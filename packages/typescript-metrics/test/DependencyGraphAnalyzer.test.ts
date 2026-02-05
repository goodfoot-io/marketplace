import * as path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DependencyGraphAnalyzer } from "../src/lib/DependencyGraphAnalyzer.js";
import type { DependencyGraph } from "../src/types.js";

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture/packages/pkg-a");

describe("DependencyGraphAnalyzer", () => {
  let analyzer: DependencyGraphAnalyzer;
  let graph: DependencyGraph;

  beforeAll(async () => {
    analyzer = new DependencyGraphAnalyzer({
      rootDir: fixtureRoot,
      tsConfigPath: path.join(fixtureRoot, "tsconfig.json"),
    });
    graph = await analyzer.buildGraph();
  });

  it("should build dependency graph from TypeScript files", async () => {
    // Test buildGraph returns correct structure
    expect(graph).toBeDefined();
    expect(graph.forward).toBeInstanceOf(Map);
    expect(graph.reverse).toBeInstanceOf(Map);
    expect(graph.allNodes).toBeInstanceOf(Set);

    // pkg-a has 7 files: index.ts, internal.ts, complex.ts, else-test.ts, logical-ops.ts, catch-test.ts, encapsulation-test.ts
    expect(graph.allNodes.size).toBe(7);

    // index.ts imports 4 files
    const indexPath = path.join(fixtureRoot, "src/index.ts");
    expect(graph.forward.has(indexPath)).toBe(true);
    expect(graph.forward.get(indexPath)?.length).toBe(4);
  });

  it("should calculate afferent coupling (Ca) correctly", () => {
    // Ca = number of files that import this file (fan-in)
    // internal.ts should have Ca=1 (imported by index.ts)
    const coupling = analyzer.calculateCoupling();
    const internalCoupling = coupling.find((c) => c.file.endsWith("internal.ts"));

    expect(internalCoupling).toBeDefined();
    expect(internalCoupling?.Ca).toBe(1);
  });

  it("should calculate efferent coupling (Ce) correctly", () => {
    // Ce = number of files this file imports (fan-out)
    // index.ts should have Ce=4 (imports internal, complex, else-test, logical-ops)
    const coupling = analyzer.calculateCoupling();
    const indexCoupling = coupling.find((c) => c.file.endsWith("index.ts"));

    expect(indexCoupling).toBeDefined();
    expect(indexCoupling?.Ce).toBe(4);
  });

  it("should calculate instability I = Ce/(Ca+Ce)", () => {
    // Instability ranges from 0 (stable) to 1 (unstable)
    const coupling = analyzer.calculateCoupling();

    // internal.ts has Ca=1, Ce=0, so I = 0/(1+0) = 0
    const internalCoupling = coupling.find((c) => c.file.endsWith("internal.ts"));
    expect(internalCoupling?.instability).toBe(0);

    // index.ts has Ca=0, Ce=4, so I = 4/(0+4) = 1
    const indexCoupling = coupling.find((c) => c.file.endsWith("index.ts"));
    expect(indexCoupling?.instability).toBe(1);
  });

  it("should calculate graph density", () => {
    // density = edges / (nodes * (nodes - 1))
    // pkg-a: 7 nodes, 4 edges (index imports 4 files)
    // density = 4 / (7 * 6) = 4/42 = 0.0952...
    const density = analyzer.calculateGraphDensity();
    expect(density).toBeCloseTo(4 / 42, 4);
  });

  it("should find top-k hub nodes", () => {
    // Hub = node with highest total degree (fanIn + fanOut)
    const hubs = analyzer.findHubs(3);

    expect(hubs.length).toBeLessThanOrEqual(3);
    expect(hubs.length).toBeGreaterThan(0);

    // index.ts should be top hub with degree 4 (0 fanIn + 4 fanOut)
    expect(hubs[0].file.endsWith("index.ts")).toBe(true);
    expect(hubs[0].totalDegree).toBe(4);
    expect(hubs[0].fanIn).toBe(0);
    expect(hubs[0].fanOut).toBe(4);
  });

  it("should calculate average path length", () => {
    // Average of all shortest paths between all pairs
    // For pkg-a, paths exist from index.ts to its 4 imports (length 1 each)
    // No paths from leaf nodes to others
    const avgPathLength = analyzer.calculateAveragePathLength();

    // Should be a positive number (at least 1)
    expect(avgPathLength).toBeGreaterThanOrEqual(1);
    expect(avgPathLength).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  it("should calculate diameter and return longest path", () => {
    // Diameter = maximum shortest path length
    // In pkg-a, all paths are length 1 (index.ts -> import)
    const result = analyzer.calculateDiameter();

    expect(result.length).toBe(1);
    expect(result.longestPath.length).toBe(2); // source and target
    expect(result.longestPath[0].endsWith("index.ts")).toBe(true);
  });

  it("should calculate directionality with custom layers", () => {
    // Percentage of edges respecting layer order
    // Define layers: index (app layer) should import from internal (shared layer)
    const layers = ["internal", "complex", "else-test", "logical-ops", "catch-test", "index"];
    const result = analyzer.calculateDirectionality(layers);

    // All 4 edges in pkg-a go from index to lower layers, so 100% compliance
    expect(result.percentage).toBe(100);
    expect(result.violations.length).toBe(0);
  });

  it("should report violating edges for directionality", () => {
    // Return list of edges that violate layer order
    // Test with reversed layers - all edges should violate
    const layers = ["index", "internal", "complex", "else-test", "logical-ops", "catch-test"];
    const result = analyzer.calculateDirectionality(layers);

    // With index first (lowest), all imports from index violate
    expect(result.percentage).toBe(0);
    expect(result.violations.length).toBe(4);
  });
});
