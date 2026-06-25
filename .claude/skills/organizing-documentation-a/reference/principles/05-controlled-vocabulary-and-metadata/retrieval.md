# Retrieval

Scope: decide which fields power navigation, search, and AI retrieval, and which stay backstage. Owns retrieval-facing metadata for Principle 5.

## In the repo

Grep is the default retrieval system: names and first lines are the index. Make them carry scope so a grep arrival lands well (`reference/principles/06-information-scent/index.md`).

## Diagnostics → actions

- **A field is one users narrow intent by**: expose it as a search filter.
- **A field defines hub membership or matrix rows/columns**: use it only if it is controlled, validated, user-meaningful, and kept accurate, with provenance — `reference/principles/04-multiple-paths/matrix-views.md`, `reference/principles/03-hubs-orientation-and-routing/index.md`.
- **A field drives ownership or freshness reports**: use owner, domain, status, review-date, last-verified, and version — `reference/principles/08-validate-and-iterate/index.md`.
- **A field affects trust, applicability, safety, or the next action**: surface it on the page; otherwise keep it backstage — `metadata-fields.md`.
- **An agent retrieves a chunk with no neighbors**: add stable identifiers, scoped aliases, scope, type, applicability, owner, freshness, and relationship fields — but only when the pipeline stores and uses them — `reference/principles/07-nonlinear-information-seeking/cross-reference.md`.
- **Retrieval ignores metadata you added**: improve the non-metadata structures it does index — clear headings, self-contained chunks, explicit scope statements, source-of-truth links, duplicate suppression, freshness signals.
- **A field is sensitive, internal-only, or misleading out of context**: exclude, redact, or permission-gate it from public search and AI retrieval.
