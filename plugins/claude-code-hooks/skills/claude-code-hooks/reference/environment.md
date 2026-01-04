# Environment & Context

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Output Builders](output-builders.md)

<instructions>

## 1. Getting the Project Directory

```typescript
import { getProjectDir } from '@goodfoot/claude-code-hooks';

const projectDir = getProjectDir();  // Returns absolute path or null
```

Returns the absolute path to the project root (where `.claude/` directory is located).

**Use cases:**
- Finding `.claude/config.json` or `.claude/settings.json`
- Reading project-specific rules or templates
- Resolving relative paths in tool inputs

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

## 4. Other Helpers

### `isRemoteEnvironment()`

Returns `true` if running in a web/remote container (rare use case).

```typescript
import { isRemoteEnvironment } from '@goodfoot/claude-code-hooks';

if (isRemoteEnvironment()) {
  // Skip operations that require local GUI or network access
}
```

### `CLAUDE_ENV_VARS`

Constants for Claude Code environment variable names:

```typescript
import { CLAUDE_ENV_VARS } from '@goodfoot/claude-code-hooks';

// CLAUDE_ENV_VARS.PROJECT_DIR - Project directory env var name
// CLAUDE_ENV_VARS.ENV_FILE - Environment file path env var name
```

</instructions>