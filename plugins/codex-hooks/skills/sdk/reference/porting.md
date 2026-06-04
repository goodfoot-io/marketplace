<instructions>

## Migration Strategy

Do not try to "wrap" your bash scripts. Port the logic into a typed hook function.

| Feature | Bash | TypeScript (via @goodfoot/codex-hooks) |
|---------|------|----------------------------------------|
| Input | `cat` + `jq` | `input` argument (typed, snake_case wire format) |
| Logging | `echo >&2` | `logger.info()` |
| Output | `echo '{"..."}'` | `return builder({})` |
| Logic | `if [[ ... ]]` | `if (input.tool_name === '...')` |
| Tool name match | `[[ "$TOOL" == "shell" ]]` | `{ matcher: 'shell' }` on the factory |
| Tool input | `jq -r '.tool_input.command'` | `(input.tool_input as { command?: string }).command` plus a type guard |

## Side-by-Side Example

### Before: Bash Hook

```bash
#!/bin/bash
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if [[ "$TOOL" == "shell" && "$CMD" == *"rm -rf /"* ]]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked"}}'
  exit 0
fi

echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
```

### After: TypeScript Hook

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/codex-hooks';

export default preToolUseHook({ matcher: 'shell' }, (input, { logger }) => {
  const cmd = isShellInput(input.tool_input) ? input.tool_input.command : '';

  if (cmd.includes('rm -rf /')) {
    logger.warn('Blocked dangerous command', { cmd });
    return preToolUseOutput({
      systemMessage: 'Safety: Dangerous root deletion blocked.',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Blocked'
    });
  }

  return preToolUseOutput({
    systemMessage: 'Command passed safety check.',
    permissionDecision: 'allow'
  });
});

function isShellInput(value: unknown): value is { command: string } {
  return typeof value === 'object' && value !== null && typeof (value as { command?: unknown }).command === 'string';
}
```

## Key Differences

### Casing

- **Bash:** Receives `tool_name` (snake_case wire format).
- **TypeScript:** Same `tool_name` wire format — no transformation.

### Output

- **Bash:** You must manually ensure valid JSON and remember to include `hookEventName` inside `hookSpecificOutput`.
- **TypeScript:** The builder injects `hookEventName` and guarantees valid JSON.

### Permission Request shape

Bash hooks often blur `PreToolUse` and `PermissionRequest`. They are distinct in Codex:

- `PreToolUse` outputs `hookSpecificOutput.permissionDecision = 'allow' | 'deny' | 'ask'`.
- `PermissionRequest` outputs `hookSpecificOutput.decision = { behavior: 'allow' | 'deny', message? }`.

If your bash hook returned `permissionDecision` from a `PermissionRequest` script, switch to the `decision` object on the way over.

### Error Handling

- **Bash:** `exit 1` might be ignored or treated as a silent error.
- **TypeScript:** Throwing inside the handler is captured by the runtime and produces a structured error response. Exit code 2 from the runtime explicitly blocks.

### Windows

Codex disables hook execution on Windows. If your bash hooks ran via WSL or Git Bash, those workflows will not survive the port — the TypeScript SDK does not change this constraint.

## Testing Your Port

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
    logError: vi.fn()
  };

  it('allows safe commands', async () => {
    const input = {
      hook_event_name: 'PreToolUse' as const,
      cwd: '/workspace',
      model: 'gpt-5-codex',
      session_id: 'session-1',
      transcript_path: null,
      permission_mode: 'default' as const,
      tool_name: 'shell',
      tool_input: { command: 'echo hello' },
      tool_use_id: 'test-123',
      turn_id: 'u1'
    };

    const result = await hook(input, { logger: mockLogger });

    expect(result._type).toBe('PreToolUse');
    expect(result.stdout.hookSpecificOutput).toBeUndefined();
  });

  it('blocks dangerous commands', async () => {
    const input = {
      hook_event_name: 'PreToolUse' as const,
      cwd: '/workspace',
      model: 'gpt-5-codex',
      session_id: 'session-1',
      transcript_path: null,
      permission_mode: 'default' as const,
      tool_name: 'shell',
      tool_input: { command: 'rm -rf /' },
      tool_use_id: 'test-456',
      turn_id: 'u1'
    };

    const result = await hook(input, { logger: mockLogger });

    expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe('deny');
  });
});
```

### Manual Integration Testing

Test the compiled hook with real JSON. Field requirements come from the wire schemas:

```bash
# After running: npm run build
echo '{
  "hook_event_name":"PreToolUse",
  "cwd":"/tmp",
  "model":"gpt-5-codex",
  "session_id":"test",
  "transcript_path":null,
  "permission_mode":"default",
  "tool_name":"shell",
  "tool_input":{"command":"ls"},
  "tool_use_id":"t1",
  "turn_id":"u1"
}' | node .codex/bin/my-hook.*.mjs
```

## Executing External Commands

Many hooks need to run external tools (tsc, eslint, etc.). Use `execSync`:

### Basic Pattern

```typescript
import { execSync } from 'node:child_process';
import { postToolUseHook, postToolUseOutput } from '@goodfoot/codex-hooks';

export default postToolUseHook({ matcher: 'shell', timeout: 60000 }, (input, { logger }) => {
  try {
    execSync('tsc --noEmit', {
      cwd: input.cwd,
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return postToolUseOutput({
      systemMessage: 'TypeScript validation passed.'
    });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr?.toString() ?? '';
    logger.warn('TypeScript errors', { stderr });

    return postToolUseOutput({
      systemMessage: 'TypeScript errors detected',
      additionalContext: `TypeScript errors:\n${stderr}`
    });
  }
});
```

### Robust Error Handling

For production hooks, use a typed error interface:

```typescript
interface ExecError extends Error {
  stdout?: Buffer | string;
  stderr?: Buffer | string;
  status?: number;
}

function runCommand(cmd: string, cwd: string, timeoutMs: number): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      timeout: timeoutMs,
      env: { ...process.env }
    });
    return { ok: true, output };
  } catch (e) {
    const error = e as ExecError;
    const stderr = error.stderr?.toString() ?? '';
    const stdout = error.stdout?.toString() ?? '';
    return { ok: false, output: stderr || stdout || error.message };
  }
}
```

**Key points:**
- Use `encoding: 'utf-8'` to get string output.
- Set `timeout` on both hook config and `execSync` (hook timeout should be higher).
- Pass `env: { ...process.env }` to inherit environment variables.
- `execSync` throws on non-zero exit — always use try/catch.
- Use `systemMessage` to provide user-visible feedback for both success and error cases.

</instructions>
