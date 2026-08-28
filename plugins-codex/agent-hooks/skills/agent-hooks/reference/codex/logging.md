<instructions>

## The Cardinal Sin

**NEVER use `console.log`, `console.error`, or direct `process.stdout/stderr` writes.**

Hooks communicate with Codex via `stdout`. `stderr` is only shown to the user during fatal exits, which we avoid by using structured JSON. Printing arbitrary text anywhere will:
1. Corrupt the JSON protocol (on stdout).
2. Be swallowed or cause UI glitches (on stderr).
3. Fail to appear in your structured logs.

## Logger Behavior

The Logger is **silent by default**. No output is produced unless you:
1. Set a log file path (via env var or constructor)
2. Subscribe to events with `.on(level, handler)`

| Configuration | Output Behavior |
|--------------|-----------------|
| No config (default) | **Silent** — no output anywhere |
| `AGENT_HOOKS_LOG_FILE` set | JSON lines appended to file |
| `new Logger({ logFilePath })` | JSON lines appended to file at the configured path |
| `new Logger({ logEnvVar: 'NAME' })` | Logger reads `process.env.NAME` at construction time |
| `.on(level, handler)` registered | Events delivered to handlers |
| Multiple destinations | All destinations receive events |

## Enabling Logs

### Environment Variable (Default)

Best for general debugging. The Logger reads `AGENT_HOOKS_LOG_FILE` automatically at construction time.

```bash
export AGENT_HOOKS_LOG_FILE=/tmp/codex-hooks.log
```

