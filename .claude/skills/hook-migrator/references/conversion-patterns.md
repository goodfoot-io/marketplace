# Conversion Patterns

## Bash Script to TypeScript

**Original (hooks.json):**
```json
{
  "hooks": [{
    "type": "PreToolUse",
    "matcher": "Bash",
    "command": "./scripts/check-command.sh"
  }]
}
```

**Converted (hooks/src/check-command.ts):**
```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  const command = input.tool_input.command;
  logger.info('Checking command', { command });

  // Replicate bash script logic here
  if (command.includes('rm -rf /')) {
    return preToolUseOutput({
      systemMessage: 'Blocked dangerous command',
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Root deletion forbidden'
      }
    });
  }

  return preToolUseOutput({ systemMessage: 'Command allowed' });
});
```

## Inline Command to TypeScript

**Original:**
```json
{
  "hooks": [{
    "type": "PostToolUse",
    "matcher": "Write|Edit",
    "command": "echo 'File modified: $TOOL_INPUT_FILE_PATH'"
  }]
}
```

**Converted:**
```typescript
import { postToolUseHook, postToolUseOutput, getFilePath } from '@goodfoot/claude-code-hooks';

export default postToolUseHook({ matcher: 'Write|Edit' }, (input, { logger }) => {
  const filePath = getFilePath(input);
  logger.info('File modified', { filePath });

  return postToolUseOutput({
    systemMessage: `File modified: ${filePath}`
  });
});
```

## SessionStart Hook

**Original:**
```json
{
  "hooks": [{
    "type": "SessionStart",
    "command": "./scripts/session-init.sh"
  }]
}
```

**Converted:**
```typescript
import { sessionStartHook, sessionStartOutput } from '@goodfoot/claude-code-hooks';

export default sessionStartHook({}, (input, { logger }) => {
  logger.info('Session starting', { sessionId: input.session_id });

  return sessionStartOutput({
    systemMessage: 'Session initialized',
    hookSpecificOutput: {
      additionalContext: 'Custom context for this session'
    }
  });
});
```

## Stop Hook with Decision

**Original:**
```json
{
  "hooks": [{
    "type": "Stop",
    "command": "./scripts/check-completion.sh"
  }]
}
```

**Converted:**
```typescript
import { stopHook, stopOutput } from '@goodfoot/claude-code-hooks';

export default stopHook({}, (input, { logger }) => {
  const reason = input.stop_hook_input?.reason;
  logger.info('Stop requested', { reason });

  // Block if work incomplete
  if (reason === 'user_interrupt') {
    return stopOutput({
      systemMessage: 'Allowing user interrupt',
      hookSpecificOutput: { decision: 'allow' }
    });
  }

  return stopOutput({
    systemMessage: 'Task complete',
    hookSpecificOutput: { decision: 'allow' }
  });
});
```

## Multi-Tool Matcher with Type Guards

**Original:**
```json
{
  "hooks": [{
    "type": "PreToolUse",
    "matcher": "Write|Edit|MultiEdit",
    "command": "./scripts/lint-check.sh"
  }]
}
```

**Converted:**
```typescript
import {
  preToolUseHook, preToolUseOutput,
  getFilePath, isTsFile, checkContentForPattern
} from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Write|Edit|MultiEdit' }, (input, { logger }) => {
  const filePath = getFilePath(input);
  if (!filePath || !isTsFile(filePath)) {
    return preToolUseOutput({});
  }

  // Check for forbidden patterns
  const result = checkContentForPattern(input, /console\.log/g);
  if (result?.isAddition) {
    return preToolUseOutput({
      systemMessage: 'console.log not allowed',
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Use logger instead of console.log'
      }
    });
  }

  return preToolUseOutput({ systemMessage: 'Lint check passed' });
});
```

## Environment Variable Substitution

**Original command using env vars:**
```bash
echo "Tool: $TOOL_NAME, Input: $TOOL_INPUT"
```

**Converted - access via input object:**
```typescript
const toolName = input.tool_name;           // e.g., 'Bash'
const toolInput = input.tool_input;         // typed per tool
const sessionId = input.session_id;
const cwd = input.cwd;
```

## External Process Execution

**Original:**
```json
{
  "hooks": [{
    "type": "PostToolUse",
    "matcher": "Write|Edit",
    "command": "tsc --noEmit"
  }]
}
```

**Converted:**
```typescript
import { execSync } from 'child_process';
import { postToolUseHook, postToolUseOutput, getFilePath, isTsFile } from '@goodfoot/claude-code-hooks';

export default postToolUseHook({ matcher: 'Write|Edit', timeout: 60000 }, (input, { logger }) => {
  const filePath = getFilePath(input);
  if (!filePath || !isTsFile(filePath)) {
    return postToolUseOutput({});
  }

  try {
    execSync('tsc --noEmit', { cwd: input.cwd, encoding: 'utf-8', timeout: 30000 });
    return postToolUseOutput({ systemMessage: 'TypeScript check passed' });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? '';
    return postToolUseOutput({
      systemMessage: 'TypeScript errors found',
      hookSpecificOutput: { additionalContext: stderr }
    });
  }
});
```

## Key Differences Summary

| Bash/Command | TypeScript SDK |
|--------------|----------------|
| `$TOOL_NAME` | `input.tool_name` |
| `$TOOL_INPUT` | `input.tool_input` |
| `echo "message"` | `systemMessage: "message"` |
| `exit 1` (deny) | `permissionDecision: 'deny'` |
| `exit 0` (allow) | return output with no deny |
| `>&2 echo "log"` | `logger.info()` |
