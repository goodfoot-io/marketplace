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

Analyze codebase health. Generates markdown reports identifying where to focus refactoring effort.

## Run Analysis

```bash
# Analyze current package
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/typescript-metrics.mjs

# Save report
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/typescript-metrics.mjs > health-report.md

# Specific metrics only
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/typescript-metrics.mjs --metrics complexity,coupling

# Help
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/typescript-metrics.mjs --help
```

## Why These Metrics Matter

Research consistently shows these metrics predict defects and maintenance costs:

**Complexity** — Functions with cyclomatic complexity >10 show 3x higher defect rates. Cognitive complexity >15 indicates code difficult to understand and safely modify.

**Coupling** — High fan-in/fan-out correlates with change ripple effects. When one file change requires touching many others, coupling is too high.

**Duplication** — Duplicated code doubles defect risk—bugs must be fixed multiple times, and one copy is often missed.

**Cycles** — Circular dependencies cause initialization bugs, make testing harder, and indicate tangled responsibilities.

**Data Flow** — Unused parameters and ignored returns signal API rot and incomplete implementations.

**Swallowed Errors** — Silent failures are the hardest bugs to diagnose. Error handling that hides problems creates debugging nightmares.

## Health Score (0-100)

| Score | Meaning |
|-------|---------|
| 75-100 | Healthy — maintain practices |
| 50-74 | Needs attention — address warnings |
| 0-49 | Critical — prioritize fixes |

## Acting on Results

### Complexity Hotspots

**Load `references/complexity.md` when:** Any function has CC >10 or Cognitive >15.

Complex code is hard to hold in working memory. If you can't understand a function in one read, neither can future maintainers.

**Quick fixes:**
- Extract guard clauses to reduce nesting
- Replace conditionals with lookup tables
- Split functions that do multiple things

### Duplication

**Load `references/duplication.md` when:** Density >10% or specific duplicate blocks identified.

Every copy of logic is a liability. When behavior needs to change, every copy must be found and updated identically.

**Quick fixes:**
- Extract common code to shared function
- Use higher-order functions for similar-but-different patterns
- Create shared module for cross-package duplicates

### Coupling

**Load `references/coupling.md` when:** Hub nodes have >10 connections, or instability seems wrong for file type.

Highly coupled modules change together. If changing `types.ts` requires changing 15 other files, that coupling will slow every future change.

**Quick fixes:**
- Depend on interfaces, not implementations
- Extract shared dependencies to lower layer
- Enforce module boundaries with explicit public APIs

### Circular Dependencies

**Load `references/cycles.md` when:** Any non-test cycles detected (ignore type-only cycles).

Cycles mean neither module can be understood or tested in isolation. They often indicate responsibilities that should be merged or separated with clearer boundaries.

**Quick fixes:**
- Extract shared interface to third file
- Merge tightly-coupled modules
- Use dependency injection

### Data Flow Issues

**Load `references/dataflow.md` when:** Unused parameters or ignored returns with high confidence.

Dead code paths indicate either unfinished work or over-engineering. Either remove the unused parts or complete the intended usage.

**Quick fixes:**
- Remove truly unused parameters
- Handle or explicitly discard return values
- Document why parameters are kept if intentional

### Swallowed Errors

**Load `references/swallowed-errors.md` when:** High-confidence findings (empty catch blocks, ignored promises).

Errors exist to communicate problems. Swallowing them creates silent failures that surface far from their cause, making debugging far harder than it needs to be.

**Quick fixes:**
- Tighten the catch to only expected error types (e.g., file not found)
- Rethrow unexpected errors (default behavior)
- Log only when failure doesn't affect user experience

## When to Ignore Metrics

Not every warning needs action:

- **Test fixtures** — Intentional complexity or cycles for testing
- **Entry points** — `index.ts` files naturally have high instability
- **Generated code** — Don't refactor auto-generated files
- **Stable, unchanged code** — Low-churn code with no bug history is low priority regardless of complexity
