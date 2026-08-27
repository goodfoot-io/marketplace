# TypeScript Hooks Plugin

A Claude Code plugin that enforces TypeScript and ESLint quality standards through automated hooks.

## Overview

This plugin provides two hooks that run automatically during Write/Edit/MultiEdit operations:

1. **ESLint/TypeScript/Biome Bypass Prevention** (PreToolUse)
2. **TypeScript/ESLint Validation** (PostToolUse)

## Features

### 1. ESLint/TypeScript/Biome Bypass Prevention

**Prevents the following patterns from being added:**
- ESLint disable comments (`// eslint-disable`, `/* eslint-disable */`)
- TypeScript suppression comments (`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`)
- TypeScript `as any` type casting
- Biome suppress comments (`biome-ignore`, `biome-ignore-all`, etc.)

**Why?** Forces proper type-safe code and encourages fixing underlying issues rather than bypassing rules.

**When it runs:** Before Write/Edit/MultiEdit operations on JavaScript/TypeScript files

**Behavior:**
- Only flags patterns being **added** (not existing patterns)
- Denies the operation if bypass patterns are detected
- Provides detailed guidance on fixing the underlying issue

### 2. TypeScript/ESLint Validation

**Validates:**
- TypeScript type checking using `tsc --noEmit`
- ESLint rules using `yarn eslint:files`
- Type errors in dependent files that import the edited file

**Features:**
- Runs project-wide TypeScript type checking
- Checks up to 5 dependent files for type errors
- Provides detailed error output in YAML format including:
  - Error location (file, line, column)
  - Error message and code
  - Code context around the error

**When it runs:** After Write/Edit/MultiEdit operations on TypeScript files

## Installation

### From Local Plugin Directory

1. Add the plugin to your `.claude/settings.json`:

```json
{
  "plugins": [
    {
      "source": "file:///workspace/plugins-claude/typescript-hooks",
      "enabled": true
    }
  ]
}
```

2. Reload Claude Code or restart the session

## Configuration

### Hook Timeouts

- PreToolUse (bypass prevention): 10 seconds
- PostToolUse (TypeScript/ESLint): 60 seconds

### Debug Mode

Set the `DEBUG` environment variable to see detailed execution logs:

```bash
DEBUG=1 claude
```

## Development

### Project Structure

The hooks are implemented in TypeScript using the `@goodfoot/claude-code-hooks` SDK:

```
packages/typescript-hooks/           # Source package
├── src/
│   ├── eslint-typescript-bypass.ts  # PreToolUse hook
│   └── typescript-check.ts          # PostToolUse hook
├── test/
│   └── *.test.ts                    # Unit tests
└── package.json

plugins-claude/typescript-hooks/     # Plugin directory
├── .claude-plugin/
│   └── plugin.json                  # Plugin manifest
├── hooks/
│   ├── hooks.json                   # Generated hook configuration
│   └── build/                       # Compiled hooks (.mjs files)
└── README.md
```

### Building Hooks

From the workspace root:

```bash
cd packages/typescript-hooks
yarn install
yarn build
```

This compiles the hooks and outputs to `plugins-claude/typescript-hooks/hooks/hooks.json`.

### Running Tests

```bash
cd packages/typescript-hooks
yarn test
```

### Modifying Hooks

1. Edit the TypeScript source files in `packages/typescript-hooks/src/`
2. Run `yarn build` to recompile
3. The updated hooks are automatically output to the plugin directory

## File Pattern Support

- **ESLint/TypeScript/Biome Bypass Prevention**: `*.js`, `*.jsx`, `*.ts`, `*.tsx`, `*.mjs`, `*.cjs`, `*.mts`, `*.cts`
- **TypeScript Validation**: `*.ts`, `*.tsx`, `*.mts`, `*.cts`

## Dependencies

The hooks require:
- Node.js >= 20.11.0
- `npx` - Node package execution
- `yarn` - Package manager (for ESLint)
- `rg` (ripgrep) - Fast file searching

## Troubleshooting

### Hooks Not Running

1. Verify plugin is enabled in `.claude/settings.json`
2. Ensure hooks are built: `cd packages/typescript-hooks && yarn build`
3. Enable DEBUG mode to see execution logs

### False Positives

If a hook incorrectly blocks valid code:

1. Review the pattern matching in the hook source
2. Run tests to verify behavior: `yarn test`
3. File an issue with the code sample

## License

MIT

## Resources

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [@goodfoot/claude-code-hooks SDK](https://www.npmjs.com/package/@goodfoot/claude-code-hooks)
