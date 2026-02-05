# Codebase Health Report

**Analyzed:** 122 files across 14 packages
**Generated:** 2026-02-05T05:31:33.832Z

## Health: 64/100 — Needs Improvement

*Weighted average: complexity (35%), duplication (25%), coupling (25%), cycles (15%)*

| Category | Score | Status |
|----------|-------|--------|
| Complexity | 75 | 🟢 Healthy |
| Duplication | 40 | 🔴 Critical |
| Coupling | 70 | 🟡 Review |
| Cycles | 70 | 🟡 Review |

---

## 🔴 Critical Issues

**1. `packages/mcp/browser/src/browser.ts:726` — Cognitive complexity 496**

This function is 33x over the threshold (15).
Cyclomatic complexity: 137 (14x over threshold).

**Recommended fix:** Extract conditional branches into named handler functions. Consider using a strategy pattern, lookup table, or state machine to replace nested conditionals.

---

## 🟡 Warnings

**2. Duplication density 18.0% (threshold: 10%)**

Found 3,143 duplicate code blocks.

**Recommended fix:** Review largest duplicate blocks for extraction opportunities.

**3. 6 unused optional parameters detected**

Parameters with default/optional values that no caller ever provides.
Example: `getContextLines(contextSize)` in packages/typescript-hooks/src/typescript-check.ts

**Recommended fix:** Review if these parameters are needed. Remove unused parameters or update callers to provide values.

---

## Complexity Hotspots

73 of 2,840 functions exceed thresholds:

| File | Line | Function | CC | Cognitive |
|------|------|----------|-----|-----------|
| packages/mcp/browser/src/browser.ts | 726 | <anonymous> | 137 🔴 | 496 🔴 |
| packages/mcp/test-agent/src/test-agent.ts | 160 | <anonymous> | 81 🔴 | 199 🔴 |
| packages/mcp/wrapper/src/wrapper.ts | 547 | initializeServer | 78 🔴 | 147 🔴 |
| packages/mcp/wrapper/src/wrapper.ts | 633 | <anonymous> | 78 🔴 | 147 🔴 |
| packages/mcp/codebase/src/codebase.ts | 105 | <anonymous> | 58 🔴 | 152 🔴 |
| packages/mcp/wrapper/tests/github-fetcher.test.ts | 11 | <anonymous> | 45 🔴 | 63 🔴 |
| packages/mcp/wrapper/src/wrapper.ts | 851 | executeAgent | 35 🔴 | 70 🔴 |
| packages/mcp/wrapper/src/wrapper.ts | 260 | parseCliArguments | 31 🔴 | 72 🔴 |
| packages/mcp/browser/tests/browser.test.ts | 8 | <anonymous> | 39 🔴 | 45 🔴 |
| packages/typescript-hooks/src/typescript-check.ts | 321 | formatErrorsAsYAML | 25 🔴 | 55 🔴 |

---

## Coupling Overview

| Metric | Value | Assessment |
|--------|-------|------------|
| Graph Density | 0.76% | Sparse (healthy) |
| Circular Dependencies | 1 | 1 (review below) |

**Hub nodes** (files with most connections):

| File | Fan-In | Fan-Out | Total | Instability |
|------|--------|---------|-------|-------------|
| packages/claude-code-hooks/src/index.ts | 1 | 12 | 13 | 0.92 (unstable) |
| packages/claude-code-hooks/src/types.ts | 12 | 0 | 12 | 0.00 (stable) |
| packages/mcp/wrapper/src/wrapper.ts | 6 | 6 | 12 | 0.50 (balanced) |
| packages/claude-code-hooks/src/hooks.ts | 6 | 3 | 9 | 0.33 (balanced) |
| packages/mcp/wrapper/src/agent-id.ts | 9 | 0 | 9 | 0.00 (stable) |

**Circular dependencies:**

- `packages/typescript-metrics/test/fixtures/monorepo-fixture/packages/pkg-b/src/cycle-a.ts` → `packages/typescript-metrics/test/fixtures/monorepo-fixture/packages/pkg-b/src/cycle-b.ts` *(test fixture — likely intentional)*

---

## Top Duplicate Blocks

Largest duplicates worth extracting:

| Location A | Location B | Tokens |
|------------|------------|--------|
| packages/test-utilities/src/vitest-matchers.ts:21 | packages/jest-test-utilities/src/jest-matchers.ts:25 | 640 |
| packages/test-utilities/tests/database-cleanup.test.ts:23 | packages/jest-test-utilities/tests/database-cleanup.test.ts:10 | 538 |
| packages/test-utilities/src/sql.ts:17 | packages/jest-test-utilities/src/sql.ts:13 | 309 |
| packages/test-utilities/tests/vitest-matchers.test.ts:1 | packages/jest-test-utilities/tests/jest-matchers.test.ts:1 | 308 |
| packages/mcp/test-agent/src/test-agent.ts:314 | packages/mcp/codebase/src/codebase.ts:773 | 259 |

