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

Generates health reports identifying where to focus refactoring effort.

## Run Analysis

```bash
# Analyze current package
./bin/typescript-metrics.mjs

# Save report
./bin/typescript-metrics.mjs > health-report.md

# Specific metrics only
./bin/typescript-metrics.mjs --metrics complexity,coupling

# Help
./bin/typescript-metrics.mjs --help
```

## Health Score (0-100)

| Score | Action |
|-------|--------|
| 75-100 | Maintain current practices |
| 50-74 | Address warnings before adding features |
| 0-49 | Prioritize fixes—defect risk is high |

Test fixture cycles are excluded from scoring.

## Acting on Results

### Complexity

**Load `references/complexity.md` for:** CC >10 or Cognitive >15.

**First principle:** Reduce what must be held in working memory at once.

The **Pattern** column tells you where complexity accumulates. The **code snippet** shows the actual structure. Ask: "What makes this hard to understand in one read?" Then reduce that—flatten nesting, extract named concepts, or separate concerns.

### Duplication

**Load `references/duplication.md` for:** Density >10% or duplicate blocks identified.

**First principle:** Single source of truth. Every copy is a liability—bugs fixed in one copy get missed in another.

The **code snippet** shows what's duplicated. The **location pairs** show where. Ask: "If this logic changes, will I remember to change all copies?" If not, extract.

### Coupling

**Load `references/coupling.md` for:** Hub nodes >10 connections or unexpected instability.

**First principle:** Depend on stable abstractions, not volatile implementations.

The **hub connections** show which files are entangled. High fan-in means many things break when this changes—make it more abstract. High fan-out means this file has many reasons to change—split it.

### Cycles

**Load `references/cycles.md` for:** Non-test cycles (type-only cycles are harmless).

**First principle:** Each module should be understandable and testable in isolation.

Cycles mean neither module stands alone. SCC size indicates severity: 2-file cycles need interface extraction; larger cycles indicate architectural confusion.

### Data Flow

**Load `references/dataflow.md` for:** Unused parameters or ignored returns with high confidence.

**First principle:** Code should be complete—everything declared should be used.

Unused parameters and ignored returns signal incomplete implementations or over-engineering. Remove what's unused, or finish what was started.

### Swallowed Errors

**Load `references/swallowed-errors.md` for:** High-confidence findings.

**First principle:** Failures should be visible, not hidden.

The **comment text** reveals intent. Comments saying "intentionally ignored" need verification. Comments saying "TODO" or absent comments need fixing. Default: catch only expected errors, rethrow unexpected ones.

## When to Skip

- **Test fixtures** — Intentional for testing
- **Entry points** — `index.ts` naturally has high instability
- **Generated code** — Don't refactor what's regenerated
- **Low-churn stable code** — If it works and rarely changes, leave it
