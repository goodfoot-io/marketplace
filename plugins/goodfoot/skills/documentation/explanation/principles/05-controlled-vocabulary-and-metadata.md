# Principle 5 — Controlled vocabulary and structured metadata

Scope: why names must be controlled and metadata reused, not reinvented. Explanation mode.

Inconsistent names and free-form metadata destroy findability for readers and accuracy for retrieval. Controlled vocabulary lets readers and agents reach a topic by the term they already use; structured metadata powers filters, hubs, and grounding.

## In a repo

Names — directories, files, packages, mesh names — are the primary vocabulary; keep one convention (kebab-case; stable prefixes). The repo already stores metadata: `CODEOWNERS`, package manifests, wiki frontmatter (`title`/`summary`/`aliases`/`tags`), mesh `why` — reuse it before inventing a field. The concerns: **vocabulary** (preferred terms, synonyms, acronyms, deprecated and informal names), **entities** (domain objects as first-class names), **metadata fields**, **governance** (the maintainer sets taxonomy authority; Claude detects drift and surfaces it), and **retrieval** (which fields surface, which stay backstage).

## Apply / draws on

- Apply it: `../../how-to/set-vocabulary-and-metadata.md`.
- Field catalog: `../../reference/metadata-fields.md`.

Related: facets project from controlled metadata `04-multiple-paths.md`; the stable-identifier field `../foundations.md`.
