import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChurnHotspotAnalyzer } from "../src/lib/ChurnHotspotAnalyzer.js";
import { ComplexityAnalyzer } from "../src/lib/ComplexityAnalyzer.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture");

// Mock git output for fixtures
// Git paths are relative to the rootDir (fixtureRoot), so they don't include "test/fixtures/monorepo-fixture"
const MOCK_GIT_LOG = `abc1234567890123456789012345678901234567
10\t5\tpackages/pkg-a/src/complex.ts
3\t2\tpackages/pkg-a/src/else-test.ts
1\t1\tpackages/pkg-a/src/catch-test.ts

def2345678901234567890123456789012345678
5\t3\tpackages/pkg-a/src/complex.ts
2\t1\tpackages/pkg-a/src/else-test.ts
`;

// Git log for 1-day window (only recent commit)
const MOCK_GIT_LOG_1DAY = `def2345678901234567890123456789012345678
5\t3\tpackages/pkg-a/src/complex.ts
2\t1\tpackages/pkg-a/src/else-test.ts
`;

// Git log for 365-day window (all commits)
const MOCK_GIT_LOG_365DAY = `abc1234567890123456789012345678901234567
10\t5\tpackages/pkg-a/src/complex.ts
3\t2\tpackages/pkg-a/src/else-test.ts
1\t1\tpackages/pkg-a/src/catch-test.ts

def2345678901234567890123456789012345678
5\t3\tpackages/pkg-a/src/complex.ts
2\t1\tpackages/pkg-a/src/else-test.ts

eee3456789012345678901234567890123456789
2\t1\tpackages/pkg-a/src/complex.ts
`;

