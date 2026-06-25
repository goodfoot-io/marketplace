# Tree testing (repo proxy)

Scope: test whether the current structure leads a reader to the right file. Owns structure validation for Principle 8.

## The repo proxy

Give a reader or agent a real retrieval task and watch whether the directory tree and hub links lead them to the right file using navigation only — no full-text search — which isolates the hierarchy from grep.

## Diagnostics → actions

- **They find the right file from the structure**: treat it as evidence for the hierarchy, then confirm with real page context and grep behavior.
- **Watch where they click first**: use it as the first-click signal — `first-click.md`.
- **They backtrack**: fix the misleading category or the missing scent — `reference/principles/06-information-scent/index.md`.
- **A label misleads them**: rename it to match destination expectations — `reference/principles/06-information-scent/link-labels.md`.
- **A branch is too broad or too narrow**: split or merge it.
- **A branch holds unexpected content**: move it to the expected location or cross-list it through a facet — `reference/principles/04-multiple-paths/facets.md`.
- **A task fails because the structure is wrong**: redesign the hierarchy or facet model — `reference/principles/04-multiple-paths/hierarchy.md`.
- **A task fails because the target page is missing**: create the source-of-truth page — `reference/principles/02-typed-source-of-truth-topics/topic-identity.md`.
- **A task succeeds only after backtracking**: improve the first-choice path even though it eventually worked.
