# Environment Utilities Reference

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Output Builders](output-builders.md) | [Logging](logging.md)

<instructions>

## 1. Overview

The `@goodfoot/claude-code-hooks` library provides utilities for working with Claude Code's environment variables and persisting configuration across sessions.

```typescript
import {
  getProjectDir,
  getEnvFilePath,
  isRemoteEnvironment,
  persistEnvVar,
  persistEnvVars,
  CLAUDE_ENV_VARS
} from '@goodfoot/claude-code-hooks';
```

## 2. Claude Code Environment Variables

Claude Code sets these environment variables when running hooks:

| Variable | Description | Available In |
|----------|-------------|--------------|
| `CLAUDE_PROJECT_DIR` | Absolute path to project root | All hooks |
| `CLAUDE_ENV_FILE` | Path to file for persisting env vars | SessionStart only |
| `CLAUDE_CODE_REMOTE` | `"true"` if running remotely | All hooks |

## 3. Utility Functions

### 3.1 getProjectDir()

Gets the Claude Code project directory.

```typescript
import { getProjectDir } from '@goodfoot/claude-code-hooks';

const projectDir = getProjectDir();
if (projectDir) {
  const configPath = `${projectDir}/.claude/config.json`;
  // Use project-relative paths
}
```

**Returns:** `string | undefined` - The project directory, or undefined if not set.

### 3.2 getEnvFilePath()

Gets the path to the environment file for persisting variables (SessionStart hooks only).

```typescript
import { getEnvFilePath } from '@goodfoot/claude-code-hooks';

const envFile = getEnvFilePath();
if (envFile) {
  // We're in a SessionStart hook and can persist env vars
}
```

**Returns:** `string | undefined` - The env file path, or undefined if not in a SessionStart hook.

### 3.3 isRemoteEnvironment()

Checks if running in a remote (web) environment vs local CLI.

```typescript
import { isRemoteEnvironment } from '@goodfoot/claude-code-hooks';

if (isRemoteEnvironment()) {
  // Use web-compatible approaches
  // Some local CLI features may not be available
} else {
  // Can use full local CLI features
}
```

**Returns:** `boolean` - true if running remotely, false if running locally.

### 3.4 persistEnvVar()

Persists an environment variable for use in subsequent bash commands. **Only works in SessionStart hooks.**

```typescript
import { sessionStartHook, sessionStartOutput, persistEnvVar } from '@goodfoot/claude-code-hooks';

export default sessionStartHook({}, (input, { logger }) => {
  // Persist environment variables for the session
  persistEnvVar('NODE_ENV', 'production');
  persistEnvVar('API_KEY', process.env.MY_API_KEY ?? 'default');
  persistEnvVar('PATH', `${process.env.PATH}:./node_modules/.bin`);

  return sessionStartOutput({});
});
```

**Parameters:**
- `name: string` - The environment variable name
- `value: string` - The value (automatically shell-escaped)

**Throws:** Error if not in a SessionStart hook (CLAUDE_ENV_FILE not set).

### 3.5 persistEnvVars()

Persists multiple environment variables at once.

```typescript
import { persistEnvVars } from '@goodfoot/claude-code-hooks';

persistEnvVars({
  NODE_ENV: 'production',
  API_KEY: 'secret',
  DEBUG: 'false'
});
```

**Parameters:**
- `vars: Record<string, string>` - Object mapping variable names to values

**Throws:** Error if not in a SessionStart hook.

## 4. Constants

### 4.1 CLAUDE_ENV_VARS

Object containing the environment variable names as constants.

```typescript
import { CLAUDE_ENV_VARS } from '@goodfoot/claude-code-hooks';

// Access raw environment variables
const projectDir = process.env[CLAUDE_ENV_VARS.PROJECT_DIR];
const envFile = process.env[CLAUDE_ENV_VARS.ENV_FILE];
const isRemote = process.env[CLAUDE_ENV_VARS.REMOTE] === 'true';
```

| Constant | Value | Description |
|----------|-------|-------------|
| `PROJECT_DIR` | `'CLAUDE_PROJECT_DIR'` | Project root directory |
| `ENV_FILE` | `'CLAUDE_ENV_FILE'` | Env file path (SessionStart only) |
| `REMOTE` | `'CLAUDE_CODE_REMOTE'` | Remote environment flag |

## 5. Common Use Cases

### 5.1 Project-Relative File Access

```typescript
import { preToolUseHook, preToolUseOutput, getProjectDir } from '@goodfoot/claude-code-hooks';
import { existsSync, readFileSync } from 'fs';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  const projectDir = getProjectDir();

  if (projectDir) {
    // Check for project-specific config
    const configPath = `${projectDir}/.claude/security-rules.json`;
    if (existsSync(configPath)) {
      const rules = JSON.parse(readFileSync(configPath, 'utf-8'));
      // Apply rules...
    }
  }

  return preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } });
});
```

### 5.2 Session Environment Setup

```typescript
import { sessionStartHook, sessionStartOutput, persistEnvVars, getProjectDir } from '@goodfoot/claude-code-hooks';
import { existsSync, readFileSync } from 'fs';

export default sessionStartHook({ matcher: 'startup' }, (input, { logger }) => {
  const projectDir = getProjectDir();

  // Load environment from project .env file
  if (projectDir) {
    const envPath = `${projectDir}/.env.claude`;
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf-8');
      const vars: Record<string, string> = {};

      for (const line of envContent.split('\n')) {
        const match = line.match(/^([A-Z_]+)=(.*)$/);
        if (match) {
          vars[match[1]] = match[2];
        }
      }

      persistEnvVars(vars);
      logger.info('Loaded environment from .env.claude', { count: Object.keys(vars).length });
    }
  }

  return sessionStartOutput({});
});
```

### 5.3 Remote Environment Detection

```typescript
import { preToolUseHook, preToolUseOutput, isRemoteEnvironment } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  const command = (input.toolInput as { command?: string })?.command ?? '';

  // Block certain commands in remote environments
  if (isRemoteEnvironment()) {
    if (command.includes('sudo') || command.includes('docker')) {
      return preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: 'This command is not available in remote environments'
        }
      });
    }
  }

  return preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } });
});
```

</instructions>
