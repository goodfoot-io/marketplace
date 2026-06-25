# Job: updating after a change

Scope: a change landed; bring the docs back into truth with minimal, evidence-driven edits. Runs `reference/procedure.md` with update emphasis (Principles 2, 8).

## First moves

- **Audit before editing** — `reference/principles/08-validate-and-iterate/baseline-audit.md`; never restructure for tidiness.
- **Detect the drift the change caused** — `git mesh stale` and `wiki check` (`reference/tools/git-mesh.md`, `reference/tools/wiki.md`).
- **Re-route facts if behavior moved** — `reference/foundations.md` layered source of truth.
- **Resolve any new duplication to one source of truth** — `reference/principles/02-typed-source-of-truth-topics/canonicality.md`.
- **Change only what a failure signal justifies**, then re-validate.

Run the loop from the audit step: `reference/procedure.md`.
