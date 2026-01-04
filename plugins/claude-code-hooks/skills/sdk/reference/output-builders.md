<instructions>

## Intent-Based Examples

Instead of just listing types, here is how to accomplish specific goals using the output builders.

### Auto-Approve Specific Safe Commands (PermissionRequest)

Use `permissionRequestHook` to bypass the "Allow?" prompt for known safe operations.

```typescript
import { permissionRequestHook, permissionRequestOutput } from '@goodfoot/claude-code-hooks';

export default permissionRequestHook({ matcher: 'Bash' }, (input, { logger }) => {
  const command = input.tool_input as { command?: string };

  // Only auto-allow echo commands
  if (command.command?.startsWith('echo ')) {
    logger.info('Auto-allowing echo command', { command: command.command });

    return permissionRequestOutput({
      systemMessage: 'Auto-approved echo command.',
      hookSpecificOutput: {
        decision: { behavior: 'allow' }
      }
    });
  }

  // Fall through to normal permission prompt
  return permissionRequestOutput({});
});
```

### Inject Project Context (UserPromptSubmit)

Use `userPromptSubmitHook` to remind Claude of project details whenever the user types.

```typescript
import { userPromptSubmitHook, userPromptSubmitOutput } from '@goodfoot/claude-code-hooks';

export default userPromptSubmitHook({}, (input, { logger }) => {
  return userPromptSubmitOutput({
    systemMessage: 'Project context injected for this prompt.',
    hookSpecificOutput: {
      additionalContext: JSON.stringify({
        projectName: 'acme-app',
        version: '3.2.1',
        stack: ['React', 'TypeScript']
      })
    }
  });
});
```

### Block Stop on Condition (Stop)

Use `stopHook` to prevent Claude from exiting if criteria aren't met.

```typescript
import { stopHook, stopOutput } from '@goodfoot/claude-code-hooks';

export default stopHook({}, (_input, { logger }) => {
  const isReady = false; // Replace with real check logic

  if (!isReady) {
    logger.info('Blocking stop');
    return stopOutput({
      decision: 'block',
      reason: 'Cannot stop - pending operations must complete first.',
      systemMessage: 'Stop blocked: pending operations in progress.'
    });
  }

  return stopOutput({
    decision: 'approve',
    systemMessage: 'Session stopping normally.'
  });
});
```

### Add Context After Tool Execution (PostToolUse)

Use `postToolUseHook` to analyze the result of a tool and add helpful notes.

```typescript
import { postToolUseHook, postToolUseOutput } from '@goodfoot/claude-code-hooks';

export default postToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  return postToolUseOutput({
    systemMessage: 'Bash command executed and validated.',
    hookSpecificOutput: {
      additionalContext: 'Command completed successfully. You may proceed.'
    }
  });
});
```

### Deny Specific Tools (PreToolUse)

Use `preToolUseHook` to enforce security policies.

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

// Typed overload: tool_input is automatically typed as BashToolInput
export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  // No cast needed - input.tool_input.command is typed as string
  const command = input.tool_input.command;

  // Example: Block 'curl'
  if (command.startsWith('curl')) {
    logger.info('Denying curl command', { command });
    return preToolUseOutput({
      systemMessage: 'Security policy: curl commands are blocked.',
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Network requests via curl are disabled.'
      }
    });
  }

  return preToolUseOutput({
    systemMessage: 'Command allowed by security policy.'
  });
});
```

### Inspect Write/Edit/MultiEdit Content (PreToolUse)

Use `checkContentForPattern` to detect patterns being added to files:

```typescript
import {
  preToolUseHook, preToolUseOutput,
  getFilePath, isTsFile, checkContentForPattern
} from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Write|Edit|MultiEdit' }, (input, { logger }) => {
  const filePath = getFilePath(input);
  if (!filePath || !isTsFile(filePath)) return preToolUseOutput({});

  // Check if console.log is being added (not just present)
  const result = checkContentForPattern(input, /console\.log/g);
  if (result?.isAddition) {
    logger.warn('Blocking console.log addition', { matches: result.matches });
    return preToolUseOutput({
      systemMessage: 'Code quality: console.log statements are not allowed.',
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: `Cannot add console.log: ${result.matches.join(', ')}`
      }
    });
  }

  return preToolUseOutput({
    systemMessage: 'File modification validated.'
  });
});
```

### Signal Errors Without Blocking (PostToolUse)

Use `postToolUseHook` with `systemMessage` to inform Claude about issues without blocking:

```typescript
import { postToolUseHook, postToolUseOutput, isBashTool } from '@goodfoot/claude-code-hooks';

