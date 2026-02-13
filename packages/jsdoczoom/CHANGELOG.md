# Changelog

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

