# typescript-hooks

TypeScript Claude Code hooks built with the `@goodfoot/claude-code-hooks` SDK. These hooks enforce TypeScript and ESLint quality standards through automated validation.

## Hooks

### 1. ESLint/TypeScript/Biome Bypass Prevention (PreToolUse)

Prevents the following patterns from being added to JS/TS files:
- ESLint disable comments (`// eslint-disable`, `/* eslint-disable */`)
- TypeScript suppression comments (`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`)
- TypeScript `as any` type casting
- Biome suppress comments (`biome-ignore`, `biome-ignore-all`, etc.)

**When it runs:** Before Write/Edit/MultiEdit operations on JavaScript/TypeScript files

**Behavior:**
- Only flags patterns being **added** (not existing patterns)
- Denies the operation if bypass patterns are detected
- Provides detailed guidance on fixing the underlying issue

### 2. TypeScript/ESLint Validation (PostToolUse)

Validates TypeScript type checking and ESLint rules after file changes.

**When it runs:** After Write/Edit/MultiEdit operations on TypeScript files

**Features:**
- Runs project-wide TypeScript type checking using `tsc --noEmit`, backed by TypeScript 7's native Go compiler for speed
- Runs ESLint validation using `yarn eslint:files`
- Checks up to 5 dependent files for type errors caused by changes
- Provides detailed error output in YAML format including:
  - Error location (file, line, column)
  - Error message and code
  - Code context around the error

## TypeScript Tooling

`tsc` (`typescript@^7`) runs as the native Go compiler for the project-wide type check the PostToolUse hook shells out to — this is the hot path run on every file edit, so its speed matters most.

TypeScript 7's package no longer ships the JS compiler API (`ts.createSourceFile`, `ts.forEachChild`, etc.), so the swallowed-error AST scan in `src/typescript-check.ts` imports that API from `@typescript/typescript6` instead, Microsoft's compatibility shim re-exporting the old TypeScript 6 API. `typescript` and `@typescript/typescript6` are independent dependencies here — one for the CLI, one for the in-process API — not an alias of one to the other.

Yarn's builtin `compat/typescript` patch (meant for PnP) hard-errors against both the native compiler's package layout and the `@typescript/typescript6` shim, so the repo carries a local plugin (`.yarn/plugins/@yarnpkg/plugin-disable-typescript-compat.cjs`) that strips it — safe since the repo uses `nodeLinker: node-modules`, not PnP. See [yarnpkg/berry#7191](https://github.com/yarnpkg/berry/issues/7191).

TypeScript 6+ no longer auto-includes every installed `@types/*` package; `tsconfig.json` explicitly lists `"types": ["node"]` to keep Node globals (`process`, `Buffer`, `node:fs`, etc.) available.

## Development

### Install Dependencies

```bash
yarn install
```

### Build Hooks

```bash
yarn build
```

This compiles the hooks to `../../plugins-claude/typescript-hooks/hooks/hooks.json`.

### Run Tests

```bash
yarn test
```

### Type Check

```bash
yarn typecheck
```

## Project Structure

```
packages/typescript-hooks/
├── src/
│   ├── eslint-typescript-bypass.ts   # PreToolUse hook
│   └── typescript-check.ts           # PostToolUse hook
├── test/
│   ├── eslint-typescript-bypass.test.ts
│   └── typescript-check.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Plugin Integration

The compiled hooks are output to `plugins-claude/typescript-hooks/hooks/hooks.json`, which is auto-detected by Claude Code when the plugin is enabled.

## Configuration

### Timeouts

- PreToolUse (bypass prevention): 10 seconds
- PostToolUse (TypeScript/ESLint): 60 seconds

These can be adjusted in the hook source files.

### Debug Mode

Set the `DEBUG` environment variable to enable debug logging:

```bash
DEBUG=1 claude
```
