# Logging Reference

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Porting](porting.md) | [Output Builders](output-builders.md) | [Environment](environment.md)

<instructions>

## 1. Why Not Console.log?

Hook protocol reserves stdout for JSON responses:
- **stdout** — Reserved for hook JSON output
- **stderr** — May conflict with Claude Code error handling
- **console.log** — Goes to stdout, breaks hook protocol!

The logger provides safe alternatives.

## 2. Logger Behavior

| Configuration | Behavior |
|--------------|----------|
| No config (default) | **Silent** - no output anywhere |
| `CLAUDE_CODE_HOOKS_LOG_FILE` | Append JSON lines to file |
| `.on(level, handler)` | Events delivered to handlers |
| Multiple destinations | All receive events |

## 3. File Output {#file-output}

### 3.1 Via Environment Variable

```bash
# Set before running claude
export CLAUDE_CODE_HOOKS_LOG_FILE=/tmp/hooks.log
```

### 3.2 Via CLI Argument (when using hook factories)

```bash
tsx ./hooks/my-hook.ts --log /tmp/hooks.log
```

### 3.3 Log File Format

Logs are written as JSON Lines (one JSON object per line):

```jsonl
{"timestamp":"2024-01-15T10:30:00.000Z","level":"info","hookType":"PreToolUse","message":"Hook started","input":{"toolName":"Bash"}}
{"timestamp":"2024-01-15T10:30:01.000Z","level":"warn","hookType":"PreToolUse","message":"Dangerous command detected"}
```

### 3.4 Reading Log Files

```bash
# View last 10 entries
tail -10 /tmp/hooks.log | jq

# Filter by level
cat /tmp/hooks.log | jq 'select(.level == "error")'

# Filter by hook type
cat /tmp/hooks.log | jq 'select(.hookType == "PreToolUse")'
```

## 4. Event Subscription {#event-subscription}

Subscribe to log events programmatically:

```typescript
import { logger } from '@goodfoot/claude-code-hooks';

// Subscribe to error events
const unsubscribe = logger.on('error', (event) => {
  console.error(`[${event.hookType}] ${event.message}`);
  if (event.error) {
    console.error(event.error.stack);
  }
});

// Later, clean up
unsubscribe();
```

### 4.1 Log Levels

| Level | Severity | Use Case |
|-------|----------|----------|
| `debug` | Lowest | Detailed debugging |
| `info` | Low | General events |
| `warn` | Medium | Potential issues |
| `error` | High | Errors requiring attention |

### 4.2 Subscribe to Multiple Levels

```typescript
import { logger, LOG_LEVELS } from '@goodfoot/claude-code-hooks';

// Subscribe to all levels
for (const level of LOG_LEVELS) {
  logger.on(level, (event) => {
    // Handle all events
  });
}

// Or specific levels
logger.on('warn', handleWarning);
logger.on('error', handleError);
```

## 5. Error Logging {#error-logging}

Use `logError` for caught exceptions:

```typescript
import { logger } from '@goodfoot/claude-code-hooks';

try {
  await riskyOperation();
} catch (err) {
  logger.logError(err, 'Failed to execute operation', {
    operation: 'delete',
    target: '/important/file.txt'
  });
}
```

### 5.1 Error Event Structure

```typescript
interface LogEventError {
  name: string;       // 'TypeError', 'ValidationError', etc.
  message: string;    // Error message
  stack?: string;     // Stack trace
  cause?: LogEventError; // Wrapped errors
}
```

## 6. Log Event Structure

```typescript
interface LogEvent {
  timestamp: string;           // ISO 8601 format
  level: 'debug' | 'info' | 'warn' | 'error';
  hookType?: HookEventName;    // PreToolUse, SessionStart, etc.
  message: string;             // Human-readable description
  input?: Partial<HookInput>;  // Hook input at log time
  error?: LogEventError;       // Error details (for errors)
  context?: Record<string, unknown>; // Additional metadata
}
```

## 7. Usage in Hooks

### 7.1 Direct Logger Usage

