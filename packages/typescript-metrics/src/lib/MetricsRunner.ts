import type {
  ComplexityMetrics,
  CouplingMetrics,
  CycleMetrics,
  DependencyGraph,
  DuplicationMetrics,
  MetricCategory,
  MetricsOptions,
  MetricsResult,
  MonorepoMetrics,
  OutputFormat,
} from "../types.js";
import { ComplexityAnalyzer } from "./ComplexityAnalyzer.js";
import { CycleDetector } from "./CycleDetector.js";
import { DependencyGraphAnalyzer } from "./DependencyGraphAnalyzer.js";
import { DuplicationDetector } from "./DuplicationDetector.js";
import { MonorepoAnalyzer } from "./MonorepoAnalyzer.js";

export interface RunnerOptions extends MetricsOptions {
  rootDir: string;
  files?: string[];
  categories?: MetricCategory[];
}

export class MetricsRunner {
  private options: RunnerOptions;
  private cachedGraph?: DependencyGraph;

  constructor(options: RunnerOptions) {
    this.options = options;
  }

  async run(): Promise<MetricsResult> {
    const categories = this.options.categories || ["coupling", "cycles", "complexity", "duplication", "monorepo"];
    const result: MetricsResult = {};

    // Coupling must run first (provides graph for cycles)
    if (categories.includes("coupling") || categories.includes("cycles")) {
      try {
        result.coupling = await this.runCouplingMetrics();
      } catch (error) {
        console.warn("Warning: Failed to calculate coupling metrics:", error);
      }
    }

    if (categories.includes("cycles") && result.coupling) {
      try {
        result.cycles = await this.runCycleMetrics();
      } catch (error) {
        console.warn("Warning: Failed to calculate cycle metrics:", error);
      }
    }

    if (categories.includes("complexity")) {
      try {
        result.complexity = await this.runComplexityMetrics();
      } catch (error) {
        console.warn("Warning: Failed to calculate complexity metrics:", error);
      }
    }

    if (categories.includes("duplication")) {
      try {
        result.duplication = await this.runDuplicationMetrics();
      } catch (error) {
        console.warn("Warning: Failed to calculate duplication metrics:", error);
      }
    }

    if (categories.includes("monorepo")) {
      try {
        result.monorepo = await this.runMonorepoMetrics();
      } catch (error) {
        console.warn("Warning: Failed to calculate monorepo metrics:", error);
      }
    }

    return result;
  }

  selectMetrics(categories: MetricCategory[]): void {
    this.options.categories = categories;
  }

  async runCouplingMetrics(): Promise<CouplingMetrics> {
    const analyzer = new DependencyGraphAnalyzer({
      rootDir: this.options.rootDir,
      // Let the analyzer find tsconfig.json automatically
    });

    const graph = await analyzer.buildGraph();
    this.cachedGraph = graph; // Cache for cycle detection

    const modules = analyzer.calculateCoupling();
    const graphDensity = analyzer.calculateGraphDensity();
    const hubs = analyzer.findHubs(this.options.topK || 10);

    return { modules, graphDensity, hubs };
  }

  async runCycleMetrics(): Promise<CycleMetrics> {
    if (!this.cachedGraph) {
      throw new Error("Coupling metrics must run before cycle metrics");
    }
    const detector = new CycleDetector(this.cachedGraph);
    return detector.getCycleMetrics();
  }

  async runComplexityMetrics(): Promise<ComplexityMetrics> {
    const files = this.options.files || (await this.findTypeScriptFiles());
    const analyzer = new ComplexityAnalyzer({
      files,
      thresholds: { cyclomatic: 10, cognitive: 15 },
    });
    return analyzer.analyze();
  }

  async runDuplicationMetrics(): Promise<DuplicationMetrics> {
    const files = this.options.files || (await this.findTypeScriptFiles());
    const detector = new DuplicationDetector({
      minTokens: this.options.minTokens || 50,
    });
    detector.setFiles(files);
    return detector.analyze();
  }

  async runMonorepoMetrics(): Promise<MonorepoMetrics> {
    const analyzer = new MonorepoAnalyzer({
      rootDir: this.options.rootDir,
    });
    return analyzer.analyze();
  }

  formatOutput(result: MetricsResult, format: OutputFormat): string {
    if (format === "json") {
      return JSON.stringify(
        result,
        (_key, value) => {
          // Convert Maps to objects for JSON serialization
          if (value instanceof Map) {
            return Object.fromEntries(value);
          }
          return value;
        },
        2,
      );
    }

    // Summary format
    const lines: string[] = ["=== Metrics Summary ==="];

    if (result.coupling) {
      lines.push("\nCoupling:");
      lines.push(`  Graph Density: ${result.coupling.graphDensity.toFixed(4)}`);
      lines.push(`  Total Modules: ${result.coupling.modules.length}`);
      lines.push(`  Hub Nodes: ${result.coupling.hubs.length}`);
    }

    if (result.cycles) {
      lines.push("\nCycles:");
      lines.push(`  Circular Dependencies: ${result.cycles.count}`);
      lines.push(`  Edges in Cycles: ${result.cycles.edgesInCycles}`);
    }

    if (result.complexity) {
      lines.push("\nComplexity:");
      lines.push(`  Files Analyzed: ${result.complexity.files.length}`);
      lines.push(`  Functions: ${result.complexity.functions.length}`);
      lines.push(`  Hotspots: ${result.complexity.hotspots.length}`);
    }

    if (result.duplication) {
      lines.push("\nDuplication:");
      lines.push(`  Density: ${(result.duplication.density * 100).toFixed(2)}%`);
      lines.push(`  Duplicated Lines: ${result.duplication.duplicatedLines}`);
      lines.push(`  Duplicate Blocks: ${result.duplication.blocks.length}`);
    }

    if (result.monorepo) {
      lines.push("\nMonorepo:");
      lines.push(`  Packages: ${result.monorepo.packages.length}`);
      lines.push(`  Dependency Depth: ${result.monorepo.dependencyDepth}`);
    }

    return lines.join("\n");
  }

  private async findTypeScriptFiles(): Promise<string[]> {
    const { glob } = await import("glob");
    return glob("**/*.ts", {
      cwd: this.options.rootDir,
      absolute: true,
      ignore: ["**/node_modules/**", "**/*.d.ts"],
    });
  }
}
