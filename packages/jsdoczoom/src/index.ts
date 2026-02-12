export { parseSelector } from './selector.js';
export { parseFileSummaries, extractFileJsdoc } from './jsdoc-parser.js';
export { drilldown, drilldownFiles } from './drilldown.js';
export { validate, validateFiles } from './validate.js';
export { generateTypeDeclarations } from './type-declarations.js';
export { isBarrel, getBarrelChildren } from './barrel.js';
export { discoverFiles } from './file-discovery.js';
export { JsdocError } from './errors.js';
export type {
  OutputItem,
  OutputErrorItem,
  OutputEntry,
  ErrorCode,
  ValidationFileResult,
  ValidationResult,
  ParsedFileInfo,
  SelectorInfo,
} from './types.js';