export default postToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  // Check if the command output indicates a warning
  const response = String(input.tool_response);

  if (response.includes('DEPRECATION WARNING')) {
    return postToolUseOutput({
      systemMessage: 'Warning: The command produced deprecation warnings. Consider updating dependencies.',
      hookSpecificOutput: {
        additionalContext: 'Deprecation warnings were detected in the output.'
      }
    });
  }

  return postToolUseOutput({});
});
```

### Run Validation and Report Errors (PostToolUse)

Use `postToolUseHook` to run external validation tools (tsc, eslint, etc.) and return structured feedback:

```typescript
import { postToolUseHook, postToolUseOutput, getFilePath, isTsFile } from '@goodfoot/claude-code-hooks';
import { execSync } from 'child_process';

export default postToolUseHook({ matcher: 'Write|Edit|MultiEdit', timeout: 60000 }, (input, { logger }) => {
  const filePath = getFilePath(input);
  if (!filePath || !isTsFile(filePath)) return postToolUseOutput({});

  try {
    execSync('tsc --noEmit', {
      cwd: input.cwd,
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env }
    });
    return postToolUseOutput({
      systemMessage: 'TypeScript validation passed.'
    });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? '';
    logger.warn('TypeScript errors detected', { file: filePath });

    // Return errors as structured context - Claude will see this
    return postToolUseOutput({
      systemMessage: 'TypeScript errors detected. Please fix before proceeding.',
      hookSpecificOutput: {
        additionalContext: `TypeScript errors:\n${stderr}`
      }
    });
  }
});
```

**Key Points:**
- PostToolUse hooks **cannot block** — the tool already ran
- Use `additionalContext` to inform Claude about issues
- Use `timeout` in hook config for long-running checks (60000ms = 1 minute)
- Set subprocess `timeout` slightly lower than hook timeout
- Return empty `postToolUseOutput({})` for silent success

## Async and Filesystem Operations

Hooks support `async/await` out of the box. This is critical for checking file state or reading configs.

### Read Config File Async (SessionStart)

```typescript
import { sessionStartHook, sessionStartOutput } from '@goodfoot/claude-code-hooks';
import { readFile } from 'fs/promises';
import { join } from 'path';

export default sessionStartHook({ matcher: 'startup' }, async (input, { logger }) => {
  try {
    const configPath = join(input.cwd, 'CONTRIBUTING.md');
    const content = await readFile(configPath, 'utf-8');

    logger.info('Injecting CONTRIBUTING.md', { path: configPath });

    return sessionStartOutput({
      systemMessage: 'Project contributing guidelines loaded.',
      hookSpecificOutput: {
        additionalContext: `Project Guidelines:\n${content.slice(0, 1000)}...`
      }
    });
  } catch (error) {
    logger.debug('No CONTRIBUTING.md found', { error: String(error) });
    return sessionStartOutput({
      systemMessage: 'Session started (no contributing guidelines found).'
    });
  }
});
```

### Check File Existence Before Command (PreToolUse)

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';
import { access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';

export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
  const cmd = (input.tool_input as { command?: string }).command ?? '';

  if (cmd.includes('npm publish')) {
    try {
      // Ensure .npmrc exists before publishing
      await access(join(input.cwd, '.npmrc'), constants.F_OK);
    } catch {
      logger.warn('Blocked publish: missing .npmrc');
      return preToolUseOutput({
        systemMessage: 'Publish blocked: .npmrc configuration file is required.',
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: 'Safety Check: .npmrc is missing. Cannot publish.'
        }
      });
    }
  }

  return preToolUseOutput({
    systemMessage: 'Command pre-check passed.'
  });
});
```

