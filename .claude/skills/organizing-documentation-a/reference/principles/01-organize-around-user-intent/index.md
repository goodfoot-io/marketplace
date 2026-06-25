# Principle 1 — Organize around user intent

Scope: segment the readers of a repository and route the corpus by what each is trying to do — intent, task, situation, priority — not by team or topic alone.

## In the repo

Readers are maintainers changing a package, contributors locating code, reviewers judging a diff, operators running build and release, newcomers onboarding, and agents retrieving by grep with no navigation context. Working norms live in root and module `AGENTS.md`/`CLAUDE.md`; every landing file must self-orient. Find who reads what with `git shortlog -sn`, `git log --author`, and `CODEOWNERS` (`reference/tools/git-history.md`). Make the most common intents the dominant navigation structure (`reference/principles/03-hubs-orientation-and-routing/index.md`, `reference/principles/04-multiple-paths/index.md`).

## Route within this principle

- **You must name the audience segments and give each a path**: read `readers-and-roles.md` — reader types, how to find them, and the landing each needs.
- **A reader's goal must map to a topic type**: read `intents.md` — learn / do / debug / decide / verify / recover routed to the right genre.
- **Task docs must match how work actually runs**: read `tasks-and-workflows.md` — frequency, stakes, prerequisites, reversibility, branching.
- **Entry points must match the conditions of arrival**: read `situations.md` — pressure, sequence, origin, search frame, environment.
- **You must decide what to fix first**: read `prioritization.md` — rank intents by frequency, value, and cost of failure; turn gaps into work.
