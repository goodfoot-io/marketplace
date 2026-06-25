# Hub necessity

Scope: decide where a hub is needed and where the directory name already carries it. Owns the hub threshold for Principle 3.

## The threshold

A directory that holds three or more docs with no overview earns a hub. Fewer than that, let the directory name carry it — do not build a hub that says little and must be kept current for little benefit (mirrors the `wiki` hub threshold, `reference/tools/wiki.md`).

## Diagnostics → actions

- **A domain, workflow, role, lifecycle stage, incident class, or architectural layer is high-volume or high-complexity, or readers rely on search, memory, or tribal knowledge to navigate it**: create a hub — pick its organizing frame in `hub-scope.md`.
- **A module needs its own working norms**: add a nested `AGENTS.md` or README at that boundary — `reference/principles/01-organize-around-user-intent/readers-and-roles.md`.
- **Existing hubs may overlap or rot**: audit them for overlap, freshness, routing quality, and link accuracy — `reference/tools/inventory-grep.md`.
- **A "hub" is really a long article**: split orientation from source-of-truth content — `anti-duplication.md`.
- **Two hubs overlap**: merge them, clarify scope, or cross-link — `hub-scope.md`.
- **A hub is obsolete**: archive or redirect it with a link — `reference/principles/04-multiple-paths/orphans-and-dead-ends.md`.
