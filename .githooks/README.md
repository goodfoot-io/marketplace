# Git hooks (router pattern)

Repo-tracked hooks wired via `core.hooksPath`:

```bash
git config core.hooksPath .githooks
```

Each git event has one thin **dispatcher** that runs an explicit, ordered list of
single-concern sub-scripts named `<event>.<concern>.sh`. Adding, removing, or
reordering a behavior is editing one `PARTS=(...)` list and dropping in one file.

## Classification

- **Fail-closed** (`pre-*`): `set -e` dispatcher; any sub-script non-zero exit
  aborts the action. Auto-fixing sub-scripts must `git add` their fixes *before*
  any gate so the fixes are not discarded.
- **Advisory** (`post-*`): failures are reported but never abort. *(none currently)*

## Sub-scripts

| Event | Sub-script | Concern | Can block |
|-------|------------|---------|-----------|
| pre-commit | `pre-commit.plugin-version-bump.sh` | Bump the patch version of any plugin (Claude or Codex) with staged changes; bump the Claude `marketplace.json` metadata version when any Claude plugin is bumped. Re-stages. | No (auto-fix only) |
| pre-commit | `pre-commit.marketplace-sync.sh` | Sync each Claude `marketplace.json` plugin entry's version to its `plugin.json` version. No-ops without `jq`. Re-stages. | No (auto-fix only) |

## Conventions

- One concern per sub-script; one dispatcher per event.
- Graceful degradation: a sub-script no-ops silently if its tool is absent
  (`command -v <tool> >/dev/null 2>&1 || exit 0`).
- Every dispatcher and sub-script is independently executable, `bash -n`-clean,
  and mode `100755`.
- Commit hook changes with `git commit --no-verify` so auto-fixing sub-scripts
  don't sweep unrelated changes into the hooks commit.
