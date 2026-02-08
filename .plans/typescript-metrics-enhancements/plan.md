# Implementation Plan: typescript-metrics-enhancements

## Problem

The typescript-metrics health report provides valuable quantitative data but lacks contextual insights that would help developers prioritize and act on findings. Specifically:

1. **Hub coupling lacks context** — When a file has high fan-in, we don't know if dependents are tests (healthy) or production code (concerning).
2. **Orphaned packages go undetected** — Duplicate packages that are `private: true` with 0 consumers waste report space and inflate duplication metrics.
3. **Duplication lacks structure** — Token counts alone don't reveal what the duplicated code represents (e.g., "error recovery loop repeated 3x").

These enhancements were identified from the earlier investigative analysis of this codebase's own health report.

## Success Criteria

- [ ] Hub nodes show separate `productionFanIn` and `testFanIn` counts
- [ ] Report flags test-only dependents with "(all tests)" annotation
- [ ] Orphaned packages (`private: true` + 0 internal consumers) are detected
- [ ] Orphaned packages are annotated in duplication report: "*(orphaned — consider deletion)*"
- [ ] Duplicate blocks include `structuralUnit` classification (loop-body, function, switch-case, etc.)
- [ ] Report shows structural unit label for top duplicates
- [ ] All tests pass
- [ ] Types check correctly

## Constraints

- Reuse existing `isTestFile()` pattern from `SwallowedErrorAnalyzer` (lines 390-397)
- Preserve all existing `HubNode` fields (backward compatibility)
- Monorepo consumer counting must invert existing `crossBoundaryMatrix`
- Structural classification should be heuristic-based (not ML)
- New fields should be optional to maintain backward compatibility
- Stub methods must throw `Error('Not implemented')` to ensure tests fail initially

## Out of Scope

- Catch block throwable enumeration (requires inter-procedural analysis)
- Shared mutable state tracking (requires scope chain analysis)
- Metric delta predictions (deferred to future work)
- External npm consumer detection (requires network requests)

## Type Definitions

These types are shared across tasks and defined upfront for clarity:

```typescript
// Task 1: Test/production classification
// Added to HubNode interface (optional for backward compatibility)
productionFanIn?: number;
testFanIn?: number;

// Task 3: Package lifecycle
type PackageLifecycleState = 'active' | 'orphaned';

interface PackageLifecycle {
  isPrivate: boolean;
  consumerCount: number;
  state: PackageLifecycleState;
}

// Task 5: Structural unit classification
type StructuralUnitType = 'function' | 'loop-body' | 'switch-case' | 'conditional' | 'block' | 'unknown';

interface StructuralUnit {
  type: StructuralUnitType;
  label: string;  // Human-readable label, e.g., "message processing loop"
  repetitionCount: number;
}

// Added to DuplicateBlock interface (optional for backward compatibility)
structuralUnit?: StructuralUnit;

// Added to MonorepoMetrics interface (optional for backward compatibility)
packageLifecycles?: Map<string, PackageLifecycle>;
```

## Tasks

### Task 1: Add test/production edge classification to DependencyGraphAnalyzer

**Rationale:** Enables distinguishing healthy test-file dependencies from concerning production dependencies. This is foundational for accurate coupling assessment.

**Files:**
- `packages/typescript-metrics/src/types.ts`
- `packages/typescript-metrics/src/lib/DependencyGraphAnalyzer.ts`
- `packages/typescript-metrics/test/DependencyGraphAnalyzer.test.ts`

| Phase | Deliverable | Validation |
|-------|-------------|------------|
| Types & Stubs | Add `productionFanIn?: number`, `testFanIn?: number` to `HubNode` interface; add private `isTestFile(path: string): boolean` method that throws `Error('Not implemented')` | typecheck |
| Tests | `it.skip`: hub node has correct productionFanIn/testFanIn split; test files classified correctly; mixed dependents split accurately; file with zero dependents has productionFanIn=0 and testFanIn=0; existing tests continue to pass | tests run |
| Implementation | Copy `isTestFile()` pattern from SwallowedErrorAnalyzer; in `findHubs()`, partition `fanInFiles` by test classification; populate new fields | tests pass |

