# Changelog

## 1.3.1
- **Deprecated.** Superseded by `@goodfoot/agent-hooks` (`@goodfoot/agent-hooks/codex`).

## 1.3.0
- Added opt-in fail-open execution mode for advisory Codex hooks, allowing hooks to be configured as non-blocking so failures don't interrupt the workflow

## 1.3.0
- Added an opt-in `unexpectedError: "continue"` hook config option so advisory hooks (e.g. `UserPromptSubmit` context nudges) can fail open: unexpected runtime failures in stdin reading, parsing, handler execution, output serialization, the stdout write, or logger cleanup are caught, reported to an optional `onUnexpectedError(error, phase)` callback and the runtime logger, and swallowed, emitting the event's valid empty output (`{}`) and exiting `0` instead of surfacing Codex's failed-hook banner. `BlockError` and the existing non-zero default are unaffected. See the README's "Fail-Open Execution" section.

## 1.2.0
- Added `--no-sourcemap` CLI option to disable sourcemap generation on build
- Fixed runtime resolution to work correctly across sibling-source-tree and symlinked package layouts, ensuring consistent behavior regardless of how packages are installed
- Scaffolded projects now pin the released versions of both hook packages

## 1.2.0
- Added `--no-sourcemap` to compile hooks without the embedded inline sourcemap, shrinking bundled output by ~85–90%. Default output is byte-for-byte unchanged; pass `--sourcemap` (the default) to restore the previous behavior.

## 1.1.5
- Fixed the entry wrapper's runtime import to resolve through the node_modules symlink, restoring portability and reproducible behavior in symlinked (workspace/monorepo) installs
- Fixed the synthetic entry wrapper's `runtime.js` import specifier to be computed through the checkout's own `node_modules` symlink rather than the CLI module's realpathed `import.meta.url`, so the sourcemap's `sources` entries and the entry wrapper's `sourcesContent` stay byte-stable across checkouts sharing a symlinked install at different nesting depths (completes the 1.1.4 portability fix, whose `preserveSymlinks` change could not reach this JavaScript-computed path)

## 1.1.4
- Fixed compiled hook output to remain portable across different checkouts of the repository
- Fixed non-portable esbuild module-boundary comments (and inline sourcemap `sources` entries) when compiling a hook whose dependency is resolved through a symlinked `node_modules`, e.g. a hoisted install shared across checkouts at different nesting depths. Added `preserveSymlinks: true` to the esbuild config so compiled output is byte-stable across checkouts regardless of how deeply each one is nested relative to the shared install.

## 1.1.3
- Updated the bundled Codex hook schemas (permission-request, tool-use, compact, session, and subagent events) to match the latest Codex definitions

## 1.1.2
- Fixed: generated hook commands now properly quote `$CLAUDE_PLUGIN_ROOT` to handle paths with spaces or special characters

## 1.1.1
- Fixed `compileHook` on native Windows: the generated entry wrapper now imports `runtime.js` via a valid relative path. Previously the runtime path was derived from `new URL(import.meta.url).pathname`, which yields `/C:/...` on Windows and caused esbuild to fail with `Could not resolve "../../../../C:/..."`. Switched to `fileURLToPath` so the path is correct on every platform.

## 1.1.0
- Added portable plugin commands for use across different environments
- Improved output with stable, predictable filenames

## 1.1.0
- Added `--plugin-root` mode: emits `${PLUGIN_ROOT}`-relative hook commands so a built `hooks.json` is portable inside an installed Codex plugin. Auto-enabled when a `.codex-plugin/` marker is found by walking up from the output path.
- Added `--stable-names` flag (default-on in plugin mode) to emit hash-free compiled bundles (`<name>.mjs`). Stable filenames keep Codex's hook trust hash byte-stable across rebuilds, so users do not have to re-review and re-trust hooks on every plugin update. Stale hashed leftovers are pruned automatically.
- Added `--no-stable-names` to opt back into hashed filenames when desired.

## 1.0.2
- Fixed package type definitions layout to correctly match the paths declared in `package.json` exports, resolving TypeScript resolution issues for consumers

## 1.0.1
- Minor improvements and bug fixes
