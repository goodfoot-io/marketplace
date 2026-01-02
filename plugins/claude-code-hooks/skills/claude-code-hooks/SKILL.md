---
name: claude-code-hooks
description: Type-safe TypeScript hooks for Claude Code using @goodfoot/claude-code-hooks. Use when creating new Claude Code hooks, porting bash hooks to TypeScript, or working with hook output builders, input types, and logging.
---

# Claude Code Hooks Reference (TypeScript)

```!
# === Claude Code Hooks Environment Check ===
BLOCKED=""

# Package manager detection
if [ -f "yarn.lock" ]; then
  PKG_MGR="yarn"
  PKG_ADD="yarn add"
elif [ -f "pnpm-lock.yaml" ]; then
  PKG_MGR="pnpm"
  PKG_ADD="pnpm add"
elif [ -f "bun.lock" ] || [ -f "bun.lockb" ]; then
  PKG_MGR="bun"
  PKG_ADD="bun add"
else
  PKG_MGR="npm"
  PKG_ADD="npm install"
fi

# 1. Runtime check
if command -v tsx >/dev/null 2>&1; then
  TSX_VER=$(tsx --version 2>&1 | head -1)
  echo "tsx $TSX_VER"
else
  BLOCKED="yes"
  echo "BLOCKED: tsx not installed"
  echo "   Install with: $PKG_ADD -D tsx"
fi

# 2. Package check
if [ -d "node_modules/@goodfoot/claude-code-hooks" ]; then
  VER=$(node -e "console.log(require('./node_modules/@goodfoot/claude-code-hooks/package.json').version)" 2>/dev/null || echo "?")
  echo "@goodfoot/claude-code-hooks@$VER"
else
  BLOCKED="yes"
  echo "BLOCKED: @goodfoot/claude-code-hooks not installed"
  echo "   Install with: $PKG_ADD @goodfoot/claude-code-hooks"
fi

# 3. TypeScript check
if command -v tsc >/dev/null 2>&1; then
  TSC_VER=$(tsc --version 2>&1)
  echo "$TSC_VER"
else
  echo "Note: TypeScript not found (optional but recommended)"
fi

# Final status
if [ -z "$BLOCKED" ]; then
  echo ""
  echo "Ready to create Claude Code hooks."
fi
```

## Quick Start {#setup}

Uses `@goodfoot/claude-code-hooks` with `tsx` runtime. Every hook file follows this pattern:

```typescript
import {
  preToolUseOutput,    // Output builder for this hook type
  type PreToolUseInput // Typed input (camelCase)
} from '@goodfoot/claude-code-hooks';

// Read JSON from stdin, produce JSON to stdout
const input: PreToolUseInput = JSON.parse(await readStdin());

// Your logic here
const output = preToolUseOutput({ allow: true });

// Write result
process.stdout.write(JSON.stringify(output.stdout));
process.exit(output.exitCode);
```

Hook files are registered in `hooks.json` and executed by Claude Code.

## Copy-Paste Examples {#examples}

These complete examples work immediately after environment check passes.

### PreToolUse: Block Dangerous Commands

```typescript
#!/usr/bin/env tsx
import { preToolUseOutput, type PreToolUseInput } from '@goodfoot/claude-code-hooks';

const input: PreToolUseInput = JSON.parse(
  await new Promise<string>((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  })
);

// Block dangerous rm commands
if (input.toolName === 'Bash' && input.toolInput?.command?.includes('rm -rf /')) {
  const output = preToolUseOutput({ deny: 'Blocking dangerous rm -rf / command' });
  process.stdout.write(JSON.stringify(output.stdout));
  process.exit(output.exitCode);
}

// Allow everything else
const output = preToolUseOutput({ allow: true });
process.stdout.write(JSON.stringify(output.stdout));
process.exit(output.exitCode);
```

### SessionStart: Inject Project Context

```typescript
#!/usr/bin/env tsx
import { sessionStartOutput, type SessionStartInput } from '@goodfoot/claude-code-hooks';
import { readFileSync, existsSync } from 'fs';

const input: SessionStartInput = JSON.parse(
  await new Promise<string>((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  })
);

// Only inject context on startup
let additionalContext: string | undefined;
if (input.source === 'startup') {
  // Read project-specific context if available
  const contextPath = `${input.cwd}/.claude-context.md`;
  if (existsSync(contextPath)) {
    additionalContext = readFileSync(contextPath, 'utf-8');
  }
}

const output = sessionStartOutput({ additionalContext });
process.stdout.write(JSON.stringify(output.stdout));
process.exit(output.exitCode);
```

