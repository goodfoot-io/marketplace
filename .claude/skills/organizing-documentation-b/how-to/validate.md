# How to validate against observed behavior

Scope: check the structure with repo-native signals, treated as diagnostic. How-to (validate stage). Applies Principle 8. Run after authoring and on a cadence.

## 1. Mechanical checks first

`wiki check` and `git mesh stale` exit clean; every inter-doc link resolves. Anchor load-bearing claims as SHA-pinned fragment links and meshes so doc↔code drift is detectable at all. These checks read the working tree — run them without committing.

### Verified counts

After authoring any index or header that reports a count (cheat-sheet count, page count, entry count), verify with an exact command. Use `grep -c` or `wc -l` against the working tree, then update the reported number to match. Do not hand-count or estimate. If the command output disagrees with the reported count, fix the reported count — the command is authoritative.

Two boundaries on this gate. It covers only anchored claims: an unanchored load-bearing claim drifts silently — anchor what you can; for what you can't, flag the owning code area's maintainers and lean on freshness/last-verified (`govern.md`). And a clean gate means the anchors resolve, not that the prose is true: a tripped gate is a prompt to re-verify the claim, and behavior can change outside an anchored range with the gate green. Semantic staleness (stale facts shown as current) is caught by freshness and the source-of-truth review, not the gate.

## 2. Derive groupings (card-sort analog)

A repo has no card-sort study; use how files cluster. Take candidate groupings from co-change clusters (`git mesh tree`, history mining) and `CODEOWNERS`; mine contributor language from commits, issues, and PRs for candidate labels and aliases; give role-specific groupings their own hubs or filters; clarify, split, rename, or cross-list hard-to-place topics; route ownership/security conflicts to alternate projections or backstage metadata.

## 3. Test findability (tree-test + first-click analog)

Pose representative "find X" tasks and walk the hub tree without grep, or dispatch a fresh agent with no context. Record the first choice, backtracks, and misleading labels. Name the expected first click per common task and find the cause of wrong ones: bad label → rewrite for scent; bad grouping → move to the expected group; missing synonym → add aliases; ambiguous hub → rewrite orientation. Fail-by-structure → redesign hierarchy/facets; fail-by-label → rewrite labels; fail-by-missing → create the page.

## 4. Read the repo's "search logs"

Recurring questions in issues and PRs (`git log --grep`) and zero-hit `git grep` terms reveal missing content, synonyms, or redirects. Add validated aliases; merge duplicate topics surfaced.

## 5. Read the behavioral proxies (analytics analog)

Churn and cross-reference count ≈ most-visited (maintain tightly); low churn with no inbound ≈ never-visited (reassess or archive); incident-touched files → harden as runbooks; release-spiking files → link from the changelog. Combine every proxy with task context.

Treat each signal as diagnostic, not proof; reorganize only when signals converge on a real failure — then `govern.md`. Stale facts shown as current are such a failure (rewrite or redirect); a page that records a past plan or decision is correct as history (mark it historical — status + date + scope + replacement link — do not rewrite).

Related: why validate `../explanation/principles/08-validate-and-iterate.md`; the signal catalog `../reference/validation-signals.md`; the baseline counts `audit-the-corpus.md`; set the gates `govern.md`.
