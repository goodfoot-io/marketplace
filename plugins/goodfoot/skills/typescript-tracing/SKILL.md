---
name: typescript-tracing
description: |
  TypeScript code analysis utilities for tracing dependencies, finding callers, and analyzing types.
  Use when: (1) finding what files a module imports, (2) finding what files import a module,
  (3) finding all call sites of a function/method, (4) analyzing types/interfaces/classes in files.
---

# TypeScript Tracing Utilities

Four CLI utilities for analyzing TypeScript codebases:

| Utility | Purpose |
|---------|---------|
| `print-dependencies` | List all files a module imports (forward dependencies) |
| `print-inverse-dependencies` | List all files that import a module (reverse dependencies) |
| `print-call-sites` | Find all call sites of a function or method |
| `print-type-analysis` | Extract type information (interfaces, classes, functions) |

## Quick Reference

```bash
# Forward dependencies - what does this file import?
${CLAUDE_PLUGIN_ROOT}/bin/print-dependencies.mjs src/index.ts

# Reverse dependencies - what files import this?
${CLAUDE_PLUGIN_ROOT}/bin/print-inverse-dependencies.mjs src/utils/helper.ts

# Call sites - where is this function called?
${CLAUDE_PLUGIN_ROOT}/bin/print-call-sites.mjs functionName src/path/to/file.ts
${CLAUDE_PLUGIN_ROOT}/bin/print-call-sites.mjs methodName src/path/to/file.ts --class ClassName

# Type analysis - what types are defined here?
${CLAUDE_PLUGIN_ROOT}/bin/print-type-analysis.mjs src/**/*.ts
```

## Getting Help

For detailed options, run with `--help` or `-h`:

```bash
${CLAUDE_PLUGIN_ROOT}/bin/print-call-sites.mjs --help
${CLAUDE_PLUGIN_ROOT}/bin/print-type-analysis.mjs --help
```

For utilities without `--help`, run without arguments to see usage:

```bash
${CLAUDE_PLUGIN_ROOT}/bin/print-dependencies.mjs
${CLAUDE_PLUGIN_ROOT}/bin/print-inverse-dependencies.mjs
```
