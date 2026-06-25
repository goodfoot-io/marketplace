# Cross-reference and retrieval readiness

Scope: expose enough relationship context on every page that an agent retrieving one chunk can continue. Owns retrieval readiness for Principle 7.

## In the repo

A mesh `why` carries the cross-file relationship an agent cannot infer from a single retrieved chunk; record load-bearing couplings there rather than in tribal memory (`reference/tools/git-mesh.md`, `reference/foundations.md` agents-as-readers). Self-contained chunks and specific heading paths do the rest (`reference/principles/06-information-scent/headings.md`).

## Diagnostics → actions

- **A concept lacks links to its tasks, or a task lacks prerequisite-concept and reference links**: add them in both directions — `reference/principles/04-multiple-paths/cross-linking.md`.
- **A reference page lacks examples, or a troubleshooting page lacks a link back to normal operation**: add the missing direction.
- **A runbook lacks escalation, or a decision record lacks a link to the current implementation**: add it — `reference/foundations.md` decision-history layer.
- **A deprecated page lacks a replacement link**: add it — `reference/principles/04-multiple-paths/orphans-and-dead-ends.md`.
- **A page ends at the immediate answer**: add next-step and related-intent links so the reader can continue — `recovery.md`.
- **A retrieval system needs relationship context**: expose source-of-truth, prerequisite, related, replacement, applicability, and evidence links in page text and, where supported, machine-readable metadata — `reference/principles/05-controlled-vocabulary-and-metadata/retrieval.md`.
