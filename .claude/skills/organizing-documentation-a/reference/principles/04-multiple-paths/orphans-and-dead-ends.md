# Orphans and dead ends

Scope: find pages with no inbound path or no useful onward path and fix them. Owns orphan and dead-end repair for Principle 4.

## Find them

Detect orphans with the grep recipe in `reference/tools/inventory-grep.md` (a file whose name is never mentioned elsewhere). Detect dead ends by reading a page's foot for next-step links.

**Orphan scoping**: do not flag files in well-known template directories (`.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE/`) as orphans. These are consumed by platform automation and typically do not need README links. Focus on files genuinely undocumented — policy files, standalone docs, unlinked guides.

## Diagnostics → actions

- **A page has no inbound links**: link it from a hub, redirect it with a link, archive it, or delete it — `reference/principles/03-hubs-orientation-and-routing/link-selection.md`.
- **A file is empty or a bare placeholder**: fix it, do not just note it as an orphan in the orientation file — populate it with a minimal stub (its purpose, a redirect to the resource that supersedes it, and a contribution invite), redirect it, or delete it.
- **A page has no useful outbound links**: add next-step, prerequisite, and related links — `cross-linking.md`.
- **A page is discoverable only by search**: add it to relevant hubs or matrix cells if it is important — `matrix-views.md`.
- **An important page is buried too deep**: promote it to a hub or a shortcut — `reference/principles/06-information-scent/cost-of-click.md`.
- **A page is linked from many irrelevant places**: remove the noisy links and keep the contextual ones.
- **A duplicate, renamed, merged, or superseded page persists**: redirect it to the source-of-truth or replacement page with a link — `reference/principles/02-typed-source-of-truth-topics/canonicality.md`.
- **A page dead-ends after the reader completes a task**: add verification, next steps, and related operations — `reference/principles/07-nonlinear-information-seeking/recovery.md`.
- **A page dead-ends for retrieval** (no context or source-of-truth links): add a summary, a stable identifier, explicit relationships, and source-of-truth links — `reference/principles/07-nonlinear-information-seeking/cross-reference.md`.
