# Governance

Scope: surface review triggers and detected gaps, gate drift detection mechanically, and record what changing the IA would need. Owns governance for Principle 8; vocabulary and metadata-value governance lives in `reference/principles/05-controlled-vocabulary-and-metadata/metadata-governance.md`.

## Triggers and handoff

- **Surface gaps; do not assign doc owners**: docs are ownerless by default — that is normal, not a gap (`reference/foundations.md`). Cadence, authority, approvals, and enforcement are the maintainer's; when detection finds a real issue (stale, contradiction, drift), flag it to the owning code area's maintainers (`CODEOWNERS`, `git log --author`).
- **Review triggers are the maintainer's to set**: cadence by risk, volatility, and usage is theirs; Claude detects and surfaces the signals that should prompt review — a release, a code-ownership change, a drift signal, a stale date.
- **Act on lifecycle conditions**: archive (mark historical) when superseded, obsolete, unused, or misleading; create a redirect (via a link) after a rename, merge, deletion, or deprecation only when the target is a clear replacement, otherwise route through disambiguation; update hubs when source-of-truth topics, workflows, status, or high-value paths change — `reference/principles/04-multiple-paths/orphans-and-dead-ends.md`.
- **Committing belongs to the owner**: this skill changes the working tree and validates without committing; commit only with authority and when no active constraint (a freeze, restricted permissions, or owner preference) applies — otherwise hand off a record of what changed and what to commit, rather than blocking the doc work.

## Mechanical drift gate

- **Doc↔code drift is not mechanically detectable**: the doc is not anchored — convert load-bearing claims to fragment links and meshes, then gate `wiki check` and `git mesh stale` in a git hook or CI so drift fails the build — `reference/tools/wiki.md`, `reference/tools/git-mesh.md`, `reference/foundations.md`.
- **A load-bearing claim can't be anchored**: the gate never sees it, so it drifts silently — flag it to the owning code area's maintainers and lean on freshness/last-verified metadata, not a doc owner. The gate is the mechanical layer; what it can't see falls to the maintainer's review, not to a field Claude assigns.
- **Keep the drift gate side-effect-free**: gate with the read-only/verify form — `wiki check` and `git mesh stale` fail on drift without mutating state. Never run a `--fix` form or an auto-staging step inside a commit hook; it can sweep unrelated files into the commit. Prefer a verify-only hook or a CI check that fails the build; if a hook must mutate, commit narrowly by explicit path and inspect the staged set first.

## Metrics and process

- **Findability is the maintainer's to track**: successful retrieval, first-click quality, reduced backtracking, and reduced support asks — a portfolio, not one number; Claude reports what it can observe.
- **Report documentation health from the audit**: freshness, duplication, orphan rate, metadata completeness, contradiction rate, source-of-truth coverage, and provenance for generated data — `baseline-audit.md`; tracking these on a cadence is the maintainer's.
- **Resolve contradictions** by source-of-truth authority, source hierarchy, and version applicability — `reference/principles/02-typed-source-of-truth-topics/canonicality.md`.
- **Tell a real failure signal from tidiness**: a page showing stale facts as current is a drift failure — rewrite or redirect it; a page that records a past plan, spike, or decision is correct as history — mark it historical (status + date + scope + replacement link), do not rewrite it; additive moves (hubs, scent, aliases, cross-links) are always in scope — `reference/principles/02-typed-source-of-truth-topics/canonicality.md`, `reference/concepts/page-genres.md`.
- **Changing the IA is the maintainer's call**: propose it with a documented rationale, expected user impact, a migration plan, redirects, and validation criteria — and only when a reader fails to find or finds the wrong thing, never for tidiness.
