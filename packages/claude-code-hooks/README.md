# @goodfoot/claude-code-hooks

Type-safe Claude Code hooks library with a build tool for compiling TypeScript hooks to standalone executables.

## CLI Build Tool

The primary interface is the CLI build tool, which compiles TypeScript hook files into standalone ESM modules and generates a `hooks.json` configuration file for Claude Code.

### Installation

```bash
# Run directly with npx (no installation required)
npx -y "@goodfoot/claude-code-hooks" -i "hooks/**/*.ts" -o "./dist/hooks.json"

# Or install globally
npm install -g @goodfoot/claude-code-hooks
claude-code-hooks -i "hooks/**/*.ts" -o "./dist/hooks.json"
```

### Usage

```
claude-code-hooks -i <glob> -o <path> [options]
```

### Options

| Option                | Description                                   |
| --------------------- | --------------------------------------------- |
| `-i, --input <glob>`  | Glob pattern for hook source files (required) |
| `-o, --output <path>` | Path for hooks.json output (required)         |
| `--log <path>`        | Optional log file path for build output       |
| `-h, --help`          | Show help message                             |
| `-v, --version`       | Show version                                  |

### Examples

```bash
# Compile all hooks in hooks/ directory
npx -y "@goodfoot/claude-code-hooks" -i "hooks/**/*.ts" -o "./dist/hooks.json"

# Compile hooks from src/hooks with logging
npx -y "@goodfoot/claude-code-hooks" -i "src/hooks/*.ts" -o "./hooks.json" --log ./build.log

# Compile a single hook file
npx -y "@goodfoot/claude-code-hooks" -i "my-hook.ts" -o "./hooks.json"
```

### Output

The build tool produces:

1. **Compiled hooks**: `{outDir}/{hookName}.{hash}.mjs` - Standalone ESM modules with content-hashed filenames
2. **hooks.json**: Configuration file with matcher settings and absolute command paths

Example `hooks.json` output:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/block-dangerous.abc12345.mjs"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/init-session.def67890.mjs"
          }
        ]
      }
    ]
  },
  "__generated": {
    "files": ["block-dangerous.abc12345.mjs", "init-session.def67890.mjs"],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Quickstart

### 1. Create a hook file

```typescript
// hooks/block-dangerous-commands.ts
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
  const command = input.toolInput.command as string;

  if (command.includes('rm -rf')) {
    logger.warn('Blocking destructive command', { command });
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Destructive commands are not allowed'
      }
    });
  }

  return preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
});
```

### 2. Compile hooks

```bash
npx -y "@goodfoot/claude-code-hooks" -i "hooks/**/*.ts" -o ".claude/hooks/hooks.json"
```

### 3. Configure Claude Code

Copy the generated `hooks.json` to your Claude Code settings or reference it in your project's `.claude/settings.json`.

---

## Hook Configuration

Each hook factory accepts a `HookConfig` object:

```typescript
interface HookConfig {
  matcher?: string; // Regex pattern to match against (varies by hook type)
  timeout?: number; // Handler timeout in milliseconds (default: 60000)
}
```

> **Note**: The `timeout` is specified in **milliseconds** in the library. Claude Code's JSON configuration uses seconds. The library handles this conversion automatically.

---

## Hook Types

The library supports all 12 Claude Code hook types:

### PreToolUse

Fires before any tool is executed. Use to validate, allow, deny, or modify tool inputs.

**Matcher**: Matches against `toolName` (e.g., 'Bash', 'Read', 'Write')

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
  const command = input.toolInput.command as string;

  // Deny dangerous commands
  if (command.includes('rm -rf /')) {
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Cannot delete root directory'
      }
    });
  }

  // Allow with modified input
  return preToolUseOutput({
    hookSpecificOutput: {
      permissionDecision: 'allow',
      updatedInput: { command: `timeout 30 ${command}` }
    }
  });
});
```

**hookSpecificOutput fields**:

- `permissionDecision: 'allow' | 'deny' | 'ask'` - Permission decision
- `permissionDecisionReason: string` - Reason for the decision
- `updatedInput: {...}` - Modify tool input before execution

### PostToolUse

Fires after a tool executes successfully. Use to add context or modify MCP tool output.

**Matcher**: Matches against `toolName`

```typescript
import { postToolUseHook, postToolUseOutput } from '@goodfoot/claude-code-hooks';

