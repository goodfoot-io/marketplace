# Output Builders Reference

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Porting](porting.md) | [Logging](logging.md)

<instructions>

## 1. All Hook Types {#hook-types}

| Hook Type | Output Builder | Input Type | When It Fires |
|-----------|----------------|------------|---------------|
| PreToolUse | `preToolUseOutput()` | `PreToolUseInput` | Before tool execution |
| PostToolUse | `postToolUseOutput()` | `PostToolUseInput` | After successful tool |
| PostToolUseFailure | `postToolUseFailureOutput()` | `PostToolUseFailureInput` | After tool failure |
| UserPromptSubmit | `userPromptSubmitOutput()` | `UserPromptSubmitInput` | User submits prompt |
| SessionStart | `sessionStartOutput()` | `SessionStartInput` | Session begins |
| SessionEnd | `sessionEndOutput()` | `SessionEndInput` | Session ends |
| Stop | `stopOutput()` | `StopInput` | Claude about to stop |
| SubagentStart | `subagentStartOutput()` | `SubagentStartInput` | Task agent starts |
| SubagentStop | `subagentStopOutput()` | `SubagentStopInput` | Task agent stops |
| Notification | `notificationOutput()` | `NotificationInput` | Notification sent |
| PreCompact | `preCompactOutput()` | `PreCompactInput` | Before compaction |
| PermissionRequest | `permissionRequestOutput()` | `PermissionRequestInput` | Permission prompt |

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

Controls tool execution before it happens.

```typescript
import { preToolUseOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
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

Add context after successful tool execution.

```typescript
import { postToolUseOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
- **Add context to transcript**: `postToolUseOutput({ hookSpecificOutput: { additionalContext: 'File contained sensitive data' } })`
- **Modify MCP tool output**: `postToolUseOutput({ hookSpecificOutput: { updatedMCPToolOutput: { sanitized: true, data: '...' } } })`
- **No modifications**: `postToolUseOutput({})`

**hookSpecificOutput Options:**

| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Context for Claude |
| `updatedMCPToolOutput` | `unknown` | Replace MCP output |

### 3.3 postToolUseFailureOutput()

Add context after tool failure.

```typescript
import { postToolUseFailureOutput } from '@goodfoot/claude-code-hooks';

// Add recovery guidance
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

Inject context when session starts.

```typescript
import { sessionStartOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
- **Inject project context**: `sessionStartOutput({ hookSpecificOutput: { additionalContext: JSON.stringify({ project: 'my-app', rules: ['no-delete'] }) } })`
- **Add system message**: `sessionStartOutput({ systemMessage: 'This is a production environment' })`
- **No additional context**: `sessionStartOutput({})`

**hookSpecificOutput Options:**

| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Initial context |

### 3.5 sessionEndOutput()

Handle session cleanup.

```typescript
import { sessionEndOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
- **Simple acknowledgment**: `sessionEndOutput({})`
- **With cleanup message**: `sessionEndOutput({ systemMessage: 'Cleanup complete' })`

### 3.6 stopOutput()

Control whether Claude can stop.

```typescript
import { stopOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
- **Allow stop**: `stopOutput({ decision: 'approve' })`
- **Block stop with reason**: `stopOutput({ decision: 'block', reason: 'Uncommitted changes present' })`
- **Default (allow stop)**: `stopOutput({})`

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `decision` | `'approve' \| 'block'` | Stop decision |
| `reason` | `string` | Reason for blocking |

### 3.7 subagentStartOutput()

Inject context for Task agents.

```typescript
import { subagentStartOutput } from '@goodfoot/claude-code-hooks';

// Add subagent context
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

Handle subagent completion.

```typescript
import { subagentStopOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
- **Allow stop**: `subagentStopOutput({ decision: 'approve' })`
- **Block stop with reason**: `subagentStopOutput({ decision: 'block', reason: 'Task not complete' })`
- **Default (allow stop)**: `subagentStopOutput({})`

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `decision` | `'approve' \| 'block'` | Stop decision |
| `reason` | `string` | Reason for blocking |

### 3.9 notificationOutput()

Handle notifications.

```typescript
import { notificationOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
- **Acknowledge**: `notificationOutput({})`
- **With message**: `notificationOutput({ systemMessage: 'Forwarded to Slack' })`

### 3.10 preCompactOutput()

Handle pre-compaction.

```typescript
import { preCompactOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
- **Simple acknowledgment**: `preCompactOutput({})`
- **Preserve context through compaction**: `preCompactOutput({ systemMessage: 'Remember: strict mode enabled' })`

### 3.11 permissionRequestOutput()

Auto-respond to permission prompts.

```typescript
import { permissionRequestOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
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

Always use `output.exitCode`:

```typescript
const output = preToolUseOutput({
  hookSpecificOutput: {
    permissionDecision: 'deny',
    permissionDecisionReason: 'Blocked'
  }
});
process.exit(output.exitCode); // Use this!
```

## 6. Import Patterns

```typescript
// Import specific builders and types
import {
  preToolUseOutput,
  postToolUseOutput,
  sessionStartOutput,
  stopOutput,
  type PreToolUseInput,
  type SessionStartInput,
  type StopInput
} from '@goodfoot/claude-code-hooks';

// Import all exports
import * as hooks from '@goodfoot/claude-code-hooks';
const output = hooks.preToolUseOutput({ allow: true });

// Import exit codes constant
import { EXIT_CODES } from '@goodfoot/claude-code-hooks';
console.log(EXIT_CODES.SUCCESS); // 0
console.log(EXIT_CODES.ERROR);   // 1
console.log(EXIT_CODES.BLOCK);   // 2
```

</instructions>
