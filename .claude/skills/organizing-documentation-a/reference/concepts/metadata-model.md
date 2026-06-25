# Metadata model

Scope: the metadata dimension — the fields that describe scope, ownership, applicability, status, version, and retrieval context, plus the catalog to choose from. Definitional and catalog; the actions of choosing, showing, governing, and exposing fields live in Principle 5.

## Reuse before inventing

The repo already stores metadata — `CODEOWNERS`, package manifests, wiki frontmatter (`title`/`summary`/`aliases`/`tags`), and mesh `why`. Reuse these before adding a field (`reference/foundations.md` layered source of truth, generate-don't-duplicate).

## Field catalog

| Field | Use it to |
|---|---|
| Topic type / documentation mode / page genre | drive templates, quality checks, and search filters (`design-dimensions.md`) |
| Domain / component / product / feature | power hubs, ownership, and component search |
| Role / audience | route by role and target language and visibility |
| Lifecycle stage / environment / version | route onboarding-to-retirement; prevent wrong-environment actions; distinguish current/legacy/deprecated |
| Status / maturity / deprecation status / replacement page | mark draft/stable/deprecated/experimental and route to replacements |
| Review date / last verified date / owner | freshness; owner is optional provenance (`CODEOWNERS`), never required and never a gap |
| Source of truth | suppress duplicates and resolve conflicts |
| Related systems / APIs / error codes / metrics / runbooks | generate cross-system, symptom, and observability links |
| Sensitivity / access level | control visibility and warnings |
| Applicable customers or configurations | prevent overgeneralized guidance |
| Stable identifier / durable ID | durable linking, generated indexes, external and AI references (`reference/foundations.md` stable-identifier section) |

## Apply

- **Choose fields and decide what shows vs. stays backstage**: `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md` — reuse before inventing, then choose and place fields.
- **Govern who defines values and how they are enforced**: `reference/principles/05-controlled-vocabulary-and-metadata/metadata-governance.md` — who sets values, and how vocabulary is enforced and kept fresh.
- **Decide which fields power search, hubs, and retrieval**: `reference/principles/05-controlled-vocabulary-and-metadata/retrieval.md` — which fields power search, hubs, and AI retrieval vs. stay backstage.

Metadata is one of four dimensions — `design-dimensions.md`.
