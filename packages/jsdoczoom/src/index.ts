export { getBarrelChildren, isBarrel } from "./barrel.js";
export { drilldown, drilldownFiles } from "./drilldown.js";
export { JsdocError } from "./errors.js";
export { discoverFiles } from "./file-discovery.js";
export { extractFileJsdoc, parseFileSummaries } from "./jsdoc-parser.js";
export { parseSelector } from "./selector.js";
export { generateTypeDeclarations } from "./type-declarations.js";
export type {
	ErrorCode,
	OutputEntry,
	OutputErrorItem,
	OutputItem,
	ParsedFileInfo,
	SelectorInfo,
	ValidationResult,
	ValidationStatus,
} from "./types.js";
export { validate, validateFiles } from "./validate.js";
