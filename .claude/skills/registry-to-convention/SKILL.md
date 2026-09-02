---
name: registry-to-convention
description: Use when migrating a codebase off a declared registry/manifest that lists per-unit facts (build targets, platform paths, version surfaces, release identity) toward computing those facts from a fixed naming convention plus what actually exists on disk. Trigger on phrases like "make the build universal", "drop this registry", "simplify this build/version system", "stop declaring targets and compute them instead", or "every X should build the same way with no exceptions".
---

<instructions>

## 1. Confirm the Registry Is Worth Removing

A declared registry (a JSON/YAML file, or a hardcoded per-unit list) is a real liability when every fact it declares — targets, output paths, version surfaces, release identity — is already fully determined by (a) a fixed path/naming convention and (b) which files or directories actually exist. The tell: a growing set of tests, CI steps, or validators exist only to keep the registry honest against what the build actually produces. Those checks are interest on the registry's principal, not independent value.

- **The registry declares facts nothing else could derive** (arbitrary per-unit config with no disk-observable signal): this is not a convention-migration candidate — stop and say so.
- **Scope is ambiguous** (the registry backs several distinct mechanisms — build, versioning, release identity, docs): confirm with the user which mechanisms to convert and which to leave alone before deleting anything. Deleting a mechanism the user wanted kept, just because it *read* the registry, is expensive to unwind mid-migration.

## 2. Design the Convention and the Exception Test

State the convention as a formula, not a lookup: "every directory under `[SOURCE_ROOT]/` is a unit; its outputs live at `[PREFIX]-<variant>/<name>/...` for every variant." No declared target list, no per-unit opt-out flag.

Real exceptions still exist (a hand-maintained, single-variant unit with no generatable source). Do not encode them as a flag inside a data file — encode them as a **structural, discoverable test**: does a sibling exist in the canonical source directory? Presence answers "generated and universal"; absence answers "hand-maintained and narrow." The test itself must be computable from disk, or the registry has just been reborn smaller.

## 3. Separate Declared Facts from Real Mechanisms

A registry usually bundles two different things: facts a script *reads*, and work a script *does* with those facts (propagate a version, discover a config file, resolve a release identity). Deleting the registry does not mean deleting every script that read it.

- **The script only ever read declared facts to do a real, still-needed job**: rewrite it to compute those facts from the Step 2 convention. Keep it.
- **The script exists solely to validate the registry against reality**: delete it — there is no drift left to validate once nothing is declared to drift from.

## 4. Pressure-Test Every Auto-Propagated Relationship

A registry-era "lockstep" relationship (one release line auto-advancing another because they happened to share a mechanism) is not automatically correct just because it's being carried forward. Ask whether the two things are conceptually the same thing, or merely used to share a mechanism. If the latter, decouple them explicitly and call it out as a deliberate behavior change, not a silent regression.

## 5. Hunt Duplicated-Formula Residue

Deleting a single declared source relocates drift risk rather than removing it. Once two or more rewritten scripts independently re-derive the same path formula or discovery pattern, that duplication is now an unenforced coupling nothing catches if one side changes and the other doesn't.

After rewriting, grep the touched scripts for their new formulas and check for repetition across files. For each real duplicate, either extract it to one shared function, or explicitly document the coupling wherever the repo already has a mechanism for that, so a future edit to one side is flagged against the other.

## 6. Verify Parity, Test Stateful Rewrites in Isolation

Before trusting the migration, diff the convention-computed value against the old registry-declared value for **every existing unit**, not a sample — a silently renamed release tag or identity is a correctness regression nothing else catches.

**STOP** — before running a rewritten script that mutates git state (a commit hook, a version-bump script) against the real repository, build a throwaway git repo in a scratch directory with a couple of representative fixtures, copy the new script in, stage synthetic edits, and run it directly. Verify the exact expected before/after state, including a negative case (a unit the change should *not* affect). Delete the scratch repo afterward.

## 7. Land It: Watch for Indirection Around the Very Thing You Changed

When the change touches a hook or dispatcher script itself, expect the mechanism that would normally run it to be stale or indirected:

- **A linked worktree's git hooks may dispatch through the origin checkout's copy of the hook**, not the worktree's own working copy — committing in the worktree can silently run the *old* hook logic against the *new* file layout. Check for a hooks-path indirection (`git config core.hooksPath`, a wrapper script, a stored "original hooks dir" pointer) before concluding the rewritten logic is broken. Look for a repo-documented, sanctioned bypass (e.g. a hooks README that says to use `--no-verify` for hook-changing commits) rather than fighting the indirection.
- **A worktree-isolated session may be unable to touch the shared/origin checkout at all.** If the final merge must happen from the origin directory and the session is sandboxed away from it, hand back the exact command rather than attempting low-level ref tricks on the shared repository.
- **If the target branch has diverged**, rebase onto the new tip, re-verify nothing regressed, and hand back the merge command again — don't force-push or force-merge over the divergence.

</instructions>
