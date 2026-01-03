# Environment & Context

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Output Builders](output-builders.md)

<instructions>

## 1. Accessing the Environment

Hooks run in a constrained environment. Use these helpers to orient yourself.

```typescript
import { 
  getProjectDir, 
  isRemoteEnvironment, 
  CLAUDE_ENV_VARS 
} from '@goodfoot/claude-code-hooks';
```

### `getProjectDir()`
Returns the absolute path to the project root.
*   **Use case:** Finding `.claude/config.json` or reading project-specific rules.

### `isRemoteEnvironment()`
Returns `true` if running in a web/remote container.
*   **Use case:** Disabling GUI tools or network-heavy operations.

## 2. Persisting Environment Variables

**Restriction:** You can ONLY persist environment variables during **SessionStart**.

The `persistEnvVar` and `persistEnvVars` functions are available as context parameters in SessionStart hooks:

```typescript
import { sessionStartHook, sessionStartOutput } from '@goodfoot/claude-code-hooks';

export default sessionStartHook({ matcher: 'startup' }, (input, { logger, persistEnvVar }) => {
  // Set NODE_ENV for the entire session
  persistEnvVar('NODE_ENV', 'development');

  return sessionStartOutput({});
});
```

**Using `persistEnvVars` to set multiple variables at once:**

```typescript
export default sessionStartHook({ matcher: 'startup' }, (input, { logger, persistEnvVars }) => {
  persistEnvVars({
    NODE_ENV: 'development',
    API_KEY: process.env.MY_API_KEY ?? 'default',
    DEBUG: 'true'
  });

  return sessionStartOutput({});
});
```

*Note: `persistEnvVar` and `persistEnvVars` are only available in SessionStart hooks.*

## 3. Hook Context

Every hook receives a context object with useful metadata. Use the `logger` to inspect these values safely.

```typescript
export default preToolUseHook({}, (input, { logger }) => {
  logger.info('Hook Context', {
    cwd: input.cwd,
    sessionId: input.sessionId,
    permissionMode: input.permissionMode
  });
  
  return preToolUseOutput({});
});
```

</instructions>