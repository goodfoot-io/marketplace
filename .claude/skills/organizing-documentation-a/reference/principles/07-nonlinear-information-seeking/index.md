# Principle 7 — Design for nonlinear information seeking

Scope: support readers who grep, skim, collect partial answers, reformulate, backtrack, and arrive from outside — without abandoning source-of-truth structure.

## In the repo

No one reads a repository top to bottom. They grep, jump to definition, blame, and retrieve. Every file and directory must be self-orienting on arrival. Berrypick a region's history with `git blame` and `git log -L`; a mesh `why` supplies the cross-file relationship an agent cannot infer from a single chunk (`reference/tools/git-history.md`, `reference/tools/git-mesh.md`).

## Route within this principle

- **You must model the common seeking journeys**: read `journeys.md` — model the common seeking journeys end to end.
- **Readers accumulate partial answers and reformulate**: read `berrypicking.md` — support partial-answer accumulation and reformulation.
- **Readers get lost or dead-end**: read `recovery.md` — a way back: overview, related, next-step, and escalation links.
- **You must tune for how readers grep and search**: read `search-behavior.md` — tune for grep/search terms; fix no-result, too-many, misleading queries.
- **An agent must continue from a single retrieved chunk**: read `cross-reference.md` — relationship context so an agent can continue from one chunk.
- **A page must lead with the answer and layer depth**: read `progressive-disclosure.md` — answer first, depth linked or below.
