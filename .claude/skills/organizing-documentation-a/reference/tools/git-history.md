# Tool: git history as evidence

Scope: use `git log`, `git blame`, `--follow`, `-L`, and history mining to learn who reads an area, what is load-bearing, and what is stale.

## Commands

```bash
git shortlog -sn -- <path>           # who works here → reader segments
git log --author=<name> --oneline    # what one person touches
git log -1 --format=%cs -- <path>    # last-change date → staleness
git log --follow -- <path>           # history across renames
git log -L <start>,<end>:<path>      # history of one region (berrypicking)
git blame <path>                     # line provenance and rationale trail
```

## Diagnostics → actions

- **You need reader segments**: `git shortlog -sn` per area names who maintains it — feed `reference/principles/01-organize-around-user-intent/readers-and-roles.md`.
- **A load-bearing doc has an old `%cs` date**: flag it for review — `reference/principles/08-validate-and-iterate/baseline-audit.md`.
- **A region's rationale is unclear**: `git log -L` / `git blame` trace it to the owning commit/ADR; link that, do not restate it (`reference/foundations.md` decision-history layer).
- **A renamed file lost its history trail in links**: re-anchor with a durable identifier (`reference/foundations.md`) and use `git log --follow` to recover the chain.

## Mine co-change coupling

When two files change together but nothing in code links them, the coupling lives in memory. Surface it by mining git history (co-change, lagged change, defect propagation, churn correlation) into a ranked shortlist: mine → shortlist → explain.

- **A pair fires across three or more signals**: very likely real coupling — verify the shared concern in the co-change commits, then mint a mesh (`reference/tools/git-mesh.md`).
- **A pair's two sides share one author, or one imports the other**: distrust it — the coupling is personal context or already enforced; do not mesh it.

## Used by

`reference/procedure.md` Steps 3 and 9; reader intent in `reference/principles/01-organize-around-user-intent/index.md`; berrypicking in `reference/principles/07-nonlinear-information-seeking/berrypicking.md`; staleness and analytics in `reference/principles/08-validate-and-iterate/index.md`.
