# Facets

Scope: turn the major ways readers think about the corpus into facets and projections. Owns the facet model for Principle 4.

## Diagnostics → actions

- **Name the major perspectives readers use**, then create a facet or hub family for each. Common facets: product area, system component, role, task, lifecycle stage, environment, customer type, failure mode, release version, API surface, operational responsibility, compliance domain, data object, business process, source system or repository.
- **Express each facet with the lightest mechanism that fits**: a hub link or wiki hub page (`reference/principles/03-hubs-orientation-and-routing/index.md`), `CODEOWNERS` for the code-ownership projection (existing code ownership as an audience/provenance view, not a per-doc owner), or a mesh for a coupling projection (`reference/tools/git-mesh.md`).
- **Technical users start from code**: add component and API-surface paths.
- **Goals or permissions differ by reader**: add role paths — `reference/principles/01-organize-around-user-intent/readers-and-roles.md`.
- **Work moves through stages**: add a lifecycle path (setup → build → test → release).
- **Readers arrive by symptom**: add a failure-mode index — `reference/principles/02-typed-source-of-truth-topics/troubleshooting-and-runbooks.md`.
- **A topic is reachable only by knowing its directory**: add at least one non-tree entry point — `entry-points.md`.
