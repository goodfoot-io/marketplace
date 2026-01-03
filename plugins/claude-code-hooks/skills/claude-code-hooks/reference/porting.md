# Porting Bash Hooks to TypeScript

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Output Builders](output-builders.md)

<instructions>

## 1. The Migration Strategy

Do not try to "wrap" your bash scripts. Port the logic.

| Feature | Bash | TypeScript (via @goodfoot/claude-code-hooks) |
| :--- | :--- | :--- |
| **Input** | `cat` + `jq` | `input` argument (typed, camelCased) |
| **Logging** | `echo >&2` | `logger.info()` |
| **Output** | `echo '{"..."}'` | `return builder({})` |
| **Logic** | `if [[ ... ]]` | `if (input.toolName === '...')` |

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
  const cmd = (input.toolInput as { command?: string })?.command ?? '';

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
*   **TypeScript:** Receives `toolName` (camelCase).

### 3.2 Output
*   **Bash:** You must manually ensure valid JSON.
*   **TypeScript:** The builder guarantees valid JSON.

### 3.3 Error Handling
*   **Bash:** `exit 1` might be ignored or treated as a silent error.
*   **TypeScript:** Throwing an error (or exit code 2) explicitly blocks Claude.

## 4. Testing Your Port

Use the same JSON payload to test both:

```bash
# Test Bash
echo '{"tool_name":"Bash"}' | ./hooks/old-hook.sh

# Test Compiled TS
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash"}' | node dist/new-hook.*.mjs
```

</instructions>