# Analytics (repo proxy)

Scope: use git history as the behavior signal — change frequency, churn, incident spikes. Owns activity analysis for Principle 8.

## The repo proxy

Web analytics map to git activity. Most-changed files (`git log` frequency) are the critical paths; churn is volatility; files touched around incident commits are the incident pages (`reference/tools/git-history.md`).

## Diagnostics → actions

- **A file changes often (hot)**: treat it as a critical path — maintain it tightly and elevate it — `reference/principles/06-information-scent/cost-of-click.md`.
- **A file is touched during incidents**: harden it as a runbook with verification — `reference/principles/02-typed-source-of-truth-topics/troubleshooting-and-runbooks.md`.
- **A file spikes after releases**: link it from the changelog and release notes — `reference/foundations.md` decision-history layer.
- **A page is found mostly through grep, links, or external references**: add navigation links if it is important, verify inbound contexts, and protect source-of-truth status and durable identifiers — `reference/principles/04-multiple-paths/index.md`, `reference/foundations.md`.
- **A file never changes and is never referenced**: reassess, link, or archive it — `reference/principles/04-multiple-paths/orphans-and-dead-ends.md`.
- **A signal is ambiguous**: combine it with task context and support evidence before restructuring — analytics are diagnostic, not proof.
