# Output Builders & Types

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Porting](porting.md) | [Logging](logging.md)

<instructions>

## 1. Intent-Based Examples

Instead of just listing types, here is how to accomplish specific goals using the output builders.

### Goal: Auto-Approve Specific Safe Commands (PermissionRequest)

Use `permissionRequestHook` to bypass the "Allow?" prompt for known safe operations.

```typescript
import { permissionRequestHook, permissionRequestOutput } from '@goodfoot/claude-code-hooks';

export default permissionRequestHook({ matcher: 'Bash' }, (input, { logger }) => {
  const command = input.toolInput as { command?: string };

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

### Goal: Inject Project Context (UserPromptSubmit)

Use `userPromptSubmitHook` to remind Claude of project details whenever the user types.

```typescript
import { userPromptSubmitHook, userPromptSubmitOutput } from '@goodfoot/claude-code-hooks';

export default userPromptSubmitHook({}, (input, { logger }) => {
  return userPromptSubmitOutput({
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

### Goal: Block Stop on Condition (Stop)

Use `stopHook` to prevent Claude from exiting if criteria aren't met.

```typescript
import { stopHook, stopOutput } from '@goodfoot/claude-code-hooks';

export default stopHook({}, (_input, { logger }) => {
  const isReady = false; // Replace with real check logic

  if (!isReady) {
    logger.info('Blocking stop');
    return stopOutput({
      decision: 'block',
      reason: 'Cannot stop - pending operations must complete first.'
    });
  }
  
  return stopOutput({ decision: 'approve' });
});
```

### Goal: Add Context After Tool Execution (PostToolUse)

Use `postToolUseHook` to analyze the result of a tool and add helpful notes.

```typescript
import { postToolUseHook, postToolUseOutput } from '@goodfoot/claude-code-hooks';

export default postToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  return postToolUseOutput({
    hookSpecificOutput: {
      additionalContext: 'Command completed successfully. You may proceed.'
    }
  });
});
```

### Goal: Deny Specific Tools (PreToolUse)

Use `preToolUseHook` to enforce security policies.

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  const command = (input.toolInput as { command?: string }).command ?? '';
  
  // Example: Block 'curl'
  if (command.startsWith('curl')) {
    logger.info('Denying curl command', { command });
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Network requests via curl are disabled.'
      }
    });
  }
  
  return preToolUseOutput({});
});
```

## 2. Async & Filesystem Operations

Hooks support `async/await` out of the box. This is critical for checking file state or reading configs.

### Goal: Read Config File Async (SessionStart)

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
      hookSpecificOutput: {
        additionalContext: `Project Guidelines:\n${content.slice(0, 1000)}...` 
      }
    });
  } catch (error) {
    logger.debug('No CONTRIBUTING.md found', { error: String(error) });
    return sessionStartOutput({});
  }
});
```

### Goal: Check File Existence Before Command (PreToolUse)

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';
import { access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';

export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
  const cmd = (input.toolInput as { command?: string }).command ?? '';

  if (cmd.includes('npm publish')) {
    try {
      // Ensure .npmrc exists before publishing
      await access(join(input.cwd, '.npmrc'), constants.F_OK);
    } catch {
      logger.warn('Blocked publish: missing .npmrc');
      return preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: 'Safety Check: .npmrc is missing. Cannot publish.'
        }
      });
    }
  }

  return preToolUseOutput({});
});
```

## 3. All 12 Hook Types Reference

| Hook Type | Factory | Builder | Input Key |
| :--- | :--- | :--- | :--- |
| **PreToolUse** | `preToolUseHook` | `preToolUseOutput` | `toolName` |
| **PostToolUse** | `postToolUseHook` | `postToolUseOutput` | `toolName` |
| **PostToolUseFailure** | `postToolUseFailureHook` | `postToolUseFailureOutput` | `toolName` |
| **SessionStart** | `sessionStartHook` | `sessionStartOutput` | `source` |
| **SessionEnd** | `sessionEndHook` | `sessionEndOutput` | `reason` |
| **Stop** | `stopHook` | `stopOutput` | N/A |
| **UserPromptSubmit** | `userPromptSubmitHook` | `userPromptSubmitOutput` | N/A |
| **Notification** | `notificationHook` | `notificationOutput` | `notificationType` |
| **SubagentStart** | `subagentStartHook` | `subagentStartOutput` | `agentType` |
| **SubagentStop** | `subagentStopHook` | `subagentStopOutput` | `agentType` |
| **PreCompact** | `preCompactHook` | `preCompactOutput` | `trigger` |
| **PermissionRequest** | `permissionRequestHook` | `permissionRequestOutput` | `toolName` |

## 4. Builder Options Cheat Sheet

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

### Common Options (All Builders)
```typescript
{
  stopReason: string,   // Force block with exit code 2
  systemMessage: string, // Inject instruction
  continue: boolean      // Continue despite errors
}
```

</instructions>