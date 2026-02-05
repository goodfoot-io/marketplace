import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { CycleDetector } from "../src/lib/CycleDetector.js";
import { DependencyGraphAnalyzer } from "../src/lib/DependencyGraphAnalyzer.js";
import type { DependencyGraph } from "../src/types.js";

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture");

describe("CycleDetector", () => {
  it("should return empty result for DAG (no cycles)", () => {
    // Create a simple DAG: A -> B -> C
    const graph: DependencyGraph = {
      forward: new Map([
        ["A", ["B"]],
        ["B", ["C"]],
        ["C", []],
      ]),
      reverse: new Map([
        ["A", []],
        ["B", ["A"]],
        ["C", ["B"]],
      ]),
      allNodes: new Set(["A", "B", "C"]),
    };

    const detector = new CycleDetector(graph);
    const metrics = detector.getCycleMetrics();

    expect(metrics.count).toBe(0);
    expect(metrics.sccs).toEqual([]);
    expect(metrics.edgesInCycles).toBe(0);
  });

  it("should detect single 2-node cycle (A ↔ B)", async () => {
    // Test with actual fixture files
    const pkgBRoot = path.join(fixtureRoot, "packages/pkg-b");
    const analyzer = new DependencyGraphAnalyzer({
      rootDir: pkgBRoot,
      includeExternal: false,
    });

    const graph = await analyzer.buildGraph();
    const detector = new CycleDetector(graph);
    const metrics = detector.getCycleMetrics();

    // Should find exactly 1 cycle (cycle-a ↔ cycle-b)
    expect(metrics.count).toBe(1);
    expect(metrics.sccs.length).toBe(1);

    // The SCC should contain both cycle files
    const cycleNodes = metrics.sccs[0];
    expect(cycleNodes.length).toBe(2);

    // Check that both cycle files are in the SCC (order doesn't matter)
    const hasCycleA = cycleNodes.some((node) => node.includes("cycle-a"));
    const hasCycleB = cycleNodes.some((node) => node.includes("cycle-b"));
    expect(hasCycleA).toBe(true);
    expect(hasCycleB).toBe(true);

    // Should have 2 edges in the cycle (A->B and B->A)
    expect(metrics.edgesInCycles).toBe(2);
  });

  it("should detect self-referential import (A → A) as SCC of size 1", () => {
    // Self-loop: A imports itself
    const graph: DependencyGraph = {
      forward: new Map([["A", ["A"]]]),
      reverse: new Map([["A", ["A"]]]),
      allNodes: new Set(["A"]),
    };

    const detector = new CycleDetector(graph);
    const sccs = detector.findSCCs();

    // Should find one SCC of size 1
    expect(sccs.length).toBe(1);
    expect(sccs[0]).toEqual(["A"]);

    // But circular dependency count should be 0 (size must be > 1)
    expect(detector.getCircularDependencyCount()).toBe(0);
  });

  it("should detect multiple overlapping SCCs", () => {
    // Two separate cycles: (A ↔ B) and (C ↔ D)
    const graph: DependencyGraph = {
      forward: new Map([
        ["A", ["B"]],
        ["B", ["A"]],
        ["C", ["D"]],
        ["D", ["C"]],
      ]),
      reverse: new Map([
        ["A", ["B"]],
        ["B", ["A"]],
        ["C", ["D"]],
        ["D", ["C"]],
      ]),
      allNodes: new Set(["A", "B", "C", "D"]),
    };

    const detector = new CycleDetector(graph);
    const metrics = detector.getCycleMetrics();

    expect(metrics.count).toBe(2);
    expect(metrics.sccs.length).toBe(2);

    // Each SCC should have 2 nodes
    for (const scc of metrics.sccs) {
      expect(scc.length).toBe(2);
    }

    // Total edges in cycles: 4 (2 per cycle)
    expect(metrics.edgesInCycles).toBe(4);
  });

  it("should detect complex multi-node cycle (A → B → C → A)", () => {
    // 3-node cycle
    const graph: DependencyGraph = {
      forward: new Map([
        ["A", ["B"]],
        ["B", ["C"]],
        ["C", ["A"]],
      ]),
      reverse: new Map([
        ["A", ["C"]],
        ["B", ["A"]],
        ["C", ["B"]],
      ]),
      allNodes: new Set(["A", "B", "C"]),
    };

    const detector = new CycleDetector(graph);
    const metrics = detector.getCycleMetrics();

    expect(metrics.count).toBe(1);
    expect(metrics.sccs.length).toBe(1);
    expect(metrics.sccs[0].length).toBe(3);

    // Should contain all three nodes
    const scc = metrics.sccs[0];
    expect(scc).toContain("A");
    expect(scc).toContain("B");
    expect(scc).toContain("C");

    // 3 edges in the cycle
    expect(metrics.edgesInCycles).toBe(3);
  });

  it("should count only SCCs with size > 1 as circular dependencies", () => {
    // Mix of single nodes and a cycle
    const graph: DependencyGraph = {
      forward: new Map([
        ["A", ["B"]],
        ["B", ["A"]],
        ["C", []],
        ["D", []],
      ]),
      reverse: new Map([
        ["A", ["B"]],
        ["B", ["A"]],
        ["C", []],
        ["D", []],
      ]),
      allNodes: new Set(["A", "B", "C", "D"]),
    };

    const detector = new CycleDetector(graph);
    const sccs = detector.findSCCs();

    // Should find 3 or 4 SCCs total (depending on if C and D are separate)
    expect(sccs.length).toBeGreaterThanOrEqual(3);

    // But only 1 should count as a circular dependency
    expect(detector.getCircularDependencyCount()).toBe(1);
  });

  it("should build correct SCC size distribution", () => {
    // 1 cycle of size 2, 1 cycle of size 3, and 2 isolated nodes
    const graph: DependencyGraph = {
      forward: new Map([
        ["A", ["B"]],
        ["B", ["A"]],
        ["C", ["D"]],
        ["D", ["E"]],
        ["E", ["C"]],
        ["F", []],
        ["G", []],
      ]),
      reverse: new Map([
        ["A", ["B"]],
        ["B", ["A"]],
        ["C", ["E"]],
        ["D", ["C"]],
        ["E", ["D"]],
        ["F", []],
        ["G", []],
      ]),
      allNodes: new Set(["A", "B", "C", "D", "E", "F", "G"]),
    };

    const detector = new CycleDetector(graph);
    const distribution = detector.getSCCSizeDistribution();

    // Should have SCCs of size 1, 2, and 3
    expect(distribution.get(1)).toBe(2); // F and G
    expect(distribution.get(2)).toBe(1); // A-B cycle
    expect(distribution.get(3)).toBe(1); // C-D-E cycle
  });

  it("should count edges where both endpoints are in same SCC", () => {
    // 2-node cycle with explicit edge count check
    const graph: DependencyGraph = {
      forward: new Map([
        ["A", ["B"]],
        ["B", ["A"]],
      ]),
      reverse: new Map([
        ["A", ["B"]],
        ["B", ["A"]],
      ]),
      allNodes: new Set(["A", "B"]),
    };

    const detector = new CycleDetector(graph);

    // For a 2-node cycle: A->B and B->A = 2 edges
    expect(detector.countEdgesInCycles()).toBe(2);

    // Verify this through getCycleMetrics as well
    const metrics = detector.getCycleMetrics();
    expect(metrics.edgesInCycles).toBe(2);
  });

  it("should not count edges outside of cycles", () => {
    // A -> B (cycle), C -> A (external edge into cycle)
    const graph: DependencyGraph = {
      forward: new Map([
        ["A", ["B"]],
        ["B", ["A"]],
        ["C", ["A"]], // Edge from outside the cycle
      ]),
      reverse: new Map([
        ["A", ["B", "C"]],
        ["B", ["A"]],
        ["C", []],
      ]),
      allNodes: new Set(["A", "B", "C"]),
    };

    const detector = new CycleDetector(graph);

    // Only the 2 edges within the A-B cycle should count
    expect(detector.countEdgesInCycles()).toBe(2);

    // C is in its own SCC of size 1
    expect(detector.getCircularDependencyCount()).toBe(1);
  });
});
