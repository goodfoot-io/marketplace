---
name: claude-code-hooks
description: Type-safe TypeScript hooks for Claude Code using @goodfoot/claude-code-hooks. Use when creating new Claude Code hooks, porting bash hooks to TypeScript, or working with hook output builders, input types, and logging.
---

<instructions>

## 1. Environment Check

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

## 2. Quick Start

Uses `@goodfoot/claude-code-hooks` with hook factories. Every hook file follows this pattern:

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  logger.info('Processing command', { toolName: input.toolName });

  // Your logic here - input is typed and in camelCase
  return preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
});
```

Then compile with the CLI to generate `hooks.json`:

```bash
npx claude-code-hooks -i "hooks/*.ts" -o ".claude/hooks.json"
```

The CLI:
- Bundles your hook into a standalone executable
- Generates `hooks.json` with correct paths and matchers
- Handles stdin/stdout, case transformation, and exit codes automatically

## 3. Copy-Paste Examples

These complete examples work immediately after environment check passes. Each uses the hook factory pattern with default export.

### 3.1 PreToolUse: Block Dangerous Commands

```typescript
// hooks/block-dangerous-commands.ts
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  const command = (input.toolInput as { command?: string })?.command ?? '';

  // Block dangerous rm commands
  if (command.includes('rm -rf /')) {
    logger.warn('Blocked dangerous command', { command });
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Blocking dangerous rm -rf / command'
      }
    });
  }

  // Allow everything else
  return preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
});
```

### 3.2 SessionStart: Inject Project Context

```typescript
// hooks/inject-context.ts
import { sessionStartHook, sessionStartOutput } from '@goodfoot/claude-code-hooks';
import { readFileSync, existsSync } from 'fs';

export default sessionStartHook({ matcher: 'startup' }, (input, { logger }) => {
  // Read project-specific context if available
  const contextPath = `${input.cwd}/.claude-context.md`;

  if (existsSync(contextPath)) {
    const additionalContext = readFileSync(contextPath, 'utf-8');
    logger.info('Injecting project context', { path: contextPath });
    return sessionStartOutput({
      hookSpecificOutput: { additionalContext }
    });
  }

  logger.debug('No context file found');
  return sessionStartOutput({});
});
```

### 3.3 Stop: Require Uncommitted Changes Check

```typescript
// hooks/check-uncommitted.ts
import { stopHook, stopOutput } from '@goodfoot/claude-code-hooks';
import { execSync } from 'child_process';

export default stopHook({}, (input, { logger }) => {
  // Check for uncommitted changes
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf-8',
      cwd: input.cwd
    });

    if (status.trim().length > 0) {
      logger.warn('Blocking stop - uncommitted changes detected');
      return stopOutput({
        decision: 'block',
        reason: 'There are uncommitted changes. Commit or stash before stopping.'
      });
    }
  } catch {
    // Not a git repo, allow stop
    logger.debug('Not a git repository');
  }

  return stopOutput({ decision: 'approve' });
});
```

### 3.4 Compile and Register Hooks

After creating your hook files, compile them:

```bash
npx claude-code-hooks -i "hooks/*.ts" -o ".claude/hooks.json"
```

This generates `.claude/hooks.json` which Claude Code reads automatically.

## 4. Task Router

Based on what you need to do:

**Creating new hooks:**
- **Set up hooks from scratch**: Read reference/installation.md
- **Create a PreToolUse hook**: See Section 5.1
- **Create a SessionStart hook**: See Section 5.2
- **Create a Stop hook**: See Section 5.3
- **Create any other hook type**: Read reference/output-builders.md

**Porting existing hooks:**
- **Convert bash hook to TypeScript**: Read reference/porting.md#bash-to-typescript
- **Migrate multiple hooks**: Read reference/porting.md#batch-migration
- **Handle complex bash logic**: Read reference/porting.md#complex-logic

**Understanding hook types:**
- **See all 12 hook types**: Read reference/output-builders.md#hook-types
- **Understand exit codes**: See Section 6
- **Learn input type structure**: Read reference/output-builders.md#input-types
- **Use hook-specific options**: Read reference/output-builders.md#hook-specific-options
- **PreToolUse vs PermissionRequest**: See Section 8.1

**Adding logging:**
- **Set up file logging**: Read reference/logging.md#file-output
- **Subscribe to log events**: Read reference/logging.md#event-subscription
- **Log errors with context**: Read reference/logging.md#error-logging

**Environment and configuration:**
- **Access project directory**: Read reference/environment.md#getprojectdir
- **Persist environment variables**: Read reference/environment.md#persistenvvar
- **Detect remote environment**: Read reference/environment.md#isremoteenvironment

## 5. Hook Type Patterns

All hooks use the factory + output builder pattern with default export.

### 5.1 PreToolUse Pattern

PreToolUse fires **before** any tool executes. Use for blocking dangerous commands, modifying tool inputs, or requiring confirmation.

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  // Your logic using input.toolName, input.toolInput
  return preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } });
});
```

