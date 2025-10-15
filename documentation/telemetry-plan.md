# Telemetry Implementation Plan - Compare Branch Extension

## Objectives
1. **Error capturing with full stack traces** (highest priority)
2. **Privacy-first data sanitization** (all paths, branch names hashed)
3. Basic usage tracking for product insights
4. Proper VS Code telemetry settings integration
5. Performance-conscious implementation (async, sampled, batched)

## Tasks (Sequential)

### ✅ Task 1: Create telemetry service infrastructure with privacy layer
**Status:** COMPLETED
**Files:** `/workspace/packages/compare-branch-extension/src/utils/telemetry.ts`
- [x] Create `TelemetryService` class
- [x] Implement PII sanitization (branch names, paths, URLs)
- [x] Add null-safe wrapper methods (sendError, sendEvent, sendPerformance)
- [x] Event naming convention: `Category.EventName`
- [x] Error categorization support
- [x] Sampling utility
- [x] Respect VS Code telemetry settings and development mode

### ✅ Task 2: Initialize telemetry early in extension activation
**Status:** COMPLETED
**Files:** `/workspace/packages/compare-branch-extension/src/extension.ts`
- [x] Initialize telemetry after line 41 (after initializeLoggers)
- [x] Wrap in try-catch (never throw)
- [x] Check `env.isTelemetryEnabled`
- [x] Store in module variable
- [x] Track activation start event

### ✅ Task 3: Add multi-stage activation tracking
**Status:** COMPLETED
**Files:** `/workspace/packages/compare-branch-extension/src/extension.ts`
- [x] Track each stage:
  1. Git repository discovery (lines 76-96)
  2. GitService creation (lines 98-118)
  3. Provider initialization (lines 136-145)
  4. Command registration (line 142)
  5. Tree view creation (line 148)
  6. Lazy data loading (line 837-876)
- [x] Track success/failure/degraded mode
- [x] Track activation completion event

### ✅ Task 4: Enhance error handlers with telemetry
**Status:** COMPLETED
**Files:** `/workspace/packages/compare-branch-extension/src/utils/logger.ts`, `/workspace/packages/compare-branch-extension/src/extension.ts`
- [x] Create `reportError()` function
- [x] Enhance `formatErrorForTelemetry()` to preserve stack
- [x] Add contextual properties
- [x] Integrated with existing error handlers
- [x] Rate limiting (100 errors/session in TelemetryService)

### ✅ Task 5: Add git service error telemetry
**Status:** COMPLETED
**Files:** `/workspace/packages/compare-branch-extension/src/services/GitService.ts`, `/workspace/packages/compare-branch-extension/src/state/GitStatusManager.ts`, `/workspace/packages/compare-branch-extension/src/state/BranchStateManager.ts`
- [x] Auto-detect source branch failures
- [x] Branch validation failures
- [x] Branch fetch failures
- [x] State persistence errors
- [x] **NO** tracking of every git operation (performance preserved)

### ✅ Task 6: Add usage tracking with sampling
**Status:** COMPLETED
**Files:** `/workspace/packages/compare-branch-extension/src/extension.ts`
- [x] Command executions (10% sampling for high-frequency)
- [x] Feature usage tracking (view modes, multi-select)
- [x] Performance metrics (duration measurements)
- [x] Branch selection method tracking
- [x] **NO** individual file operations tracked

### ✅ Task 7: Add error tracking to providers and file watchers
**Status:** COMPLETED
**Files:** `/workspace/packages/compare-branch-extension/src/fileMonitoring/fileWatcher.ts`, `/workspace/packages/compare-branch-extension/src/providers/*.ts`
- [x] File watcher errors (aggregated batch metrics)
- [x] Git content provider failures
- [x] Drag-and-drop operation failures
- [x] Tree provider loading errors
- [x] 10% sampling for aggregated batch events

### ✅ Task 8: Update deactivate() and add testing strategy
**Status:** COMPLETED
**Files:** `/workspace/packages/compare-branch-extension/src/extension.ts`, `/workspace/documentation/telemetry-testing-checklist.md`
- [x] Make deactivate() async
- [x] Await telemetry disposal
- [x] Create comprehensive testing checklist
- [x] Document manual verification steps
- [x] Add Application Insights query examples

## Event Naming Convention
- `Extension.ActivationStarted`, `Extension.ActivationCompleted`, `Extension.ActivationFailed`
- `Error.GitOperationFailed`, `Error.CommandExecutionFailed`
- `Performance.RefreshCompleted`, `Performance.GitOperationCompleted`
- `Usage.CommandExecuted`, `Usage.ViewModeChanged`

## Privacy Safeguards
- Hash non-common branch names (keep main/master/develop)
- Strip user paths from stack traces (<workspace>/, /Users/<user>/)
- Remove git URLs entirely (<url>)
- Sanitize all context properties

## Sampling Strategy
- High-frequency events: 10% sampling
- User commands: 100% (sanitized)
- Errors: 100% (rate limited to 100/session)
- Performance: Aggregated only (p50, p95, p99)
