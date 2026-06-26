# Reference: validation signals

Scope: catalog mapping each information-architecture validation method to its repo-native signal. Reference mode — look up while validating. A repo has no UX-study tooling, so each method becomes a proxy; treat every proxy as diagnostic, not proof. The process is `../how-to/validate.md`.

| Method | Repo-native signal | Command / source | Caveat |
|---|---|---|---|
| Baseline audit | corpus counts: size, stale, orphan, duplicate, unclassified | `git ls-files`, `git grep`, `git log -1 --format=%cs`, `wiki check`, `git mesh stale` | counts scope the work, not its priority |
| Card sorting | co-change clusters; contributor language | `git mesh tree`, history mining, commit/issue/PR text | a cluster is a candidate grouping, confirm by tree-test |
| Tree testing | can a fresh reader/agent locate a target from the structure | walk hubs without grep; dispatch a context-free agent | one task's failure may be a label, not the tree |
| First click | is the correct next link the obvious one from a hub | name the expected first link; observe the wrong ones | a rate is a signal, not a threshold |
| Search logs | recurring questions; terms returning no hit | `git log --grep`, issue/PR text, zero-hit `git grep` | a query is a hypothesis about intent |
| Analytics | churn, cross-reference count, incident-touch, release-spike | `git log`, inbound-link counts, hotfix commits | activity is not page-views; pair with task context |
| Support / ops | repeated questions; post-incident gaps | issues, PRs, chat, postmortems | confirm reuse value before creating a page |

- **Mechanical advantage**: doc↔code drift is the one signal that is not a proxy — `wiki check` and `git mesh stale` detect it exactly, but only on claims anchored as fragment links and meshes, and only as anchor integrity: a clean gate means the anchors resolve, not that the prose is true (a tripped gate is a prompt to re-verify the claim; behavior can change outside an anchored range with the gate green). An unanchored load-bearing claim drifts silently and falls back to the owning code area's maintainers and freshness/last-verified (`../how-to/govern.md`).

Related: run these checks `../how-to/validate.md`; set the gates and hand off governance `../how-to/govern.md`; the inventory commands `tools/inventory-grep.md`; why validate `../explanation/principles/08-validate-and-iterate.md`.