```typescript
#!/usr/bin/env tsx
import {
  preToolUseOutput,
  logger,
  type PreToolUseInput
} from '@goodfoot/claude-code-hooks';

async function main() {
  const input: PreToolUseInput = JSON.parse(await readStdin());

  // Set context for better log events
  logger.setContext('PreToolUse', input);

  logger.debug('Processing hook', { toolName: input.toolName });

  if (isDangerous(input)) {
    logger.warn('Blocking dangerous command', {
      command: input.toolInput?.command
    });

    const output = preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Dangerous command'
      }
    });
    process.stdout.write(JSON.stringify(output.stdout));
    process.exit(output.exitCode);
  }

  logger.info('Allowing command');
  const output = preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
  process.stdout.write(JSON.stringify(output.stdout));
  process.exit(output.exitCode);
}
```

### 7.2 Logging Methods

```typescript
// Debug - detailed info
logger.debug('Processing input', { size: 256 });

// Info - general events
logger.info('Session started', { source: 'startup' });

// Warn - potential issues
logger.warn('Rate limit approaching', { usage: 0.9 });

// Error - problems
logger.error('Failed to parse', { reason: 'invalid JSON' });

// Error with exception
logger.logError(err, 'Operation failed', { context: 'cleanup' });
```

## 8. Integration with External Loggers

### 8.1 Pino

```typescript
import { logger } from '@goodfoot/claude-code-hooks';
import pino from 'pino';

const pinoLogger = pino({ level: 'debug' });

logger.on('debug', (event) => pinoLogger.debug(event, event.message));
logger.on('info', (event) => pinoLogger.info(event, event.message));
logger.on('warn', (event) => pinoLogger.warn(event, event.message));
logger.on('error', (event) => pinoLogger.error(event, event.message));
```

### 8.2 Winston

```typescript
import { logger } from '@goodfoot/claude-code-hooks';
import winston from 'winston';

const winstonLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: 'hooks.log' })]
});

logger.on('debug', (e) => winstonLogger.debug(e.message, e));
logger.on('info', (e) => winstonLogger.info(e.message, e));
logger.on('warn', (e) => winstonLogger.warn(e.message, e));
logger.on('error', (e) => winstonLogger.error(e.message, e));
```

### 8.3 Custom Handler

```typescript
import { logger, type LogEvent, type LogLevel } from '@goodfoot/claude-code-hooks';

function sendToMonitoring(event: LogEvent) {
  fetch('https://monitoring.example.com/api/logs', {
    method: 'POST',
    body: JSON.stringify(event)
  }).catch(() => {
    // Silently ignore send failures
  });
}

// Only send warnings and errors
logger.on('warn', sendToMonitoring);
logger.on('error', sendToMonitoring);
```

## 9. Runtime Configuration

### 9.1 Set Log File at Runtime

```typescript
import { logger } from '@goodfoot/claude-code-hooks';

// Enable file logging
logger.setLogFile('/var/log/claude-hooks.log');

// Disable file logging
logger.setLogFile(null);
```

### 9.2 Check for Active Destinations

```typescript
if (logger.hasDestinations()) {
  logger.debug('Detailed info that costs to generate');
}
```

### 9.3 Close Logger

```typescript
// Flush and close file handle
logger.close();
```

## 10. Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_HOOKS_LOG_FILE` | Path to log file |

## 11. Best Practices

**Do:**

```typescript
// Log to file or handlers, not console
logger.info('Hook executed');

// Include context
logger.warn('Blocking command', { toolName, command });

// Use logError for exceptions
logger.logError(err, 'Handler failed');

// Clean up subscriptions
const unsub = logger.on('error', handler);
// ... later
unsub();
```

**Don't:**

```typescript
// Never log to console in hooks
console.log('Debug');  // BREAKS HOOK PROTOCOL!

// Don't ignore errors
try { ... } catch (e) {
  // Don't just swallow
  logger.logError(e, 'Operation failed');
}

// Don't forget to set context
logger.setContext(hookType, input);
```

## 12. Troubleshooting

### 12.1 Logs Not Appearing

1. Check `CLAUDE_CODE_HOOKS_LOG_FILE` is set
2. Verify directory exists and is writable
3. Check file permissions

```bash
# Test file creation
touch /tmp/hooks.log && rm /tmp/hooks.log
```

### 12.2 Too Verbose

Filter by level:

```bash
# Only errors
cat hooks.log | jq 'select(.level == "error")'
```

Or only subscribe to higher levels:

```typescript
// Only warn and error
logger.on('warn', handler);
logger.on('error', handler);
```

### 12.3 Performance Concerns

Logging is designed to be low-impact:
- Silent by default (no I/O unless configured)
- Handler errors are silently ignored
- File writes use synchronous I/O to avoid async complexity

</instructions>
