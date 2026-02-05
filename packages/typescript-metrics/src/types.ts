export interface MetricsOptions {
  skipPathMetrics?: boolean;
  layers?: string[];
  minTokens?: number;
  topK?: number;
}

export interface DependencyGraphOptions {
  rootDir: string;
  includeExternal?: boolean;
  tsConfigPath?: string;
}

export interface ComplexityOptions {
  files: string[];
  thresholds?: {
    cyclomatic?: number;
    cognitive?: number;
  };
}

export interface DuplicationOptions {
  minTokens: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface MonorepoOptions {
  rootDir: string;
  packageFilter?: (pkg: WorkspacePackage) => boolean;
}

export interface MetricsOutput {
  version: string;
  timestamp: string;
  targets: string[];
  options: MetricsOptions;
  metrics: MetricsResult;
}

export interface MetricsResult {
  coupling?: CouplingMetrics;
  cycles?: CycleMetrics;
  complexity?: ComplexityMetrics;
  duplication?: DuplicationMetrics;
  monorepo?: MonorepoMetrics;
}

export interface DependencyGraph {
  forward: Map<string, string[]>;
  reverse: Map<string, string[]>;
  allNodes: Set<string>;
}

export interface ModuleCoupling {
  file: string;
  Ca: number;
  Ce: number;
  instability: number;
}

export interface HubNode {
  file: string;
  totalDegree: number;
  fanIn: number;
  fanOut: number;
}

export interface DiameterResult {
  length: number;
  longestPath: string[];
}

export interface DirectionalityResult {
  percentage: number;
  violations: Array<[string, string]>;
}

export interface GraphMetrics {
  density: number;
  hubNodes: HubNode[];
  avgPathLength: number;
  diameter: DiameterResult;
  directionality: DirectionalityResult;
}

export interface CouplingMetrics {
  modules: ModuleCoupling[];
  graphDensity: number;
  hubs: HubNode[];
}

export interface CycleMetrics {
  count: number;
  sccDistribution: Record<number, number>;
  edgesInCycles: number;
  sccs: string[][];
}

export interface FunctionComplexity {
  name: string;
  file: string;
  line: number;
  cyclomatic: number;
  cognitive: number;
}

export interface LOCBreakdown {
  total: number;
  code: number;
  blank: number;
  comment: number;
}

export interface FileComplexity {
  file: string;
  functions: FunctionComplexity[];
  loc: LOCBreakdown;
  statementCount: number;
  commentDensity: number;
}

export interface ComplexityMetrics {
  files: FileComplexity[];
  functions: FunctionComplexity[];
  hotspots: FunctionComplexity[];
}

export interface NormalizedToken {
  kind: string;
  normalizedValue: string;
  line: number;
  column: number;
}

export interface TokenWindow {
  file: string;
  startLine: number;
  endLine: number;
  tokens: NormalizedToken[];
  hash: string;
}

export interface DuplicateBlock {
  files: Array<{
    file: string;
    startLine: number;
    endLine: number;
  }>;
  tokenCount: number;
  fingerprint: string;
}

export interface DuplicationMetrics {
  totalLines: number;
  duplicatedLines: number;
  density: number;
  blocks: DuplicateBlock[];
}

export interface WorkspacePackage {
  name: string;
  dir: string;
  relativeDir: string;
  packageJson: Record<string, unknown>;
}

export interface PackageApiSurface {
  namedExports: string[];
  defaultExport: boolean;
  typeExports: string[];
  barrelReexports: number;
}

export interface PackageImportBreakdown {
  internal: {
    count: number;
    ratio: number;
  };
  workspacePackages: {
    count: number;
    ratio: number;
  };
  externalNpm: {
    count: number;
    ratio: number;
  };
}

export type CrossBoundaryMatrix = Map<string, Map<string, number>>;

export interface MonorepoMetrics {
  packages: WorkspacePackage[];
  apiSurfaces: Map<string, PackageApiSurface>;
  importBreakdowns: Map<string, PackageImportBreakdown>;
  crossBoundaryMatrix: CrossBoundaryMatrix;
  dependencyDepth: number;
}

export type MetricCategory = "coupling" | "cycles" | "complexity" | "duplication" | "monorepo";

export type OutputFormat = "json" | "summary";

export interface CliArgs {
  targets: string[];
  metrics?: MetricCategory[];
  format?: OutputFormat;
  verbose?: boolean;
  skipPathMetrics?: boolean;
  layers?: string[];
  minTokens?: number;
  topK?: number;
  help?: boolean;
  version?: boolean;
}
