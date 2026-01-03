# Output Builders Reference

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Porting](porting.md) | [Logging](logging.md) | [Environment](environment.md)

<instructions>

## 1. All Hook Types {#hook-types}

For descriptions of when each hook type fires, see https://code.claude.com/docs/en/hooks.

| Hook Type | Hook Factory | Output Builder | Matcher Field |
|-----------|--------------|----------------|---------------|
| PreToolUse | `preToolUseHook()` | `preToolUseOutput()` | `toolName` |
| PostToolUse | `postToolUseHook()` | `postToolUseOutput()` | `toolName` |
| PostToolUseFailure | `postToolUseFailureHook()` | `postToolUseFailureOutput()` | `toolName` |
| UserPromptSubmit | `userPromptSubmitHook()` | `userPromptSubmitOutput()` | N/A |
| SessionStart | `sessionStartHook()` | `sessionStartOutput()` | `source` |
| SessionEnd | `sessionEndHook()` | `sessionEndOutput()` | `reason` |
| Stop | `stopHook()` | `stopOutput()` | N/A |
| SubagentStart | `subagentStartHook()` | `subagentStartOutput()` | `agentType` |
| SubagentStop | `subagentStopHook()` | `subagentStopOutput()` | `agentType` |
| Notification | `notificationHook()` | `notificationOutput()` | `notificationType` |
| PreCompact | `preCompactHook()` | `preCompactOutput()` | `trigger` |
| PermissionRequest | `permissionRequestHook()` | `permissionRequestOutput()` | `toolName` |

**Usage pattern:** Import the hook factory and output builder, export default the hook:

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  return preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } });
});
```

## 2. Input Types {#input-types}

### 2.1 Base Input Fields

All input types include these base fields:

```typescript
interface BaseHookInput {
  hookEventName: HookEventName;  // The hook type
  sessionId?: string;            // Current session ID
  cwd: string;                   // Working directory
  claudeVersion?: string;        // Claude Code version
  permissionMode?: PermissionMode; // Permission level
}
```

### 2.2 PreToolUseInput

```typescript
interface PreToolUseInput extends BaseHookInput {
  hookEventName: 'PreToolUse';
  toolName: string;              // Tool being called (e.g., 'Bash', 'Write')
  toolInput: Record<string, unknown>; // Tool parameters
}
```

Common `toolInput` shapes:
- **Bash**: `{ command: string }`
- **Write**: `{ file_path: string, content: string }`
- **Read**: `{ file_path: string }`
- **Edit**: `{ file_path: string, old_string: string, new_string: string }`

### 2.3 PostToolUseInput

```typescript
interface PostToolUseInput extends BaseHookInput {
  hookEventName: 'PostToolUse';
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResult?: unknown;          // Result from the tool
}
```

### 2.4 PostToolUseFailureInput

```typescript
interface PostToolUseFailureInput extends BaseHookInput {
  hookEventName: 'PostToolUseFailure';
  toolName: string;
  toolInput: Record<string, unknown>;
  error?: string;                // Error message
}
```

### 2.5 SessionStartInput

```typescript
interface SessionStartInput extends BaseHookInput {
  hookEventName: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact'; // Why session started
}
```

### 2.6 SessionEndInput

```typescript
interface SessionEndInput extends BaseHookInput {
  hookEventName: 'SessionEnd';
  reason?: string;               // Why session ended
}
```

### 2.7 StopInput

```typescript
interface StopInput extends BaseHookInput {
  hookEventName: 'Stop';
  reason?: string;               // Why Claude is stopping
}
```

### 2.8 SubagentStartInput

```typescript
interface SubagentStartInput extends BaseHookInput {
  hookEventName: 'SubagentStart';
  agentId: string;               // Subagent instance ID
  agentType: string;             // Type of subagent (used for matcher)
}
```

### 2.9 SubagentStopInput

```typescript
interface SubagentStopInput extends BaseHookInput {
  hookEventName: 'SubagentStop';
  stopHookActive: boolean;       // Whether stop hook is active
  agentId: string;               // Subagent instance ID
  agentTranscriptPath: string;   // Path to subagent transcript
}
```

### 2.10 UserPromptSubmitInput

```typescript
interface UserPromptSubmitInput extends BaseHookInput {
  hookEventName: 'UserPromptSubmit';
  prompt?: string;               // User's prompt text
}
```

### 2.11 NotificationInput

```typescript
interface NotificationInput extends BaseHookInput {
  hookEventName: 'Notification';
  notificationType?: string;     // Type of notification
  message?: string;              // Notification message
}
```

### 2.12 PreCompactInput

```typescript
interface PreCompactInput extends BaseHookInput {
  hookEventName: 'PreCompact';
  trigger?: 'manual' | 'auto';   // What triggered compaction
}
```

### 2.13 PermissionRequestInput

```typescript
interface PermissionRequestInput extends BaseHookInput {
  hookEventName: 'PermissionRequest';
  toolName: string;
  toolInput: Record<string, unknown>;
  permissionType?: string;       // Type of permission requested
}
```

## 3. Output Builders Detail {#hook-specific-options}

### 3.1 preToolUseOutput()

```typescript
import { preToolUseOutput } from '@goodfoot/claude-code-hooks';
```

**Usage:**
- **Allow execution**: `preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } })`
- **Allow with modified input**: `preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow', updatedInput: { command: 'safe-command' } } })`
- **Deny with reason**: `preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: 'Reason shown to Claude' } })`
- **Ask for confirmation**: `preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'ask', permissionDecisionReason: 'This will modify files. Continue?' } })`
- **Default behavior (no decision)**: `preToolUseOutput({})`
- **Block with exit code 2**: `preToolUseOutput({ stopReason: 'Hard block reason' })`

