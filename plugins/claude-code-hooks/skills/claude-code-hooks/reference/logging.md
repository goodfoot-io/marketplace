# Logging & Debugging

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Output Builders](output-builders.md)

<instructions>

## 1. The Cardinal Sin

**NEVER use `console.log`, `console.error`, or direct `process.stdout/stderr` writes.**

Hooks communicate with Claude via `stdout`. `stderr` is only shown to the user during fatal exits (Exit 2), which we avoid by using structured JSON. Printing arbitrary text anywhere will:
1.  Corrupt the JSON protocol (on stdout).
2.  Be swallowed or cause UI glitches (on stderr).
3.  Fail to appear in your structured logs.

## 2. Enabling Logs

Logs are **off by default**. You must explicitly enable them.

### Option A: Environment Variable (Global)
Best for general debugging.
```bash
export CLAUDE_CODE_HOOKS_LOG_FILE=/tmp/claude-hooks.log
```

### Option B: Build Flag (Hardcoded)
Best if you want to force logging for a specific build.
```bash
npx -y @goodfoot/claude-code-hooks ... --log /tmp/claude-hooks.log
```

## 3. Viewing Logs

Since logs go to a file, use `tail` to watch them in a separate terminal:

```bash
tail -f /tmp/claude-hooks.log | jq
```

*Tip: Use `jq` to make the JSON lines readable.*

### Log Output Format

Each log entry is a JSON line:

```json
{"level":"info","message":"Hook started","context":{"tool":"Bash"},"timestamp":"2024-01-15T10:30:00.000Z","hookType":"PreToolUse"}
```

Use `jq` filters to find specific logs:

```bash
# Show only warnings and errors
tail -f /tmp/claude-hooks.log | jq 'select(.level == "warn" or .level == "error")'

# Filter by hook type
tail -f /tmp/claude-hooks.log | jq 'select(.hookType == "PostToolUse")'

# Search for specific message content
tail -f /tmp/claude-hooks.log | jq 'select(.message | contains("blocked"))'
```

## 4. Using the Logger

The `logger` is injected into your hook context.

```typescript
export default preToolUseHook({}, (input, { logger }) => {
  // INFO: Normal events
  logger.info('Hook started', { tool: input.tool_name });

  // WARN: Something fishy
  logger.warn('Suspicious input detected', { input: input.tool_input });

  // ERROR: Something broke
  try {
    throw new Error("Kaboom");
  } catch (e) {
    logger.logError(e, "Handler failed");
  }

  return preToolUseOutput({});
});
```

## 5. Troubleshooting Checklist

**"I don't see any logs!"**
1.  Did you set `CLAUDE_CODE_HOOKS_LOG_FILE`?
2.  Is the path writable?
3.  Did you rebuild your hooks after changing code?

**"Claude says 'Invalid JSON'!"**
1.  Search your code for `console.log`, `console.error`, or `process.stdout.write`.
2.  Remove them.

**"My hook takes too long!"**
1.  Check if you are logging massive objects.
2.  The logger is synchronous (for safety), so large writes block execution.

</instructions>