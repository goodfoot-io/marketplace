# TypeScript Hooks Plugin

A Claude Code plugin that enforces TypeScript and ESLint quality standards through automated hooks.

## Overview

This plugin provides three hooks that run automatically during Write/Edit/MultiEdit operations:

1. **ESLint/TypeScript Bypass Prevention** (PreToolUse)
2. **Jest Mock Prevention** (PreToolUse)
3. **TypeScript/ESLint Validation** (PostToolUse)

## Features

### 1. ESLint/TypeScript Bypass Prevention

**Prevents the following patterns:**
- ESLint disable comments (`// eslint-disable`, `/* eslint-disable */`)
- TypeScript suppression comments (`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`)
- TypeScript `as any` type casting

**Why?** Forces proper type-safe code and encourages fixing underlying issues rather than bypassing rules.

**When it runs:** Before Write/Edit/MultiEdit operations on JavaScript/TypeScript files

**Exit behavior:**
- Denies the operation if bypass patterns are detected
- Provides detailed guidance on fixing the underlying issue

### 2. Jest Mock Prevention

**Prevents the following patterns:**
- `jest.fn()`, `jest.mock()`, `jest.spyOn()`
- Mock utilities from `@jest/globals` or `jest-mock`
- Mock-related type assertions and matchers
- Mock configuration methods (`mockReturnValue`, `mockResolvedValue`, etc.)

**Why?** Enforces integration-first testing with real implementations instead of mocks.

**When it runs:** Before Write/Edit/MultiEdit operations on test files

**Exit behavior:**
- Denies the operation if mocking patterns are detected
- Provides comprehensive guidance on using real implementations:
  - Database operations with `getTestSql()`
  - File operations with temp directories
  - WebSockets with real `ws` servers
  - React hooks with real store implementations
  - Dependency injection patterns

### 3. TypeScript/ESLint Validation

**Validates:**
- TypeScript type checking using `tsc`
- ESLint rules using `yarn eslint:files`
- Type errors in dependent files that import the edited file

**Features:**
- Automatically finds the appropriate `tsconfig.json`
- Checks up to 5 dependent files for type errors
- Provides detailed error output in YAML format including:
  - Error location (file, line, column)
  - Error message and code
  - Code context around the error
  - Function signatures for type mismatch errors
  - External errors in dependent files

**When it runs:** After successful Write/Edit/MultiEdit operations on TypeScript files

**Exit behavior:**
- Exits with code 2 if errors are found (blocks the operation)
- Provides detailed YAML output to help fix errors
- Silent success when no errors are detected

## Installation

### From Local Plugin Directory

1. Add the plugin to your `.claude/settings.json`:

```json
{
  "plugins": [
    {
      "source": "file:///workspace/plugins/typescript-hooks",
      "enabled": true
    }
  ]
}
```

2. Reload Claude Code or restart the session

### From Git Repository

```json
{
  "plugins": [
    {
      "source": "git::https://github.com/your-org/typescript-hooks.git",
      "enabled": true
    }
  ]
}
```

## Configuration

### Hook Timeouts

The plugin uses the following timeouts:
- PreToolUse hooks: 10 seconds each
- PostToolUse hooks: 30 seconds

These can be adjusted in `hooks/hooks.json` if needed.

### Debug Mode

Set the `DEBUG` environment variable to see detailed execution logs:

```bash
DEBUG=1 claude
```

## Hook Details

### File Patterns

- **ESLint/TypeScript Bypass Prevention**: `*.js`, `*.jsx`, `*.ts`, `*.tsx`, `*.mjs`, `*.cjs`, `*.mts`, `*.cts`
- **Jest Mock Prevention**: `*.test.ts`, `*.test.tsx`, `*.test.js`, `*.test.jsx`, `*.spec.*`, `__tests__/*`, `tests/*`
- **TypeScript Validation**: `*.ts`, `*.tsx`

### Dependencies

The hooks require the following tools to be available:
- `jq` - JSON processing (for PreToolUse hooks)
- `tsx` - TypeScript execution (for PostToolUse hook)
- `npx` - Node package execution
- `yarn` - Package manager
- `rg` (ripgrep) - Fast file searching

## Development

### Project Structure

```
typescript-hooks/
├── plugin.json           # Plugin manifest
├── README.md            # This file
└── hooks/
    ├── hooks.json       # Hook configuration
    ├── eslint-typescript-bypass    # PreToolUse hook
    ├── jest-mock-prevention        # PreToolUse hook
    └── typescript-check            # PostToolUse hook
```

### Customizing Hooks

To modify hook behavior:

1. Edit the hook scripts in `hooks/`
2. Update patterns in the `check_for_*_patterns()` functions
3. Adjust guidance messages as needed

### Testing Hooks

You can test hooks manually by piping JSON to them:

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"test.ts","content":"const x: any = 1;"}}' | \
  ./hooks/eslint-typescript-bypass
```

## Troubleshooting

### Hooks Not Running

1. Verify plugin is enabled in `.claude/settings.json`
2. Check that hook scripts are executable: `ls -la hooks/`
3. Enable DEBUG mode to see execution logs

### False Positives

If a hook incorrectly blocks valid code:

1. Review the pattern matching in the hook script
2. Consider adding exceptions for specific cases
3. File an issue with the code sample

### Performance Issues

If PostToolUse hook is too slow:

1. Increase timeout in `hooks.json`
2. Reduce the number of dependent files checked (edit `findDependentFiles()`)
3. Disable dependent file checking for faster feedback

## License

MIT

## Contributing

Contributions are welcome! Please:

1. Test your changes thoroughly
2. Update documentation as needed
3. Follow the existing code style
4. Add examples for new patterns

## Resources

- [Claude Code Hooks Documentation](https://docs.claude.com/en/docs/claude-code/hooks.md)
- [Claude Code Hooks Guide](https://docs.claude.com/en/docs/claude-code/hooks-guide.md)
- [Plugin Development Reference](https://docs.claude.com/en/docs/claude-code/plugins-reference.md)
