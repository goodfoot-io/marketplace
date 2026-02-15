<instructions>

## Getting the Project Directory

```typescript
import { getProjectDir } from '@goodfoot/claude-code-hooks';

const projectDir = getProjectDir();  // Returns absolute path or null
```

Returns the absolute path to the project root (where `.claude/` directory is located).

**Use cases:**
- Finding `.claude/config.json` or `.claude/settings.json`
- Reading project-specific rules or templates
- Resolving relative paths in tool inputs

## Persisting Environment Variables into Bash Tools

`persistEnvVar` and `persistEnvVars` inject variables into **Bash tool invocations only**. They are callable in SessionStart hooks and write `export` statements to `$CLAUDE_ENV_FILE`, which Claude Code sources before each Bash tool shell. Other hooks (Stop, PostToolUse, etc.) run as separate subprocesses and **do not** receive these variables via `process.env`.

```typescript
import { sessionStartHook, sessionStartOutput } from '@goodfoot/claude-code-hooks';

export default sessionStartHook({ matcher: 'startup' }, (input, { logger, persistEnvVar }) => {
  // Available in Bash tool shells for the rest of the session
  persistEnvVar('NODE_ENV', 'development');

  return sessionStartOutput({});
});
```

Use `persistEnvVars` for multiple variables:

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

### Sharing data between hooks

To pass data from a SessionStart hook to a Stop or other hook, use file-based persistence keyed by `input.session_id` (available on every hook input). Do not rely on `persistEnvVar` for this — those values will be absent from `process.env` in non-Bash hook subprocesses.

## Hook Context

Every hook receives a context object with useful metadata. Use the `logger` to inspect these values safely.

```typescript
export default preToolUseHook({}, (input, { logger }) => {
  logger.info('Hook Context', {
    cwd: input.cwd,
    session_id: input.session_id,
    permission_mode: input.permission_mode
  });

  return preToolUseOutput({});
});
```

## Other Helpers

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