export default postToolUseHook({ matcher: 'Read' }, async (input, { logger }) => {
  const filePath = input.toolInput.file_path as string;
  logger.info('File read', { filePath });

  return postToolUseOutput({
    hookSpecificOutput: {
      additionalContext: `File ${filePath} was read. Consider security implications.`
    }
  });
});
```

**hookSpecificOutput fields**:

- `additionalContext: string` - Add context to the conversation
- `updatedMCPToolOutput: {...}` - Modify MCP tool output before showing to Claude

### PostToolUseFailure

Fires when tool execution fails. Use to provide recovery guidance.

**Matcher**: Matches against `toolName`

```typescript
import { postToolUseFailureHook, postToolUseFailureOutput } from '@goodfoot/claude-code-hooks';

export default postToolUseFailureHook({ matcher: '.*' }, async (input, { logger }) => {
  logger.error('Tool failed', {
    toolName: input.toolName,
    error: input.error,
    isInterrupt: input.isInterrupt
  });

  return postToolUseFailureOutput({
    hookSpecificOutput: {
      additionalContext: 'Consider trying an alternative approach.'
    }
  });
});
```

**hookSpecificOutput fields**:

- `additionalContext: string` - Add context to the conversation

### PermissionRequest

Fires when Claude Code would show a permission dialog. Use to auto-approve or auto-deny.

**Matcher**: Matches against `toolName`

```typescript
import { permissionRequestHook, permissionRequestOutput } from '@goodfoot/claude-code-hooks';

export default permissionRequestHook({ matcher: 'Read' }, async (input) => {
  const filePath = input.toolInput.file_path as string;

  // Auto-approve reads in safe directories
  if (filePath.startsWith('/allowed/')) {
    return permissionRequestOutput({
      hookSpecificOutput: {
        decision: { behavior: 'allow' }
      }
    });
  }

  // Auto-deny sensitive files
  if (filePath.includes('.env') || filePath.includes('secrets')) {
    return permissionRequestOutput({
      hookSpecificOutput: {
        decision: {
          behavior: 'deny',
          message: 'Cannot read sensitive files',
          interrupt: true
        }
      }
    });
  }

  // Fall through to normal permission prompt
  return permissionRequestOutput({});
});
```

**hookSpecificOutput fields**:

- `decision.behavior: 'allow'` - Auto-approve with optional `updatedInput` and `updatedPermissions`
- `decision.behavior: 'deny'` - Auto-deny with optional `message` and `interrupt`

```typescript
// Allow with updated input
permissionRequestOutput({
  hookSpecificOutput: {
    decision: {
      behavior: 'allow',
      updatedInput: { file_path: '/safe/path' },
      updatedPermissions: []
    }
  }
});

// Deny with interrupt
permissionRequestOutput({
  hookSpecificOutput: {
    decision: {
      behavior: 'deny',
      message: 'Operation not allowed',
      interrupt: true
    }
  }
});
```

### Notification

Fires when Claude Code sends a notification. Use for external integrations.

**Matcher**: Matches against `notificationType` ('permission_prompt', 'idle_prompt', 'auth_success', 'elicitation_dialog')

**Input Fields**:

- `message` - Main notification content
- `title` - Optional notification title
- `notificationType` - Type/category of notification

```typescript
import { notificationHook, notificationOutput } from '@goodfoot/claude-code-hooks';

export default notificationHook({ matcher: 'idle_prompt' }, async (input, { logger }) => {
  logger.info('Notification', {
    type: input.notificationType,
    title: input.title,
    message: input.message
  });

  // Forward to external system
  const prefix = input.title ? `${input.title}: ` : '';
  await sendSlackMessage(`Claude Code: ${prefix}${input.message}`);

  return notificationOutput({});
});
```

### UserPromptSubmit

Fires when a user submits a prompt. Use to inject context or validate prompts.

**Matcher**: None - fires on all prompt submissions

```typescript
import { userPromptSubmitHook, userPromptSubmitOutput } from '@goodfoot/claude-code-hooks';

