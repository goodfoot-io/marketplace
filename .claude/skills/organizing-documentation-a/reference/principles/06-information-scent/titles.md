# Titles

Scope: make every page title and file name predict its contents out of context. Owns titling for Principle 6.

## In the repo

A file name is a title — a reader greps names before opening files. Rename vague files with `git mv` and confirm history with `git log --follow` (`reference/tools/git-history.md`); use the kebab-case convention (`reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`).

## Diagnostics → actions

- **The title does not clearly describe the page**: rename it until its promise is obvious.
- **The title is not the preferred term**: use preferred terminology while preserving aliases for search and routing — `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`.
- **The title hides intent**: add a topic-type cue (concept, task, reference, troubleshooting); use verb-object form for tasks — `reference/principles/02-typed-source-of-truth-topics/task-pages.md`.
- **The title or heading names the page's contents rather than the reader's goal**: rephrase around what the reader can accomplish ("Find a free book by language", not "Books index") — a heading that answers the reader's question carries more scent than one that describes the container.
- **The title uses internal shorthand or an ambiguous noun**: replace it with a recognizable term and add a disambiguating qualifier.
- **The title would not make sense in a search result or as link text elsewhere**: rewrite it to be self-describing out of context.
- **The title hides a version, environment, or status difference that matters**: add the qualifier where choosing the wrong page would matter — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
