# Changelog

## 0.4.16
- Fixed parsing of `.tsx` files that contain JSX syntax (previously caused false `PARSE_ERROR`)

## 0.4.13
- Fixed file filtering to correctly handle files outside the working directory (e.g., cross-package paths in monorepos)

## 0.4.12
- Fixed build process that could cause incorrect package output

## 0.4.11
- Updated eslint dependency to support a broader range of versions

## 0.4.10
- Reduced package size by extracting hooks into a separate package

## 0.4.9
- Updated build dependency to use pinned version of @goodfoot/claude-code-hooks for improved reliability

## 0.4.8
- Minor improvements and bug fixes

## 0.4.7
- Updated dependencies

## 0.4.6
- Updated dependencies

## 0.4.5
- Minor improvements and bug fixes

## 0.4.4
- Skip hooks build in CI where claude-code-hooks CLI is unavailable

## 0.4.3
- Fixed a build issue that could prevent the package from being published correctly

## 0.4.2
- Fixed `.d.ts` files being incorrectly included in drilldown results
- Fixed gitignore rules not being applied when using `drilldownFiles` directly
- Improved hook output format to compact JSON for cleaner context injection
- Improved hook file path extraction to use structured tool responses instead of string parsing
- Fixed dynamic imports in CLI stdin processing

## 0.4.0
- Added Claude Code plugin hook that automatically enriches Grep and Glob search results with JSDoc summaries
- Added content-hash-based disk caching for faster repeated runs across drilldown, validate, and lint operations
- Added `--disable-cache` and `--cache-directory` CLI flags for cache control
- Improved barrel file documentation guidance to emphasize describing child module functionality rather than the re-export mechanism
- Fixed async `drilldownFiles` handling in the plugin hook

## 0.3.1
- Renamed `-v`/`--validate` to `-c`/`--check` for validation mode
- Added `-v`/`--version` flag to print the package version
- Added missing barrel detection: directories with more than 3 TypeScript files lacking an `index.ts` are now flagged in both `--check` and `--lint` modes
- Upgraded ESLint, eslint-plugin-jsdoc, and Biome dependencies

## 0.3.0
- Improved type declaration generation performance with cached TypeScript language service
- Added tsconfig.json awareness for project-specific compiler settings

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
- Validation mode (`--check`) to check JSDoc quality across files
- Lint mode (`--lint`) for comprehensive JSDoc quality analysis powered by ESLint
- Skill mode (`--skill`) to print JSDoc writing guidelines
- Stdin piping support for integration with other tools
- `.gitignore`-aware file discovery with `--no-gitignore` escape hatch
- JSON output with `--pretty` formatting and `--limit` result cap
- Programmatic API for use as a library