**Output options:**
- **Permit execution**: `preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } })`
- **Block with reason**: `preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: 'Reason' } })`
- **Request confirmation**: `preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'ask', permissionDecisionReason: 'Confirm?' } })`
- **Allow with modified input**: `preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow', updatedInput: {...} } })`
- **Default permission behavior**: `preToolUseOutput({})`

**Input fields (camelCase):**
- `toolName` — Name of the tool (e.g., `'Bash'`, `'Write'`, `'Read'`)
- `toolInput` — Tool parameters as `Record<string, unknown>`

### 5.2 SessionStart Pattern

SessionStart fires when a session begins. Use for injecting project context, setting up environment, or different behavior for startup vs resume.

```typescript
import { sessionStartHook, sessionStartOutput } from '@goodfoot/claude-code-hooks';

export default sessionStartHook({ matcher: 'startup' }, (input, { logger }) => {
  // Your logic using input.source, input.cwd
  return sessionStartOutput({ hookSpecificOutput: { additionalContext: 'Context' } });
});
```

**Output options:**
- **Inject context**: `sessionStartOutput({ hookSpecificOutput: { additionalContext: 'Context string' } })`
- **Add system instruction**: `sessionStartOutput({ systemMessage: 'System instruction' })`
- **No additional context**: `sessionStartOutput({})`

**Input fields:**
- `source` — `'startup'` | `'resume'` | `'clear'` | `'compact'`
- `cwd` — Working directory

### 5.3 Stop Pattern

Stop fires when Claude Code is about to stop. Use for preventing premature stops, cleanup validation, or final checks.

```typescript
import { stopHook, stopOutput } from '@goodfoot/claude-code-hooks';

export default stopHook({}, (input, { logger }) => {
  // Your logic - no matcher needed for Stop hooks
  return stopOutput({ decision: 'approve' });
});
```

**Output options:**
- **Allow stop**: `stopOutput({ decision: 'approve' })`
- **Prevent stop**: `stopOutput({ decision: 'block', reason: 'Not ready' })`
- **Default (allow stop)**: `stopOutput({})`

## 6. Exit Codes

| Exit Code | Name | When Used | Claude Code Behavior |
|-----------|------|-----------|---------------------|
| `0` | Success | Handler returns normally | Continue, parse stdout as JSON |
| `1` | Error | Handler throws, invalid input | Non-blocking, stderr to user only |
| `2` | Block | `stopReason` set or `decision: 'block'` | Blocking, stderr shown to Claude |

The output builders handle exit codes automatically:

```typescript
// Exit 0 - normal success
preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } });

// Exit 2 - blocking (via stopReason)
preToolUseOutput({ stopReason: 'Operation not permitted' });

// Exit 2 - blocking (for Stop/SubagentStop hooks)
stopOutput({ decision: 'block', reason: 'Uncommitted changes' });
```

## 7. hooks.json Configuration

The CLI generates `hooks.json` automatically from your hook files:

```bash
npx claude-code-hooks -i "hooks/*.ts" -o ".claude/hooks.json"
```

