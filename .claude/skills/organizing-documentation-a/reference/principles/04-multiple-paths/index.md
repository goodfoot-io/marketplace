# Principle 4 — Provide multiple paths to the same topic

Scope: provide enough high-scent paths for the ways readers actually seek — the directory tree is only one hierarchy. The goal is enough paths, not every possible path.

## In the repo

The directory tree is one hierarchy. Add projections for the other ways people seek: a lifecycle path (setup → build → test → release), a role path, a failure-mode index, an API-surface path. Express them with hub links, wiki hub pages, `CODEOWNERS` (the code-ownership projection), and meshes. `git mesh tree <glob>` surfaces a change's blast radius as a coupling-based path (`reference/tools/git-mesh.md`).

## Route within this principle

- **You must turn reader perspectives into navigable facets**: read `facets.md` — turn the ways readers think into facets and projections.
- **You must pick one backbone and demote the rest**: read `hierarchy.md` — choose one default backbone; demote other hierarchies to projections.
- **You must wire prerequisite, next-step, reference, and recovery links**: read `cross-linking.md` — inbound/outbound links for prerequisites, next steps, reference, and recovery.
- **You must add the entry points each reader uses**: read `entry-points.md` — entry points matching how each reader and agent looks.
- **You want a matrix/table projection over facets**: read `matrix-views.md` — a table projection over two facets, with honest cells.
- **A page has no inbound links or dead-ends the reader**: read `orphans-and-dead-ends.md` — find and fix no-inbound and no-onward pages.
