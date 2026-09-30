# TypeScript Hooks for Codex

Codex command hooks for `apply_patch`, built from [the shared source package](../../packages/typescript-hooks/README.md).

## Behavior

- **PreToolUse:** denies added ESLint, TypeScript, and Biome suppressions and `as any` casts in JavaScript and TypeScript files. Checks each file and patch hunk; retained or removed matches are permitted.
- **PostToolUse:** checks existing TypeScript files at their destination paths after a successful patch. Runs the project compiler once per affected package, ESLint per file, and the swallowed-error scan. Reports diagnostics as model context.

Additions, updates, multiple files, and renames are supported. Deleted files are skipped. Edits made through shell commands or other tools are outside this plugin's coverage. Pattern checks use text matching and may flag matching text inside strings.

Compiler and ESLint behavior follows the shared package: a nearby `package.json`, a `tsconfig.json` for compiler checks, and a working `yarn eslint:files` script are required for those checks. Diagnostics are filtered to edited files and selected dependent files; this is not a complete project validation gate. Tool failures that produce no recognized diagnostics may not appear in the report.

## Install and enable

The plugin is listed in [the Goodfoot Codex marketplace](../../.agents/plugins/marketplace.json). Install `typescript-hooks` from that marketplace using Codex's plugin manager and enable it.

Review and trust the hooks through `/hooks` before expecting them to run. Installing or enabling the plugin does not automatically trust its command hooks. See [OpenAI's bundled plugin hooks documentation](https://developers.openai.com/plugins/build/plugins#bundled-hooks) and [Codex hooks](https://developers.openai.com/codex/hooks).

The [plugin manifest](.codex-plugin/plugin.json) declares `./hooks/hooks.json`. Its generated commands use `${PLUGIN_ROOT}` so the plugin can be relocated after installation. Hook timeouts are 10 seconds before a patch and 60 seconds afterward.

The execution environment needs Node.js >=20.11, `npx`, `yarn`, `rg`, and the target project's installed compiler and lint dependencies.

## Build and test

From the repository root:

```bash
yarn workspace typescript-hooks build
yarn workspace typescript-hooks typecheck
yarn workspace typescript-hooks test
yarn workspace typescript-hooks test:artifacts
```

`build` emits both Claude Code and Codex plugins. Use `build:codex` to rebuild only this plugin after source edits. `test:artifacts` rebuilds the Codex executables and invokes them directly with wire-format events, including a real compiler diagnostic fixture. It verifies compiled behavior; it does not test host registration.

Set `AGENT_HOOKS_LOG_FILE` to an absolute file path to capture hook execution logs.
