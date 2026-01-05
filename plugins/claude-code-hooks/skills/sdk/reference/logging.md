<instructions>

## The Cardinal Sin

**NEVER use `console.log`, `console.error`, or direct `process.stdout/stderr` writes.**

Hooks communicate with Claude via `stdout`. `stderr` is only shown to the user during fatal exits (Exit 2), which we avoid by using structured JSON. Printing arbitrary text anywhere will:
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
| `CLAUDE_CODE_HOOKS_LOG_FILE` set | JSON lines appended to file |
| `.on(level, handler)` registered | Events delivered to handlers |
| Multiple destinations | All destinations receive events |

## Enabling Logs

### Environment Variable (Global)

Best for general debugging.

```bash
export CLAUDE_CODE_HOOKS_LOG_FILE=/tmp/claude-hooks.log
```

### Build Flag (Hardcoded)

Best if you want to force logging for a specific build.

```bash
npx -y @goodfoot/claude-code-hooks ... --log /tmp/claude-hooks.log
```

### Constructor (Programmatic)

Best for custom logging pipelines or testing.

```typescript
import { Logger } from '@goodfoot/claude-code-hooks';

const logger = new Logger({ logFilePath: '/tmp/my-hooks.log' });
```

## Viewing Logs

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
import { Logger } from '@goodfoot/claude-code-hooks';

// Silent logger (default) — perfect for unit tests
const logger = new Logger();

// Logger with file output
const fileLogger = new Logger({ logFilePath: '/var/log/hooks.log' });

// Runtime configuration
logger.setLogFile('/tmp/debug.log');  // Enable file logging
logger.setLogFile(null);               // Disable file logging
```

### Using Logger in Tests

Since the Logger is silent by default, you can pass it directly to hooks without mocking:

```typescript
import { describe, it, expect } from 'vitest';
import { Logger, type PreToolUseInput } from '@goodfoot/claude-code-hooks';
import hook from '../src/my-hook.js';

// Silent logger — no output, no mocking needed
const logger = new Logger();

describe('My Hook', () => {
  it('allows safe commands', async () => {
    const input: PreToolUseInput = {
      session_id: 'test',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' }
    };

    const result = await hook(input, { logger });

    expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe('allow');
  });
});
```

### Event Subscription

Subscribe to log events for monitoring, alerting, or custom output:

```typescript
import { Logger, type LogEvent } from '@goodfoot/claude-code-hooks';

const logger = new Logger();

// Subscribe to error events for external monitoring
const unsubscribe = logger.on('error', (event: LogEvent) => {
  // Forward to your monitoring service (e.g., Sentry, Datadog, etc.)
  sendToMonitoring({
    hookType: event.hookType,
    message: event.message,
    stack: event.error?.stack
  });
});

// Subscribe to multiple levels
logger.on('warn', sendToSlack);
logger.on('error', sendToPagerDuty);

// Later, clean up
unsubscribe();
```

### LogEvent Structure

```typescript
interface LogEvent {
  timestamp: string;           // ISO 8601 timestamp
  level: 'debug' | 'info' | 'warn' | 'error';
  hookType?: string;           // 'PreToolUse', 'PostToolUse', etc.
  message: string;             // Human-readable description
  input?: object;              // Hook input at time of logging
  error?: {                    // Present for logError() calls
    name: string;
    message: string;
    stack?: string;
    cause?: object;            // Nested error chain
  };
  context?: Record<string, unknown>;  // Additional data
}
```

### Forwarding to External Loggers

```typescript
import { logger } from '@goodfoot/claude-code-hooks';
import pino from 'pino';

const pinoLogger = pino({ level: 'debug' });

// Forward all events to pino
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

// Clean up on shutdown
process.on('exit', () => {
  logger.close();
});
```

## Troubleshooting Checklist

**"I don't see any logs!"**
1. Did you set `CLAUDE_CODE_HOOKS_LOG_FILE`?
2. Is the path writable?
3. Did you rebuild your hooks after changing code?
4. Are you using `new Logger()` without a file path? (Silent by default)

**"Claude says 'Invalid JSON'!"**
1. Search your code for `console.log`, `console.error`, or `process.stdout.write`.
2. Remove them.

**"My hook takes too long!"**
1. Check if you are logging massive objects.
2. The logger is synchronous (for safety), so large writes block execution.

**"Log events aren't reaching my handler!"**
1. Verify you subscribed to the correct level: `logger.on('error', handler)`.
2. Check that your handler isn't throwing errors (they're silently ignored).
3. Ensure the Logger instance is the same one passed to hooks.

</instructions>
