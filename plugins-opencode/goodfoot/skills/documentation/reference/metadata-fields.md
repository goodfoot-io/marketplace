# Reference: metadata fields

Scope: the metadata fields worth carrying and which existing store owns each. Reference mode — look up when setting metadata. The process is `../how-to/set-vocabulary-and-metadata.md`.

## Reuse before inventing

The repo already stores most metadata — reuse it (`../explanation/foundations.md` §1):

| Store | Carries |
|---|---|
| `CODEOWNERS` | the owning code area's maintainers — provenance, not a doc owner |
| Package manifests | component, version |
| Wiki frontmatter | `title`, `summary`, `aliases`, `tags` |
| Mesh `why` | the coupling and its standing property |
| Commit dates | freshness / last change |

## Fields worth carrying

Topic type · documentation mode · page genre · domain · component · product · feature · role · audience · lifecycle stage · environment · version · status · owner · review date · last-verified date · source-of-truth · related systems/APIs/error-codes/metrics/runbooks · sensitivity / access level · maturity · deprecation status · replacement page · applicable customers/configs · stable identifier.

- Use each field for one job: templates and filters, routing, provenance, freshness, applicability, or redirects.
- Surface fields that affect trust, applicability, safety, or next action; keep maintenance-only fields backstage.
- The **stable identifier** field is a SHA-pinned fragment link or a durable mesh name, distinct from any SEO signal.
- The **owner** field is optional provenance from `CODEOWNERS` (the owning code area's maintainers), never required and never a gap when absent (`../explanation/foundations.md` §3).

Related: the process and governance `../how-to/set-vocabulary-and-metadata.md`; reuse principle `../explanation/foundations.md`; track renames `tools/git-history.md`.
