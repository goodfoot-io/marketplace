# Readers and roles

Scope: identify the reader segments of a repository and give each segment a path. Owns the audience model for Principle 1.

## Find the segments

`git shortlog -sn -- <area>` and `git log --author` show who works where; `CODEOWNERS` names accountable readers; `AGENTS.md`/`CLAUDE.md` declare the agent's intended path (`reference/tools/git-history.md`).

## Diagnostics → actions

- **A primary reader is an agent with no navigation context**: put working norms in root and module `AGENTS.md`/`CLAUDE.md` and make each landing file self-orienting — `reference/principles/07-nonlinear-information-seeking/index.md`.
- **A reader arrives from a stack trace or file path**: make the owning directory's README the high-scent landing for that path — `reference/principles/06-information-scent/summaries-and-previews.md`.
- **The reader is an internal expert**: give direct access to precise reference, schemas, and runbooks — `reference/principles/02-typed-source-of-truth-topics/reference-pages.md`.
- **The reader is a newcomer**: build a guided path, but keep each linked file understandable when reached directly — `reference/principles/07-nonlinear-information-seeking/journeys.md`.
- **The reader is an operator under time pressure**: create short, high-scent runbook paths with verification and escalation — `reference/principles/02-typed-source-of-truth-topics/troubleshooting-and-runbooks.md`.
- **The reader is a reviewer judging a diff**: link decision history near the rationale rather than restating it — `reference/foundations.md` decision-history layer.
- **The reader only needs to understand, not act**: separate explanatory pages from action pages that require authority or credentials — `reference/principles/02-typed-source-of-truth-topics/modes-and-genres.md`.
- **The reader needs evidence, not instruction** (audit, compliance): create pages that state source, owner, scope, and version — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
- **The reader falsely assumes something**: add a correction or disambiguation note near the likely wrong turn — `reference/principles/06-information-scent/disambiguation.md`.