**Dependencies:** None

### Task 2: Update ReportGenerator to show test/production split for hubs

**Rationale:** Users need to see the test/production split in the report to understand coupling health.

**Files:**
- `packages/typescript-metrics/src/lib/ReportGenerator.ts`
- `packages/typescript-metrics/test/ReportGenerator.test.ts` (create if not exists)

| Phase | Deliverable | Validation |
|-------|-------------|------------|
| Types & Stubs | No new types needed (uses HubNode from Task 1) | typecheck |
| Tests | `it.skip`: hub table shows "(all tests)" when productionFanIn=0; hub shows split "3 prod / 2 test" for mixed; existing hub formatting preserved when new fields undefined | tests run |
| Implementation | In the Coupling Overview section of `generate()` (lines 294-335), check `productionFanIn`/`testFanIn`; add annotation to fan-in column showing split or "(all tests)" | tests pass |

**Dependencies:** Task 1

### Task 3: Add package lifecycle detection to MonorepoAnalyzer

**Rationale:** Orphaned packages (`private: true` + 0 consumers) inflate duplication metrics and should be flagged for deletion.

**Files:**
- `packages/typescript-metrics/src/types.ts`
- `packages/typescript-metrics/src/lib/MonorepoAnalyzer.ts`
- `packages/typescript-metrics/test/MonorepoAnalyzer.test.ts`
- `packages/typescript-metrics/test/fixtures/monorepo-fixture/packages/pkg-orphaned/` (create test fixture)

| Phase | Deliverable | Validation |
|-------|-------------|------------|
| Types & Stubs | Add `PackageLifecycleState` type and `PackageLifecycle` interface; add `analyzeLifecycles(packages: WorkspacePackage[], matrix: CrossBoundaryMatrix): Map<string, PackageLifecycle>` stub that throws `Error('Not implemented')` | typecheck |
| Tests | `it.skip`: private package with 0 consumers marked orphaned; public package not marked orphaned; private package WITH consumers not marked orphaned; existing tests continue to pass | tests run |
| Implementation | Create `pkg-orphaned` fixture with `"private": true` and no dependents; invert `crossBoundaryMatrix` to count consumers per package; check `private` field in package.json; classify state as 'orphaned' when private + 0 consumers, else 'active' | tests pass |

**Dependencies:** None (can run in parallel with Task 1)

### Task 4: Add lifecycle to MonorepoMetrics and flag in reports

**Rationale:** Report should surface orphaned packages prominently so they can be deleted.

**Files:**
- `packages/typescript-metrics/src/types.ts`
- `packages/typescript-metrics/src/lib/MonorepoAnalyzer.ts` (update `analyze()` to call `analyzeLifecycles()`)
- `packages/typescript-metrics/src/lib/ReportGenerator.ts`

| Phase | Deliverable | Validation |
|-------|-------------|------------|
| Types & Stubs | Add `packageLifecycles?: Map<string, PackageLifecycle>` to `MonorepoMetrics` | typecheck |
| Tests | `it.skip`: report shows orphaned package warning in issues section; duplication section annotates blocks in orphaned packages with "*(orphaned — consider deletion)*" | tests run |
| Implementation | In `MonorepoAnalyzer.analyze()`, call `analyzeLifecycles()` and include result in returned `MonorepoMetrics`; in ReportGenerator, add warning issue for orphaned packages; annotate duplicate blocks in orphaned packages | tests pass |

**Dependencies:** Task 3

### Task 5: Add structural unit classification to DuplicationDetector

**Rationale:** Knowing the type of duplicated structure (function, loop body, switch case) helps developers understand extraction opportunities.

