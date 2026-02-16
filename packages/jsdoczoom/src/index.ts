/**
 * Progressively explores TypeScript codebase documentation through a 4-level
 * drill-down (summary, description, type declarations, full source), validates
 * file-level JSDoc structure, and lints comprehensive JSDoc quality using
 * ESLint. Barrel files gate their children at shallow depths, revealing
 * individual files only at deeper levels.
 *
 * @summary Progressive JSDoc exploration, validation, and linting for TypeScript codebases
 */

export { getBarrelChildren, isBarrel } from "./barrel.js";
export { drilldown, drilldownFiles } from "./drilldown.js";
export { JsdocError } from "./errors.js";
export { discoverFiles } from "./file-discovery.js";
export { extractFileJsdoc, parseFileSummaries } from "./jsdoc-parser.js";
export { lint, lintFiles } from "./lint.js";
export { parseSelector } from "./selector.js";
export { generateTypeDeclarations } from "./type-declarations.js";
export {
	type CacheConfig,
	type CacheOperationMode,
	DEFAULT_CACHE_DIR,
	type DrilldownResult,
	type ErrorCode,
	type LintDiagnostic,
	type LintFileResult,
	type LintResult,
	type OutputEntry,
	type OutputErrorItem,
	type OutputItem,
	type OutputItemNext,
	type OutputItemTerminal,
	type ParsedFileInfo,
	type SelectorInfo,
	VALIDATION_STATUS_PRIORITY,
	type ValidationGroup,
	type ValidationResult,
	type ValidationStatus,
} from "./types.js";
export { validate, validateFiles } from "./validate.js";
