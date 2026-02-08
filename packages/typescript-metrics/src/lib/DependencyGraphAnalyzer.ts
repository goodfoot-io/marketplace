import * as path from "node:path";
import { glob } from "glob";
import * as ts from "typescript";
import type {
  DependencyGraph,
  DependencyGraphOptions,
  DiameterResult,
  DirectionalityResult,
  HubNode,
  ModuleCoupling,
} from "../types.js";

export class DependencyGraphAnalyzer {
  private options: DependencyGraphOptions;
  private graph: DependencyGraph | null = null;

  constructor(options: DependencyGraphOptions) {
    this.options = options;
  }

  /**
   * Extract import/export references from a source file, tracking if they are type-only
   */
  private extractReferencedFiles(sourceFile: ts.SourceFile): Array<{ moduleSpecifier: string; isTypeOnly: boolean }> {
    const references: Array<{ moduleSpecifier: string; isTypeOnly: boolean }> = [];

    function visit(node: ts.Node): void {
      // Handle import declarations: import { x } from 'module' or import type { x } from 'module'
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const isTypeOnly = node.importClause?.isTypeOnly ?? false;
        references.push({ moduleSpecifier: node.moduleSpecifier.text, isTypeOnly });
      }
      // Handle re-exports: export { x } from 'module' and export * from 'module'
      else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const isTypeOnly = node.isTypeOnly ?? false;
        references.push({ moduleSpecifier: node.moduleSpecifier.text, isTypeOnly });
      }
      // Handle require calls: require('module') - these are never type-only
      else if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        references.push({ moduleSpecifier: node.arguments[0].text, isTypeOnly: false });
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return references;
  }

  async buildGraph(): Promise<DependencyGraph> {
    const { rootDir, tsConfigPath, includeExternal } = this.options;

    // Find tsconfig.json
    let configPath = tsConfigPath;
    if (!configPath) {
      configPath = ts.findConfigFile(rootDir, (filePath) => ts.sys.fileExists(filePath), "tsconfig.json");
    }

    if (!configPath) {
      throw new Error(`Could not find tsconfig.json in ${rootDir}`);
    }

    // Parse tsconfig.json
    const configFile = ts.readConfigFile(configPath, (filePath) => ts.sys.readFile(filePath));
    if (configFile.error) {
      throw new Error(
        `Error reading tsconfig.json: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`,
      );
    }

    const parsedCommandLine = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));

    if (parsedCommandLine.errors.length > 0) {
      throw new Error(
        `Error parsing tsconfig.json: ${ts.flattenDiagnosticMessageText(parsedCommandLine.errors[0].messageText, "\n")}`,
      );
    }

    const compilerOptions = parsedCommandLine.options;
    const rawConfig = parsedCommandLine.raw as { include?: string[]; exclude?: string[] } | undefined;
    const includePatterns: string[] = rawConfig?.include || ["**/*.ts", "**/*.tsx"];
    const excludePatterns: string[] = rawConfig?.exclude || ["node_modules", "**/*.d.ts"];

    // Find TypeScript files
    const configDir = path.dirname(configPath);
    const projectFiles = await glob(includePatterns, {
      ignore: excludePatterns,
      absolute: true,
      nodir: true,
      cwd: configDir,
    });

    if (projectFiles.length === 0) {
      // Return empty graph
      this.graph = {
        forward: new Map(),
        reverse: new Map(),
        allNodes: new Set(),
      };
      return this.graph;
    }

    // Create TypeScript program
    const program = ts.createProgram(projectFiles, compilerOptions);

    // Build the graph
    const forward = new Map<string, string[]>();
    const reverse = new Map<string, string[]>();
    const allNodes = new Set<string>();

    // Track type-only edges: "from|to" -> isTypeOnly
    // An edge is type-only if ALL imports from A to B are type-only
    const typeOnlyEdges = new Map<string, boolean>();

    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;

      const currentFile = sourceFile.fileName;

      // Only process files in our project
      if (!projectFiles.includes(currentFile)) continue;

      allNodes.add(currentFile);

      const refs = this.extractReferencedFiles(sourceFile);
      const resolvedImports: string[] = [];

      for (const ref of refs) {
        const resolvedModule = ts.resolveModuleName(ref.moduleSpecifier, currentFile, compilerOptions, ts.sys);

        if (resolvedModule.resolvedModule?.resolvedFileName) {
          const resolvedPath = resolvedModule.resolvedModule.resolvedFileName;

          // Skip external modules unless includeExternal is true
          if (!includeExternal && resolvedModule.resolvedModule.isExternalLibraryImport) {
            continue;
          }

          // Only include resolved files that are part of our project
          if (!includeExternal && !projectFiles.includes(resolvedPath)) {
            continue;
          }

          // Track type-only status for this edge
          const edgeKey = `${currentFile}|${resolvedPath}`;
          const existingTypeOnly = typeOnlyEdges.get(edgeKey);
          if (existingTypeOnly === undefined) {
            // First import from this file to that file
            typeOnlyEdges.set(edgeKey, ref.isTypeOnly);
          } else if (!ref.isTypeOnly) {
            // If any import is NOT type-only, the edge is not type-only
            typeOnlyEdges.set(edgeKey, false);
          }

          // Avoid duplicates in resolved imports
          if (!resolvedImports.includes(resolvedPath)) {
            resolvedImports.push(resolvedPath);
            allNodes.add(resolvedPath);

            // Add to reverse map
            const reverseList = reverse.get(resolvedPath);
            if (reverseList) {
              if (!reverseList.includes(currentFile)) {
                reverseList.push(currentFile);
              }
            } else {
              reverse.set(resolvedPath, [currentFile]);
            }
          }
        }
      }

      forward.set(currentFile, resolvedImports);
    }

    // Ensure all nodes have entries in both maps
    for (const node of allNodes) {
      if (!forward.has(node)) {
        forward.set(node, []);
      }
      if (!reverse.has(node)) {
        reverse.set(node, []);
      }
    }

    this.graph = { forward, reverse, allNodes, typeOnlyEdges };
    return this.graph;
  }

  calculateCoupling(): ModuleCoupling[] {
    if (!this.graph) {
      throw new Error("Graph not built. Call buildGraph() first.");
    }

    const coupling: ModuleCoupling[] = [];

    for (const file of this.graph.allNodes) {
      // Ca (afferent coupling) = number of files that import this file (fan-in)
      const Ca = this.graph.reverse.get(file)?.length ?? 0;
      // Ce (efferent coupling) = number of files this file imports (fan-out)
      const Ce = this.graph.forward.get(file)?.length ?? 0;
      // Instability = Ce / (Ca + Ce), or 0 if both are 0
      const instability = Ca + Ce === 0 ? 0 : Ce / (Ca + Ce);

      coupling.push({ file, Ca, Ce, instability });
    }

    return coupling;
  }

  calculateInstability(): Map<string, number> {
    const coupling = this.calculateCoupling();
    const instabilityMap = new Map<string, number>();

    for (const c of coupling) {
      instabilityMap.set(c.file, c.instability);
    }

    return instabilityMap;
  }

  calculateGraphDensity(): number {
    if (!this.graph) {
      throw new Error("Graph not built. Call buildGraph() first.");
    }

    const nodes = this.graph.allNodes.size;
    if (nodes < 2) {
      return 0;
    }

    // Count total edges
    let edges = 0;
    for (const imports of this.graph.forward.values()) {
      edges += imports.length;
    }

    // density = edges / (nodes * (nodes - 1))
    return edges / (nodes * (nodes - 1));
  }

  findHubs(k: number, includeBetweenness = false): HubNode[] {
    if (!this.graph) {
      throw new Error("Graph not built. Call buildGraph() first.");
    }

    // Optionally calculate betweenness centrality
    const betweenness = includeBetweenness ? this.calculateBetweennessCentrality() : null;

    const hubs: HubNode[] = [];

    for (const file of this.graph.allNodes) {
      const fanInFiles = this.graph.reverse.get(file) ?? [];
      const fanOutFiles = this.graph.forward.get(file) ?? [];
      const fanIn = fanInFiles.length;
      const fanOut = fanOutFiles.length;
      const totalDegree = fanIn + fanOut;

      hubs.push({
        file,
        totalDegree,
        fanIn,
        fanOut,
        betweennessCentrality: betweenness?.get(file),
        // Include sample of files (up to 5 each) for context
        fanInFiles: fanInFiles.slice(0, 5),
        fanOutFiles: fanOutFiles.slice(0, 5),
        productionFanIn: this.calculateProductionFanIn(fanInFiles),
        testFanIn: this.calculateTestFanIn(fanInFiles),
      });
    }

    // Sort by totalDegree descending
    hubs.sort((a, b) => b.totalDegree - a.totalDegree);

    // Return top k
    return hubs.slice(0, k);
  }

  private isTestFile(file: string): boolean {
    return (
      file.includes(".test.") ||
      file.includes(".spec.") ||
      file.includes("__tests__") ||
      file.includes("/test/") ||
      file.includes("/tests/")
    );
  }

  private calculateProductionFanIn(fanInFiles: string[]): number {
    return fanInFiles.filter((f) => !this.isTestFile(f)).length;
  }

  private calculateTestFanIn(fanInFiles: string[]): number {
    return fanInFiles.filter((f) => this.isTestFile(f)).length;
  }

  /**
   * BFS from a source node, returns distances and parent map for path reconstruction
   */
  private bfsFromNode(source: string): { distances: Map<string, number>; parents: Map<string, string | null> } {
    if (!this.graph) {
      throw new Error("Graph not built. Call buildGraph() first.");
    }

    const distances = new Map<string, number>();
    const parents = new Map<string, string | null>();
    const queue: string[] = [source];

    distances.set(source, 0);
    parents.set(source, null);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;

      const currentDist = distances.get(current) ?? 0;

      // Visit all neighbors (files this file imports)
      const neighbors = this.graph.forward.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, currentDist + 1);
          parents.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }

    return { distances, parents };
  }

  /**
   * Reconstruct path from source to target using parent map
   */
  private reconstructPath(parents: Map<string, string | null>, source: string, target: string): string[] {
    const pathResult: string[] = [];
    let current: string | null = target;

    while (current !== null) {
      pathResult.unshift(current);
      current = parents.get(current) ?? null;
    }

    // Only return the path if it starts from source
    if (pathResult[0] === source) {
      return pathResult;
    }
    return [];
  }

  calculateAveragePathLength(): number {
    if (!this.graph) {
      throw new Error("Graph not built. Call buildGraph() first.");
    }

    const nodes = Array.from(this.graph.allNodes);
    if (nodes.length < 2) {
      return 0;
    }

    let totalPathLength = 0;
    let pathCount = 0;

    // BFS from each node
    for (const source of nodes) {
      const { distances } = this.bfsFromNode(source);

      // Sum distances to all reachable nodes (excluding self)
      for (const [target, dist] of distances) {
        if (target !== source && dist > 0) {
          totalPathLength += dist;
          pathCount++;
        }
      }
    }

    if (pathCount === 0) {
      return 0;
    }

    return totalPathLength / pathCount;
  }

  calculateDiameter(): DiameterResult {
    if (!this.graph) {
      throw new Error("Graph not built. Call buildGraph() first.");
    }

    const nodes = Array.from(this.graph.allNodes);
    if (nodes.length < 2) {
      return { length: 0, longestPath: [] };
    }

    let maxLength = 0;
    let longestPath: string[] = [];

    // BFS from each node to find the diameter
    for (const source of nodes) {
      const { distances, parents } = this.bfsFromNode(source);

      // Find the farthest reachable node
      for (const [target, dist] of distances) {
        if (dist > maxLength) {
          maxLength = dist;
          longestPath = this.reconstructPath(parents, source, target);
        }
      }
    }

    return { length: maxLength, longestPath };
  }

  /**
   * Get the layer index for a file based on its filename matching layer patterns.
   * Returns -1 if no layer matches.
   */
  private getLayerIndex(filePath: string, layers: string[]): number {
    const filename = path.basename(filePath, path.extname(filePath));
    return layers.findIndex((layer) => filename.includes(layer));
  }

  /**
   * Calculate betweenness centrality for all nodes using Brandes' algorithm.
   * Betweenness centrality measures how often a node lies on shortest paths between other nodes.
   * Nodes with high betweenness are "bridge" modules that many paths flow through.
   */
  calculateBetweennessCentrality(): Map<string, number> {
    if (!this.graph) {
      throw new Error("Graph not built. Call buildGraph() first.");
    }

    const centrality = new Map<string, number>();
    const nodes = Array.from(this.graph.allNodes);

    // Initialize centrality to 0
    for (const node of nodes) {
      centrality.set(node, 0);
    }

    // Brandes' algorithm
    for (const source of nodes) {
      // Single-source shortest paths
      const stack: string[] = [];
      const predecessors = new Map<string, string[]>();
      const sigma = new Map<string, number>(); // Number of shortest paths
      const distance = new Map<string, number>();

      for (const node of nodes) {
        predecessors.set(node, []);
        sigma.set(node, 0);
        distance.set(node, -1);
      }

      sigma.set(source, 1);
      distance.set(source, 0);

      const queue: string[] = [source];

      while (queue.length > 0) {
        const v = queue.shift();
        if (v === undefined) break;
        stack.push(v);

        const neighbors = this.graph.forward.get(v) ?? [];
        for (const w of neighbors) {
          const distW = distance.get(w) ?? -1;
          const distV = distance.get(v) ?? 0;

          // First visit?
          if (distW < 0) {
            queue.push(w);
            distance.set(w, distV + 1);
          }

          // Shortest path to w via v?
          if (distance.get(w) === distV + 1) {
            sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
            predecessors.get(w)?.push(v);
          }
        }
      }

      // Accumulation
      const delta = new Map<string, number>();
      for (const node of nodes) {
        delta.set(node, 0);
      }

      while (stack.length > 0) {
        const w = stack.pop();
        if (w === undefined) break;
        const preds = predecessors.get(w) ?? [];
        for (const v of preds) {
          const sigmaV = sigma.get(v) ?? 0;
          const sigmaW = sigma.get(w) ?? 1; // Avoid division by zero
          const deltaW = delta.get(w) ?? 0;
          const contribution = (sigmaV / sigmaW) * (1 + deltaW);
          delta.set(v, (delta.get(v) ?? 0) + contribution);
        }
        if (w !== source) {
          centrality.set(w, (centrality.get(w) ?? 0) + (delta.get(w) ?? 0));
        }
      }
    }

    // Normalize by (n-1)(n-2) for directed graphs
    const n = nodes.length;
    if (n > 2) {
      const normFactor = (n - 1) * (n - 2);
      for (const [node, value] of centrality) {
        centrality.set(node, value / normFactor);
      }
    }

    return centrality;
  }

  calculateDirectionality(layers: string[]): DirectionalityResult {
    if (!this.graph) {
      throw new Error("Graph not built. Call buildGraph() first.");
    }

    const violations: Array<[string, string]> = [];
    let totalEdges = 0;
    let validEdges = 0;

    // For each edge (from -> to), check if the layer order is respected
    // A valid edge goes from higher layer index to lower layer index
    // (higher layers should import from lower layers)
    for (const [fromFile, toFiles] of this.graph.forward) {
      const fromLayer = this.getLayerIndex(fromFile, layers);

      for (const toFile of toFiles) {
        totalEdges++;
        const toLayer = this.getLayerIndex(toFile, layers);

        // Skip edges where we can't determine the layer
        if (fromLayer === -1 || toLayer === -1) {
          validEdges++; // Don't count unknown layers as violations
          continue;
        }

        // Valid: fromLayer > toLayer (higher layer imports from lower layer)
        // e.g., index (layer 5) imports internal (layer 0)
        if (fromLayer > toLayer) {
          validEdges++;
        } else {
          // Violation: lower layer imports from higher or same layer
          violations.push([fromFile, toFile]);
        }
      }
    }

    const percentage = totalEdges === 0 ? 100 : (validEdges / totalEdges) * 100;

    return { percentage, violations };
  }
}