export default userPromptSubmitHook({}, async (input, { logger }) => {
  logger.debug('Prompt submitted', { length: input.prompt.length });

  // Block prompts with secrets
  if (/password|secret|key/i.test(input.prompt)) {
    return userPromptSubmitOutput({
      stopReason: 'Please remove sensitive information from your prompt'
    });
  }

  // Add project context
  return userPromptSubmitOutput({
    hookSpecificOutput: {
      additionalContext: `Current time: ${new Date().toISOString()}`
    }
  });
});
```

**hookSpecificOutput fields**:

- `additionalContext: string` - Add context to the conversation

### SessionStart

Fires when a Claude Code session starts. Use to initialize context or environment.

**Matcher**: Matches against `source` ('startup', 'resume', 'clear', 'compact')

```typescript
import { sessionStartHook, sessionStartOutput, persistEnvVar } from '@goodfoot/claude-code-hooks';

export default sessionStartHook({ matcher: 'startup' }, async (input, { logger }) => {
  logger.info('Session started', { sessionId: input.sessionId });

  // Persist environment variables for the session
  persistEnvVar('NODE_ENV', 'development');
  persistEnvVar('DEBUG', 'true');

  return sessionStartOutput({
    hookSpecificOutput: {
      additionalContext: 'Project initialized with development settings.'
    }
  });
});
```

**hookSpecificOutput fields**:

- `additionalContext: string` - Add context to the conversation

### SessionEnd

Fires when a Claude Code session ends. Use for cleanup.

**Matcher**: Matches against `reason` ('clear', 'logout', 'prompt_input_exit', 'other')

```typescript
import { sessionEndHook, sessionEndOutput } from '@goodfoot/claude-code-hooks';

export default sessionEndHook({}, async (input, { logger }) => {
  logger.info('Session ended', { reason: input.reason });
  await cleanupResources();
  return sessionEndOutput({});
});
```

### Stop

Fires when Claude Code is about to stop. Use to block stopping or require action.

**Matcher**: None - fires on all stop events

```typescript
import { stopHook, stopOutput } from '@goodfoot/claude-code-hooks';

export default stopHook({}, async (input, { logger }) => {
  // Prevent infinite loops
  if (input.stopHookActive) {
    return stopOutput({ decision: 'approve' });
  }

  const hasUncommittedChanges = await checkGitStatus();
  if (hasUncommittedChanges) {
    return stopOutput({
      decision: 'block',
      reason: 'Please commit or stash changes before stopping'
    });
  }

  return stopOutput({ decision: 'approve' });
});
```

### SubagentStart

Fires when a subagent (Task tool) starts. Use to inject context for subagents.

**Matcher**: Matches against `agentType` (e.g., 'explore', 'codebase-analysis')

```typescript
import { subagentStartHook, subagentStartOutput } from '@goodfoot/claude-code-hooks';

export default subagentStartHook({ matcher: 'explore' }, async (input, { logger }) => {
  logger.info('Subagent starting', {
    agentId: input.agentId,
    agentType: input.agentType
  });

  return subagentStartOutput({
    hookSpecificOutput: {
      additionalContext: 'Focus on finding patterns and conventions.'
    }
  });
});
```

**hookSpecificOutput fields**:

- `additionalContext: string` - Add context to the subagent

### SubagentStop

Fires when a subagent completes. Use to block or process results.

**Matcher**: Matches against `agentType`

**Input Fields**:

- `agentId` - Unique identifier for the subagent instance
- `agentType` - Type of subagent (e.g., 'explore', 'codebase-analysis')
- `agentTranscriptPath` - Path to the subagent's transcript file
- `stopHookActive` - Whether a stop hook is currently active

```typescript
import { subagentStopHook, subagentStopOutput } from '@goodfoot/claude-code-hooks';
import * as fs from 'node:fs';

export default subagentStopHook({ matcher: 'explore' }, async (input, { logger }) => {
  logger.info('Subagent stopping', {
    agentId: input.agentId,
    agentType: input.agentType,
    transcriptPath: input.agentTranscriptPath
  });

  // Optionally read the subagent's transcript for analysis
  const transcript = fs.readFileSync(input.agentTranscriptPath, 'utf-8');

  // Block if task seems incomplete
  return subagentStopOutput({
    decision: 'block',
    reason: 'Please verify all relevant files were explored.'
  });
});
```

### PreCompact

Fires before context compaction. Use to preserve information.

**Matcher**: Matches against `trigger` ('manual', 'auto')

```typescript
import { preCompactHook, preCompactOutput } from '@goodfoot/claude-code-hooks';

