# Compare Branch Extension - Filter Menu Implementation Plan (v2)

## Executive Summary

This plan revises the filter button strategy for the Compare Branch tree view so it relies only on stable, public VS Code extension APIs. The toolbar button now contributes a submenu that lists the change-type filters (Modified, Added, Deleted, Renamed) plus a `Clear All` action. Filter state persists per workspace via `context.workspaceState`, the menu reflects selections using the built-in `toggled` affordance, and the toolbar icon swaps between `filter` and `filter-filled` by conditionally showing separate menu items. Menu commands remain no-ops for tree contents, laying the groundwork for future filtering without touching private workbench internals or attempting to keep the menu open after selection.

## Core Features

1. **Toolbar Filter Submenu**: Add a `compareBranchV3.filterMenu` submenu referenced from the view title so clicking the toolbar entry opens the filter list using the stock dropdown.
2. **Public API Toggle UX**: Represent filter checkboxes with the native `toggled` property and rely on built-in leading checkmarks; no custom action view items or CSS.
3. **Icon Swap via Context**: Contribute two view-title submenu entries (icons `filter` / `filter-filled`) that are mutually exclusive through `when` clauses keyed off `compareBranchV3.filterActive`.
4. **Persisted State**: Store active filters under `compareBranchV3.filterState` in `workspaceState`, hydrate during activation, and keep context keys in sync.
5. **Future-Ready Logic**: Expose filter state to providers but leave actual tree filtering for a later phase.

## Architecture Overview

### Component Touchpoints

```
package.json (contributions)
└── submenus → declare compareBranchV3.filterMenu
└── menus.view/title → toolbar entries for empty vs active filters
└── menus.compareBranchV3.filterMenu → Clear All + filter toggles

src/extension.ts
├── registerCommand('compareBranchV3.filter.toggle')
├── registerCommand('compareBranchV3.filter.clear')
├── filter state + context synchronization

src/state/filterStateManager.ts (new)
└── Set-backed state with events + serialization helpers

src/types/filter.ts (new)
└── helpers for filter identifiers and iteration order
```

### Key Decisions

1. **Declarative Menu Composition**: Use `contributes.submenus` and `contributes.menus` exclusively; no `MenuRegistry` imports.
2. **Context Keys Only for Visibility**: Leverage `setContext` to drive the icon swap and `toggled` expressions; avoid per-item enablement keys unless required.
3. **Single Toggle Command**: Register one `compareBranchV3.filter.toggle` command that accepts the filter id as an argument and flips membership in the manager.
4. **Menu Close Behavior**: Accept that the dropdown closes after each command invocation, matching public API behavior.
5. **Accessibility Defaults**: Rely on VS Code’s native checkmark rendering and tooltips; no DOM manipulation.

## Detailed Implementation Plan

### Phase 1: Contribution Wiring

#### 1.1 package.json Updates

**Reference**: `/workspace/.worktrees/compare-branch-extension/packages/compare-branch-extension-v3/package.json`

- Define commands:
  - `compareBranchV3.filter.toggle` (accepts `{ filter: 'modified' | ... }`).
  - `compareBranchV3.filter.clear` (with `enablement: compareBranchV3.filterActive`).
- Declare `compareBranchV3.filterMenu` in `contributes.submenus` with title “Filter Changes”.
- Add two `view/title` menu entries that point directly at the submenu—mirroring Source Control’s `scm.action.more` pattern:
  - When `view == compareBranchV3 && !compareBranchV3.filterActive`, show a submenu entry with `submenu: compareBranchV3.filterMenu`, icon `$(filter)`, and group `navigation@2` (adjust ordering as needed alongside existing toolbar items).
  - When `view == compareBranchV3 && compareBranchV3.filterActive`, show a submenu entry with `submenu: compareBranchV3.filterMenu`, icon `$(filter-filled)`, and the same group.
- Populate the submenu via `contributes.menus['compareBranchV3.filterMenu']`:
  - `compareBranchV3.filter.clear` in group `0_clear`.
  - Separator.
  - Four `compareBranchV3.filter.toggle` entries (one per filter) in `1_filters`, each with:
    - `toggled: compareBranchV3.filter.<id>`.
    - `command.arguments: [{ filter: '<id>' }]`.
- (Optional) Hide menu-driving commands such as `compareBranchV3.filter.clear` and `compareBranchV3.filter.toggle` from the Command Palette via `menus.commandPalette` entries set to `when: false`.

#### 1.2 Activation Event Review

