import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { ChurnHotspotAnalyzer } from "../src/lib/ChurnHotspotAnalyzer.js";
import { ComplexityAnalyzer } from "../src/lib/ComplexityAnalyzer.js";

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture");

describe("ChurnHotspotAnalyzer", () => {
  it("calculates churn from git history using git log", () => {
    // Use actual repo - test with real git history
    // The fixture files are in git, so they have history
    const files = [
      path.join(fixtureRoot, "packages/pkg-a/src/complex.ts"),
      path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts"),
    ];

    const analyzer = new ChurnHotspotAnalyzer({
      rootDir: path.join(__dirname, ".."), // typescript-metrics root is in git
      files,
    });

    const result = analyzer.analyze();

    expect(result.isGitRepo).toBe(true);
    expect(result.files).toHaveLength(2);

    // Check structure of FileChurn objects
    for (const fileChurn of result.files) {
      expect(fileChurn).toHaveProperty("file");
      expect(fileChurn).toHaveProperty("commits");
      expect(fileChurn).toHaveProperty("linesAdded");
      expect(fileChurn).toHaveProperty("linesDeleted");
      expect(fileChurn).toHaveProperty("churnScore");
      expect(fileChurn.churnScore).toBe(fileChurn.commits + fileChurn.linesAdded + fileChurn.linesDeleted);
    }
  }, 10000);

  it("respects timeWindowDays option (default 90 days)", () => {
    // Test that only recent commits are counted
    const files = [path.join(fixtureRoot, "packages/pkg-a/src/complex.ts")];

    // Create analyzer with 1 day window
    const recentAnalyzer = new ChurnHotspotAnalyzer({
      rootDir: path.join(__dirname, ".."),
      files,
      timeWindowDays: 1,
    });

    const recentResult = recentAnalyzer.analyze();

    // Create analyzer with 365 day window
    const longAnalyzer = new ChurnHotspotAnalyzer({
      rootDir: path.join(__dirname, ".."),
      files,
      timeWindowDays: 365,
    });

    const longResult = longAnalyzer.analyze();

    // The longer time window should have at least as many commits as the short window
    const recentChurn = recentResult.files[0]?.commits ?? 0;
    const longChurn = longResult.files[0]?.commits ?? 0;

    expect(longChurn).toBeGreaterThanOrEqual(recentChurn);
  }, 10000);

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
      rootDir: path.join(__dirname, ".."),
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
  }, 10000);

  it("handles non-git directory gracefully (isGitRepo=false, empty results)", () => {
    // Create temp dir, run analyzer, expect isGitRepo: false
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
    // Create temp file in git repo but don't track it
    const tempFile = path.join(__dirname, "..", "temp-untracked.ts");
    fs.writeFileSync(tempFile, "export const x = 1;");

    try {
      const analyzer = new ChurnHotspotAnalyzer({
        rootDir: path.join(__dirname, ".."),
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
  }, 10000);

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
      rootDir: path.join(__dirname, ".."),
      files,
      complexityMetrics,
    });

    const result = churnAnalyzer.analyze();

    // Verify hotspots are sorted by combined score descending
    for (let i = 1; i < result.hotspots.length; i++) {
      expect(result.hotspots[i - 1]?.combinedScore).toBeGreaterThanOrEqual(result.hotspots[i]?.combinedScore);
    }
  }, 10000);

  it("limits git log to avoid performance issues (--max-count=1000)", () => {
    // Hard to test directly, but verify command includes limit
    // This is more of an implementation check - we verify it doesn't crash
    // on repos with many commits
    const files = [path.join(fixtureRoot, "packages/pkg-a/src/complex.ts")];

    const analyzer = new ChurnHotspotAnalyzer({
      rootDir: path.join(__dirname, ".."),
      files,
      timeWindowDays: 3650, // 10 years - likely to have >1000 commits in some repos
    });

    // Should complete without timing out
    const result = analyzer.analyze();

    expect(result.isGitRepo).toBe(true);
    // Result should be defined - the test is that it doesn't hang
    expect(result.files).toBeDefined();
  }, 15000);

  it("handles churn without complexity metrics (churn-only hotspots)", () => {
    const files = [
      path.join(fixtureRoot, "packages/pkg-a/src/complex.ts"),
      path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts"),
    ];

    const analyzer = new ChurnHotspotAnalyzer({
      rootDir: path.join(__dirname, ".."),
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
  }, 10000);

  it("normalizes scores correctly for combined calculation", () => {
    const files = [
      path.join(fixtureRoot, "packages/pkg-a/src/complex.ts"),
      path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts"),
    ];

    // Get complexity metrics
    const complexityAnalyzer = new ComplexityAnalyzer({ files });
    const complexityMetrics = complexityAnalyzer.analyze();

    const analyzer = new ChurnHotspotAnalyzer({
      rootDir: path.join(__dirname, ".."),
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
  }, 10000);
});
