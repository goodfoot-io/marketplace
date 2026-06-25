# Card sorting (repo proxy)

Scope: discover the groupings readers and agents actually use before imposing structure. Owns grouping discovery for Principle 8.

## The repo proxy

There are no card-sort sessions in a repo. Observe how the corpus is already partitioned in practice: co-change clusters from git history (files that move together form a natural group), `CODEOWNERS` partitions, directory and grep-pattern clusters, and the labels people invent in issues, PRs, and commit subjects.

## Diagnostics → actions

- **You need candidate groupings**: mine co-change clusters (mine → shortlist) — `reference/tools/git-history.md`.
- **Different roles group topics differently** (operators vs. developers vs. support): create role-specific hubs or facets — `reference/principles/04-multiple-paths/facets.md`, `reference/principles/01-organize-around-user-intent/readers-and-roles.md`.
- **People invent labels**: add them as aliases or candidate preferred labels — `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`.
- **A grouping is stable across signals**: treat it as a candidate for primary navigation, then test it against real retrieval tasks — `tree-testing.md`.
- **A topic is consistently hard to place**: clarify, split, rename, or cross-list it — `reference/principles/02-typed-source-of-truth-topics/topic-identity.md`, `reference/principles/04-multiple-paths/cross-linking.md`.
- **A topic belongs in multiple groups**: represent it with facets and multiple inbound links — `reference/principles/04-multiple-paths/facets.md`.
- **Readers ignore an existing category**: remove, demote, or rename it — `reference/principles/06-information-scent/disambiguation.md`.
- **A natural grouping conflicts with ownership or security boundaries**: use an alternate projection or backstage metadata rather than forcing the user-facing structure to mirror internal constraints — `reference/principles/05-controlled-vocabulary-and-metadata/retrieval.md`.
