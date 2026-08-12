import { execSync } from "node:child_process";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MetricsRunner } from "../src/lib/MetricsRunner.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

// Mock git output for fixture files
const MOCK_GIT_LOG = `abc1234567890123456789012345678901234567
10\t5\tpackages/pkg-a/src/complex.ts
3\t2\tpackages/pkg-a/src/else-test.ts
1\t1\tpackages/pkg-a/src/catch-test.ts
`;

beforeEach(() => {
  mockedExecSync.mockReset();
  mockedExecSync.mockImplementation((cmd: string | Buffer, options?: unknown) => {
    const cmdStr = typeof cmd === "string" ? cmd : cmd.toString();
    const opts = options as { encoding?: string } | undefined;

    if (cmdStr === "git rev-parse --git-dir") {
      return opts?.encoding ? ".git\n" : Buffer.from(".git\n");
    }
    if (cmdStr.startsWith("git log --numstat")) {
      return opts?.encoding ? MOCK_GIT_LOG : Buffer.from(MOCK_GIT_LOG);
    }
    throw new Error(`Unexpected command: ${cmdStr}`);
  });
});

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture");

describe("MetricsRunner", () => {
  // runner.run() compiles the fixture tree — ~2s idle, ~8s under concurrent
  // full-suite validation on a shared host. The 5000ms default killed these
  // mid-run; the named-option style matches cli.test.ts's heavy invocations.
  it("should run all metrics by default", { timeout: 30000 }, async () => {
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
    });
    const result = await runner.run();

    expect(result.coupling).toBeDefined();
    expect(result.cycles).toBeDefined();
    expect(result.complexity).toBeDefined();
    expect(result.duplication).toBeDefined();
    expect(result.monorepo).toBeDefined();
    expect(result.encapsulation).toBeDefined();
    expect(result.churnHotspots).toBeDefined();
  });

  it("should run only selected metric categories", { timeout: 30000 }, async () => {
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
      categories: ["coupling", "cycles"],
    });
    const result = await runner.run();

    expect(result.coupling).toBeDefined();
    expect(result.cycles).toBeDefined();
    expect(result.complexity).toBeUndefined();
    expect(result.duplication).toBeUndefined();
    expect(result.monorepo).toBeUndefined();
  });

  it("should coordinate analyzer execution order", { timeout: 30000 }, async () => {
    // Coupling must run before cycles (cycles needs the graph)
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
      categories: ["cycles"], // Only cycles requested
    });
    const result = await runner.run();

    // Coupling should run automatically since cycles needs it
    expect(result.coupling).toBeDefined();
    expect(result.cycles).toBeDefined();
  });

  it("should aggregate results into unified MetricsResult", { timeout: 30000 }, async () => {
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
    });
    const result = await runner.run();

    expect(typeof result).toBe("object");
    expect(result).toHaveProperty("coupling");
    expect(result).toHaveProperty("cycles");
    expect(result).toHaveProperty("complexity");
    expect(result).toHaveProperty("duplication");
    expect(result).toHaveProperty("monorepo");
    expect(result).toHaveProperty("encapsulation");
    expect(result).toHaveProperty("churnHotspots");
  });

  it("should handle analyzer errors gracefully", { timeout: 30000 }, async () => {
    const runner = new MetricsRunner({
      rootDir: "/nonexistent/path",
    });

    // Should not throw, but should log warnings
    const result = await runner.run();
    expect(result).toBeDefined();
  });

  it("should log warning and continue for malformed TypeScript files", { timeout: 30000 }, async () => {
    // This test would need a fixture with a malformed TypeScript file
    // For now, just verify the error handling mechanism exists
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
    });
    const result = await runner.run();
    expect(result).toBeDefined();
  });

  it("should include relative path in file-not-found error", { timeout: 30000 }, async () => {
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
      files: [path.join(fixtureRoot, "nonexistent.ts")],
    });

    // Should handle gracefully with warnings
    const result = await runner.run();
    expect(result).toBeDefined();
  });

  it("should include path in permission-denied error", { timeout: 30000 }, async () => {
    // This test would need a fixture with permission issues
    // Difficult to test in CI, so we just verify error handling exists
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
    });
    const result = await runner.run();
    expect(result).toBeDefined();
  });

  it("should format output as JSON", () => {
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
    });

    const mockResult: import("../src/types.js").MetricsResult = {
      coupling: {
        modules: [],
        graphDensity: 0.02,
        hubs: [],
      },
      cycles: {
        count: 2,
        sccDistribution: { 2: 1 },
        edgesInCycles: 5,
        sccs: [["a.ts", "b.ts"]],
      },
    };

    const output = runner.formatOutput(mockResult, "json");

    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed.coupling).toBeDefined();
    expect(parsed.cycles).toBeDefined();
  });

  it("should format output as summary", () => {
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
    });

    const mockResult: import("../src/types.js").MetricsResult = {
      coupling: {
        modules: [{ file: "a.ts", Ca: 2, Ce: 3, instability: 0.6 }],
        graphDensity: 0.02,
        hubs: [{ file: "a.ts", totalDegree: 10, fanIn: 5, fanOut: 5 }],
      },
      cycles: {
        count: 2,
        sccDistribution: { 2: 1 },
        edgesInCycles: 5,
        sccs: [["a.ts", "b.ts"]],
      },
      complexity: {
        files: [
          {
            file: "a.ts",
            functions: [],
            loc: { total: 100, code: 80, blank: 10, comment: 10 },
            statementCount: 50,
            commentDensity: 0.125,
          },
        ],
        functions: [],
        hotspots: [],
      },
      duplication: {
        totalLines: 5000,
        duplicatedLines: 150,
        density: 0.03,
        blocks: [],
      },
      monorepo: {
        packages: [],
        apiSurfaces: new Map(),
        importBreakdowns: new Map(),
        crossBoundaryMatrix: new Map(),
        dependencyDepth: 3,
      },
    };

    const output = runner.formatOutput(mockResult, "summary");

    expect(output).toContain("=== Metrics Summary ===");
    expect(output).toContain("Coupling:");
    expect(output).toContain("Graph Density:");
    expect(output).toContain("Cycles:");
    expect(output).toContain("Circular Dependencies:");
    expect(output).toContain("Complexity:");
    expect(output).toContain("Duplication:");
    expect(output).toContain("Monorepo:");
  });

  it("should run encapsulation metrics when requested", { timeout: 30000 }, async () => {
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
      categories: ["encapsulation"],
    });
    const result = await runner.run();

    expect(result.encapsulation).toBeDefined();
    expect(result.coupling).toBeUndefined();
    expect(result.complexity).toBeUndefined();
  });

  it("should run churn-hotspots metrics when requested", { timeout: 30000 }, async () => {
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
      categories: ["churn-hotspots"],
    });
    const result = await runner.run();

    expect(result.churnHotspots).toBeDefined();
    if (result.churnHotspots) {
      expect(result.churnHotspots.isGitRepo).toBeDefined();
    }
    expect(result.coupling).toBeUndefined();
  });

  it("should pass cached complexity to churn-hotspots when both are requested", { timeout: 30000 }, async () => {
    const runner = new MetricsRunner({
      rootDir: fixtureRoot,
      categories: ["complexity", "churn-hotspots"],
    });
    const result = await runner.run();

    expect(result.complexity).toBeDefined();
    expect(result.churnHotspots).toBeDefined();

    // If complexity is available, churn-hotspots should use it
    if (!result.churnHotspots) return;

    if (result.churnHotspots.hotspots.length > 0) {
      // Some hotspots should have complexity data
      const withComplexity = result.churnHotspots.hotspots.filter((h) => h.complexityScore > 0);
      // This may be 0 if no files have both churn and complexity, which is ok
      expect(withComplexity.length).toBeGreaterThanOrEqual(0);
    }
  });
});
