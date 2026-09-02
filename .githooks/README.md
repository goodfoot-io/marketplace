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
| pre-commit | `pre-commit.plugin-version-bump.sh` | Bump the one canonical manifest of any plugin with staged changes — convention-derived: a `skills-src/<name>` sibling makes it a "full" plugin whose bump propagates to its Codex/OpenCode/Antigravity surfaces and Claude marketplace entry via `scripts/sync-plugin-versions.sh`, every other `plugins-claude/<name>` is hand-maintained and Claude-only; a staged change to one of a plugin's own version surfaces counts only when it alters something other than the version, so the hook's writes cannot re-trigger it but a real edit to a manifest or a version-bearing source file is not exempt. Bumps the Claude `marketplace.json` catalog version when any Claude plugin is bumped, and the Codex `marketplace.json` catalog version when a bumped full plugin is one of its listed entries — both on their own release track, separate from the plugin versions in `plugins[]`. Re-stages. | Yes (unreadable or missing catalog version; no `jq`) |
| pre-commit | `pre-commit.marketplace-sync.sh` | Sync each Claude `marketplace.json` plugin entry's version to its `plugin.json` version. No-ops without `jq`. Re-stages. | No (auto-fix only) |

## Conventions

- One concern per sub-script; one dispatcher per event.
- Graceful degradation: a sub-script no-ops silently if its tool is absent
  (`command -v <tool> >/dev/null 2>&1 || exit 0`).
- Every dispatcher and sub-script is independently executable, `bash -n`-clean,
  and mode `100755`.
- Commit hook changes with `git commit --no-verify` so auto-fixing sub-scripts
  don't sweep unrelated changes into the hooks commit.
