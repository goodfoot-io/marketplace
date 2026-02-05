# TypeScript Metrics Report

**Generated:** 2026-02-05T05:02:06.072Z
**Tool Version:** 0.0.1
**Workspace:** /workspace

---

## Summary

| Category | Key Metric | Value |
|----------|------------|-------|
| **Coupling** | Graph Density | 0.0076 |
| **Coupling** | Total Modules | 122 |
| **Coupling** | Hub Nodes | 10 |
| **Cycles** | Circular Dependencies | 1 |
| **Cycles** | Edges in Cycles | 2 |
| **Complexity** | Files Analyzed | 122 |
| **Complexity** | Functions | 2,840 |
| **Complexity** | Hotspots (high complexity) | 72 |
| **Duplication** | Density | 41.34% |
| **Duplication** | Duplicated Lines | 15,759 |
| **Duplication** | Duplicate Blocks | 9,509 |
| **Monorepo** | Packages | 14 |
| **Monorepo** | Dependency Depth | 1 |

---

## Coupling Metrics

### Hub Nodes (Top 10 by Total Degree)

Hub nodes are files with the most connections (imports + importers). High hub nodes indicate central points in the codebase.

| File | Total Degree | Fan-In | Fan-Out | Instability |
|------|-------------|--------|---------|-------------|
| `packages/claude-code-hooks/src/index.ts` | 13 | 1 | 12 | 0.92 |
| `packages/claude-code-hooks/src/types.ts` | 12 | 12 | 0 | 0.00 |
| `packages/mcp/wrapper/src/wrapper.ts` | 12 | 6 | 6 | 0.50 |
| `packages/claude-code-hooks/src/hooks.ts` | 9 | 6 | 3 | 0.33 |
| `packages/mcp/wrapper/src/agent-id.ts` | 9 | 9 | 0 | 0.00 |
| `packages/claude-code-hooks/src/outputs.ts` | 8 | 8 | 0 | 0.00 |
| `packages/claude-code-hooks/src/logger.ts` | 8 | 7 | 1 | 0.13 |
| `packages/claude-code-hooks/src/runtime.ts` | 8 | 2 | 6 | 0.75 |
| `packages/mcp/wrapper/src/logger.ts` | 6 | 6 | 0 | 0.00 |
| `packages/claude-code-hooks/tests/hooks.test.ts` | 5 | 0 | 5 | 1.00 |

**Interpretation:**
- **Instability = 0**: Highly stable, many dependents (types.ts, agent-id.ts, outputs.ts)
- **Instability = 1**: Highly unstable, depends on others but nothing depends on it (test files)
- **Instability ≈ 0.5**: Balanced coupling (wrapper.ts)

---

## Cycle Detection

### Circular Dependencies Found: 1

| Cycle | Files Involved | Edges |
|-------|---------------|-------|
| 1 | `pkg-b/src/cycle-a.ts` ↔ `pkg-b/src/cycle-b.ts` | 2 |

**Note:** This cycle exists in the test fixtures (`packages/typescript-metrics/test/fixtures/`) and is intentional for testing the cycle detection feature. No production cycles detected.

### SCC Size Distribution

| SCC Size | Count |
|----------|-------|
| 1 (no cycle) | 120 |
| 2 (2-node cycle) | 1 |

---

## Complexity Metrics

### Top 10 Hotspots (Highest Cognitive Complexity)

Functions with high cognitive complexity are harder to understand and maintain.

| Function | File | Line | Cyclomatic | Cognitive |
|----------|------|------|------------|-----------|
| `<anonymous>` | `mcp/browser/src/browser.ts` | 726 | 137 | 496 |
| `<anonymous>` | `mcp/test-agent/src/test-agent.ts` | 160 | 81 | 199 |
| `initializeServer` | `mcp/wrapper/src/wrapper.ts` | 547 | 78 | 147 |
| `<anonymous>` | `mcp/wrapper/src/wrapper.ts` | 633 | 78 | 147 |
| `<anonymous>` | `mcp/codebase/src/codebase.ts` | 105 | 58 | 152 |
| `<anonymous>` | `mcp/wrapper/tests/github-fetcher.test.ts` | 11 | 45 | 63 |
| `executeAgent` | `mcp/wrapper/src/wrapper.ts` | 851 | 35 | 70 |
| `parseCliArguments` | `mcp/wrapper/src/wrapper.ts` | 260 | 31 | 72 |
| `<anonymous>` | `mcp/browser/tests/browser.test.ts` | 8 | 39 | 45 |
| `formatErrorsAsYAML` | `typescript-hooks/src/typescript-check.ts` | 321 | 25 | 55 |

**Thresholds (SonarSource recommendations):**
- Cognitive Complexity > 15: Consider refactoring
- Cyclomatic Complexity > 10: Consider refactoring

---

## Duplication Metrics

| Metric | Value |
|--------|-------|
| Total Lines | 38,112 |
| Duplicated Lines | 15,759 |
| Duplication Density | 41.34% |
| Duplicate Blocks | 9,509 |

**Note:** High duplication density may include:
- Similar test patterns across test files
- Boilerplate code that's intentionally duplicated
- Configuration patterns

Consider using the `--min-tokens` flag to adjust sensitivity.

---

## Monorepo Structure

### Packages (14 total)

| Package | Description |
|---------|-------------|
| `@goodfoot/claude-code-hooks` | Claude Code hooks SDK |
| `@goodfoot/example` | Example package |
| `goodfoot-hooks` | Goodfoot-specific hooks |
| `@goodfoot/jest-test-utilities` | Jest test utilities |
| `@goodfoot/browser-mcp-server` | Browser MCP server |
| `@goodfoot/codebase-mcp-server` | Codebase MCP server |
| `@goodfoot/test-agent-mcp-server` | Test agent MCP server |
| `@goodfoot/mcp-wrapper-server` | MCP wrapper server |
| `@goodfoot/print` | Code analysis CLI tools |
| `@goodfoot/streamable-http-mcp-server-daemon` | Streamable HTTP daemon |
| `@goodfoot/test-utilities` | Vitest test utilities |
| `typescript-hooks` | TypeScript Claude Code hooks |
| `@goodfoot/typescript-metrics` | TypeScript metrics CLI |
| `@goodfoot/yarn-plugin-worktree-isolation` | Yarn worktree plugin |

### Dependency Depth: 1

The package dependency graph is shallow with a maximum depth of 1, indicating good package isolation.

---

## Recommendations

### High Priority

1. **browser.ts:726** - Cognitive complexity of 496 is extremely high. Consider breaking this function into smaller, focused functions.

2. **wrapper.ts** - Multiple high-complexity functions. Consider extracting configuration parsing and initialization logic.

3. **test-agent.ts:160** - Complexity of 199 suggests this could benefit from helper functions.

### Medium Priority

4. Review duplication in test files - some duplication may be acceptable for test clarity, but opportunities for shared fixtures may exist.

5. Consider adding more type exports with lower instability to create stable API boundaries.

### Low Priority

6. The intentional cycle in test fixtures is fine - no action needed.

---

## Command Used

```bash
/workspace/plugins/goodfoot/bin/typescript-metrics.mjs --format summary
```

### Available Options

```
--metrics <categories>  Comma-separated: coupling,cycles,complexity,duplication,monorepo
--format <format>       Output format: json (default) or summary
--skip-path-metrics     Skip expensive path calculations for large codebases
--layers <layers>       Custom layer order for directionality analysis
--min-tokens <n>        Minimum tokens for duplication detection (default: 50)
--top-k <n>             Number of hub nodes to report (default: 10)
```
