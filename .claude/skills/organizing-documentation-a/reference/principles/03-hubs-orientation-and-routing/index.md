# Principle 3 — Make hubs orientation and routing layers

Scope: build hubs that tell a reader where they are, which path to choose, and why — before the click — without duplicating the facts that other layers own.

## In the repo

The root README is the product hub; `AGENTS.md`/`CLAUDE.md` are agent hubs; a README at each major module boundary is a local hub. A wiki hub page serves a cross-cutting domain (`reference/tools/wiki.md`). A hub routes and orients; it does not restate code facts. Inventory existing hubs with `git ls-files '**/README.md' '**/AGENTS.md' 'CLAUDE.md' '**/CLAUDE.md'` (`reference/tools/inventory-grep.md`).

## Route within this principle

- **You must decide where a hub is warranted**: read `hub-necessity.md` — the three-or-more-docs threshold and the don't-build-an-empty-hub rule.
- **A hub needs a clear scope and organizing frame**: read `hub-scope.md` — scope, audience, organizing frame, and exclusions.
- **A hub must tell readers where to start and what to skip**: read `orientation.md` — where-am-I, what-to-read-first, and what-to-skip cues.
- **You must choose and group the hub's links**: read `link-selection.md` — which links belong, how to group them, and risk cues before the click.
- **You must decide what a hub holds beyond links**: read `hub-content.md` — what a hub holds beyond links: overview, map, status, onboarding/incident paths.
- **A hub is restating facts and will go stale**: read `anti-duplication.md` — keep hubs about routing, not facts, so they do not go stale.
