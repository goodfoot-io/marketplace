# Principle 1 — Organize around user intent

Scope: why a corpus is organized around what readers come to do, not around the source's or team's structure. Explanation mode.

A corpus is *found*, not merely written. Organize it around the intents readers actually arrive with; docs organized around team or internal structure block those intents and force readers into search, memory, and tribal knowledge.

## In a repo

Readers are maintainers, contributors, reviewers, operators, newcomers — and agents grepping with no navigation context (a first-class reader; see `../foundations.md` §3). Intent has layers: the **reader/role**, the **intent** (learn, do, debug, decide, verify, recover), the **task**, the **situation** (incident, onboarding, audit, arriving from an alert or code path), and the **priority** among intents. The dominant navigation should follow the most common intents.

## Apply / draws on

- Apply it: `../../how-to/design-around-intent.md`.
- Discover readers and intent from history and inventory: `../../reference/tools/git-history.md`, `../../reference/tools/inventory-grep.md`.

Related: intent decides what to type `02-typed-source-of-truth-topics.md`; intent is expressed through hubs `03-hubs-orientation-and-routing.md`; the priority among intents sets path length `06-information-scent.md`.
