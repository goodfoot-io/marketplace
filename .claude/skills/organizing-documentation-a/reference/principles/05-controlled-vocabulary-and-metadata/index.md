# Principle 5 — Use controlled vocabulary and structured metadata

Scope: make names the vocabulary, reuse the metadata the repo already stores, and expose only navigation-critical fields while keeping the rest backstage.

## In the repo

Names are the vocabulary: directories, files, packages, and mesh names. Keep one convention (kebab-case; stable project prefixes). The repo already carries metadata — `CODEOWNERS`, package manifests, wiki frontmatter (`title`/`summary`/`aliases`/`tags`), and mesh `why`. Reuse it before inventing a field. Add aliases for synonyms and old names with the `wiki` tool; rename with `git mv` and `git log --follow` to preserve history (`reference/tools/wiki.md`, `reference/tools/git-history.md`).

## Route within this principle

- **Names drift, or synonyms and old terms have no home**: read `vocabulary.md` — one naming convention; synonyms, acronyms, and old names mapped to preferred terms.
- **The domain's core entities need first-class names and pages**: read `entities.md` — make core domain entities first-class objects with consistent names.
- **You must pick metadata fields and decide what shows**: read `metadata-fields.md` — choose fields and decide what shows vs. stays backstage.
- **You must govern who defines values and how vocabulary is enforced**: read `metadata-governance.md` — who defines values, how vocabulary is enforced, how stale terms are found.
- **You must decide which fields power navigation, search, and retrieval**: read `retrieval.md` — which fields power search, hubs, and AI retrieval vs. stay backstage.
