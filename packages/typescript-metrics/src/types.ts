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
  dataFlow?: DataFlowMetrics;
  swallowedErrors?: SwallowedErrorMetrics;
  encapsulation?: EncapsulationMetrics;
  churnHotspots?: ChurnHotspotMetrics;
}

export interface DependencyGraph {
  forward: Map<string, string[]>;
  reverse: Map<string, string[]>;
  allNodes: Set<string>;
  /** Map of "from|to" edge keys to boolean indicating if the edge is type-only */
  typeOnlyEdges?: Map<string, boolean>;
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
  betweennessCentrality?: number;
  /** Files that import this module (sample of dependents) */
  fanInFiles?: string[];
  /** Files this module imports (sample of dependencies) */
  fanOutFiles?: string[];
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
  /** Indices of SCCs that are type-only (no runtime edges) */
  typeOnlySccIndices?: number[];
  /** Files that import themselves (self-loops) */
  selfLoops?: string[];
}

export type ComplexityPattern =
  | "nested-conditionals"
  | "many-branches"
  | "switch-heavy"
  | "loop-heavy"
  | "mixed"
  | "unknown";

export interface FunctionComplexity {
  name: string;
  file: string;
  line: number;
  endLine: number;
  cyclomatic: number;
  cognitive: number;
  /** Code snippet showing the function signature and first few lines */
  codeSnippet?: string;
  /** Detected complexity pattern to help understand WHY the function is complex */
  complexityPattern?: ComplexityPattern;
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
  /** Sample of the duplicated code (from the first occurrence) */
  codeSnippet?: string;
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

// Data Flow Analysis Types

export interface UnusedParameter {
  file: string;
  line: number;
  functionName: string;
  parameterName: string;
  parameterType: "optional" | "default" | "rest" | "destructured";
  totalCallSites: number;
  callSitesProviding: number;
  defaultValue?: string;
  isExported: boolean;
  sampleCallSites: string[];
}

export interface IgnoredReturn {
  file: string;
  line: number;
  functionName: string;
  returnType: string;
  confidence: "high" | "medium";
}

export interface UnreadWrite {
  file: string;
  line: number;
  propertyName: string;
  writeContext: string;
  confidence: "high" | "medium" | "low";
}

export interface OrphanRead {
  file: string;
  line: number;
  propertyName: string;
  readContext: string;
  confidence: "high" | "medium" | "low";
}

export interface DataFlowMetrics {
  unusedParameters: UnusedParameter[];
  ignoredReturns: IgnoredReturn[];
  unreadWrites: UnreadWrite[];
  orphanReads: OrphanRead[];
}

export type MetricCategory =
  | "coupling"
  | "cycles"
  | "complexity"
  | "duplication"
  | "monorepo"
  | "dataflow"
  | "swallowed-errors"
  | "encapsulation"
  | "churn-hotspots";

export type OutputFormat = "json" | "summary";

// Swallowed Error Analysis Types

export type SwallowedErrorPattern =
  | "empty-catch"
  | "comment-only-catch"
  | "catch-returns-success"
  | "catch-log-only"
  | "void-promise"
  | "empty-promise-catch"
  | "error-param-unused";

export interface SwallowedErrorContext {
  /** Whether this is in a test file */
  isTestFile: boolean;
  /** Whether there's logging nearby (within the catch block or try block) */
  hasLoggingNearby: boolean;
  /** Function name suggests optional behavior (try*, maybe*, attempt*) */
  functionNameSuggestsOptional: boolean;
  /** Comment keywords found nearby (intentional, expected, ignore, etc.) */
  nearbyCommentKeywords: string[];
  /** Whether this is in a finally block */
  isInFinallyBlock: boolean;
}

export interface SwallowedErrorFinding {
  file: string;
  line: number;
  column: number;
  pattern: SwallowedErrorPattern;
  confidence: "high" | "medium" | "low";
  context: SwallowedErrorContext;
  codeSnippet: string;
  suggestion: string;
  /** For comment-only catches, the actual comment text */
  commentText?: string;
}

export interface SwallowedErrorMetrics {
  findings: SwallowedErrorFinding[];
  summary: {
    total: number;
    byPattern: Record<SwallowedErrorPattern, number>;
    byConfidence: Record<"high" | "medium" | "low", number>;
    highConfidenceCount: number;
  };
}

// Encapsulation Analysis Types

export interface EncapsulationOptions {
  rootDir: string;
  files: string[];
}

export interface ClassEncapsulation {
  className: string;
  file: string;
  line: number;
  totalMethods: number;
  hiddenMethods: number;
  totalAttributes: number;
  hiddenAttributes: number;
  mhf: number; // Method Hiding Factor (hiddenMethods / totalMethods, 1.0 if no methods)
  ahf: number; // Attribute Hiding Factor (hiddenAttributes / totalAttributes, 1.0 if no attributes)
}

export interface EncapsulationMetrics {
  classes: ClassEncapsulation[];
  aggregateMhf: number; // Average MHF across all classes
  aggregateAhf: number; // Average AHF across all classes
}

// Churn Hotspot Analysis Types

export interface ChurnHotspotOptions {
  rootDir: string;
  files: string[];
  timeWindowDays?: number; // Default 90 days
  complexityMetrics?: ComplexityMetrics; // Optional - passed from cached runner results
}

export interface FileChurn {
  file: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  churnScore: number; // commits + linesAdded + linesDeleted
  /** Average lines changed per commit - high value suggests refactors, low suggests incremental */
  avgLinesPerCommit: number;
}

export interface Hotspot {
  file: string;
  churnScore: number;
  complexityScore: number;
  combinedScore: number; // normalized(churn) * normalized(complexity)
  cyclomatic?: number; // Max cyclomatic in file (if complexity data available)
  cognitive?: number; // Max cognitive in file (if complexity data available)
}

export interface ChurnHotspotMetrics {
  files: FileChurn[];
  hotspots: Hotspot[];
  isGitRepo: boolean;
}

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