**hookSpecificOutput Options:**

| Option | Type | Description |
|--------|------|-------------|
| `permissionDecision` | `'allow' \| 'deny' \| 'ask'` | Permission decision |
| `permissionDecisionReason` | `string` | Reason for the decision |
| `updatedInput` | `Record<string, unknown>` | Modified tool input |

### 3.2 postToolUseOutput()

```typescript
import { postToolUseOutput } from '@goodfoot/claude-code-hooks';
```

**Usage:**
- **Add context to transcript**: `postToolUseOutput({ hookSpecificOutput: { additionalContext: 'File contained sensitive data' } })`
- **Modify MCP tool output**: `postToolUseOutput({ hookSpecificOutput: { updatedMCPToolOutput: { sanitized: true, data: '...' } } })`
- **No modifications**: `postToolUseOutput({})`

**hookSpecificOutput Options:**

| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Context for Claude |
| `updatedMCPToolOutput` | `unknown` | Replace MCP output |

### 3.3 postToolUseFailureOutput()

```typescript
import { postToolUseFailureOutput } from '@goodfoot/claude-code-hooks';

postToolUseFailureOutput({
  hookSpecificOutput: {
    additionalContext: 'Try using a different approach'
  }
});
```

**hookSpecificOutput Options:**

| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Recovery guidance |

### 3.4 sessionStartOutput()

```typescript
import { sessionStartOutput } from '@goodfoot/claude-code-hooks';
```

**Usage:**
- **Inject project context**: `sessionStartOutput({ hookSpecificOutput: { additionalContext: JSON.stringify({ project: 'my-app', rules: ['no-delete'] }) } })`
- **Add system message**: `sessionStartOutput({ systemMessage: 'This is a production environment' })`
- **No additional context**: `sessionStartOutput({})`

**hookSpecificOutput Options:**

| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Initial context |

### 3.5 sessionEndOutput()

```typescript
import { sessionEndOutput } from '@goodfoot/claude-code-hooks';
```

**Usage:**
- **Simple acknowledgment**: `sessionEndOutput({})`
- **With cleanup message**: `sessionEndOutput({ systemMessage: 'Cleanup complete' })`

### 3.6 stopOutput()

```typescript
import { stopOutput } from '@goodfoot/claude-code-hooks';
```

**Usage:**
- **Allow stop**: `stopOutput({ decision: 'approve' })`
- **Block stop with reason**: `stopOutput({ decision: 'block', reason: 'Uncommitted changes present' })`
- **Default (allow stop)**: `stopOutput({})`

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `decision` | `'approve' \| 'block'` | Stop decision |
| `reason` | `string` | Reason for blocking |

### 3.7 subagentStartOutput()

```typescript
import { subagentStartOutput } from '@goodfoot/claude-code-hooks';

subagentStartOutput({
  hookSpecificOutput: {
    additionalContext: 'Focus on finding patterns'
  }
});
```

**hookSpecificOutput Options:**

| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Subagent instructions |

### 3.8 subagentStopOutput()

```typescript
import { subagentStopOutput } from '@goodfoot/claude-code-hooks';
```

**Usage:**
- **Allow stop**: `subagentStopOutput({ decision: 'approve' })`
- **Block stop with reason**: `subagentStopOutput({ decision: 'block', reason: 'Task not complete' })`
- **Default (allow stop)**: `subagentStopOutput({})`

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `decision` | `'approve' \| 'block'` | Stop decision |
| `reason` | `string` | Reason for blocking |

