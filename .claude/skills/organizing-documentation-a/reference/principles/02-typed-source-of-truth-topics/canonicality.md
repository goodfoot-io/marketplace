# Canonicality

Scope: resolve competing pages to one source of truth and mark authority, freshness, and durable identity. Owns conflict resolution for Principle 2.

## In the repo

There is no single source-of-truth page for the whole repo: canonicality is per-topic within its owning layer (`reference/foundations.md`). Detect duplicates with grep over a defining phrase (`reference/tools/inventory-grep.md`).

## Diagnostics → actions

- **One topic has several pages**: pick the source-of-truth page and route links, references, and maintenance to it; replace the rest with contextual links.
- **There are competing explanations**: merge, archive, or reconcile them.
- **A page is superseded, split, or merged**: apply the lifecycle action — merge, split, archive, or redirect with a link to the replacement — `reference/principles/04-multiple-paths/orphans-and-dead-ends.md`.
- **A page presents stale facts as current**: that is a drift and canonicality failure — rewrite it to current truth or redirect to the source of truth (a justified change, not tidiness).
- **A page records a past plan, spike, or decision** (a historical genre): do not rewrite history — mark it historical (status + date + scope + replacement link) and leave the content intact — `reference/concepts/page-genres.md`.
- **Authority, freshness, or conflict affects reader trust**: mark source-of-truth status in metadata or page chrome, not in the title alone — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
- **The title is not the stable preferred term**: rename it; keep aliases for search and routing — `reference/principles/06-information-scent/titles.md`, `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`.
- **A page would benefit from a review date or version applicability**: add them as optional freshness/applicability metadata — not required, and never a doc owner — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
- **The page is cited from tickets, alerts, code, or indexes**: give it a durable identifier; preserve access through links when paths change — `reference/foundations.md` stable-identifier section. Reserve "canonical URL" for duplicate-URL consolidation only — it does not mean editorial authority.
