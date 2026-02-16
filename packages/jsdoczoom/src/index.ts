/**
 * Re-exports all public functions, classes, and types from internal modules.
 * This is the sole entry point for programmatic consumers of the jsdoczoom
 * package.
 *
 * @summary Public API barrel re-exporting all functions, types, and classes
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
