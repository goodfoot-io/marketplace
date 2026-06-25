# Search logs (repo proxy)

Scope: use the terms readers actually search to find missing content, aliases, and bad titles. Owns search-evidence analysis for Principle 8.

## The repo proxy

A repo has no built-in search log. Mine the proxies: terms in issues, PRs, commit messages, and review comments that match no file or alias (failed "searches"), recurring grep patterns, and questions asked repeatedly. Use `git log` over messages (`reference/tools/git-history.md`).

## Diagnostics → actions

- **A top term matches no file or alias**: create the missing content, add a synonym, or improve a name — `reference/principles/02-typed-source-of-truth-topics/topic-identity.md`, `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`.
- **A term is repeatedly reformulated**: add query suggestions, vocabulary mapping, scoped aliases, or clearer summaries — `reference/principles/06-information-scent/summaries-and-previews.md`.
- **A nonpreferred or customer term recurs**: add it as a scoped alias after confirming its meaning and equivalence — `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`.
- **A term reveals a missing page**: add it to the backlog — `baseline-audit.md`.
- **A term reveals a bad title**: rename only after confirming the search reflects intended meaning; otherwise add aliases, summaries, or disambiguation — `reference/principles/06-information-scent/titles.md`.
- **A term reveals duplicate topics**: merge them into a source of truth — `reference/principles/02-typed-source-of-truth-topics/canonicality.md`.
