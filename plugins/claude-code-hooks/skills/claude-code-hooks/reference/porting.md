# Porting Bash Hooks to TypeScript

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Output Builders](output-builders.md) | [Logging](logging.md)

<instructions>

## 1. Why Port to TypeScript?

| Benefit | Description |
|---------|-------------|
| Type Safety | Catch errors at compile time, not runtime |
| IntelliSense | Full autocomplete for inputs and outputs |
| Maintainability | Structured code with proper abstractions |
| Debugging | Better error messages and stack traces |
| Testability | Unit test hooks with proper mocking |

## 2. Bash to TypeScript Conversion {#bash-to-typescript}

### 2.1 Identify Hook Type

Find the hook type from your `hooks.json`:

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "./hooks/block-dangerous.sh" }]
    }
  ]
}
```

This is a `PreToolUse` hook.

### 2.2 Analyze Bash Logic

Example bash hook:

```bash
#!/bin/bash
# Read stdin
INPUT=$(cat)

# Parse with jq
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Check for dangerous commands
if [[ "$TOOL_NAME" == "Bash" && "$COMMAND" == *"rm -rf /"* ]]; then
  # Block with reason
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Dangerous command blocked"}}'
  exit 0
fi

# Allow by default
echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
exit 0
```

### 2.3 Create TypeScript Equivalent

```typescript
#!/usr/bin/env tsx
import { preToolUseOutput, type PreToolUseInput } from '@goodfoot/claude-code-hooks';

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const input: PreToolUseInput = JSON.parse(await readStdin());

  // Type-safe access to fields (camelCase!)
  const toolName = input.toolName;
  const command = (input.toolInput as { command?: string })?.command ?? '';

  // Check for dangerous commands
  if (toolName === 'Bash' && command.includes('rm -rf /')) {
    const output = preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Dangerous command blocked'
      }
    });
    process.stdout.write(JSON.stringify(output.stdout));
    process.exit(output.exitCode);
  }

  // Allow by default
  const output = preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
  process.stdout.write(JSON.stringify(output.stdout));
  process.exit(output.exitCode);
}

main();
```

### 2.4 Update hooks.json

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "tsx .claude/hooks/block-dangerous.ts" }]
    }
  ]
}
```

## 3. Field Name Mapping

The library uses **camelCase** for TypeScript while Claude Code uses **snake_case** in JSON:

| Bash (snake_case) | TypeScript (camelCase) |
|-------------------|------------------------|
| `hook_event_name` | `hookEventName` |
| `tool_name` | `toolName` |
| `tool_input` | `toolInput` |
| `session_id` | `sessionId` |
| `cwd` | `cwd` |
| `claude_version` | `claudeVersion` |
| `permission_mode` | `permissionMode` |

Input types automatically handle this conversion when you type your input correctly.

## 4. Batch Migration {#batch-migration}

### 4.1 Create Shared Utilities

Create `.claude/hooks/utils.ts`:

```typescript
export async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

export function writeOutput(output: { stdout: unknown; exitCode: number }): never {
  process.stdout.write(JSON.stringify(output.stdout));
  process.exit(output.exitCode);
}
```

### 4.2 Use in Each Hook

```typescript
#!/usr/bin/env tsx
import { preToolUseOutput, type PreToolUseInput } from '@goodfoot/claude-code-hooks';
import { readStdin, writeOutput } from './utils.js';

async function main() {
  const input: PreToolUseInput = JSON.parse(await readStdin());
  // ... your logic
  writeOutput(preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  }));
}

main();
```

### 4.3 Migration Checklist

For each bash hook:

- [ ] Identify hook type from `hooks.json`
- [ ] Create corresponding TypeScript file
- [ ] Import correct types (`PreToolUseInput`, `SessionStartInput`, etc.)
- [ ] Import correct output builder (`preToolUseOutput`, `sessionStartOutput`, etc.)
- [ ] Convert `jq` parsing to typed access
- [ ] Convert snake_case fields to camelCase
- [ ] Update `hooks.json` to use `tsx`
- [ ] Test with sample input
- [ ] Remove bash file after verification

## 5. Complex Logic Patterns {#complex-logic}

### 5.1 Multiple Conditions

**Bash:**
```bash
if [[ "$TOOL_NAME" == "Bash" ]]; then
  if [[ "$COMMAND" == *"sudo"* ]]; then
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Sudo command detected"}}'
    exit 0
  elif [[ "$COMMAND" == *"rm"* && "$COMMAND" != *"-i"* ]]; then
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Destructive command"}}'
    exit 0
  fi
fi
```

