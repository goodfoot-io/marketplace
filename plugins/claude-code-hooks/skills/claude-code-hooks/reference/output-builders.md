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
  agentType?: string;            // Type of subagent
  description?: string;          // Task description
  prompt?: string;               // Task prompt
}
```

### 2.9 SubagentStopInput

```typescript
interface SubagentStopInput extends BaseHookInput {
  hookEventName: 'SubagentStop';
  agentType?: string;
  result?: unknown;              // Subagent result
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
- **Allow execution**: `preToolUseOutput({ allow: true })`
- **Allow with modified input**: `preToolUseOutput({ allow: true, updatedInput: { command: 'safe-command' } })`
- **Deny with reason**: `preToolUseOutput({ deny: 'Reason shown to Claude' })`
- **Ask for confirmation**: `preToolUseOutput({ ask: 'This will modify files. Continue?' })`
- **Default behavior (no decision)**: `preToolUseOutput({})`
- **Block with exit code 2**: `preToolUseOutput({ block: 'Hard block reason' })`

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `allow` | `true` | Permit execution |
| `deny` | `string` | Block with reason |
| `ask` | `string` | Request confirmation |
| `updatedInput` | `object` | Modified tool input (with allow) |

### 3.2 postToolUseOutput()

Add context after successful tool execution.

```typescript
import { postToolUseOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
- **Add context to transcript**: `postToolUseOutput({ additionalContext: 'File contained sensitive data' })`
- **Modify MCP tool output**: `postToolUseOutput({ updatedMCPToolOutput: { sanitized: true, data: '...' } })`
- **No modifications**: `postToolUseOutput({})`

**Options:**

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
  additionalContext: 'Try using a different approach'
});
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Recovery guidance |

### 3.4 sessionStartOutput()

Inject context when session starts.

```typescript
import { sessionStartOutput } from '@goodfoot/claude-code-hooks';
```

Based on desired behavior:
- **Inject project context**: `sessionStartOutput({ additionalContext: JSON.stringify({ project: 'my-app', rules: ['no-delete'] }) })`
- **Add system message**: `sessionStartOutput({ systemMessage: 'This is a production environment' })`
- **No additional context**: `sessionStartOutput({})`

**Options:**

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
  additionalContext: 'Focus on finding patterns'
});
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Subagent instructions |

### 3.8 subagentStopOutput()

Handle subagent completion.

```typescript
import { subagentStopOutput } from '@goodfoot/claude-code-hooks';

// Acknowledgment
subagentStopOutput({});
```

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
- **Auto-approve**: `permissionRequestOutput({ allow: true })`
- **Auto-approve with modified input**: `permissionRequestOutput({ allow: true, updatedInput: { file_path: '/safe/path' } })`
- **Auto-deny**: `permissionRequestOutput({ deny: true, message: 'This operation is not allowed', interrupt: true })`
- **Fall through to normal prompt**: `permissionRequestOutput({})`

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `allow` | `true` | Auto-approve |
| `deny` | `true` | Auto-deny |
| `updatedInput` | `object` | Modified input (with allow) |
| `updatedPermissions` | `PermissionUpdate[]` | Permission updates |
| `message` | `string` | Denial message (with deny) |
| `interrupt` | `boolean` | Interrupt operation (with deny) |

## 4. Base Options {#base-options}

All output builders support these options:

```typescript
interface BaseOptions {
  block?: string;         // Block with exit code 2
  error?: string;         // Error with exit code 1
  continue?: boolean;     // Continue despite errors
  suppressOutput?: boolean; // Suppress hook output
  systemMessage?: string; // Inject system message
}
```

**Usage:**

```typescript
// Block execution (any hook type)
preToolUseOutput({ block: 'Hard block reason' });

// Report non-blocking error
sessionStartOutput({ error: 'Warning: config not found' });

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
| `*Output({ allow: true })` | 0 | Success |
| `*Output({})` | 0 | Success (default) |
| `*Output({ error: '...' })` | 1 | Non-blocking error |
| `*Output({ block: '...' })` | 2 | Blocking |
| `*Output({ deny: '...' })` | 0 | Denial (handled in output) |
| `stopOutput({ decision: 'block' })` | 0 | Stop blocked (via output) |

Always use `output.exitCode`:

```typescript
const output = preToolUseOutput({ deny: 'Blocked' });
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
