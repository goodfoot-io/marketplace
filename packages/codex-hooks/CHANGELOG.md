# Changelog

## 1.1.0
- Added `--plugin-root` mode: emits `${PLUGIN_ROOT}`-relative hook commands so a built `hooks.json` is portable inside an installed Codex plugin. Auto-enabled when a `.codex-plugin/` marker is found by walking up from the output path.
- Added `--stable-names` flag (default-on in plugin mode) to emit hash-free compiled bundles (`<name>.mjs`). Stable filenames keep Codex's hook trust hash byte-stable across rebuilds, so users do not have to re-review and re-trust hooks on every plugin update. Stale hashed leftovers are pruned automatically.
- Added `--no-stable-names` to opt back into hashed filenames when desired.

## 1.0.2
- Fixed package type definitions layout to correctly match the paths declared in `package.json` exports, resolving TypeScript resolution issues for consumers

## 1.0.1
- Minor improvements and bug fixes
