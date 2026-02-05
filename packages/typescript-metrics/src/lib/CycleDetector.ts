import type { CycleMetrics, DependencyGraph } from "../types.js";

export class CycleDetector {
  private graph: DependencyGraph;
  private cachedSCCs: string[][] | null = null;

  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }

  findSCCs(): string[][] {
    if (this.cachedSCCs) {
      return this.cachedSCCs;
    }

    const sccs: string[][] = [];
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    let currentIndex = 0;

    const strongconnect = (node: string): void => {
      index.set(node, currentIndex);
      lowlink.set(node, currentIndex);
      currentIndex++;
      stack.push(node);
      onStack.add(node);

      const neighbors = this.graph.forward.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (!index.has(neighbor)) {
          strongconnect(neighbor);
          const nodeLowlink = lowlink.get(node) ?? 0;
          const neighborLowlink = lowlink.get(neighbor) ?? 0;
          lowlink.set(node, Math.min(nodeLowlink, neighborLowlink));
        } else if (onStack.has(neighbor)) {
          const nodeLowlink = lowlink.get(node) ?? 0;
          const neighborIndex = index.get(neighbor) ?? 0;
          lowlink.set(node, Math.min(nodeLowlink, neighborIndex));
        }
      }

      if (lowlink.get(node) === index.get(node)) {
        const scc: string[] = [];
        let w: string | undefined;
        do {
          w = stack.pop();
          if (w !== undefined) {
            onStack.delete(w);
            scc.push(w);
          }
        } while (w !== node);
        sccs.push(scc);
      }
    };

    for (const node of this.graph.allNodes) {
      if (!index.has(node)) {
        strongconnect(node);
      }
    }

    this.cachedSCCs = sccs;
    return sccs;
  }

  getCircularDependencyCount(): number {
    return this.findSCCs().filter((scc) => scc.length > 1).length;
  }

  getSCCSizeDistribution(): Map<number, number> {
    const distribution = new Map<number, number>();
    for (const scc of this.findSCCs()) {
      const size = scc.length;
      distribution.set(size, (distribution.get(size) ?? 0) + 1);
    }
    return distribution;
  }

  countEdgesInCycles(): number {
    const cycleSCCs = this.findSCCs().filter((scc) => scc.length > 1);
    const nodeToSCCIndex = new Map<string, number>();

    for (let i = 0; i < cycleSCCs.length; i++) {
      for (const node of cycleSCCs[i]) {
        nodeToSCCIndex.set(node, i);
      }
    }

    let count = 0;
    for (const [source, targets] of this.graph.forward) {
      const sourceSCCIndex = nodeToSCCIndex.get(source);
      if (sourceSCCIndex === undefined) continue;

      for (const target of targets) {
        if (nodeToSCCIndex.get(target) === sourceSCCIndex) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Find self-loops (files that import themselves).
   */
  findSelfLoops(): string[] {
    const selfLoops: string[] = [];

    for (const [node, targets] of this.graph.forward) {
      if (targets.includes(node)) {
        selfLoops.push(node);
      }
    }

    return selfLoops;
  }

  getCycleMetrics(): CycleMetrics {
    const sccs = this.findSCCs();
    const cycleSCCs = sccs.filter((scc) => scc.length > 1);

    const distribution: Record<number, number> = {};
    for (const scc of sccs) {
      const size = scc.length;
      distribution[size] = (distribution[size] ?? 0) + 1;
    }

    // Detect type-only SCCs
    const typeOnlySccIndices = this.detectTypeOnlySCCs(cycleSCCs);

    // Detect self-loops
    const selfLoops = this.findSelfLoops();

    return {
      count: cycleSCCs.length,
      sccDistribution: distribution,
      edgesInCycles: this.countEdgesInCycles(),
      sccs: cycleSCCs,
      typeOnlySccIndices,
      selfLoops: selfLoops.length > 0 ? selfLoops : undefined,
    };
  }

  /**
   * Detects which SCCs consist entirely of type-only imports.
   * Returns indices of SCCs that are type-only.
   */
  private detectTypeOnlySCCs(cycleSCCs: string[][]): number[] {
    const typeOnlyEdges = this.graph.typeOnlyEdges;
    if (!typeOnlyEdges) {
      return [];
    }

    const typeOnlyIndices: number[] = [];

    for (let i = 0; i < cycleSCCs.length; i++) {
      const scc = cycleSCCs[i];
      const sccSet = new Set(scc);

      // Check if all edges within this SCC are type-only
      let allTypeOnly = true;

      for (const source of scc) {
        const targets = this.graph.forward.get(source) ?? [];
        for (const target of targets) {
          // Only check edges within the SCC
          if (!sccSet.has(target)) continue;

          const edgeKey = `${source}|${target}`;
          const isTypeOnly = typeOnlyEdges.get(edgeKey);

          // If any edge is not type-only (or unknown), the SCC is not type-only
          if (isTypeOnly !== true) {
            allTypeOnly = false;
            break;
          }
        }
        if (!allTypeOnly) break;
      }

      if (allTypeOnly) {
        typeOnlyIndices.push(i);
      }
    }

    return typeOnlyIndices;
  }
}
