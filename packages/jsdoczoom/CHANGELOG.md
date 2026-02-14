# Changelog

## 0.2.1
- Added package homepage and repository metadata for improved discoverability on npm

## 0.2.0
- Added `--explain-rule` CLI flag to display detailed explanations and examples for lint rules
- Added `require-file-ordering` rule to enforce file-level JSDoc structure with validation for duplicate blocks and proper tag ordering
- Improved symbol detection with more robust pattern matching for functions, classes, interfaces, type aliases, variables, getters/setters, and class methods
- Added skill-based prompt templates and interactive CLI features
- Added schema and content validation

## 0.1.0
- Initial release of `jsdoczoom` — a CLI tool for extracting JSDoc summaries at configurable depths
- Progressive exploration of TypeScript codebases with four detail levels (summary, description, type declarations, full source)
- Glob and file path selectors with `@depth` suffix for controlling output detail
- Barrel file gating: `index.ts` files with `@summary` automatically gate sibling files at lower depths
- Validation mode (`--validate`) to check JSDoc quality across files
- Lint mode (`--lint`) for comprehensive JSDoc quality analysis powered by ESLint
- Skill mode (`--skill`) to print JSDoc writing guidelines
- Stdin piping support for integration with other tools
- `.gitignore`-aware file discovery with `--no-gitignore` escape hatch
- JSON output with `--pretty` formatting and `--limit` result cap
- Programmatic API for use as a library