- Re-use the existing `onStartupFinished` activation and rely on menu context; no new events required.

### Phase 2: Filter State Infrastructure

#### 2.1 Define Filter Types

- Introduce `src/types/filter.ts` exporting:
  - `CompareBranchFilter` union type (`'modified' | 'added' | 'deleted' | 'renamed'`).
  - `ALL_FILTERS` ordered array.
  - `isCompareBranchFilter(value: unknown)` type guard for command argument validation.

#### 2.2 State Manager

- Create `src/state/filterStateManager.ts` exposing:
  - Event emitter for state changes.
  - `hydrate({ activeFilters })`, `toggle({ filter })`, `clear()`.
  - `serialize()` returning sorted string array for persistence.
  - Getter utilities for UI queries.

### Phase 3: Command Registration + Context Sync

#### 3.1 Command Wiring in `extension.ts`

**Reference**: `/workspace/.worktrees/compare-branch-extension/packages/compare-branch-extension-v3/src/extension.ts`

- Instantiate `FilterStateManager` during activation and hydrate from `workspaceState.get('compareBranchV3.filterState', [])` (validate against `ALL_FILTERS`).
- Register commands:
  - `compareBranchV3.filter.toggle`: destructure `{ filter }`, guard with `isCompareBranchFilter`, update manager, persist, refresh contexts.
  - `compareBranchV3.filter.clear`: call manager.clear, persist, refresh contexts.
- Expose manager on the shared provider container if future phases need it.

#### 3.2 Context Keys

- Maintain:
  - `compareBranchV3.filterActive` (boolean) — `manager.activeCount > 0`.
  - `compareBranchV3.filter.<id>` (boolean per filter).
- Implement `updateFilterContextKeys()` helper that sets these values after any state change.
- Call helper post-hydration and after each command run.

### Phase 4: Menu Behavior & UX Notes

- Accept default dropdown closure; document future UX improvements only if API evolves.
- Provide descriptive titles in `package.json` (e.g., “Modified Changes”).
- Ensure `compareBranchV3.filter.clear` uses `enablement` instead of hiding via `when`, matching disabled appearance conventions.
- Optionally add tooltip text to the toolbar commands via `command.title` localization.

### Phase 5: Persistence

- Serialize filter selections on each update with `await context.workspaceState.update('compareBranchV3.filterState', manager.serialize())`.
- Guard against invalid stored values (filter providers may change) by intersecting with `ALL_FILTERS` during hydration.
- Wrap updates in `void` to avoid blocking UI but log on failure using existing `formatError` helper.

### Phase 6: Integration Hooks (Deferred)

- Expose `FilterStateManager` to `FastLoadingProvider` via dependency injection but leave filtering logic disabled until the follow-up story.
- Provide `onDidChange` subscription to tree providers so they can react later without API churn.

## Testing Strategy

1. **Unit Tests** (`test/suite`)
   - FilterStateManager: toggle, clear, serialize/deserialize round trips, invalid input guard.
   - Command handler argument validation and context key updates (use spies on `vscode.commands.executeCommand`).
2. **Integration Tests**
   - Extend activation test to assert `compareBranchV3.filter.toggle` and `compareBranchV3.filter.clear` appear in `vscode.commands.getCommands(true)`.
   - Verify persisted filters survive deactivate/activate cycles using temporary workspace state.
3. **Manual QA Checklist**
   - Toolbar icon switches between `filter` and `filter-filled` when toggling filters.
   - Individual filter items show/hide checkmark via `toggled` automatically.
   - `Clear All` disabled when no filters active and enabled otherwise.
   - Filter selections survive VS Code reload.

## Risks & Mitigations

1. **Menu Closes After Toggle**: Communicate in release notes; revisit if VS Code introduces a keep-open API.
2. **Context Key Drift**: Centralize context updates in one helper and add unit tests to ensure parity with state.
3. **Future Filter Types**: Encapsulate filter metadata in `ALL_FILTERS` so adding types remains declarative; include migration notes in documentation.

## References

1. Stack Overflow guidance on view-title toggles without private APIs (mirrors the context swap approach).〔https://stackoverflow.com/questions/65905635/how-to-add-toggle-menu-to-view-title-with-vscode-extension〕
2. VS Code Timeline filter implementation for submenu inspiration (core workbench source). `/documentation/vscode/src/vs/workbench/contrib/timeline/browser/timeline.contribution.ts`
3. Existing extension activation flow and context helpers. `/workspace/.worktrees/compare-branch-extension/packages/compare-branch-extension-v3/src/extension.ts`


