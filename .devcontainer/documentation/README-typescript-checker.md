# TypeScript File Checker Hook

A Claude Code PostToolUse hook that automatically runs TypeScript type checking and ESLint on files after edits.

## Features

- **Automatic validation**: Runs on Write, Edit, and MultiEdit operations
- **TypeScript checking**: Single-file incremental type checking for performance
- **ESLint integration**: Automatic fixing and error reporting with caching
- **Smart filtering**: Only processes TypeScript files (.ts, .tsx)
- **Minimal output**: Silent on success, only shows errors to stderr
- **Performance optimized**:
  - ESLint uses `--cache` for faster subsequent runs
  - TypeScript uses incremental builds with `.tsbuildinfo` files
  - Single-file checking instead of full project validation

## Performance Optimizations

### 1. TypeScript Incremental Builds
The checker uses TypeScript's incremental compilation feature by:
- Adding `"incremental": true` to tsconfig.json
- Using `--incremental` flag with a separate build info file
- Checking only the modified file instead of the entire project

### 2. ESLint Caching
ESLint automatically uses its cache mechanism via the `--cache` flag in the package.json scripts.

### 3. Single-File Checking
Instead of running `yarn typecheck` (which checks the entire project), the hook:
- Runs `tsc --noEmit` on just the modified file
- Uses relative paths for better performance
- Maintains incremental build cache separately

## Installation

1. Ensure the hook is executable:
```bash
chmod +x /workspace/.devcontainer/utilities/check-typescript-file
```

2. Configure the hook in `.claude/settings.local.json`:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "(Write|Edit|MultiEdit)",
        "hooks": [
          {
            "type": "command",
            "command": "/workspace/.devcontainer/utilities/check-typescript-file",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

## Debug Mode

Set `DEBUG=1` to see detailed output:
```bash
DEBUG=1 echo '{"tool":"Edit","tool_input":{"file_path":"path/to/file.ts"}}' | ./check-typescript-file
```

## Exit Codes

- `0`: Success (no errors found or file skipped)
- `1`: Errors found in TypeScript or ESLint

## Error Output

All error messages are sent to stderr, making them visible in Claude Code's hook feedback system.