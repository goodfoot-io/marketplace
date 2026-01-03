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

```typescript
import { sessionStartHook, sessionStartOutput, persistEnvVar } from '@goodfoot/claude-code-hooks';

export default sessionStartHook({ matcher: 'startup' }, (input, { logger }) => {
  
  // Set NODE_ENV for the entire session
  persistEnvVar('NODE_ENV', 'development');
  
  // Set multiple
  // persistEnvVars({ API_KEY: '...', DEBUG: 'true' });

  return sessionStartOutput({});
});
```

*Warning: Calling `persistEnvVar` in other hooks (like PreToolUse) will throw an error.*

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