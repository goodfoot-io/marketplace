# How to set vocabulary and metadata

Scope: control the names and reuse the metadata the repo already carries. How-to (author stage). Applies Principle 5.

## 1. Set the vocabulary

Use one naming convention (kebab-case; stable prefixes) for directories, files, packages, and mesh names. Set a preferred term per concept and use it in titles, headings, metadata, and links. Map synonyms to aliases; attach acronyms as scoped alternate labels; mark deprecated names with replacement and date; add validated informal names as aliases; use product/customer/code names as facets or aliases where the equivalence holds. Disambiguate overloaded terms with qualifiers and a glossary entry; record renames (`git log --follow`, `git mv`); lint terms that should never be used. A glossary entry carries preferred term, definition, synonyms, scope, and disambiguation.

## 2. Make entities first-class

Systems, components, services, data objects, actors/roles, workflows, states, events, APIs, permissions, environments, customers, and error codes each get the page, facet, metadata value, or reference they warrant. Map internal entities to external (compliance, audit, customer-facing) vocabulary.

## 3. Choose metadata fields — reuse before inventing

Reuse `CODEOWNERS`, package manifests, wiki frontmatter (`title`/`summary`/`aliases`/`tags`), mesh `why`, and commit dates first. Carry only fields that earn their place (see the catalog `../reference/metadata-fields.md`). The stable-identifier field is a SHA-pinned fragment link or mesh name (`../explanation/foundations.md` §2).

## 4. Govern the vocabulary

Taxonomy authority — who creates a tag, renames a preferred term, maintains synonyms, approves deprecations — is the maintainer's; surface proposed renames and deprecations (with replacement and redirects) for approval rather than enforcing them. Claude's part: detect drift — audit for stale and deprecated terms (search, redirects, linting), flag missing required fields, and generate from authoritative systems with validation, provenance, and override rules.

## 5. Decide retrieval exposure

Power filters, hubs, and matrix views from controlled, validated fields. Surface fields that affect trust, applicability, safety, or next action on the page; keep maintenance-only fields backstage. For agents, add stable identifiers, scoped aliases, scope, type, applicability, freshness, and relationship fields, plus self-contained chunks and clear headings. Redact or permission-gate sensitive metadata. Generate, don't duplicate.

Related: why controlled vocabulary `../explanation/principles/05-controlled-vocabulary-and-metadata.md`; the field catalog `../reference/metadata-fields.md`; track renames `../reference/tools/git-history.md`; durable identifiers `../explanation/foundations.md`.