export default preCompactHook({}, async (input, { logger }) => {
  logger.info('Compacting', { trigger: input.trigger });

  return preCompactOutput({
    systemMessage: 'Remember: strict TypeScript mode is enabled.'
  });
});
```

---

## Input Fields Reference

### Common Fields (All Hooks)

Every hook receives these base fields:

| Field            | Type             | Description                                                 |
| ---------------- | ---------------- | ----------------------------------------------------------- |
| `sessionId`      | `string`         | Unique identifier for the current session                   |
| `transcriptPath` | `string`         | Absolute path to the session transcript file (JSONL format) |
| `cwd`            | `string`         | Current working directory for the session                   |
| `permissionMode` | `PermissionMode` | Current permission mode (see below)                         |
| `hookEventName`  | `string`         | Discriminator for the hook type                             |

### Permission Modes

The `permissionMode` field indicates how tool executions are being handled:

| Value                 | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `'default'`           | Normal interactive mode with permission prompts        |
| `'acceptEdits'`       | Auto-accept file edits                                 |
| `'bypassPermissions'` | Skip all permission prompts (dangerous)                |
| `'plan'`              | Planning mode - no tool execution                      |
| `'delegate'`          | Delegated permission handling                          |
| `'dontAsk'`           | Non-interactive mode - deny tools requiring permission |

### Hook-Specific Input Fields

| Hook Type          | Additional Fields                                               |
| ------------------ | --------------------------------------------------------------- |
| PreToolUse         | `toolName`, `toolInput`, `toolUseId`                            |
| PostToolUse        | `toolName`, `toolInput`, `toolResponse`, `toolUseId`            |
| PostToolUseFailure | `toolName`, `toolInput`, `toolUseId`, `error`, `isInterrupt?`   |
| PermissionRequest  | `toolName`, `toolInput`, `toolUseId`, `permissionSuggestions?`  |
| Notification       | `message`, `title?`, `notificationType`                         |
| UserPromptSubmit   | `prompt`                                                        |
| SessionStart       | `source`                                                        |
| SessionEnd         | `reason`                                                        |
| Stop               | `stopHookActive`                                                |
| SubagentStart      | `agentId`, `agentType`                                          |
| SubagentStop       | `agentId`, `agentType`, `agentTranscriptPath`, `stopHookActive` |
| PreCompact         | `trigger`, `customInstructions`                                 |

---

## Environment Variables

Claude Code sets these environment variables when running hooks:

| Variable             | Description                   | Available In      |
| -------------------- | ----------------------------- | ----------------- |
| `CLAUDE_PROJECT_DIR` | Absolute path to project root | All hooks         |
| `CLAUDE_ENV_FILE`    | Path for persisting env vars  | SessionStart only |
| `CLAUDE_CODE_REMOTE` | `"true"` if running remotely  | All hooks         |

### Environment Variable Utilities

The library provides utilities for working with these variables:

```typescript
import {
  getProjectDir,
  getEnvFilePath,
  isRemoteEnvironment,
  persistEnvVar,
  persistEnvVars
} from '@goodfoot/claude-code-hooks';

// Get project directory
const projectDir = getProjectDir();

// Check if running remotely
if (isRemoteEnvironment()) {
  // Handle remote-specific logic
}

