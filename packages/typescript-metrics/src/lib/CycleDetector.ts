import type { CycleMetrics, DependencyGraph } from "../types.js";

export class CycleDetector {
  private graph: DependencyGraph;

  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }

  findSCCs(): string[][] {
    const sccs: string[][] = [];
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    let currentIndex = 0;

    const strongconnect = (node: string) => {
      index.set(node, currentIndex);
      lowlink.set(node, currentIndex);
      currentIndex++;
      stack.push(node);
      onStack.add(node);

      const neighbors = this.graph.forward.get(node) || [];
      for (const neighbor of neighbors) {
        if (!index.has(neighbor)) {
          strongconnect(neighbor);
          const nodeLowlink = lowlink.get(node);
          const neighborLowlink = lowlink.get(neighbor);
          if (nodeLowlink !== undefined && neighborLowlink !== undefined) {
            lowlink.set(node, Math.min(nodeLowlink, neighborLowlink));
          }
        } else if (onStack.has(neighbor)) {
          const nodeLowlink = lowlink.get(node);
          const neighborIndex = index.get(neighbor);
          if (nodeLowlink !== undefined && neighborIndex !== undefined) {
            lowlink.set(node, Math.min(nodeLowlink, neighborIndex));
          }
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

    return sccs;
  }

  getCircularDependencyCount(): number {
    const sccs = this.findSCCs();
    return sccs.filter((scc) => scc.length > 1).length;
  }

  getSCCSizeDistribution(): Map<number, number> {
    const sccs = this.findSCCs();
    const distribution = new Map<number, number>();
    for (const scc of sccs) {
      const size = scc.length;
      distribution.set(size, (distribution.get(size) || 0) + 1);
    }
    return distribution;
  }

  countEdgesInCycles(): number {
    const sccs = this.findSCCs().filter((scc) => scc.length > 1);
    const nodeToSCC = new Map<string, number>();

    sccs.forEach((scc, idx) => {
      for (const node of scc) {
        nodeToSCC.set(node, idx);
      }
    });

    let count = 0;
    for (const [source, targets] of this.graph.forward) {
      const sourceSCC = nodeToSCC.get(source);
      if (sourceSCC !== undefined) {
        for (const target of targets) {
          if (nodeToSCC.get(target) === sourceSCC) {
            count++;
          }
        }
      }
    }
    return count;
  }

  getCycleMetrics(): CycleMetrics {
    const sccs = this.findSCCs();
    const cycleSCCs = sccs.filter((scc) => scc.length > 1);

    const distribution: Record<number, number> = {};
    for (const scc of sccs) {
      const size = scc.length;
      distribution[size] = (distribution[size] || 0) + 1;
    }

    return {
      count: cycleSCCs.length,
      sccDistribution: distribution,
      edgesInCycles: this.countEdgesInCycles(),
      sccs: cycleSCCs,
    };
  }
}
