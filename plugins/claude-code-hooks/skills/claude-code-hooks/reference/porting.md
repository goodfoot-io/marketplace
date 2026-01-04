# Porting Bash Hooks to TypeScript

<instructions>

## 1. The Migration Strategy

Do not try to "wrap" your bash scripts. Port the logic.

| Feature | Bash | TypeScript (via @goodfoot/claude-code-hooks) |
| :--- | :--- | :--- |
| **Input** | `cat` + `jq` | `input` argument (typed, snake_case wire format) |
| **Logging** | `echo >&2` | `logger.info()` |
| **Output** | `echo '{"..."}'` | `return builder({})` |
| **Logic** | `if [[ ... ]]` | `if (input.tool_name === '...')` |

## 2. Side-by-Side Example

### Before: Bash Hook
```bash
#!/bin/bash
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if [[ "$TOOL" == "Bash" && "$CMD" == *"rm -rf /"* ]]; then
  echo '{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"Blocked"}}'
  exit 0
fi

echo '{"hookSpecificOutput":{"permissionDecision":"allow"}}'
```

### After: TypeScript Hook
```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  const cmd = (input.tool_input as { command?: string })?.command ?? '';

  if (cmd.includes('rm -rf /')) {
    logger.warn('Blocked dangerous command', { cmd });
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Blocked'
      }
    });
  }

  return preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
});
```

## 3. Key Differences

### 3.1 Casing
*   **Bash:** Receives `tool_name` (snake_case).
*   **TypeScript:** Also receives `tool_name` (snake_case) - same wire format!

### 3.2 Output
*   **Bash:** You must manually ensure valid JSON.
*   **TypeScript:** The builder guarantees valid JSON.

### 3.3 Error Handling
*   **Bash:** `exit 1` might be ignored or treated as a silent error.
*   **TypeScript:** Throwing an error (or exit code 2) explicitly blocks Claude.

## 4. Testing Your Port

### Unit Testing with Vitest

The scaffolded project includes Vitest. Here's how to test your hooks:

```typescript
// test/my-hook.test.ts
import { describe, it, expect, vi } from 'vitest';
import hook from '../src/my-hook.js';

describe('MyHook', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  };

  it('allows safe commands', async () => {
    const input = {
      hook_event_name: 'PreToolUse' as const,
      tool_name: 'Bash',
      tool_input: { command: 'echo hello' },
      tool_use_id: 'test-123',
      session_id: 'session-1',
      transcript_path: '/tmp/transcript.jsonl',
      cwd: '/workspace',
    };

    const result = await hook(input, { logger: mockLogger });

    expect(result._type).toBe('PreToolUse');
    expect(result.stdout.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  it('blocks dangerous commands', async () => {
    const input = {
      hook_event_name: 'PreToolUse' as const,
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
      tool_use_id: 'test-456',
      session_id: 'session-1',
      transcript_path: '/tmp/transcript.jsonl',
      cwd: '/workspace',
    };

    const result = await hook(input, { logger: mockLogger });

    expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe('deny');
  });
});
```

### Manual Integration Testing

Test the compiled hook with real JSON:

```bash
# After running: npm run build
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"},"session_id":"test","cwd":"/tmp","transcript_path":"/tmp/t.jsonl","tool_use_id":"123"}' \
  | node dist/build/my-hook.*.mjs
```

## 5. Executing External Commands

Many hooks need to run external tools (tsc, eslint, etc.). Use `execSync`:

```typescript
import { execSync } from 'child_process';
import { postToolUseHook, postToolUseOutput } from '@goodfoot/claude-code-hooks';

export default postToolUseHook({ matcher: 'Write|Edit' }, (input, { logger }) => {
  try {
    // Run tsc and capture output
    execSync('tsc --noEmit', {
      cwd: input.cwd,
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']  // Capture stdout and stderr
    });

    return postToolUseOutput({ continue: true });
  } catch (error) {
    // execSync throws on non-zero exit
    const stderr = (error as { stderr?: Buffer | string }).stderr?.toString() ?? '';
    logger.warn('TypeScript errors', { stderr });

    return postToolUseOutput({
      systemMessage: 'TypeScript errors detected',
      hookSpecificOutput: {
        additionalContext: `TypeScript errors:\n${stderr}`
      }
    });
  }
});
```

**Key points:**
- Use `encoding: 'utf-8'` to get string output
- Set `timeout` to prevent hanging
- `execSync` throws on non-zero exit - use try/catch
- Access stderr via `(error as { stderr?: ... }).stderr`

</instructions>