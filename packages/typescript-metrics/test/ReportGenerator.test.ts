import { describe, expect, it } from "vitest";
import { ReportGenerator } from "../src/lib/ReportGenerator.js";
import type {
  DuplicateBlock,
  HubNode,
  MetricsResult,
  MonorepoMetrics,
  PackageLifecycle,
  WorkspacePackage,
} from "../src/types.js";

describe("ReportGenerator - Hub Table Test/Production Split", () => {
  const rootDir = "/test/root";
  const generator = new ReportGenerator(rootDir);

  const baseOptions = {
    rootDir,
    fileCount: 100,
    timestamp: "2024-01-01T00:00:00Z",
  };

  function createMetricsWithHub(hub: HubNode): MetricsResult {
    return {
      coupling: {
        modules: [],
        graphDensity: 0.05,
        hubs: [hub],
      },
      cycles: {
        count: 0,
        sccDistribution: {},
        edgesInCycles: 0,
        sccs: [],
      },
    };
  }

  it("should show '(all tests)' annotation when productionFanIn=0 and testFanIn > 0", () => {
    const hub: HubNode = {
      file: "/test/root/src/utils.ts",
      totalDegree: 15,
      fanIn: 10,
      fanOut: 5,
      productionFanIn: 0,
      testFanIn: 10,
    };

    const result = createMetricsWithHub(hub);
    const report = generator.generate(result, baseOptions);

    // The Fan-In column should show "10 (all tests)"
    expect(report).toContain("10 (all tests)");
  });

  it("should show 'X prod / Y test' format for mixed production and test dependencies", () => {
    const hub: HubNode = {
      file: "/test/root/src/utils.ts",
      totalDegree: 15,
      fanIn: 10,
      fanOut: 5,
      productionFanIn: 7,
      testFanIn: 3,
    };

    const result = createMetricsWithHub(hub);
    const report = generator.generate(result, baseOptions);

    // The Fan-In column should show "7 prod / 3 test"
    expect(report).toContain("7 prod / 3 test");
  });

  it("should preserve existing hub formatting when productionFanIn/testFanIn are undefined", () => {
    const hub: HubNode = {
      file: "/test/root/src/utils.ts",
      totalDegree: 15,
      fanIn: 10,
      fanOut: 5,
      // productionFanIn and testFanIn are undefined (backward compatibility)
    };

    const result = createMetricsWithHub(hub);
    const report = generator.generate(result, baseOptions);

    // Should show just the fanIn number without annotation
    // The table should have "| src/utils.ts | 10 |" in the Fan-In column
    expect(report).toMatch(/\|\s*src\/utils\.ts[^|]*\|\s*10\s*\|/);
  });

  it("should show just the number when productionFanIn equals fanIn (no test dependencies)", () => {
    const hub: HubNode = {
      file: "/test/root/src/utils.ts",
      totalDegree: 15,
      fanIn: 10,
      fanOut: 5,
      productionFanIn: 10,
      testFanIn: 0,
    };

    const result = createMetricsWithHub(hub);
    const report = generator.generate(result, baseOptions);

    // Should show just "10" since all dependencies are production
    expect(report).toMatch(/\|\s*src\/utils\.ts[^|]*\|\s*10\s*\|/);
    expect(report).not.toContain("(all tests)");
    expect(report).not.toContain("prod / test");
  });
});

describe("ReportGenerator - Structural Labels in Duplication Report", () => {
  const rootDir = "/test/root";
  const generator = new ReportGenerator(rootDir);

  const baseOptions = {
    rootDir,
    fileCount: 100,
    timestamp: "2024-01-01T00:00:00Z",
  };

  function createMetricsWithDuplication(blocks: DuplicateBlock[]): MetricsResult {
    return {
      duplication: {
        totalLines: 1000,
        duplicatedLines: 150,
        density: 0.15, // 15% > threshold of 10%
        blocks,
      },
    };
  }

  it("should include 'Structure' column in duplicate table header", () => {
    const block: DuplicateBlock = {
      files: [
        { file: "/test/root/src/fileA.ts", startLine: 10, endLine: 20 },
        { file: "/test/root/src/fileB.ts", startLine: 30, endLine: 40 },
      ],
      tokenCount: 150,
      fingerprint: "abc123",
    };

    const result = createMetricsWithDuplication([block]);
    const report = generator.generate(result, baseOptions);

    // Header should include Structure column
    expect(report).toContain("| Location A | Location B | Lines | Structure |");
  });

  it("should show structural label for classified blocks", () => {
    const block: DuplicateBlock = {
      files: [
        { file: "/test/root/src/fileA.ts", startLine: 10, endLine: 20 },
        { file: "/test/root/src/fileB.ts", startLine: 30, endLine: 40 },
      ],
      tokenCount: 150,
      fingerprint: "abc123",
      structuralUnit: {
        type: "function",
        label: "user validation logic",
        repetitionCount: 2,
      },
    };

    const result = createMetricsWithDuplication([block]);
    const report = generator.generate(result, baseOptions);

    // Should show the structural label in the Structure column
    expect(report).toContain("user validation logic");
  });

  it("should show '-' for unclassified blocks (no structuralUnit)", () => {
    const block: DuplicateBlock = {
      files: [
        { file: "/test/root/src/fileA.ts", startLine: 10, endLine: 20 },
        { file: "/test/root/src/fileB.ts", startLine: 30, endLine: 40 },
      ],
      tokenCount: 150,
      fingerprint: "abc123",
      // No structuralUnit field
    };

    const result = createMetricsWithDuplication([block]);
    const report = generator.generate(result, baseOptions);

    // Should show "-" for blocks without structural classification
    // The table row should end with "| - |" (with ~11 lines from endLine 20 - startLine 10 + 1)
    expect(report).toMatch(/\|\s*~11\s*\|\s*-\s*\|/);
  });

  it("should handle multiple blocks with mixed classification", () => {
    const blocks: DuplicateBlock[] = [
      {
        files: [
          { file: "/test/root/src/fileA.ts", startLine: 10, endLine: 20 },
          { file: "/test/root/src/fileB.ts", startLine: 30, endLine: 40 },
        ],
        tokenCount: 200,
        fingerprint: "abc123",
        structuralUnit: {
          type: "loop-body",
          label: "data processing loop",
          repetitionCount: 3,
        },
      },
      {
        files: [
          { file: "/test/root/src/fileC.ts", startLine: 15, endLine: 25 },
          { file: "/test/root/src/fileD.ts", startLine: 35, endLine: 45 },
        ],
        tokenCount: 150,
        fingerprint: "def456",
        // No structuralUnit
      },
    ];

    const result = createMetricsWithDuplication(blocks);
    const report = generator.generate(result, baseOptions);

    // Should show both the label and the dash
    expect(report).toContain("data processing loop");
    expect(report).toMatch(/\|\s*~11\s*\|\s*-\s*\|/);
  });
});

