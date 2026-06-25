# How to build and maintain hubs

Scope: create and repair hubs that orient and route without owning the facts they link to. How-to (author stage). Applies Principle 3.

## 1. Decide if a hub is needed

Create one for a high-volume or high-complexity domain, workflow, role, lifecycle stage, incident class, product area, or architecture layer. **Threshold**: a directory with three or more docs and no overview → add a hub; fewer → let the directory name carry it (a hub that says little is worse than none). Inventory existing hubs with `git ls-files '**/README.md' '**/AGENTS.md'`; a "hub" that is really a long article → split orientation from content.

## 2. Scope it

State the scope in the opening line; add explicit exclusions and links to adjacent hubs; label the audience and prior knowledge; choose one dominant organizing frame (domain, workflow, role, lifecycle, problem class) and make it visible in the headings.

## 3. Orient the reader

Add a where-you-are paragraph and "use this when" guidance; elevate "start here"; separate beginner from expert, normal from emergency, learning from action, current from legacy; add "not the same as" notes; say what to read first and what to skip; add situational doors; keep it clear for direct grep arrivals.

## 4. Select and group links

Include only links serving the scope; move too-detailed links down; add missing source-of-truth and high-intent paths; remove redundant links; update or redirect stale ones; replace non-source-of-truth targets; group by intent/lifecycle/role/system/failure; elevate or demote; add risk/permission/version cues before the click. Every link carries scent — state when and why to follow it.

## 5. Choose hub content

Enough overview to orient; a domain map where relationships matter; common tasks, failures, concepts, and reference links; decision-record links where rationale affects use; owner/escalation and maturity/status indicators; "new here?" and "under incident pressure?" guidance.

## 6. Keep facts out

Restated owned content → a summary plus a link; volatile detail → the owning page or a generated reference; duplicated status/ownership/version → generate or link to the metadata. The hub's authority is routing and orientation, not the facts.

Related: why hubs route, not own `../explanation/principles/03-hubs-orientation-and-routing.md`; a hub is a genre `../reference/page-genres.md`; write the link scent `strengthen-scent.md`; the wiki hub threshold `../reference/tools/wiki.md`.
