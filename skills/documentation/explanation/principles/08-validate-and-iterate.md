# Principle 8 — Validate and iterate using observed behavior

Scope: why structure is validated against observed behavior and governed on a cadence. Explanation mode.

Structure should follow evidence, not aesthetics. Validation evidence is diagnostic, not magical: combine signals and revise the structure only when they converge on a real failure — a reader fails to find, or finds the wrong thing.

## In a repo

A repository beats a generic wiki here: doc↔code drift is mechanically detectable. Anchor load-bearing claims as SHA-pinned fragment links and meshes so `wiki check` and `git mesh stale` fail when code moves; gate them in a hook or CI. This edge is real but bounded: the gate covers only anchored claims (an unanchored claim drifts silently) and proves only that anchors resolve, not that the prose is true. So it sits on top of — it does not replace — the prevent-and-govern loop a generic wiki must rely on anyway: single source of truth and generate-don't-duplicate to prevent drift, the owning code area's maintainers and freshness and review to catch what the gate cannot see. That governance loop is the maintainer's: Claude feeds it by detecting and surfacing gaps, and does not assign doc owners (`../foundations.md` §3). The classic UX-research methods (card sorting, tree testing, first-click, search logs, analytics) have no study tooling in a repo, so each translates to a repo-native signal — co-change clusters, fresh-agent navigation, grep misses, churn. The concerns: the **baseline audit**, the **validation signals**, and **governance** (the maintainer's review triggers and authority; drift gates).

## Apply / draws on

- Apply it: `../../how-to/validate.md`, then `../../how-to/govern.md`.
- Signal catalog: `../../reference/validation-signals.md`.

Related: the loop these signals feed `../../how-to/procedure.md`; the drift gates `../../reference/tools/git-mesh.md`, `../../reference/tools/wiki.md`.
