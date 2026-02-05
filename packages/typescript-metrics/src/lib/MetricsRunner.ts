import type {
  ChurnHotspotMetrics,
  ComplexityMetrics,
  CouplingMetrics,
  CycleMetrics,
  DataFlowMetrics,
  DependencyGraph,
  DuplicationMetrics,
  EncapsulationMetrics,
  MetricCategory,
  MetricsOptions,
  MetricsResult,
  MonorepoMetrics,
  OutputFormat,
  SwallowedErrorMetrics,
} from "../types.js";
import { ChurnHotspotAnalyzer } from "./ChurnHotspotAnalyzer.js";
import { ComplexityAnalyzer } from "./ComplexityAnalyzer.js";
import { CycleDetector } from "./CycleDetector.js";
import { DataFlowAnalyzer } from "./DataFlowAnalyzer.js";
import { DependencyGraphAnalyzer } from "./DependencyGraphAnalyzer.js";
import { DuplicationDetector } from "./DuplicationDetector.js";
import { EncapsulationAnalyzer } from "./EncapsulationAnalyzer.js";
import { MonorepoAnalyzer } from "./MonorepoAnalyzer.js";
import { SwallowedErrorAnalyzer } from "./SwallowedErrorAnalyzer.js";

export interface RunnerOptions extends MetricsOptions {
  rootDir: string;
  files?: string[];
  categories?: MetricCategory[];
}

export class MetricsRunner {
  private options: RunnerOptions;
  private cachedGraph?: DependencyGraph;
  private cachedComplexity?: ComplexityMetrics;

  constructor(options: RunnerOptions) {
    this.options = options;
  }

  async run(): Promise<MetricsResult> {
    const categories = this.options.categories ?? [
      "coupling",
      "cycles",
      "complexity",
      "duplication",
      "monorepo",
      "dataflow",
      "swallowed-errors",
      "encapsulation",
      "churn-hotspots",
    ];
    const result: MetricsResult = {};

    const runWithWarning = async <T>(name: string, fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (error) {
        console.warn(`Warning: Failed to calculate ${name} metrics:`, error);
        return undefined;
      }
    };

    // Coupling must run first (provides graph for cycles)
    if (categories.includes("coupling") || categories.includes("cycles")) {
      result.coupling = await runWithWarning("coupling", () => this.runCouplingMetrics());
    }

    if (categories.includes("cycles") && result.coupling) {
      result.cycles = await runWithWarning("cycle", () => this.runCycleMetrics());
    }

    if (categories.includes("complexity")) {
      result.complexity = await runWithWarning("complexity", () => this.runComplexityMetrics());
      this.cachedComplexity = result.complexity; // Cache for churn-hotspots
    }

    if (categories.includes("duplication")) {
      result.duplication = await runWithWarning("duplication", () => this.runDuplicationMetrics());
    }

    if (categories.includes("monorepo")) {
      result.monorepo = await runWithWarning("monorepo", () => this.runMonorepoMetrics());
    }

    if (categories.includes("dataflow")) {
      result.dataFlow = await runWithWarning("data flow", () => this.runDataFlowMetrics());
    }

    if (categories.includes("swallowed-errors")) {
      result.swallowedErrors = await runWithWarning("swallowed errors", () => this.runSwallowedErrorMetrics());
    }

    if (categories.includes("encapsulation")) {
      result.encapsulation = await runWithWarning("encapsulation", () => this.runEncapsulationMetrics());
    }

    if (categories.includes("churn-hotspots")) {
      result.churnHotspots = await runWithWarning("churn hotspots", () => this.runChurnHotspotMetrics());
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
    const hubs = analyzer.findHubs(this.options.topK ?? 10, true);

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
      minTokens: this.options.minTokens ?? 100,
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

  async runDataFlowMetrics(): Promise<DataFlowMetrics> {
    const files = this.options.files || (await this.findTypeScriptFiles());
    const analyzer = new DataFlowAnalyzer({
      rootDir: this.options.rootDir,
      files,
    });
    return analyzer.analyze(files);
  }

  async runSwallowedErrorMetrics(): Promise<SwallowedErrorMetrics> {
    const files = this.options.files || (await this.findTypeScriptFiles());
    const analyzer = new SwallowedErrorAnalyzer({
      rootDir: this.options.rootDir,
      files,
    });
    return analyzer.analyze(files);
  }

  async runEncapsulationMetrics(): Promise<EncapsulationMetrics> {
    const files = this.options.files || (await this.findTypeScriptFiles());
    const analyzer = new EncapsulationAnalyzer({
      rootDir: this.options.rootDir,
      files,
    });
    return analyzer.analyze(files);
  }

  async runChurnHotspotMetrics(): Promise<ChurnHotspotMetrics> {
    const files = this.options.files || (await this.findTypeScriptFiles());
    const analyzer = new ChurnHotspotAnalyzer({
      rootDir: this.options.rootDir,
      files,
      complexityMetrics: this.cachedComplexity, // Pass cached complexity if available
    });
    return analyzer.analyze(files);
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

    if (result.dataFlow) {
      lines.push("\nData Flow:");
      lines.push(`  Unused Parameters: ${result.dataFlow.unusedParameters.length}`);
      lines.push(`  Ignored Returns: ${result.dataFlow.ignoredReturns.length}`);
      lines.push(`  Unread Writes: ${result.dataFlow.unreadWrites.length}`);
      lines.push(`  Orphan Reads: ${result.dataFlow.orphanReads.length}`);
    }

    if (result.swallowedErrors) {
      lines.push("\nSwallowed Errors:");
      lines.push(`  Total Findings: ${result.swallowedErrors.summary.total}`);
      lines.push(`  High Confidence: ${result.swallowedErrors.summary.highConfidenceCount}`);
      const patterns = result.swallowedErrors.summary.byPattern;
      if (patterns["empty-catch"] > 0) lines.push(`  Empty Catch Blocks: ${patterns["empty-catch"]}`);
      if (patterns["empty-promise-catch"] > 0)
        lines.push(`  Empty .catch() Handlers: ${patterns["empty-promise-catch"]}`);
      if (patterns["catch-returns-success"] > 0)
        lines.push(`  Catch Returns Success: ${patterns["catch-returns-success"]}`);
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