describe("ChurnHotspotAnalyzer", () => {
  beforeEach(() => {
    mockedExecSync.mockReset();
    // Default: simulate git repo with known history
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd === "git rev-parse --git-dir") {
        return ".git\n";
      }
      if (cmd.startsWith("git log --numstat")) {
        return MOCK_GIT_LOG;
      }
      throw new Error(`Unexpected command: ${cmd}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calculates churn from git history using git log", () => {
    // Test with mocked git history
    const files = [
      path.join(fixtureRoot, "packages/pkg-a/src/complex.ts"),
      path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts"),
    ];

    const analyzer = new ChurnHotspotAnalyzer({
      rootDir: fixtureRoot,
      files,
    });

    const result = analyzer.analyze();

    expect(result.isGitRepo).toBe(true);
    expect(result.files).toHaveLength(2);

    // complex.ts: 2 commits, 15 lines added (10+5), 8 lines deleted (5+3), churnScore = 25
    const complexFile = result.files.find((f) => f.file.includes("complex.ts"));
    expect(complexFile).toBeDefined();
    expect(complexFile?.commits).toBe(2);
    expect(complexFile?.linesAdded).toBe(15);
    expect(complexFile?.linesDeleted).toBe(8);
    expect(complexFile?.churnScore).toBe(25);

    // else-test.ts: 2 commits, 5 lines added (3+2), 3 lines deleted (2+1), churnScore = 10
    const elseTestFile = result.files.find((f) => f.file.includes("else-test.ts"));
    expect(elseTestFile).toBeDefined();
    expect(elseTestFile?.commits).toBe(2);
    expect(elseTestFile?.linesAdded).toBe(5);
    expect(elseTestFile?.linesDeleted).toBe(3);
    expect(elseTestFile?.churnScore).toBe(10);

    // Check structure of FileChurn objects
    for (const fileChurn of result.files) {
      expect(fileChurn).toHaveProperty("file");
      expect(fileChurn).toHaveProperty("commits");
      expect(fileChurn).toHaveProperty("linesAdded");
      expect(fileChurn).toHaveProperty("linesDeleted");
      expect(fileChurn).toHaveProperty("churnScore");
      expect(fileChurn.churnScore).toBe(fileChurn.commits + fileChurn.linesAdded + fileChurn.linesDeleted);
    }
  });

  it("respects timeWindowDays option (default 90 days)", () => {
    const files = [path.join(fixtureRoot, "packages/pkg-a/src/complex.ts")];

    // First analyze with 1 day window
    mockedExecSync.mockReset();
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd === "git rev-parse --git-dir") {
        return ".git\n";
      }
      if (cmd.startsWith("git log --numstat")) {
        return MOCK_GIT_LOG_1DAY; // Only 1 commit
      }
      throw new Error(`Unexpected command: ${cmd}`);
    });

    const recentAnalyzer = new ChurnHotspotAnalyzer({
      rootDir: fixtureRoot,
      files,
      timeWindowDays: 1,
    });

    const recentResult = recentAnalyzer.analyze();
    const recentChurn = recentResult.files[0]?.commits ?? 0;

    // Then analyze with 365 day window
    mockedExecSync.mockReset();
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd === "git rev-parse --git-dir") {
        return ".git\n";
      }
      if (cmd.startsWith("git log --numstat")) {
        return MOCK_GIT_LOG_365DAY; // All 3 commits
      }
      throw new Error(`Unexpected command: ${cmd}`);
    });

    const longAnalyzer = new ChurnHotspotAnalyzer({
      rootDir: fixtureRoot,
      files,
      timeWindowDays: 365,
    });

    const longResult = longAnalyzer.analyze();
    const longChurn = longResult.files[0]?.commits ?? 0;

    // The longer time window should have more commits than the short window
    expect(recentChurn).toBe(1); // Only 1 commit in 1-day window
    expect(longChurn).toBe(3); // All 3 commits in 365-day window
    expect(longChurn).toBeGreaterThan(recentChurn);
  });

  it("combines churn with provided complexityMetrics to identify hotspots", () => {
    // Pass mock complexityMetrics, verify hotspots calculated
    const files = [
      path.join(fixtureRoot, "packages/pkg-a/src/complex.ts"),
      path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts"),
    ];

    // First get complexity metrics
    const complexityAnalyzer = new ComplexityAnalyzer({ files });
    const complexityMetrics = complexityAnalyzer.analyze();

    // Now run churn analysis with complexity metrics
    const churnAnalyzer = new ChurnHotspotAnalyzer({
      rootDir: fixtureRoot,
      files,
      complexityMetrics,
    });

    const result = churnAnalyzer.analyze();

    expect(result.hotspots.length).toBeGreaterThan(0);

    // Check structure of Hotspot objects
    for (const hotspot of result.hotspots) {
      expect(hotspot).toHaveProperty("file");
      expect(hotspot).toHaveProperty("churnScore");
      expect(hotspot).toHaveProperty("complexityScore");
      expect(hotspot).toHaveProperty("combinedScore");

      // If complexity metrics were provided, we should have complexity scores
      if (hotspot.complexityScore > 0) {
        expect(hotspot).toHaveProperty("cyclomatic");
        expect(hotspot).toHaveProperty("cognitive");
      }
    }
  });

  it("handles non-git directory gracefully (isGitRepo=false, empty results)", () => {
    // Mock git rev-parse to throw (non-git directory)
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd === "git rev-parse --git-dir") {
        throw new Error("fatal: not a git repository");
      }
      throw new Error(`Unexpected command: ${cmd}`);
    });

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "churn-test-"));
    const testFile = path.join(tempDir, "test.ts");
    fs.writeFileSync(testFile, "export const x = 1;");

    try {
      const analyzer = new ChurnHotspotAnalyzer({
        rootDir: tempDir,
        files: [testFile],
      });

      const result = analyzer.analyze();

      expect(result.isGitRepo).toBe(false);
      expect(result.files).toEqual([]);
      expect(result.hotspots).toEqual([]);
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("handles files not tracked by git (churn=0)", () => {
    // Mock git output without the untracked file
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd === "git rev-parse --git-dir") {
        return ".git\n";
      }
      if (cmd.startsWith("git log --numstat")) {
        // Return empty log (file not in git history)
        return "";
      }
      throw new Error(`Unexpected command: ${cmd}`);
    });

    // Create temp file in git repo but don't track it
    const tempFile = path.join(__dirname, "..", "temp-untracked.ts");
    fs.writeFileSync(tempFile, "export const x = 1;");

    try {
      const analyzer = new ChurnHotspotAnalyzer({
        rootDir: fixtureRoot,
        files: [tempFile],
      });

      const result = analyzer.analyze();

      expect(result.isGitRepo).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.churnScore).toBe(0);
      expect(result.files[0]?.commits).toBe(0);
      expect(result.files[0]?.linesAdded).toBe(0);
      expect(result.files[0]?.linesDeleted).toBe(0);
    } finally {
      // Clean up
      fs.rmSync(tempFile, { force: true });
    }
  });

  it("ranks hotspots by combined score (churn * complexity normalized)", () => {
    // Verify sorting
    const files = [
      path.join(fixtureRoot, "packages/pkg-a/src/complex.ts"),
      path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts"),
      path.join(fixtureRoot, "packages/pkg-a/src/catch-test.ts"),
    ];

    // Get complexity metrics
    const complexityAnalyzer = new ComplexityAnalyzer({ files });
    const complexityMetrics = complexityAnalyzer.analyze();

    // Run churn analysis
    const churnAnalyzer = new ChurnHotspotAnalyzer({
      rootDir: fixtureRoot,
      files,
      complexityMetrics,
    });

    const result = churnAnalyzer.analyze();

    // Verify hotspots are sorted by combined score descending
    for (let i = 1; i < result.hotspots.length; i++) {
      expect(result.hotspots[i - 1]?.combinedScore).toBeGreaterThanOrEqual(result.hotspots[i]?.combinedScore);
    }
  });

  it("limits git log to avoid performance issues (--max-count=1000)", () => {
    // Verify command includes --max-count=1000
    let capturedCommand = "";
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd === "git rev-parse --git-dir") {
        return ".git\n";
      }
      if (cmd.startsWith("git log --numstat")) {
        capturedCommand = cmd;
        expect(cmd).toContain("--max-count=1000");
        return MOCK_GIT_LOG;
      }
      throw new Error(`Unexpected command: ${cmd}`);
    });

    const files = [path.join(fixtureRoot, "packages/pkg-a/src/complex.ts")];

    const analyzer = new ChurnHotspotAnalyzer({
      rootDir: fixtureRoot,
      files,
      timeWindowDays: 3650, // 10 years - likely to have >1000 commits in some repos
    });

    // Should complete without timing out
    const result = analyzer.analyze();

    expect(result.isGitRepo).toBe(true);
    expect(result.files).toBeDefined();
    expect(capturedCommand).toContain("--max-count=1000");
  });

  it("handles churn without complexity metrics (churn-only hotspots)", () => {
    const files = [
      path.join(fixtureRoot, "packages/pkg-a/src/complex.ts"),
      path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts"),
    ];

    const analyzer = new ChurnHotspotAnalyzer({
      rootDir: fixtureRoot,
      files,
      // No complexityMetrics provided
    });

    const result = analyzer.analyze();

    // Hotspots should be based on churn alone
    for (const hotspot of result.hotspots) {
      expect(hotspot.complexityScore).toBe(0);
      expect(hotspot.combinedScore).toBe(hotspot.churnScore);
      expect(hotspot.cyclomatic).toBeUndefined();
      expect(hotspot.cognitive).toBeUndefined();
    }

    // Should be sorted by churn score
    for (let i = 1; i < result.hotspots.length; i++) {
      expect(result.hotspots[i - 1]?.churnScore).toBeGreaterThanOrEqual(result.hotspots[i]?.churnScore);
    }
  });

  it("normalizes scores correctly for combined calculation", () => {
    const files = [
      path.join(fixtureRoot, "packages/pkg-a/src/complex.ts"),
      path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts"),
    ];

    // Get complexity metrics
    const complexityAnalyzer = new ComplexityAnalyzer({ files });
    const complexityMetrics = complexityAnalyzer.analyze();

    const analyzer = new ChurnHotspotAnalyzer({
      rootDir: fixtureRoot,
      files,
      complexityMetrics,
    });

    const result = analyzer.analyze();

    // If we have hotspots with both churn and complexity
    const hotspotsWithBoth = result.hotspots.filter((h) => h.churnScore > 0 && h.complexityScore > 0);

    if (hotspotsWithBoth.length > 0) {
      // Combined score should be between 0 and 1 for normalized values
      for (const hotspot of hotspotsWithBoth) {
        expect(hotspot.combinedScore).toBeGreaterThanOrEqual(0);
        expect(hotspot.combinedScore).toBeLessThanOrEqual(1);
      }
    }
  });
});