### 3.9 notificationOutput()

```typescript
import { notificationOutput } from '@goodfoot/claude-code-hooks';
```

**Usage:**
- **Add context**: `notificationOutput({ hookSpecificOutput: { additionalContext: 'Forwarded to Slack #alerts' } })`
- **With system message**: `notificationOutput({ systemMessage: 'Notification processed' })`
- **Suppress notification**: `notificationOutput({ suppressOutput: true })`
- **Acknowledge only**: `notificationOutput({})`

**hookSpecificOutput Options:**

| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Context about notification handling |

### 3.10 preCompactOutput()

```typescript
import { preCompactOutput } from '@goodfoot/claude-code-hooks';
```

**Usage:**
- **Simple acknowledgment**: `preCompactOutput({})`
- **Preserve context through compaction**: `preCompactOutput({ systemMessage: 'Remember: strict mode enabled' })`

### 3.11 permissionRequestOutput()

```typescript
import { permissionRequestOutput } from '@goodfoot/claude-code-hooks';
```

**Usage:**
- **Auto-approve**: `permissionRequestOutput({ hookSpecificOutput: { decision: { behavior: 'allow' } } })`
- **Auto-approve with modified input**: `permissionRequestOutput({ hookSpecificOutput: { decision: { behavior: 'allow', updatedInput: { file_path: '/safe/path' } } } })`
- **Auto-deny**: `permissionRequestOutput({ hookSpecificOutput: { decision: { behavior: 'deny', message: 'This operation is not allowed', interrupt: true } } })`
- **Fall through to normal prompt**: `permissionRequestOutput({})`

**hookSpecificOutput.decision (Allow):**

| Option | Type | Description |
|--------|------|-------------|
| `behavior` | `'allow'` | Auto-approve (required) |
| `updatedInput` | `Record<string, unknown>` | Modified input |
| `updatedPermissions` | `PermissionUpdate[]` | Permission updates |

**hookSpecificOutput.decision (Deny):**

| Option | Type | Description |
|--------|------|-------------|
| `behavior` | `'deny'` | Auto-deny (required) |
| `message` | `string` | Denial message |
| `interrupt` | `boolean` | Interrupt operation |

## 4. Common Options {#base-options}

All output builders support these common options:

```typescript
interface CommonOptions {
  continue?: boolean;      // Continue despite errors
  suppressOutput?: boolean; // Suppress hook output
  systemMessage?: string;  // Inject system message
  stopReason?: string;     // Block with exit code 2
}
```

**Usage:**

```typescript
// Block execution (any hook type) - sets exit code to 2
preToolUseOutput({ stopReason: 'Hard block reason' });

// Continue despite issues
postToolUseOutput({ continue: true });

// Suppress output
notificationOutput({ suppressOutput: true });

// Add system instruction
sessionStartOutput({
  systemMessage: 'Use TypeScript strict mode'
});
```

## 5. Exit Codes

Output builders set exit codes automatically:

| Builder Call | Exit Code | Meaning |
|--------------|-----------|---------|
| `*Output({})` | 0 | Success (default) |
| `*Output({ hookSpecificOutput: {...} })` | 0 | Success with hook-specific data |
| `*Output({ stopReason: '...' })` | 2 | Blocking (via stopReason) |
| `stopOutput({ decision: 'block' })` | 2 | Stop blocked (via decision) |
| `subagentStopOutput({ decision: 'block' })` | 2 | Subagent stop blocked |

When using hook factories, exit codes are handled automatically by the runtime.

## 6. Import Patterns

**Hook factories + output builders (recommended):**

```typescript
// Import hook factory and output builder together
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  return preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
});
```

**All hook factories:**

```typescript
import {
  preToolUseHook,
  postToolUseHook,
  postToolUseFailureHook,
  sessionStartHook,
  sessionEndHook,
  stopHook,
  subagentStartHook,
  subagentStopHook,
  userPromptSubmitHook,
  notificationHook,
  preCompactHook,
  permissionRequestHook
} from '@goodfoot/claude-code-hooks';
```

**All output builders:**

```typescript
import {
  preToolUseOutput,
  postToolUseOutput,
  postToolUseFailureOutput,
  sessionStartOutput,
  sessionEndOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
  userPromptSubmitOutput,
  notificationOutput,
  preCompactOutput,
  permissionRequestOutput
} from '@goodfoot/claude-code-hooks';
```

</instructions>