**TypeScript:**
```typescript
if (input.toolName === 'Bash') {
  const command = (input.toolInput as { command?: string })?.command ?? '';

  if (command.includes('sudo')) {
    writeOutput(preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'ask',
        permissionDecisionReason: 'Sudo command detected. Continue?'
      }
    }));
  }

  if (command.includes('rm') && !command.includes('-i')) {
    writeOutput(preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'ask',
        permissionDecisionReason: 'Destructive command. Continue?'
      }
    }));
  }
}

writeOutput(preToolUseOutput({
  hookSpecificOutput: { permissionDecision: 'allow' }
}));
```

### 5.2 File System Checks

**Bash:**
```bash
if [ -f "$CWD/.no-delete" ]; then
  echo '{"decision":"block","reason":"Deletions disabled"}'
  exit 2
fi
```

**TypeScript:**
```typescript
import { existsSync } from 'fs';
import { join } from 'path';

if (existsSync(join(input.cwd, '.no-delete'))) {
  writeOutput(preToolUseOutput({ stopReason: 'Deletions disabled' }));
}
```

### 5.3 External Command

**Bash:**
```bash
GIT_STATUS=$(git status --porcelain 2>/dev/null)
if [ -n "$GIT_STATUS" ]; then
  echo '{"decision":"block","reason":"Uncommitted changes"}'
  exit 2
fi
```

**TypeScript:**
```typescript
import { execSync } from 'child_process';

try {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  if (status.trim().length > 0) {
    writeOutput(stopOutput({
      decision: 'block',
      reason: 'Uncommitted changes present'
    }));
  }
} catch {
  // Not a git repo, continue
}
```

### 5.4 JSON Processing

**Bash:**
```bash
# Extract nested field
VALUE=$(echo "$INPUT" | jq -r '.tool_input.path // ""')
```

**TypeScript:**
```typescript
// Type-safe nested access
const toolInput = input.toolInput as { path?: string };
const value = toolInput?.path ?? '';
```

### 5.5 Environment Variables

**Bash:**
```bash
if [ -z "$ALLOW_DANGEROUS" ]; then
  # Block dangerous commands
fi
```

**TypeScript:**
```typescript
if (!process.env.ALLOW_DANGEROUS) {
  // Block dangerous commands
}
```

## 6. Testing Ported Hooks

### 6.1 Manual Testing

```bash
# Test with sample input (camelCase for direct tsx testing)
echo '{"hookEventName":"PreToolUse","toolName":"Bash","toolInput":{"command":"ls"}}' | tsx .claude/hooks/pre-tool-use.ts
```

### 6.2 Unit Testing with Vitest

```typescript
import { describe, it, expect } from 'vitest';
import { preToolUseOutput } from '@goodfoot/claude-code-hooks';

describe('PreToolUse Hook Logic', () => {
  it('should allow safe commands', () => {
    const input = { toolName: 'Bash', toolInput: { command: 'ls -la' } };
    // Your logic here
    const result = preToolUseOutput({
      hookSpecificOutput: { permissionDecision: 'allow' }
    });
    expect(result.exitCode).toBe(0);
  });

  it('should block dangerous commands', () => {
    const input = { toolName: 'Bash', toolInput: { command: 'rm -rf /' } };
    // Your logic here
    const result = preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Dangerous command'
      }
    });
    expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe('deny');
  });
});
```

## 7. Common Porting Mistakes

| Mistake | Fix |
|---------|-----|
| Using snake_case fields | Use camelCase: `toolName` not `tool_name` |
| Forgetting to await stdin | Always `await readStdin()` |
| Wrong exit code | Use `output.exitCode` from builder |
| Missing type assertion | Cast `toolInput` to expected shape |
| Logging to console | Use file logging instead |

## 8. Complete Migration Example

**Before (bash):**
```bash
#!/bin/bash
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if [[ "$TOOL" == "Bash" ]]; then
  if [[ "$CMD" == *"rm -rf"* ]]; then
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"rm -rf blocked"}}'
    exit 0
  fi
fi

echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
exit 0
```

**After (TypeScript):**
```typescript
#!/usr/bin/env tsx
import { preToolUseOutput, type PreToolUseInput } from '@goodfoot/claude-code-hooks';

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const input: PreToolUseInput = JSON.parse(await readStdin());

  if (input.toolName === 'Bash') {
    const cmd = (input.toolInput as { command?: string })?.command ?? '';
    if (cmd.includes('rm -rf')) {
      const output = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: 'rm -rf blocked'
        }
      });
      process.stdout.write(JSON.stringify(output.stdout));
      process.exit(output.exitCode);
    }
  }

  const output = preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
  process.stdout.write(JSON.stringify(output.stdout));
  process.exit(output.exitCode);
}

main();
```

</instructions>