### Stop: Require Uncommitted Changes Check

```typescript
#!/usr/bin/env tsx
import { stopOutput, type StopInput } from '@goodfoot/claude-code-hooks';
import { execSync } from 'child_process';

const input: StopInput = JSON.parse(
  await new Promise<string>((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  })
);

// Check for uncommitted changes
try {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  if (status.trim().length > 0) {
    const output = stopOutput({
      decision: 'block',
      reason: 'There are uncommitted changes. Commit or stash before stopping.'
    });
    process.stdout.write(JSON.stringify(output.stdout));
    process.exit(output.exitCode);
  }
} catch {
  // Not a git repo, allow stop
}

const output = stopOutput({ decision: 'approve' });
process.stdout.write(JSON.stringify(output.stdout));
process.exit(output.exitCode);
```

## I Want To... {#router}

### Create New Hooks
| Task | Reference |
|------|-----------|
| Set up hooks from scratch | reference/installation.md |
| Create a PreToolUse hook | #pretooluse-pattern |
| Create a SessionStart hook | #sessionstart-pattern |
| Create a Stop hook | #stop-pattern |
| Create any other hook type | reference/output-builders.md |

### Port Existing Hooks
| Task | Reference |
|------|-----------|
| Convert bash hook to TypeScript | reference/porting.md#bash-to-typescript |
| Migrate multiple hooks | reference/porting.md#batch-migration |
| Handle complex bash logic | reference/porting.md#complex-logic |

### Understand Hook Types
| Task | Reference |
|------|-----------|
| See all 12 hook types | reference/output-builders.md#hook-types |
| Understand exit codes | #exit-codes |
| Learn input type structure | reference/output-builders.md#input-types |
| Use hook-specific options | reference/output-builders.md#hook-specific-options |

### Add Logging
| Task | Reference |
|------|-----------|
| Set up file logging | reference/logging.md#file-output |
| Subscribe to log events | reference/logging.md#event-subscription |
| Log errors with context | reference/logging.md#error-logging |

## Hook Type Patterns {#patterns}

### PreToolUse Pattern {#pretooluse-pattern}

PreToolUse fires **before** any tool executes. Use for:
- Blocking dangerous commands
- Modifying tool inputs
- Requiring confirmation

```typescript
import { preToolUseOutput, type PreToolUseInput } from '@goodfoot/claude-code-hooks';

// Decision options (mutually exclusive):
preToolUseOutput({ allow: true });                    // Permit execution
preToolUseOutput({ deny: 'Reason shown to Claude' }); // Block with reason
preToolUseOutput({ ask: 'Confirm this action?' });    // Request user confirmation
preToolUseOutput({ allow: true, updatedInput: {...}}); // Allow with modified input
preToolUseOutput({});                                  // Default permission behavior
```

**Input fields (camelCase):**
- `toolName`: string - Name of the tool (e.g., 'Bash', 'Write', 'Read')
- `toolInput`: Record<string, unknown> - Tool parameters

### SessionStart Pattern {#sessionstart-pattern}

SessionStart fires when a session begins. Use for:
- Injecting project context
- Setting up environment
- Different behavior for startup vs resume

```typescript
import { sessionStartOutput, type SessionStartInput } from '@goodfoot/claude-code-hooks';

// Available options:
sessionStartOutput({ additionalContext: 'Context string' });
sessionStartOutput({ systemMessage: 'System instruction' });
sessionStartOutput({});  // No additional context

// Input fields:
// - source: 'startup' | 'resume' | 'clear' | 'compact'
// - cwd: string - Working directory
// - claudeVersion: string - Claude Code version
```

### Stop Pattern {#stop-pattern}

Stop fires when Claude Code is about to stop. Use for:
- Preventing premature stops
- Cleanup validation
- Final checks

```typescript
import { stopOutput, type StopInput } from '@goodfoot/claude-code-hooks';

// Decision options:
stopOutput({ decision: 'approve' });                    // Allow stop
stopOutput({ decision: 'block', reason: 'Not ready' }); // Prevent stop
stopOutput({});                                         // Default: allow stop
```

