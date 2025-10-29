# check-typescript-file

A utility that performs TypeScript type checking and ESLint validation on individual TypeScript files. This utility is designed to work with Claude Code's PostToolUse hook system.

## Features

- **TypeScript Type Checking**: Runs type checking using the project's TypeScript configuration
- **ESLint Validation**: Automatically runs ESLint with auto-fix capability
- **Monorepo Aware**: Automatically detects which package a file belongs to and uses the appropriate configuration
- **JSON Input**: Accepts Claude Code hook JSON payload via stdin

## Usage

### As a Claude Code Hook

The utility is configured to run automatically after file modifications through the hook configuration in `.claude/hooks/settings.local.json`:

```json
{
  "hooks": {
    "PostToolUse": {
      "command": [
        {
          "match": ["Write", "Edit", "MultiEdit"],
          "command": "/workspace/.devcontainer/utilities/check-typescript-file"
        }
      ]
    }
  }
}
```

### Manual Testing

You can test the utility manually by piping a JSON payload:

```bash
echo '{"tool_name": "Write", "tool_input": {"file_path": "/workspace/packages/website/app/index.ts"}}' | ./check-typescript-file
```

## Input Format

The utility expects a JSON payload following the Claude Code PostToolUse hook structure:

```json
{
  "tool_name": "Write|Edit|MultiEdit",
  "tool_input": {
    "file_path": "/absolute/path/to/file.ts"
  }
}
```

## Output

The utility operates in two modes:

### Normal Mode (default)
- **Silent on success**: No output when all checks pass
- **Verbose on errors**: Shows detailed error information when issues are found
- Ideal for use as a hook to avoid noise during normal operations

### Debug Mode (DEBUG=1)
- Shows all output including:
  - File being checked
  - Package directory detected
  - TypeScript type checking results
  - ESLint results (with auto-fix status)
  - Summary of all checks

Enable debug mode by setting `DEBUG=1`:
```bash
DEBUG=1 echo '{"tool_name": "Write", "tool_input": {"file_path": "/path/to/file.ts"}}' | ./check-typescript-file
```

## Exit Codes

- `0`: All checks passed
- `1`: General error (e.g., invalid input)
- `2`: Quality issues found (TypeScript or ESLint errors)

## Requirements

- Node.js
- Yarn (as the monorepo uses Yarn)
- Valid `package.json` with `typecheck` and `eslint:files` scripts in the package directory