## All 12 Hook Types Reference

| Hook Type | Factory | Builder | Input Key |
|-----------|---------|---------|-----------|
| PreToolUse | `preToolUseHook` | `preToolUseOutput` | `tool_name` |
| PostToolUse | `postToolUseHook` | `postToolUseOutput` | `tool_name` |
| PostToolUseFailure | `postToolUseFailureHook` | `postToolUseFailureOutput` | `tool_name` |
| SessionStart | `sessionStartHook` | `sessionStartOutput` | `source` |
| SessionEnd | `sessionEndHook` | `sessionEndOutput` | `reason` |
| Stop | `stopHook` | `stopOutput` | N/A |
| UserPromptSubmit | `userPromptSubmitHook` | `userPromptSubmitOutput` | N/A |
| Notification | `notificationHook` | `notificationOutput` | `notification_type` |
| SubagentStart | `subagentStartHook` | `subagentStartOutput` | `agent_type` |
| SubagentStop | `subagentStopHook` | `subagentStopOutput` | `agent_type` |
| PreCompact | `preCompactHook` | `preCompactOutput` | `trigger` |
| PermissionRequest | `permissionRequestHook` | `permissionRequestOutput` | `tool_name` |

## Builder Options Cheat Sheet

### preToolUseOutput

```typescript
{
  hookSpecificOutput: {
    permissionDecision: 'allow' | 'deny' | 'ask',
    permissionDecisionReason: string,
    updatedInput: object
  }
}
```

### stopOutput / subagentStopOutput

```typescript
{
  decision: 'approve' | 'block',
  reason: string
}
```

### permissionRequestOutput

```typescript
{
  hookSpecificOutput: {
    decision: {
      behavior: 'allow' | 'deny',
      message?: string,     // for deny
      interrupt?: boolean,  // for deny
      updatedInput?: object // for allow
    }
  }
}
```

### postToolUseOutput / postToolUseFailureOutput

```typescript
{
  hookSpecificOutput: {
    additionalContext: string  // Added to Claude's context
  }
}
```

### Common Options (All Builders)

These options are available on ALL output builders:

| Option | Type | Effect |
|--------|------|--------|
| `systemMessage` | string | Message injected into Claude's context. Use for instructions or warnings. |
| `continue` | boolean | Continue processing even after errors. Only meaningful with `stopReason`. |
| `stopReason` | string | **Causes exit code 2** and blocks Claude. Use sparingly. |
| `suppressOutput` | boolean | If `true`, hook output is hidden from the user. |

**Clarification on `continue`**: This field is only meaningful when used alongside `stopReason`. PostToolUse hooks always continue by default since the tool has already run. Use `additionalContext` to inform Claude about issues.

**When to use which mechanism:**

| Goal | Hook Type | Use This |
|------|-----------|----------|
| Block Claude from stopping | Stop, SubagentStop | `decision: 'block'` with `reason` |
| Deny a tool execution | PreToolUse | `permissionDecision: 'deny'` with `permissionDecisionReason` |
| Deny permission request | PermissionRequest | `decision: { behavior: 'deny' }` |
| Provide feedback after tool | PostToolUse | `additionalContext` and/or `systemMessage` |
| Critical error (any hook) | Any | `stopReason` (last resort) |

**Important**: PostToolUse hooks **cannot block execution** — the tool has already run. Use `additionalContext` and `systemMessage` to inform Claude of issues.

</instructions>
