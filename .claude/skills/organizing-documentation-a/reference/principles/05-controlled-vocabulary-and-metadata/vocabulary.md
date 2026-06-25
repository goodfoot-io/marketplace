# Vocabulary

Scope: keep one naming convention and map synonyms, acronyms, and deprecated names to preferred terms. Owns the controlled vocabulary for Principle 5.

## In the repo

Directory, file, and mesh names follow one convention (kebab-case). Normalize to it; record deprecated paths and redirect readers with links, never silent deletion. Rename with `git mv` and confirm the chain with `git log --follow` (`reference/tools/git-history.md`).

## Diagnostics → actions

- **Pick the preferred term for each concept** and use it consistently in names, headings, frontmatter, and links — `reference/principles/06-information-scent/titles.md`.
- **A concept has common synonyms**: map them to the preferred term as aliases; redirect with a link only when the synonym is equivalent within scope — `reference/tools/wiki.md`.
- **A term is an acronym**: define and expand it at first use and attach it as a scoped alternate label, not automatically the preferred term.
- **A name is deprecated**: mark it historical, record the replacement term and date, and redirect with a link only when there is a clear current equivalent.
- **People use an informal name**: add it as a searchable alias after validating its meaning and scope.
- **A term is an internal code name or a customer-facing name**: map it to the preferred term only where the equivalence is valid and safe to expose; otherwise keep it a scoped alias and explain the distinction.
- **A term is overloaded or means different things by context**: disambiguate with qualifiers and scope each meaning by domain or component — `reference/principles/06-information-scent/disambiguation.md`.
- **A term must never be used**: add a linting rule or editorial guidance — `metadata-governance.md`.
