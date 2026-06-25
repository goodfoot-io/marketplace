# Job: organizing and maintaining

Scope: keep an existing corpus findable and accurate over time — drift detection and governance on a cadence. Runs `reference/procedure.md` Steps 9–10 on a schedule (Principle 8).

## On a cadence

- **Gate drift mechanically** — `wiki check` and `git mesh stale` in a git hook or CI — `reference/principles/08-validate-and-iterate/governance.md`.
- **Re-run the baseline audit** — `reference/principles/08-validate-and-iterate/baseline-audit.md`.
- **Reorganize only on a real failure signal** (a reader fails to find, or finds the wrong thing) — `reference/principles/08-validate-and-iterate/index.md`.
- **Surface review triggers for the maintainer**: release, code-ownership change, drift signal, stale date — `reference/principles/08-validate-and-iterate/governance.md`.

The shared loop these steps come from: `reference/procedure.md`.
