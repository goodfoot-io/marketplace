// Library exports

export { ComplexityAnalyzer } from "./lib/ComplexityAnalyzer.js";
export { CycleDetector } from "./lib/CycleDetector.js";
export { DataFlowAnalyzer } from "./lib/DataFlowAnalyzer.js";
export { DependencyGraphAnalyzer } from "./lib/DependencyGraphAnalyzer.js";
export { DuplicationDetector } from "./lib/DuplicationDetector.js";
export { MetricsRunner } from "./lib/MetricsRunner.js";
export { MonorepoAnalyzer } from "./lib/MonorepoAnalyzer.js";
export { ReportGenerator } from "./lib/ReportGenerator.js";
export { SwallowedErrorAnalyzer } from "./lib/SwallowedErrorAnalyzer.js";
export * from "./types.js";

import * as fs from "node:fs";
import * as path from "node:path";
import { glob } from "glob";
import { MetricsRunner } from "./lib/MetricsRunner.js";
import { ReportGenerator } from "./lib/ReportGenerator.js";
import type { MetricCategory } from "./types.js";

const VERSION = "0.0.1";

// Default configuration
const DEFAULT_MIN_TOKENS = 100;
const DEFAULT_TOP_K = 10;
const DEFAULT_LAYERS = [
  // Lowest layers (foundations)
  "shared",
  "common",
  "utils",
  "helpers",
  "constants",
  // Type definitions
  "types",
  "models",
  "interfaces",
  // Core library
  "lib",
  "core",
  // Data & services
  "services",
  "data",
  "api",
  "store",
  // Business logic
  "domain",
  "business",
  "logic",
  // Middleware & hooks
  "middleware",
  "hooks",
  // UI layer
  "components",
  "ui",
  "views",
  // Feature modules
  "features",
  "modules",
  "pages",
  "routes",
  // Application entry
  "app",
  "main",
  "index",
  // Tests (highest - can import anything)
  "test",
  "tests",
  "spec",
];

interface CliArgs {
  targets: string[];
  metrics?: MetricCategory[];
  json?: boolean;
  verbose?: boolean;
  skipPathMetrics?: boolean;
  layers?: string[];
  minTokens?: number;
  topK?: number;
  help?: boolean;
  version?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { targets: [] };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else if (arg === "-v" || arg === "--version") {
      args.version = true;
    } else if (arg === "--verbose") {
      args.verbose = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--skip-path-metrics") {
      args.skipPathMetrics = true;
    } else if (arg === "--metrics" && argv[i + 1]) {
      args.metrics = argv[++i].split(",") as MetricCategory[];
    } else if (arg === "--layers" && argv[i + 1]) {
      args.layers = argv[++i].split(",");
    } else if (arg === "--min-tokens" && argv[i + 1]) {
      args.minTokens = parseInt(argv[++i], 10);
    } else if (arg === "--top-k" && argv[i + 1]) {
      args.topK = parseInt(argv[++i], 10);
    } else if (!arg.startsWith("-")) {
      args.targets.push(arg);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
typescript-metrics - Calculate TypeScript codebase metrics

Usage:
  typescript-metrics [options] [targets...]

Output:
  Generates a markdown health report with actionable recommendations.
  Use --json for machine-readable output.

Options:
  -h, --help              Show this help message
  -v, --version           Show version number
  --json                  Output raw JSON instead of markdown report
  --metrics <categories>  Comma-separated metrics to run (coupling,cycles,complexity,duplication,monorepo,dataflow,swallowed-errors)
  --verbose               Show progress information
  --skip-path-metrics     Skip average path length and diameter (for large codebases)
  --layers <layers>       Comma-separated layer order for directionality
  --min-tokens <n>        Minimum tokens for duplication detection (default: ${DEFAULT_MIN_TOKENS})
  --top-k <n>             Number of hub nodes to report (default: ${DEFAULT_TOP_K})

Examples:
  typescript-metrics                           # Analyze current package, output markdown
  typescript-metrics > report.md               # Save report to file
  typescript-metrics --json                    # Output raw JSON
  typescript-metrics packages/foo/**/*.ts      # Analyze specific files
  typescript-metrics --metrics coupling,cycles # Run specific metrics only
`);
}

function printVersion(): void {
  console.log(VERSION);
}

async function resolveTargets(args: CliArgs): Promise<string[]> {
  const cwd = process.cwd();

  if (args.targets.length > 0) {
    // Use provided glob patterns
    const files: string[] = [];
    for (const pattern of args.targets) {
      const matches = await glob(pattern, {
        cwd,
        absolute: true,
        ignore: ["**/node_modules/**", "**/*.d.ts"],
      });
      files.push(...matches);
    }
    return files;
  }

  // Default behavior: check for package.json
  const packageJsonPath = path.join(cwd, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(
      "No package.json found in current directory. Specify target files or run from a package directory.",
    );
  }

  // Look for tsconfig.json for include patterns
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  let includePatterns = ["src/**/*.ts"];

  if (fs.existsSync(tsconfigPath)) {
    try {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
      if (tsconfig.include) {
        includePatterns = tsconfig.include;
      }
    } catch {
      // Use defaults
    }
  }

  const files = await glob(includePatterns, {
    cwd,
    absolute: true,
    ignore: ["**/node_modules/**", "**/*.d.ts"],
  });

  return files;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    return;
  }

  if (args.version) {
    printVersion();
    return;
  }

  const cwd = process.cwd();
  const files = await resolveTargets(args);

  if (files.length === 0) {
    throw new Error("No TypeScript files found to analyze.");
  }

  if (args.verbose) {
    console.error(`Analyzing ${files.length} files...`);
  }

  const runner = new MetricsRunner({
    rootDir: cwd,
    files,
    categories: args.metrics,
    skipPathMetrics: args.skipPathMetrics,
    layers: args.layers ?? DEFAULT_LAYERS,
    minTokens: args.minTokens ?? DEFAULT_MIN_TOKENS,
    topK: args.topK ?? DEFAULT_TOP_K,
  });

  const result = await runner.run();

  if (args.json) {
    // Raw JSON output for programmatic use
    console.log(
      JSON.stringify(
        {
          version: VERSION,
          timestamp: new Date().toISOString(),
          targets: args.targets.length > 0 ? args.targets : ["(package default)"],
          options: {
            skipPathMetrics: args.skipPathMetrics,
            layers: args.layers ?? DEFAULT_LAYERS,
            minTokens: args.minTokens ?? DEFAULT_MIN_TOKENS,
            topK: args.topK ?? DEFAULT_TOP_K,
          },
          metrics: result,
        },
        (_key, value) => {
          if (value instanceof Map) {
            return Object.fromEntries(value);
          }
          return value;
        },
        2,
      ),
    );
  } else {
    // Markdown report (default)
    const reportGenerator = new ReportGenerator(cwd);
    const packageCount = result.monorepo?.packages.length;

    const report = reportGenerator.generate(result, {
      rootDir: cwd,
      fileCount: files.length,
      packageCount,
      timestamp: new Date().toISOString(),
      minTokens: args.minTokens ?? DEFAULT_MIN_TOKENS,
    });

    console.log(report);
  }
}

// Dual-mode: CLI when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
}
