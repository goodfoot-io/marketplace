<instructions>

`@goodfoot/agent-hooks/codex` deliberately ships **no environment helpers**. Codex does not expose a Claude-equivalent of `$CLAUDE_ENV_FILE` or a `getProjectDir()` indirection — the same data is already present on every hook input.

Use the input fields documented below instead of inventing wrappers.

## Hook Context

Every hook receives a context object with the logger and (in future versions) other runtime helpers. Today the only documented field is `logger`.

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/agent-hooks/codex';

export default preToolUseHook({}, (input, { logger }) => {
  logger.info('Hook Context', {
    cwd: input.cwd,
    session_id: input.session_id,
    permission_mode: input.permission_mode,
    model: input.model
  });
  return preToolUseOutput({});
});
```

## Reading the Project Directory

Codex always sets `cwd` on the input to the project directory at dispatch time. Use it directly:

```typescript
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { sessionStartHook, sessionStartOutput } from '@goodfoot/agent-hooks/codex';

export default sessionStartHook({ matcher: 'startup' }, async (input) => {
  const conventions = await readFile(join(input.cwd, '.codex/conventions.md'), 'utf-8').catch(() => '');
  return sessionStartOutput({
    additionalContext: conventions || undefined
  });
});
```

## Persisting State Across Hook Invocations

Hooks run as **independent subprocesses**. There is no shared in-memory state and no Codex-managed env file. To share state between hooks, persist to disk keyed by `session_id`:

```typescript
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFile, readFile } from 'node:fs/promises';
import { sessionStartHook, sessionStartOutput, stopHook, stopOutput } from '@goodfoot/agent-hooks/codex';

function stateFile(sessionId: string): string {
  return join(tmpdir(), `codex-hooks-${sessionId}.json`);
}

// On SessionStart, record a value.
export const onStart = sessionStartHook({ matcher: 'startup' }, async (input) => {
  await writeFile(stateFile(input.session_id), JSON.stringify({ startedAt: Date.now() }));
  return sessionStartOutput({});
});

// On Stop, read it back.
export const onStop = stopHook({}, async (input, { logger }) => {
  try {
    const data = JSON.parse(await readFile(stateFile(input.session_id), 'utf-8')) as { startedAt: number };
    logger.info('Session duration', { ms: Date.now() - data.startedAt });
  } catch {
    // file missing — first run or cleared
  }
  return stopOutput({});
});
```

## Reading Environment Variables

Hook subprocesses inherit `process.env` from the Codex parent. Read host environment variables directly:

```typescript
const apiKey = process.env.MY_API_KEY;
```

There is **no** Codex-provided mechanism to inject variables into the shell of subsequent `shell` tool invocations from a hook. If you need that, modify the project's shell rc files or use a wrapper script.

## Detecting the Runtime

Codex hooks always run as Node child processes spawned by the Codex binary. The standard Node APIs apply:

```typescript
import { platform } from 'node:process';

if (platform === 'win32') {
  // Codex disables hook execution on Windows entirely — this branch is unreachable
  // in production, but useful as a defensive guard during cross-platform development.
}
```

## Summary

| Need | Codex-hooks approach |
|------|----------------------|
| Project directory | `input.cwd` |
| Session id | `input.session_id` |
| Transcript path | `input.transcript_path` (may be `null`) |
| Model id | `input.model` |
| Permission mode | `input.permission_mode` |
| Cross-hook state | File on disk keyed by `input.session_id` |
| Read host env | `process.env.MY_VAR` |
| Set env for downstream shell tools | Not supported by Codex — use rc files or wrappers |

</instructions>
