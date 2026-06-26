# Tool: git history

Scope: mine `git` history for decision history, co-change coupling, and staleness. Owns history queries. Use in Step 2 (translate) to learn what is load-bearing before changing anything.

## Decision history (why something is the way it is)

```bash
git log --follow -- <path>          # full history across renames
git log -L<start>,<end>:<path>      # berrypick one region's history
git blame <path>                    # line-by-line last change + author
git log -S'<string>'                # the commit where a string entered or left
```

Decision history is owned by commits / PRs / `CHANGELOG` / ADRs — link to it; never fold it into current instructions.

## Co-change coupling (mesh candidates)

Files that repeatedly change together but are not linked by any type/test/import are implicit semantic dependencies. Surface them by history mining: **mine → shortlist → explain** (co-change, lagged co-change, defect propagation, churn correlation, reviewer overlap, and similar signals).

- Distrust a pair whose commits share a single author (it may be one person's habit, not a contract).
- Distrust a pair a type, test, schema, or import already enforces — that mechanism *is* the dependency.
- A surviving load-bearing pair → record it as a mesh.

## Staleness

```bash
git log -1 --format=%cs -- <path>   # last change date for a file
```

Compare last-change dates to release cadence; surface the oldest docs in high-churn areas for review.

## Who works where (intent and ownership)

```bash
git shortlog -sn -- <path>          # contributors to a path
git log --author='<name>'           # one author's footprint
```

Related: turn a surviving pair into a mesh `git-mesh.md`; route staleness into governance `../../how-to/govern.md`; map contributors to reader intent `../../how-to/design-around-intent.md`.
