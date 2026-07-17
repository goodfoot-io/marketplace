# Changelog

## 1.1.4
- Fixed compiled hook output to remain portable across different checkouts of the repository

## 1.1.4
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