---

## Data Flow Issues

Potential broken data flow patterns detected:

### Unused Parameters

Optional/default parameters that no caller ever provides:

| File | Function | Parameter | Type | Call Sites |
|------|----------|-----------|------|------------|
| packages/typescript-hooks/src/typescript-check.ts:69 | getContextLines | contextSize | default | 2 |
| packages/test-utilities/src/vitest-matchers.ts:40 | toEmit | timeoutInterval | default | 10 |
| packages/test-utilities/src/sql.ts:28 | getTestSql | options | default | 6 |
| packages/jest-test-utilities/src/sql.ts:24 | getTestSql | options | default | 6 |
| packages/jest-test-utilities/src/jest-matchers.ts:44 | toEmit | timeoutInterval | default | 10 |
| packages/mcp/browser/src/chrome-proxy.ts:44 | checkPort | host | default | 2 |

### Ignored Return Values

Function calls whose return values are discarded:

| File | Function | Return Type |
|------|----------|-------------|
| packages/streamable-http-mcp-server-daemon/src/example-http-server.ts:84 | resume | ReadStream & { fd: 0; } |

---

## Recommended Actions

- [ ] Refactor packages/mcp/browser/src/browser.ts:726 — reduce complexity
- [ ] Extract duplicate code into shared modules
- [ ] Review unused parameters — remove or wire up callers
- [ ] Add pre-commit complexity checks to prevent new hotspots

---

<details>
<summary><strong>📖 Metric Reference</strong></summary>

### Score Bands

| Score | Status | Meaning |
|-------|--------|---------|
| 75–100 | 🟢 Healthy | Within acceptable thresholds |
| 50–74 | 🟡 Review | Some issues worth addressing |
| 0–49 | 🔴 Critical | Significant issues requiring attention |

### Scoring Formulas

**Complexity Score:** Based on % of functions exceeding thresholds
- 0% hotspots → 100, ≤2% → 90, ≤5% → 75, ≤10% → 50, ≤20% → 25, >20% → 0

**Duplication Score:** Based on duplication density
- ≤2% → 100, ≤5% → 85, ≤10% → 70, ≤15% → 55, ≤20% → 40, ≤30% → 20, >30% → 0

**Coupling Score:** Starts at 100, penalized for:
- Each hub with >10 connections: -5 points
- Each circular dependency: -15 points
- Graph density >10%: -10 points

**Cycles Score:** Based on cycle count
- 0 cycles → 100, 1 cycle → 70, 2-3 cycles → 40, >3 cycles → 0

### Complexity Thresholds

| Metric | Description | Threshold |
|--------|-------------|-----------|
| Cyclomatic (CC) | Independent paths through code. Each `if`, `for`, `while`, `&&`, `\|\|` adds 1. | ≤ 10 |
| Cognitive | Mental effort to understand. Penalizes nesting and breaks in linear flow. | ≤ 15 |

*Thresholds based on SonarSource recommendations.*

### Coupling & Instability

| Metric | Description |
|--------|-------------|
| Fan-in | Files that import this module (dependents) |
| Fan-out | Files this module imports (dependencies) |
| Instability | `Fan-out / (Fan-in + Fan-out)` — 0 = stable, 1 = unstable |
| Graph Density | `edges / (nodes × (nodes-1))` — <5% sparse, 5-10% moderate, >10% dense |

**Instability interpretation:**
- **0.0–0.3 (Stable):** Core types, interfaces. Many dependents, few dependencies.
- **0.7–1.0 (Unstable):** Entry points, barrel files (`index.ts`). Expected for app code.
- **0.3–0.7 (Balanced):** May indicate mixed responsibilities — review for SRP.

### Duplication Detection

Token-based detection using Rabin-Karp rolling hash with identifier normalization.

- **Minimum tokens:** 100 (configurable via `--min-tokens`)
- **Density threshold:** 10%
- **Block:** A sequence of tokens appearing in 2+ locations

### Data Flow Analysis

Detects broken data flow patterns:

| Pattern | Description |
|---------|-------------|
| Unused Parameters | Optional/default params that no caller provides |
| Ignored Returns | Non-void return values that are discarded |
| Unread Writes | Properties written but never read (low confidence) |

### Notes

- Cycles in `test/fixtures/` directories are typically intentional test fixtures
- High instability on `index.ts` files is expected (barrel/entry point pattern)
- Test files are included in analysis; use `--exclude` patterns if needed
- Data flow analysis requires ≥2 call sites for confidence

</details>

