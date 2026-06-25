# Principle 8 — Validate and iterate using observed behavior

Scope: prove the corpus works and keep it working — baseline audit, repo-native validation proxies, mechanical drift gates, and governance. Reorganize only on a real failure signal, never for tidiness.

## In the repo

A repository beats a generic wiki here: doc↔code drift is mechanically detectable. Anchor docs with fragment links and meshes so `wiki check` and `git mesh stale` fail when code moves out from under prose, and gate them in a git hook or CI (`reference/tools/wiki.md`, `reference/tools/git-mesh.md`). Two limits bound that gate: it sees only anchored claims — an unanchored load-bearing claim drifts silently, so anchor what you can and govern what you can't; and green means the anchors resolve, not that the prose is true — a tripped gate is a prompt to re-verify the claim, behavior can change outside an anchored range with the gate green, and stale facts shown as current are caught by the canonicality review and freshness, not the gate. Mechanical detection complements, never replaces, prevention and governance (`governance.md`). The web-IA validation methods have no native logs in a repo; each leaf below gives the repo proxy. Treat every signal as diagnostic — combine signals and revise only when a reader fails to find or finds the wrong thing.

## Route within this principle

- **You need the corpus's real state in counts**: read `baseline-audit.md` — the corpus's real state in counts before any change.
- **You must discover the groupings readers actually use**: read `card-sorting.md` — discover real groupings (co-change, CODEOWNERS) before imposing structure.
- **You must test whether the structure leads to the right file**: read `tree-testing.md` — test whether the structure leads to the right file, navigation-only.
- **You must check the first hop is predictable**: read `first-click.md` — check the first hop is predictable from a hub link or directory name.
- **You must learn what readers search and fail to find**: read `search-logs.md` — mine searched terms for missing content, aliases, and bad titles.
- **You want a behavior signal from history**: read `analytics.md` — git activity as the behavior signal: frequency, churn, incident spikes.
- **You must turn repeated questions and incidents into docs**: read `support-and-ops.md` — convert repeated questions and incident findings into docs.
- **You must hand off governance — triggers, drift gates, IA-change**: read `governance.md` — review triggers to surface, mechanical drift gates, and what changing the IA needs.
