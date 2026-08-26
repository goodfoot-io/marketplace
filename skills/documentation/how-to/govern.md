# How to govern the corpus

Scope: detect governance gaps and surface them to the maintainer; gate drift; convert support signal; reorganize only on failure. How-to (govern stage). Applies Principle 8.

## 1. Ownership is the maintainer's, not the doc's

Docs are ownerless by default — that is normal, not a gap (`../explanation/foundations.md` §3). What keeps a doc accurate is anchoring to code plus the owning code area's existing ownership (`CODEOWNERS`), not a per-doc owner field. Detect gaps and surface them; the maintainer sets review authority and who approves structural and navigation changes.

## 2. Surface review triggers and lifecycle actions

Cadence and authority are the maintainer's (by risk, volatility, usage). Detect the trigger conditions — release, incident, stale date (last-commit vs cadence), high-risk or dependency change — and surface them; detect superseded, obsolete, unused, or misleading pages and propose the lifecycle action (archive; redirect on rename/merge/delete/deprecation when the target is a clear replacement, else disambiguate) for the maintainer to authorize.

## 3. Gate drift mechanically

Gate `wiki check` and `git mesh stale` in a git hook or CI so doc↔code drift fails the build; this is the repo's advantage over a generic wiki. Anchor load-bearing claims as fragment links and meshes. Keep the gate side-effect-free: use the read-only `wiki check` / `git mesh stale` (they fail without mutating); never run a `--fix` form or an auto-staging step in a commit hook — it can sweep unrelated files into the commit. Prefer a verify-only hook or CI; if a hook must mutate, commit narrowly by explicit path and inspect the staged set first.

## 4. Surface health and findability signals

Detect and report what the repo makes measurable — freshness (last-commit), duplication, orphan rate, metadata completeness, contradiction rate, source-of-truth coverage, provenance of generated data; and findability proxies — first-click success, reduced backtracking, reduced repeated questions. Tracking them over time as a portfolio is the maintainer's.

## 5. Convert support and incident signal

Recurring questions → a source-of-truth doc or FAQ; pages people paste in response → promote as assets; post-incident gaps → doc tasks; a support answer conflicting with a source-of-truth page → resolve against the page.

## 6. Resolve contradictions and change the structure

Resolve by the layered source of truth (code over prose) and date/version applicability (`../explanation/foundations.md` §1); a contradiction needing stakeholder judgment is surfaced, not decided here. Propose an IA change with a documented rationale, expected impact, migration plan, redirects, and validation criteria — the maintainer approves and authorizes it.

## 7. The rule

Reorganize only on an observed failure — a reader fails to find, or finds the wrong thing — never for tidiness. **Commits and pushes belong to the repo owner**: this skill changes the working tree and validation needs no commit, so commit only with authority and when no active constraint (a freeze, restricted permissions, or owner preference) applies — otherwise hand off a record of what changed and what to commit rather than blocking. If a tool errors unexpectedly, stop and report it.

Related: why govern `../explanation/principles/08-validate-and-iterate.md`; the validation that precedes it `validate.md`; the loop `procedure.md`; drift gates `../reference/tools/git-mesh.md`, `../reference/tools/wiki.md`.