// In SessionStart hooks: persist environment variables
persistEnvVar('NODE_ENV', 'production');
persistEnvVars({
  API_KEY: 'secret',
  DEBUG: 'true'
});
```

---

## Output Builders

Each hook type has a corresponding output builder function. All builders accept common options:

```typescript
interface CommonOptions {
  stopReason?: string; // Block execution with reason (exit code 2)
  continue?: boolean; // Continue after errors
  suppressOutput?: boolean; // Hide output from transcript
  systemMessage?: string; // Message shown to user
}
```

Hook-specific fields go in the `hookSpecificOutput` property:

| Hook Type          | Output Builder               | hookSpecificOutput Fields                                                          |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------- |
| PreToolUse         | `preToolUseOutput()`         | `permissionDecision`, `permissionDecisionReason`, `updatedInput`                   |
| PostToolUse        | `postToolUseOutput()`        | `additionalContext`, `updatedMCPToolOutput`                                        |
| PostToolUseFailure | `postToolUseFailureOutput()` | `additionalContext`                                                                |
| PermissionRequest  | `permissionRequestOutput()`  | `decision: { behavior, message?, interrupt?, updatedInput?, updatedPermissions? }` |
| Notification       | `notificationOutput()`       | (common only)                                                                      |
| UserPromptSubmit   | `userPromptSubmitOutput()`   | `additionalContext`                                                                |
| SessionStart       | `sessionStartOutput()`       | `additionalContext`                                                                |
| SessionEnd         | `sessionEndOutput()`         | (common only)                                                                      |
| Stop               | `stopOutput()`               | `decision`, `reason` (top-level, not in hookSpecificOutput)                        |
| SubagentStart      | `subagentStartOutput()`      | `additionalContext`                                                                |
| SubagentStop       | `subagentStopOutput()`       | `decision`, `reason` (top-level, not in hookSpecificOutput)                        |
| PreCompact         | `preCompactOutput()`         | (common only)                                                                      |

---

## Logger

The library includes a structured logging system that:

- Is silent by default (no stdout/stderr interference)
- Supports file output via `CLAUDE_CODE_HOOKS_LOG_FILE` environment variable
- Provides event subscription via `.on(level, handler)`
- Integrates with OpenTelemetry when enabled

```typescript
export default preToolUseHook({}, async (input, { logger }) => {
  logger.info('Processing tool', { toolName: input.toolName });
  logger.warn('Rate limit approaching', { current: 95, max: 100 });
  logger.error('Operation failed', { error: 'timeout' });

  try {
    await riskyOperation();
  } catch (err) {
    logger.logError(err, 'Risky operation failed');
  }

  return preToolUseOutput({});
});
```

---

## OpenTelemetry Integration

Enable telemetry with environment variables:

| Variable                             | Description                                       | Default               |
| ------------------------------------ | ------------------------------------------------- | --------------------- |
| `CLAUDE_CODE_HOOKS_ENABLE_TELEMETRY` | Enable telemetry (1 or 0)                         | 0                     |
| `OTEL_METRICS_EXPORTER`              | Metrics exporter: otlp, prometheus, console, none | none                  |
| `OTEL_LOGS_EXPORTER`                 | Logs exporter: otlp, console, none                | none                  |
| `OTEL_EXPORTER_OTLP_ENDPOINT`        | OTLP collector endpoint                           | http://localhost:4318 |

---

## API Reference

### Exports

```typescript
// Hook factories (12 total)
export {
  preToolUseHook,
  postToolUseHook,
  postToolUseFailureHook,
  permissionRequestHook,
  notificationHook,
  userPromptSubmitHook,
  sessionStartHook,
  sessionEndHook,
  stopHook,
  subagentStartHook,
  subagentStopHook,
  preCompactHook
} from '@goodfoot/claude-code-hooks';

// Output builders (12 total)
export {
  preToolUseOutput,
  postToolUseOutput,
  postToolUseFailureOutput,
  permissionRequestOutput,
  notificationOutput,
  userPromptSubmitOutput,
  sessionStartOutput,
  sessionEndOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
  preCompactOutput,
  EXIT_CODES
} from '@goodfoot/claude-code-hooks';

// Environment utilities
export {
  CLAUDE_ENV_VARS,
  getProjectDir,
  getEnvFilePath,
  isRemoteEnvironment,
  persistEnvVar,
  persistEnvVars
} from '@goodfoot/claude-code-hooks';

// Logger
export { logger, Logger, LOG_LEVELS } from '@goodfoot/claude-code-hooks';

// Types
export type {
  // Input types
  PreToolUseInput,
  PostToolUseInput,
  PostToolUseFailureInput,
  PermissionRequestInput,
  NotificationInput,
  UserPromptSubmitInput,
  SessionStartInput,
  SessionEndInput,
  StopInput,
  SubagentStartInput,
  SubagentStopInput,
  PreCompactInput,
  HookInput,
  HookEventName,

  // Supporting types
  PermissionMode,
  SessionStartSource,
  SessionEndReason,
  PreCompactTrigger,

  // Configuration
  HookConfig,
  HookContext,

  // Output options
  CommonOptions,
  PreToolUseOptions,
  PostToolUseOptions,
  PermissionRequestOptions,
  // ... and more

  // Hook-specific output types
  PreToolUseHookSpecificOutput,
  PostToolUseHookSpecificOutput,
  PermissionRequestHookSpecificOutput,
  PermissionRequestDecision
} from '@goodfoot/claude-code-hooks';
```

---

## License

MIT