The CLI extracts matchers from your hook factory calls and generates the correct format:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "/path/to/hook.abc123.mjs" }]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{ "type": "command", "command": "/path/to/hook.def456.mjs" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "/path/to/hook.ghi789.mjs" }]
      }
    ]
  }
}
```

**Matcher by hook type:**

| Hook Type | Matcher Matches Against | Example Values |
|-----------|------------------------|----------------|
| PreToolUse | `toolName` | `'Bash'`, `'Write'`, `'Read\|Edit'` |
| PostToolUse | `toolName` | `'Bash'`, `'Skill'` |
| PermissionRequest | `toolName` | `'Bash'`, `'Write'` |
| SessionStart | `source` | `'startup'`, `'resume'`, `'compact'` |
| SubagentStart | `agentType` | Subagent type string |
| Notification | `notificationType` | Notification type string |
| PreCompact | `trigger` | `'manual'`, `'auto'` |
| Stop, SubagentStop, UserPromptSubmit | N/A | Fire on all events (no matcher) |

## 8. All 12 Hook Types

| Hook Type | When It Fires | Common Uses |
|-----------|---------------|-------------|
| PreToolUse | Before tool execution | Block/allow commands, modify inputs |
| PostToolUse | After successful tool | Add context, modify output |
| PostToolUseFailure | After tool failure | Add recovery guidance |
| UserPromptSubmit | User submits prompt | Inject context |
| SessionStart | Session begins | Initialize context, persist env vars |
| SessionEnd | Session ends | Cleanup |
| Stop | Claude about to stop | Validate before stopping |
| SubagentStart | Task agent starts | Subagent-specific context |
| SubagentStop | Task agent stops | Subagent cleanup |
| Notification | Notification sent | Forward notifications |
| PreCompact | Before compaction | Preserve context |
| PermissionRequest | Permission prompt shown | Auto-approve/deny permissions |

### 8.1 PreToolUse vs PermissionRequest

These hooks are related but serve different purposes:

| Aspect | PreToolUse | PermissionRequest |
|--------|------------|-------------------|
| **When** | Before every tool execution | Only when permission dialog would show |
| **Purpose** | Control whether Claude executes tools | Auto-respond to permission prompts |
| **Scope** | All tool invocations (even allowed ones) | Only tools requiring user permission |
| **Output** | `permissionDecision: 'allow'/'deny'/'ask'` | `decision: { behavior: 'allow'/'deny' }` |
| **Use case** | Block dangerous commands, modify inputs | Eliminate permission dialogs for trusted operations |

**Use PreToolUse when you want to:**
- Block dangerous commands regardless of permission settings
- Modify tool inputs before execution
- Log all tool invocations
- Apply custom security rules

**Use PermissionRequest when you want to:**
- Auto-approve safe operations without prompts
- Auto-deny certain operations silently
- Customize the permission flow

**Example: Both hooks working together:**

```typescript
// PreToolUse: Block rm -rf / regardless of permissions
export default preToolUseHook({ matcher: 'Bash' }, (input) => {
  const cmd = (input.toolInput as { command?: string })?.command ?? '';
  if (cmd.includes('rm -rf /')) {
    return preToolUseOutput({
      hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: 'Blocked' }
    });
  }
  return preToolUseOutput({}); // Let normal permission flow continue
});

// PermissionRequest: Auto-approve safe git commands
export default permissionRequestHook({ matcher: 'Bash' }, (input) => {
  const cmd = (input.toolInput as { command?: string })?.command ?? '';
  if (cmd.startsWith('git status') || cmd.startsWith('git diff')) {
    return permissionRequestOutput({
      hookSpecificOutput: { decision: { behavior: 'allow' } }
    });
  }
  return permissionRequestOutput({}); // Show normal permission prompt
});
```

## 9. Troubleshooting

### 9.1 Hook Not Firing

1. Verify CLI compilation succeeded: `npx claude-code-hooks -i "hooks/*.ts" -o ".claude/hooks.json"`
2. Check `hooks.json` contains correct absolute paths
3. Verify matcher pattern matches (case-sensitive, uses regex)
4. Check compiled `.mjs` files exist and are executable

### 9.2 Compilation Errors

Ensure hook file uses correct pattern:

```typescript
// Correct - uses hook factory with default export
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  return preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } });
});
```

Common issues:
- Missing `export default`
- Using direct output builder pattern instead of hook factory
- Missing return statement

### 9.3 Type Errors

Use the correct hook factory for your hook type:
- **PreToolUse**: `preToolUseHook()` with `preToolUseOutput()`
- **PostToolUse**: `postToolUseHook()` with `postToolUseOutput()`
- **SessionStart**: `sessionStartHook()` with `sessionStartOutput()`
- **Stop**: `stopHook()` with `stopOutput()`
- **Other types**: See reference/output-builders.md

### 9.4 Logging Issues

Never use `console.log` - it breaks the hook protocol. Use the logger:

```typescript
export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  logger.info('Processing', { tool: input.toolName }); // Correct
  // console.log('Processing');  // WRONG - breaks protocol
  return preToolUseOutput({});
});
```

See reference/logging.md for file output configuration.

## 10. Common Gotchas

| Issue | What Happens | Fix |
|-------|--------------|-----|
| Missing `export default` | CLI can't find hook | Add `export default` to hook factory call |
| Using `console.log` | Breaks hook protocol | Use `logger` from context |
| Wrong hook factory | Type errors | Match factory to hook event type |
| Matcher not matching | Hook doesn't fire | Check regex pattern, use `\|` for OR |
| Missing return | Undefined output | Always return output builder result |

</instructions>
