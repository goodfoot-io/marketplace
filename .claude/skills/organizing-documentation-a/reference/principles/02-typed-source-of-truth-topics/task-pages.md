# Task and how-to pages

Scope: author how-to/task pages — the action, the end state, and verification. Owns task-page structure for Principle 2; checklists and migration guides follow the same shape.

## In the repo

A how-to is a runnable task (a script or `justfile` target) or a guide; link the code and config as the owner of behavior, do not restate it (`reference/foundations.md`).

## Diagnostics → actions

- **Set the title to the action** as a verb-object phrase — `reference/principles/06-information-scent/titles.md`.
- **Define success / the end state before the steps.**
- **State who may perform it**: role and permission requirements — `reference/principles/05-controlled-vocabulary-and-metadata/entities.md`.
- **List prerequisites, required inputs, tools, and credentials before the instructions.**
- **Write ordered, testable steps.**
- **Add verification**: commands, checks, or expected outputs that confirm success.
- **Things can go wrong**: link troubleshooting at the point of failure — `troubleshooting-and-runbooks.md`, `reference/principles/04-multiple-paths/cross-linking.md`.
- **A step is risky**: put a warning at the point of risk; add rollback before risky execution, or state that none exists.
- **Behavior varies by version, environment, customer, or config**: branch only where it differs and label each branch — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