Override the variable name programmatically with the `logEnvVar` constructor option (see [Programmatic Logger Usage](#programmatic-logger-usage) below).

### Custom Env Var Name

If you need a project-specific env var (for example, across different git worktrees), construct the Logger with `logEnvVar`. It is read at construction time:

```typescript
import { Logger } from '@goodfoot/agent-hooks/codex';

const logger = new Logger({ logEnvVar: 'MY_PLUGIN_LOG_FILE' });
```

Then set that variable in the environment when running Codex:

```bash
export MY_PLUGIN_LOG_FILE=/tmp/my-plugin.log
```

### Hardcoded Path (Programmatic)

If you want to force a specific log file path regardless of environment:

```typescript
import { Logger } from '@goodfoot/agent-hooks/codex';

const logger = new Logger({ logFilePath: '/tmp/codex-hooks.log' });
```

### Related Build Flags for Asset Imports

If a hook imports prompt assets such as markdown, keep the build command aligned with the source:

```bash
npx -y @goodfoot/agent-hooks --agent codex -i "src/**/*.ts" -o ".codex/hooks.json" --loader .txt=text
```

- `.md` already works by default through `.md=text`.
- For other extensions, opt in explicitly with `--loader`.
- Mirror the same extension handling in Vitest/Vite so tests do not diverge from build behavior.

### Constructor (Programmatic)

Best for custom logging pipelines or testing.

```typescript
import { Logger } from '@goodfoot/agent-hooks/codex';

// Hardcode the log file path
const logger = new Logger({ logFilePath: '/tmp/my-hooks.log' });

// Read the path from a custom env var at construction time
const logger = new Logger({ logEnvVar: 'MY_PLUGIN_LOG_FILE' });
```

## Viewing Logs

Since logs go to a file, use `tail` to watch them in a separate terminal:

```bash
tail -f /tmp/codex-hooks.log | jq
```

*Tip: Use `jq` to make the JSON lines readable.*

### Log Output Format

Each log entry is a JSON line:

```json
{"timestamp":"2024-01-15T10:30:00.000Z","level":"info","hookType":"PreToolUse","message":"Hook started","context":{"tool":"shell"}}
```

Use `jq` filters to find specific logs:

```bash
# Show only warnings and errors
tail -f /tmp/codex-hooks.log | jq 'select(.level == "warn" or .level == "error")'

# Filter by hook type
tail -f /tmp/codex-hooks.log | jq 'select(.hookType == "PostToolUse")'

# Search for specific message content
tail -f /tmp/codex-hooks.log | jq 'select(.message | contains("blocked"))'
```

## Using the Logger in Hooks

The `logger` is injected into your hook context.

```typescript
export default preToolUseHook({}, (input, { logger }) => {
  // INFO: Normal events
  logger.info('Hook started', { tool: input.tool_name });

  // WARN: Something fishy
  logger.warn('Suspicious input detected', { input: input.tool_input });

  // DEBUG: Verbose details (only visible if log level permits)
  logger.debug('Full input dump', { input });

  // ERROR: Something broke
  try {
    throw new Error("Kaboom");
  } catch (e) {
    logger.logError(e, "Handler failed");
  }

  // Return with systemMessage to inform the user
  return preToolUseOutput({
    systemMessage: 'Hook processing complete.'
  });
});
```

### Log Levels

| Level | Severity | Use Case |
|-------|----------|----------|
| `debug` | Lowest | Detailed debugging information |
| `info` | Low | General operational events |
| `warn` | Medium | Warning conditions that may indicate issues |
| `error` | High | Error conditions requiring attention |

## Programmatic Logger Usage

The `Logger` class can be used directly for testing, monitoring integration, or custom logging pipelines.

### Creating Logger Instances

```typescript
import { Logger } from '@goodfoot/agent-hooks/codex';

// Silent logger (default) — perfect for unit tests
const logger = new Logger();

// Logger with file output
const fileLogger = new Logger({ logFilePath: '/var/log/hooks.log' });

// Logger reading from a custom env var
const dynamicLogger = new Logger({ logEnvVar: 'MY_LOG_PATH' });
```

### Using Logger in Tests

Since the Logger is silent by default, you can pass it directly to hooks without mocking:

```typescript
import { describe, it, expect } from 'vitest';
import { Logger, type PreToolUseInput } from '@goodfoot/agent-hooks/codex';
import hook from '../src/my-hook.js';

const logger = new Logger();

describe('My Hook', () => {
  it('allows safe commands', async () => {
    const input: PreToolUseInput = {
      cwd: '/workspace',
      hook_event_name: 'PreToolUse',
      model: 'gpt-5-codex',
      session_id: 'test',
      transcript_path: null,
      permission_mode: 'default',
      tool_name: 'shell',
      tool_input: { command: 'ls' },
      tool_use_id: 't1',
      turn_id: 'u1'
    };

    const result = await hook(input, { logger });

    expect(result._type).toBe('PreToolUse');
  });
});
```

### Event Subscription

Subscribe to log events for monitoring, alerting, or custom output:

```typescript
import { Logger, type LogEvent } from '@goodfoot/agent-hooks/codex';

const logger = new Logger();

const unsubscribe = logger.on('error', (event: LogEvent) => {
  sendToMonitoring({
    hookType: event.hookType,
    message: event.message
  });
});

logger.on('warn', sendToSlack);
logger.on('error', sendToPagerDuty);

unsubscribe();
```

### LogEvent Structure

```typescript
interface LogEvent {
  timestamp: string;                          // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  hookType?: HookEventName;                   // 'PreToolUse', etc.
  message: string;
  input?: Partial<HookInput>;
  context?: Record<string, unknown>;
}
```

### Forwarding to External Loggers

```typescript
import { logger } from '@goodfoot/agent-hooks/codex';
import pino from 'pino';

const pinoLogger = pino({ level: 'debug' });

logger.on('debug', (event) => pinoLogger.debug(event, event.message));
logger.on('info', (event) => pinoLogger.info(event, event.message));
logger.on('warn', (event) => pinoLogger.warn(event, event.message));
logger.on('error', (event) => pinoLogger.error(event, event.message));
```

### Cleanup

Always close file handles when done:

```typescript
const logger = new Logger({ logFilePath: '/tmp/hooks.log' });
// ... use logger ...
process.on('exit', () => {
  logger.close();
});
```

## Troubleshooting Checklist

**"I don't see any logs!"**
1. Did you set `AGENT_HOOKS_LOG_FILE`?
2. Is the path writable?
3. Did you rebuild your hooks after changing code?
4. Are you using `new Logger()` without a file path? (Silent by default)
5. Are you on Windows? Codex disables hook execution there entirely.

**"Codex says 'Invalid JSON'!"**
1. Search your code for `console.log`, `console.error`, or `process.stdout.write`.
2. Remove them.

**"My hook takes too long!"**
1. Check if you are logging massive objects.
2. The logger is synchronous (for safety), so large writes block execution.

**"Log events aren't reaching my handler!"**
1. Verify you subscribed to the correct level: `logger.on('error', handler)`.
2. Check that your handler isn't throwing errors.
3. Ensure the Logger instance is the same one passed to hooks.

</instructions>
