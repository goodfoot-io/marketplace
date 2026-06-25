# Troubleshooting and runbooks

Scope: author symptom-led troubleshooting pages and time-pressure runbooks. Owns operational-content structure for Principle 2.

## In the repo

A runbook step a responder follows under pressure often depends on the alert handler or emitter that triggers it — a load-bearing coupling that no type or test enforces. Record it as a mesh so a change to the handler surfaces against the runbook (`reference/tools/git-mesh.md`).

## Diagnostics → actions

- **Title the page from the user-visible symptom, alert, or error** — `reference/principles/06-information-scent/titles.md`.
- **Add diagnostic checks before fixes**; put the cheapest, highest-yield checks first and rare or risky checks later.
- **Order likely causes by probability, severity, and cost of investigation.**
- **Mark safe actions clearly; on risky actions add warnings, approvals, and rollback notes.**
- **Define escalation thresholds and contacts** — `reference/principles/05-controlled-vocabulary-and-metadata/entities.md`.
- **List the evidence to collect**: logs, metrics, IDs, traces, timestamps.
- **Give the rollback or recovery path and a post-fix health check.**
- **There are known false positives or lookalike symptoms**: add "not actually this" notes and link neighboring pages — `reference/principles/06-information-scent/disambiguation.md`, `reference/principles/04-multiple-paths/cross-linking.md`.
- **After recovery**: add cleanup, follow-up, and post-incident documentation — `reference/principles/08-validate-and-iterate/support-and-ops.md`.
- **It is a runbook**: also structure it for time pressure, safety, rollback, verification, and operational handoff.
