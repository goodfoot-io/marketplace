---
name: typescript-metrics
description: |
  Analyze TypeScript codebase health with metrics for complexity, coupling, duplication, cycles,
  data flow, and swallowed errors. Use when: (1) assessing code quality before refactoring,
  (2) identifying complexity hotspots, (3) finding duplicate code to extract, (4) detecting
  circular dependencies, (5) finding unused parameters or swallowed errors, (6) generating
  health reports for a codebase.
---

# TypeScript Metrics

CLI tool for codebase health analysis. Generates actionable markdown reports with complexity,
coupling, duplication, cycles, data flow, and swallowed error metrics.

## Quick Start

```bash
# Analyze current package (default: markdown report)
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/typescript-metrics.mjs

# Save report to file
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/typescript-metrics.mjs > health-report.md

# Analyze specific files (globs and individual files)
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/typescript-metrics.mjs "src/**/*.ts" "lib/**/*.ts" src/index.ts

# Run specific metrics only
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/typescript-metrics.mjs --metrics complexity,coupling

# JSON output for programmatic use
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/typescript-metrics.mjs --json
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--metrics <list>` | Comma-separated: `coupling,cycles,complexity,duplication,monorepo,dataflow,swallowed-errors` |
| `--json` | Output raw JSON instead of markdown |
| `--verbose` | Show progress information |
| `--skip-path-metrics` | Skip expensive path calculations (large codebases) |
| `--min-tokens <n>` | Minimum tokens for duplication detection (default: 100) |
| `--top-k <n>` | Number of hub nodes to report (default: 10) |

## Interpreting Results

### Health Score

**Overall Score** (0-100): Weighted average of category scores.

| Score | Status | Action |
|-------|--------|--------|
| 75-100 | Healthy | Maintain current practices |
| 50-74 | Review | Address warnings before they worsen |
| 0-49 | Critical | Prioritize immediate fixes |

**Category Weights:**
- Complexity: 35%
- Duplication: 25%
- Coupling: 25%
- Cycles: 15%

### Metric Categories

For detailed interpretation and refactoring guidance, see the references:

- **Complexity Hotspots** → `references/complexity.md`
  - When to read: Functions exceed CC>10 or Cognitive>15
  - Covers: Extraction patterns, refactoring strategies, when to ignore

- **Duplication** → `references/duplication.md`
  - When to read: Duplication density >10% or duplicate blocks identified
  - Covers: Extraction to shared modules, DRY principles, acceptable duplication

- **Coupling & Instability** → `references/coupling.md`
  - When to read: Hub nodes with >10 connections or instability concerns
  - Covers: Dependency injection, interface extraction, layer violations

- **Circular Dependencies** → `references/cycles.md`
  - When to read: SCCs detected (except test fixtures)
  - Covers: Breaking cycles, interface extraction, dependency inversion

- **Data Flow Issues** → `references/dataflow.md`
  - When to read: Unused parameters, ignored returns, or broken data patterns
  - Covers: Parameter removal, return value handling, API cleanup

- **Swallowed Errors** → `references/swallowed-errors.md`
  - When to read: Empty catch blocks, log-only handlers, or fire-and-forget async
  - Covers: Error propagation, logging strategies, intentional swallowing

## Report Features

The generated report includes:

- **Score transparency**: Each category score shows the contributing factor (e.g., "2.6% hotspots")
- **Function LOC**: Complexity table shows lines of code to help assess severity
- **Barrel file detection**: Hub nodes annotated with `(barrel)` for index.ts files
- **Smart function naming**: Anonymous functions show context (e.g., `callback in app.get`, `Foo.bar`)
- **Enhanced unused parameters**: Shows default value, export status, and sample call sites
- **Type-only cycle detection**: Cycles using only `import type` marked as "(type-only — no runtime impact)"

## Quick Interpretation Reference

### Complexity Thresholds

| Metric | Threshold | Meaning |
|--------|-----------|---------|
| Cyclomatic (CC) | ≤10 | Independent paths through code |
| Cognitive | ≤15 | Mental effort to understand |

### Instability Formula

`I = Fan-out / (Fan-in + Fan-out)`

| Range | Meaning | Typical Files |
|-------|---------|---------------|
| 0.0-0.3 | Stable | Types, interfaces, core utilities |
| 0.3-0.7 | Balanced | Review for mixed responsibilities |
| 0.7-1.0 | Unstable | Entry points, barrel files (expected) |

### Graph Density

| Density | Assessment |
|---------|------------|
| <5% | Sparse (healthy) |
| 5-10% | Moderate |
| >10% | Dense (review coupling) |

## Decision Framework

**When to act on metrics:**

1. **Complexity hotspots**: Refactor when CC>20 or Cognitive>30, especially if file changes frequently
2. **Duplication**: Extract when same block appears 3+ times OR >50 tokens duplicated
3. **Coupling**: Investigate hubs with >10 connections; consider interface extraction
4. **Cycles**: Break all non-test-fixture cycles; use dependency inversion
5. **Data flow**: Remove unused parameters; handle or explicitly ignore returns
6. **Swallowed errors**: Fix high-confidence findings; document intentional swallowing

**When to ignore metrics:**

- Test fixtures with intentional cycles
- Entry points (`index.ts`) with high instability
- Generated code or vendor files
- Hotspots in stable, rarely-modified code
