# Output Builders Reference

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Porting](porting.md) | [Logging](logging.md)

Complete reference for all 12 hook output builders and their input types.

## All Hook Types {#hook-types}

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

## Input Types {#input-types}

### Base Input Fields

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

### PreToolUseInput

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

### PostToolUseInput

```typescript
interface PostToolUseInput extends BaseHookInput {
  hookEventName: 'PostToolUse';
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResult?: unknown;          // Result from the tool
}
```

### PostToolUseFailureInput

```typescript
interface PostToolUseFailureInput extends BaseHookInput {
  hookEventName: 'PostToolUseFailure';
  toolName: string;
  toolInput: Record<string, unknown>;
  error?: string;                // Error message
}
```

### SessionStartInput

```typescript
interface SessionStartInput extends BaseHookInput {
  hookEventName: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact'; // Why session started
}
```

### SessionEndInput

```typescript
interface SessionEndInput extends BaseHookInput {
  hookEventName: 'SessionEnd';
  reason?: string;               // Why session ended
}
```

### StopInput

```typescript
interface StopInput extends BaseHookInput {
  hookEventName: 'Stop';
  reason?: string;               // Why Claude is stopping
}
```

### SubagentStartInput

```typescript
interface SubagentStartInput extends BaseHookInput {
  hookEventName: 'SubagentStart';
  agentType?: string;            // Type of subagent
  description?: string;          // Task description
  prompt?: string;               // Task prompt
}
```

### SubagentStopInput

```typescript
interface SubagentStopInput extends BaseHookInput {
  hookEventName: 'SubagentStop';
  agentType?: string;
  result?: unknown;              // Subagent result
}
```

### UserPromptSubmitInput

```typescript
interface UserPromptSubmitInput extends BaseHookInput {
  hookEventName: 'UserPromptSubmit';
  prompt?: string;               // User's prompt text
}
```

### NotificationInput

```typescript
interface NotificationInput extends BaseHookInput {
  hookEventName: 'Notification';
  notificationType?: string;     // Type of notification
  message?: string;              // Notification message
}
```

### PreCompactInput

```typescript
interface PreCompactInput extends BaseHookInput {
  hookEventName: 'PreCompact';
  trigger?: 'manual' | 'auto';   // What triggered compaction
}
```

### PermissionRequestInput

```typescript
interface PermissionRequestInput extends BaseHookInput {
  hookEventName: 'PermissionRequest';
  toolName: string;
  toolInput: Record<string, unknown>;
  permissionType?: string;       // Type of permission requested
}
```

## Output Builders Detail {#hook-specific-options}

### preToolUseOutput()

Controls tool execution before it happens.

```typescript
import { preToolUseOutput } from '@goodfoot/claude-code-hooks';

// Allow execution
preToolUseOutput({ allow: true });

// Allow with modified input
preToolUseOutput({
  allow: true,
  updatedInput: { command: 'safe-command' }
});

// Deny with reason
preToolUseOutput({ deny: 'Reason shown to Claude' });

// Ask for confirmation
preToolUseOutput({ ask: 'This will modify files. Continue?' });

// Default behavior (no decision)
preToolUseOutput({});

// Block with exit code 2
preToolUseOutput({ block: 'Hard block reason' });
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `allow` | `true` | Permit execution |
| `deny` | `string` | Block with reason |
| `ask` | `string` | Request confirmation |
| `updatedInput` | `object` | Modified tool input (with allow) |

### postToolUseOutput()

Add context after successful tool execution.

```typescript
import { postToolUseOutput } from '@goodfoot/claude-code-hooks';

// Add context to transcript
postToolUseOutput({
  additionalContext: 'File contained sensitive data'
});

// Modify MCP tool output
postToolUseOutput({
  updatedMCPToolOutput: { sanitized: true, data: '...' }
});

// No modifications
postToolUseOutput({});
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Context for Claude |
| `updatedMCPToolOutput` | `unknown` | Replace MCP output |

### postToolUseFailureOutput()

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

### sessionStartOutput()

Inject context when session starts.

```typescript
import { sessionStartOutput } from '@goodfoot/claude-code-hooks';

// Inject project context
sessionStartOutput({
  additionalContext: JSON.stringify({
    project: 'my-app',
    rules: ['no-delete', 'test-first']
  })
});

// Add system message
sessionStartOutput({
  systemMessage: 'This is a production environment'
});
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `additionalContext` | `string` | Initial context |

### sessionEndOutput()

Handle session cleanup.

```typescript
import { sessionEndOutput } from '@goodfoot/claude-code-hooks';

// Simple acknowledgment
sessionEndOutput({});

// With cleanup message
sessionEndOutput({
  systemMessage: 'Cleanup complete'
});
```

### stopOutput()

Control whether Claude can stop.

```typescript
import { stopOutput } from '@goodfoot/claude-code-hooks';

// Allow stop
stopOutput({ decision: 'approve' });

// Block stop with reason
stopOutput({
  decision: 'block',
  reason: 'Uncommitted changes present'
});

// Default (allow stop)
stopOutput({});
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `decision` | `'approve' \| 'block'` | Stop decision |
| `reason` | `string` | Reason for blocking |

### subagentStartOutput()

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

### subagentStopOutput()

Handle subagent completion.

```typescript
import { subagentStopOutput } from '@goodfoot/claude-code-hooks';

// Acknowledgment
subagentStopOutput({});
```

### notificationOutput()

Handle notifications.

```typescript
import { notificationOutput } from '@goodfoot/claude-code-hooks';

// Acknowledge
notificationOutput({});

// With message
notificationOutput({
  systemMessage: 'Forwarded to Slack'
});
```

### preCompactOutput()

Handle pre-compaction.

```typescript
import { preCompactOutput } from '@goodfoot/claude-code-hooks';

// Preserve context through compaction
preCompactOutput({
  systemMessage: 'Remember: strict mode enabled'
});
```

### permissionRequestOutput()

Auto-respond to permission prompts.

```typescript
import { permissionRequestOutput } from '@goodfoot/claude-code-hooks';

// Auto-approve
permissionRequestOutput({ allow: true });

// Auto-approve with modified input
permissionRequestOutput({
  allow: true,
  updatedInput: { file_path: '/safe/path' }
});

// Auto-deny
permissionRequestOutput({
  deny: true,
  message: 'This operation is not allowed',
  interrupt: true
});

// Fall through to normal prompt
permissionRequestOutput({});
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `allow` | `true` | Auto-approve |
| `deny` | `true` | Auto-deny |
| `updatedInput` | `object` | Modified input (with allow) |
| `updatedPermissions` | `PermissionUpdate[]` | Permission updates |
| `message` | `string` | Denial message (with deny) |
| `interrupt` | `boolean` | Interrupt operation (with deny) |

## Base Options {#base-options}

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

## Exit Codes

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

## Import Patterns

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
