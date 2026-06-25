# Berrypicking

Scope: support readers who accumulate partial answers and reformulate their question as they learn. Owns the berrypicking model for Principle 7.

## In the repo

Berrypicking a region's history is `git blame` plus `git log -L <start>,<end>:<path>` — a reader gathers context across past changes (`reference/tools/git-history.md`).

## Diagnostics → actions

- **Readers collect partial answers along the way**: add summaries, snippets, examples, and related links so accumulation works — `reference/principles/06-information-scent/summaries-and-previews.md`.
- **Readers change their question after learning more**: add reformulation cues and next links.
- **A page should help reformulation**: add glossary, comparison, and "you may mean" links — `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`, `reference/principles/06-information-scent/disambiguation.md`.
- **Readers need to know they are in the right neighborhood**: add scope, examples, and familiar terminology; for the wrong place, add exclusions and alternate destinations — `recovery.md`.
- **Related questions arise from a page**: add follow-up links and "what to read next or instead" — `recovery.md`.
- **Readers started with the wrong term**: add scoped aliases, disambiguation, and synonym maps — `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`.
- **A snippet must be meaningful when extracted by search or an agent**: make summaries and headings context-rich enough to stand alone — `cross-reference.md`.