**Files:**
- `packages/typescript-metrics/src/types.ts`
- `packages/typescript-metrics/src/lib/DuplicationDetector.ts`
- `packages/typescript-metrics/test/DuplicationDetector.test.ts`

| Phase | Deliverable | Validation |
|-------|-------------|------------|
| Types & Stubs | Add `StructuralUnitType` type and `StructuralUnit` interface; add `structuralUnit?: StructuralUnit` to `DuplicateBlock`; add private `classifyStructure(codeSnippet: string, file: string): StructuralUnit \| undefined` stub that throws `Error('Not implemented')` | typecheck |
| Tests | `it.skip`: function duplication classified as "function"; loop body classified as "loop-body"; switch case classified as "switch-case"; top-level statements classified as "block" or "unknown"; existing tests continue to pass | tests run |
| Implementation | Parse duplicate region with `ts.createSourceFile`; walk AST to identify enclosing structure type; generate human-readable label from identifiers; return undefined for unclassifiable structures | tests pass |

**Dependencies:** None (can run in parallel with Tasks 1 and 3)

### Task 6: Show structural labels in duplication report

**Rationale:** Report should show the structural classification to help developers understand what's duplicated.

**Files:**
- `packages/typescript-metrics/src/lib/ReportGenerator.ts`

| Phase | Deliverable | Validation |
|-------|-------------|------------|
| Types & Stubs | No new types needed (uses StructuralUnit from Task 5) | typecheck |
| Tests | `it.skip`: duplicate table includes "Structure" column; structural labels shown for classified blocks; "-" shown for unclassified blocks | tests run |
| Implementation | Add "Structure" column to duplicate table in `formatDuplicationSection`; show `structuralUnit.label` if present, or "-" if undefined | tests pass |

**Dependencies:** Task 5

## Validation Commands

### packages/typescript-metrics
- Type check: `cd packages/typescript-metrics && yarn typecheck`
- Test: `cd packages/typescript-metrics && yarn test`
- Lint: `cd packages/typescript-metrics && yarn lint`

## Exploration Summary

### Key Patterns Discovered

1. **Analyzer pattern**: Each analyzer is a class with `analyze()` method returning typed metrics
2. **Test file detection**: `isTestFile()` already exists in SwallowedErrorAnalyzer (lines 390-397) — reuse this pattern:
   ```typescript
   private isTestFile(file: string): boolean {
     return (
       file.includes(".test.") ||
       file.includes(".spec.") ||
       file.includes("__tests__") ||
       file.includes("/test/") ||
       file.includes("/tests/")
     );
   }
   ```
3. **Report generation**: ReportGenerator takes MetricsResult and produces markdown with tables
4. **Cross-boundary matrix**: MonorepoAnalyzer already builds `Map<string, Map<string, number>>` for package dependencies

### Existing Infrastructure Leveraged

- `DependencyGraphAnalyzer.findHubs()` (lines 247-280) already collects `fanInFiles` — just need to partition by test classification
- `MonorepoAnalyzer.buildCrossBoundaryMatrix()` (lines 222-253) — inverting this gives consumer counts
- `DuplicationDetector` already extracts `codeSnippet` — can reparse for structural classification
- TypeScript AST parsing already used throughout codebase

### Test Fixture Location

- `packages/typescript-metrics/test/fixtures/monorepo-fixture/` — contains 3 packages with cycles, duplicates, and complexity hotspots
- Task 3 requires creating `pkg-orphaned` fixture with `"private": true`

## Task Dependency Order

1. Task 1: Test/production edge classification - no dependencies
2. Task 3: Package lifecycle detection - no dependencies
3. Task 5: Structural unit classification - no dependencies
4. Task 2: Hub report annotation - depends on Task 1
5. Task 4: Lifecycle reporting - depends on Task 3
6. Task 6: Structural labels in report - depends on Task 5

**Parallelization opportunities:**
- Tasks 1, 3, 5 can all run in parallel (no dependencies)
- Tasks 2, 4, 6 must wait for their respective dependencies
