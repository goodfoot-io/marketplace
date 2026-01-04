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
- Runs project-wide TypeScript type checking using `tsc --noEmit`
- Runs ESLint validation using `yarn eslint:files`
- Checks up to 5 dependent files for type errors caused by changes
- Provides detailed error output in YAML format including:
  - Error location (file, line, column)
  - Error message and code
  - Code context around the error

## Development

### Install Dependencies

```bash
yarn install
```

### Build Hooks

```bash
yarn build
```

This compiles the hooks to `../../plugins/typescript-hooks/hooks/hooks.json`.

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

The compiled hooks are output to `plugins/typescript-hooks/hooks/hooks.json`, which is auto-detected by Claude Code when the plugin is enabled.

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
