# Tasks and workflows

Scope: shape task documentation around how work actually runs — frequency, stakes, prerequisites, reversibility, branching. Owns the task-shaping rules for Principle 1.

## Diagnostics → actions

- **A task recurs often**: give it a short path from hubs and search — `reference/principles/06-information-scent/cost-of-click.md`.
- **A task is rare but high-stakes**: write a reviewed runbook with warnings, approvals, rollback limits, and evidence capture — `reference/principles/02-typed-source-of-truth-topics/troubleshooting-and-runbooks.md`.
- **A task runs only during incidents**: place it in an incident hub and recovery path — `reference/principles/03-hubs-orientation-and-routing/hub-necessity.md`.
- **A task spans multiple systems or teams**: show handoffs, dependencies, ownership boundaries, and escalation points — `reference/principles/04-multiple-paths/facets.md`.
- **A task has prerequisites**: put them before the steps and link the setup doc — `reference/principles/02-typed-source-of-truth-topics/task-pages.md`.
- **A task is irreversible**: add warnings, approvals, backups, and rollback notes before the risky step.
- **A task is frequently done wrong**: rewrite it with stronger scent, examples, guardrails, and verification — `reference/principles/06-information-scent/index.md`.
- **A task varies by environment, version, customer, or config**: add applicability metadata and branch only where behavior differs — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
- **A task needs a checklist, runbook, or reference table**: convert it to that genre — `reference/principles/02-typed-source-of-truth-topics/modes-and-genres.md`.
- **A task must not be attempted by some readers**: add role, permission, and environment markers — `reference/principles/05-controlled-vocabulary-and-metadata/entities.md`.
