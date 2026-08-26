---
name: worktree-cleanup
description: Identify and remove git worktrees (and their branch refs) whose work has already landed in the main branch, including squash- and rebase-merged ones that naive ancestry checks miss. Use when the user says "prune merged worktrees", "clean up worktrees", "remove stale worktrees", "worktree cleanup", or asks which worktrees have no unique commits.
disable-model-invocation: true
---

<instructions>

## 1. Establish the Baseline Branch

Determine the integration branch every worktree is measured against — call it `[BASE]`. Default to the repository's main branch (`main`, or `master`/`trunk` if that is what exists). Confirm with the user when more than one plausible candidate exists. Every command below diffs against `[BASE]`.

## 2. Enumerate and Classify Every Worktree

For each worktree's HEAD, compute two independent signals — ancestry and patch-equivalence — because they catch different merge styles:

```
git rev-list --count [BASE]..$HEAD     # commits on HEAD not reachable from BASE ("ahead")
git cherry [BASE] $HEAD                 # one line per commit: '-' = patch already in BASE, '+' = not
```

Classify from the pair:

- **ahead == 0**: Fully merged. HEAD is an ancestor of `[BASE]`; nothing unique. Safe to remove.
- **ahead > 0 but every `git cherry` line is `-` (zero `+`)**: Merged (stale). The commits were rebased or squash-merged — their patches already exist in `[BASE]`, and the branch is just pinned to an old base. Safe to remove.
- **ahead > 0 with any `+` line**: Genuine unmerged work. **STOP** — do not remove without explicit user confirmation; surface the `+` commit subjects.

**Never** rely on `git branch --merged` or `ahead == 0` alone — both miss squash- and rebase-merges, which is exactly what `git cherry`'s patch-id comparison detects.

Ignore the size of `git diff [BASE] $HEAD` as a merge signal. A stale worktree on an old base shows a huge diff (thousands of deletions) purely because `[BASE]` moved forward — it is not evidence of unique work. The `git cherry` result is authoritative.

When useful, corroborate staleness with `git merge-base [BASE] $HEAD` and `git rev-list --count $HEAD..[BASE]` (how far behind), but classification rests on Step 2's two signals.

## 3. Present the Classification and Confirm Scope

Report worktrees grouped as fully merged, merged (stale), and unmerged, with branch name and path. Confirm which group(s) and which name pattern (e.g. only `agent-*`) the user wants removed before deleting anything. Exclude from scope any branch that never had a worktree in the listing.

## 4. Remove the Worktrees

- **Fully merged (ahead == 0)**: `git worktree remove $PATH` — succeeds without force.
- **Merged stale (ahead > 0, all cherry `-`)**: `git worktree remove --force $PATH` — required because the HEAD is not an ancestor of `[BASE]` by hash, so plain remove refuses. The Step 2 patch-equivalence is the justification that nothing is lost.

## 5. Delete the Associated Branch Refs

`git worktree remove` deletes the working tree but leaves the branch ref. Delete the branch each removed worktree had **checked out** (read it from the worktree listing — the directory name often differs from the checked-out branch).

- Guard each deletion: `git show-ref --verify --quiet refs/heads/$BRANCH` before `git branch -D $BRANCH`.
- Use `-D` (force) — these are not ancestors of `[BASE]` by hash, so `-d` refuses despite the patches having landed.
- **Detached-HEAD worktrees** have no branch ref — skip the branch step for them.
- **Identically-named leftovers**: a ref sharing the worktree's directory name but pointing at a different commit than the worktree's HEAD is a separate branch, not the one the worktree used. Re-classify it with Step 2 and confirm before deleting.

## 6. Shell Pitfalls When Batch-Deleting

- **In zsh, unquoted variables do not word-split.** `for b in $branchlist` iterates once over the whole string. Use an explicit array (`branches=(a b c); for b in $branches`) or `${(s: :)var}`.
- Loop with per-item success/failure reporting rather than one bulk command, so a single failing ref does not mask the rest.

</instructions>
