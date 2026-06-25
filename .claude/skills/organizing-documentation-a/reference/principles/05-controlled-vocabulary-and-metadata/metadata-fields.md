# Metadata fields

Scope: choose metadata fields for a page and decide what shows versus what stays backstage. Owns the field-selection action for Principle 5. The field catalog and the reuse-before-inventing rule are in `reference/concepts/metadata-model.md`.

## Diagnose and act

- **Reuse before inventing**: check what the repo already stores — `CODEOWNERS`, package manifests, wiki frontmatter, mesh `why` — before adding a field (`reference/concepts/metadata-model.md`).
- **Choose fields from the catalog** that serve a real reader or maintainer need — `reference/concepts/metadata-model.md`.
- **Owner is optional provenance, not a required field**: if shown, it is the owning code area from `CODEOWNERS`; never require it or flag its absence — docs are ownerless by default (`reference/foundations.md`).
- **A field affects trust, applicability, safety, or the next action**: show it on the page.
- **A field is useful only for maintenance, security, or internal governance**: keep it backstage — `retrieval.md`.
- **Govern who sets the values and how they are validated**: `metadata-governance.md`.
