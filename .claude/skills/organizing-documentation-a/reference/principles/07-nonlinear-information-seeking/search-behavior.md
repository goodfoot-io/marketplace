# Search behavior

Scope: tune for how readers actually grep and search — exact terms, errors, log lines, wrong terms — and fix no-result, too-many, and misleading queries. Owns search tuning for Principle 7.

## In the repo

Grep is the search engine. A failed grep means a missing alias or missing content; the terms people grep are candidate aliases. Mine recurring search terms from issue, PR, and commit text with `git log` (`reference/tools/git-history.md`, `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`).

## Diagnostics → actions

- **Readers search exact terms the page lacks**: add the validated terms to titles, aliases, or metadata — but do not title with a nonpreferred or ambiguous term just because it appears in logs — `reference/principles/06-information-scent/titles.md`.
- **Readers search an incorrect term**: investigate the intended meaning, then add disambiguation or a scoped alias only when the term reliably maps to one destination.
- **Readers search acronyms**: define and alias them — `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`.
- **Readers paste error messages or log lines**: link that text to troubleshooting and runbook pages — `reference/principles/02-typed-source-of-truth-topics/troubleshooting-and-runbooks.md`.
- **A search returns no results**: decide whether content, synonyms, or ranking is missing, and create, alias, or backlog accordingly — `reference/principles/08-validate-and-iterate/search-logs.md`.
- **A search returns too many results**: improve metadata, titles, summaries, and filters — `reference/principles/05-controlled-vocabulary-and-metadata/retrieval.md`.
- **A search returns misleading results**: retitle, redirect, or improve summaries after confirming the mismatch — `reference/principles/06-information-scent/disambiguation.md`.