## Exit Codes {#exit-codes}

| Exit Code | Name | When Used | Claude Code Behavior |
|-----------|------|-----------|---------------------|
| `0` | Success | Handler returns normally | Continue, parse stdout as JSON |
| `1` | Error | Handler throws, invalid input | Non-blocking, stderr to user only |
| `2` | Block | `{ block: "reason" }` output | Blocking, stderr shown to Claude |

The output builders handle exit codes automatically:

```typescript
// Exit 0 - normal success
preToolUseOutput({ allow: true });

// Exit 2 - blocking
preToolUseOutput({ block: 'Operation not permitted' });

// Exit 1 - error (for manual errors)
preToolUseOutput({ error: 'Something went wrong' });
```

## hooks.json Configuration {#hooks-json}

Register hooks in `.claude/hooks.json` or project hooks file:

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "tsx ./hooks/pre-tool-use-bash.ts"
        }
      ]
    }
  ],
  "SessionStart": [
    {
      "matcher": "startup",
      "hooks": [
        {
          "type": "command",
          "command": "tsx ./hooks/session-start.ts"
        }
      ]
    }
  ],
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "tsx ./hooks/stop-check.ts"
        }
      ]
    }
  ]
}
```

**Matcher by hook type:**

| Hook Type | Matcher Matches Against | Example Values |
|-----------|------------------------|----------------|
| PreToolUse | `tool_name` | `'Bash'`, `'Write'`, `'Read'` |
| PostToolUse | `tool_name` | `'Bash'`, `'Skill'` |
| SessionStart | `source` | `'startup'`, `'resume'`, `'compact'` |
| SubagentStart | `agent_type` | Subagent type |
| Stop | N/A (no matcher) | Fires on all stop events |

## All 12 Hook Types {#all-hooks}

| Hook Type | When It Fires | Common Uses |
|-----------|---------------|-------------|
| PreToolUse | Before tool execution | Block/allow commands, modify inputs |
| PostToolUse | After successful tool | Add context, modify output |
| PostToolUseFailure | After tool failure | Add recovery guidance |
| UserPromptSubmit | User submits prompt | Inject context |
| SessionStart | Session begins | Initialize context |
| SessionEnd | Session ends | Cleanup |
| Stop | Claude about to stop | Validate before stopping |
| SubagentStart | Task agent starts | Subagent-specific context |
| SubagentStop | Task agent stops | Subagent cleanup |
| Notification | Notification sent | Forward notifications |
| PreCompact | Before compaction | Preserve context |
| PermissionRequest | Permission prompt shown | Auto-approve/deny |

## Troubleshooting {#troubleshooting}

### Hook Not Firing

1. Check `hooks.json` path is correct
2. Verify matcher matches (case-sensitive)
3. Ensure `tsx` is in PATH
4. Check hook file has execute permissions

### JSON Parse Errors

Always handle stdin completely before parsing:

```typescript
// Correct pattern
const stdin = await new Promise<string>((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => data += chunk);
  process.stdin.on('end', () => resolve(data));
});
const input = JSON.parse(stdin);
```

### Type Errors

Ensure you're using the correct input type for your hook:

| Hook Type | Input Type |
|-----------|------------|
| PreToolUse | `PreToolUseInput` |
| PostToolUse | `PostToolUseInput` |
| SessionStart | `SessionStartInput` |
| Stop | `StopInput` |
| ... | See reference/output-builders.md |

### Exit Code Issues

Output builders return the correct exit code automatically. Don't override unless necessary:

```typescript
const output = preToolUseOutput({ deny: 'Blocked' });
process.exit(output.exitCode); // Correct - uses builder's exit code
// process.exit(0);           // WRONG - would indicate success
```

## Common Gotchas {#gotchas}

| Issue | What Happens | Fix |
|-------|--------------|-----|
| **Missing await on stdin** | Empty input | Always await stdin read |
| **stdout before processing** | Corrupted JSON | Only write final JSON to stdout |
| **Logging to console** | Breaks hook protocol | Use file logging or event subscription |
| **Forgetting exit code** | Process hangs | Always call `process.exit(output.exitCode)` |
| **Wrong input type** | Type errors | Match input type to hook event |