describe("ReportGenerator - Orphaned Package Warnings", () => {
  const rootDir = "/test/root";
  const generator = new ReportGenerator(rootDir);

  const baseOptions = {
    rootDir,
    fileCount: 100,
    packageCount: 3,
    timestamp: "2024-01-01T00:00:00Z",
  };

  function createMetricsWithOrphanedPackages(): MetricsResult {
    const packages: WorkspacePackage[] = [
      {
        name: "@test/pkg-a",
        dir: "/test/root/packages/pkg-a",
        relativeDir: "packages/pkg-a",
        packageJson: { name: "@test/pkg-a", version: "1.0.0", private: true },
      },
      {
        name: "@test/pkg-orphaned",
        dir: "/test/root/packages/pkg-orphaned",
        relativeDir: "packages/pkg-orphaned",
        packageJson: { name: "@test/pkg-orphaned", version: "1.0.0", private: true },
      },
    ];

    const packageLifecycles = new Map<string, PackageLifecycle>([
      [
        "@test/pkg-a",
        {
          isPrivate: true,
          consumerCount: 2,
          state: "active",
        },
      ],
      [
        "@test/pkg-orphaned",
        {
          isPrivate: true,
          consumerCount: 0,
          state: "orphaned",
        },
      ],
    ]);

    const monorepo: MonorepoMetrics = {
      packages,
      apiSurfaces: new Map(),
      importBreakdowns: new Map(),
      crossBoundaryMatrix: new Map(),
      dependencyDepth: 1,
      packageLifecycles,
    };

    return {
      monorepo,
    };
  }

  it("should show orphaned package warning in issues section", () => {
    const result = createMetricsWithOrphanedPackages();
    const report = generator.generate(result, baseOptions);

    // Should have a warning about orphaned packages
    expect(report).toContain("Orphaned");
    expect(report).toContain("@test/pkg-orphaned");
    expect(report).toContain("consider deletion");
  });

  it("should annotate duplicate blocks in orphaned packages with deletion note", () => {
    const result = createMetricsWithOrphanedPackages();

    // Add duplication data
    const blocks: DuplicateBlock[] = [
      {
        files: [
          { file: "/test/root/packages/pkg-orphaned/src/fileA.ts", startLine: 10, endLine: 20 },
          { file: "/test/root/packages/pkg-a/src/fileB.ts", startLine: 30, endLine: 40 },
        ],
        tokenCount: 150,
        fingerprint: "abc123",
      },
    ];

    result.duplication = {
      totalLines: 1000,
      duplicatedLines: 150,
      density: 0.15,
      blocks,
    };

    const report = generator.generate(result, baseOptions);

    // Should annotate the orphaned package file with deletion note
    expect(report).toContain("(orphaned — consider deletion)");
  });

  it("should not annotate active package files with orphaned note", () => {
    const result = createMetricsWithOrphanedPackages();

    const blocks: DuplicateBlock[] = [
      {
        files: [
          { file: "/test/root/packages/pkg-a/src/fileA.ts", startLine: 10, endLine: 20 },
          { file: "/test/root/packages/pkg-a/src/fileB.ts", startLine: 30, endLine: 40 },
        ],
        tokenCount: 150,
        fingerprint: "abc123",
      },
    ];

    result.duplication = {
      totalLines: 1000,
      duplicatedLines: 150,
      density: 0.15,
      blocks,
    };

    const report = generator.generate(result, baseOptions);

    // Active packages should not have the orphaned annotation
    const pkgALines = report.split("\n").filter((line) => line.includes("packages/pkg-a"));
    for (const line of pkgALines) {
      expect(line).not.toContain("(orphaned — consider deletion)");
    }
  });
});
