# `@goodfoot/agent-hooks`

Unified agent hooks library for AI coding CLIs. One package consolidating the
runtime previously split across `@goodfoot/claude-code-hooks` and
`@goodfoot/codex-hooks`, with per-agent entry points.

**Status: `0.1.0` — core only.** This release ships the agent-neutral core:
the shared driver, transport abstraction, hook factory primitive, `Logger`,
and env utilities. Per-agent entry points (`@goodfoot/agent-hooks/claude-code`,
`/codex`, `/antigravity`) do not exist yet; they are added to the package
`exports` map only in the version that lands their implementation — never
pre-declared.

## Exports map policy

The `exports` map is an explicit, closed list of subpaths. It deliberately
does **not** include a `./*` wildcard subpath (unlike the source packages):
a wildcard would make every internal module independently importable,
defeating the root-export lint. This is a permanent rule enforced by the
package's own test suite (`tests/export-surface.test.ts`), which also carries
a fail-case fixture proving the check rejects a wildcard entry.

## Core API

### `defineHook(eventName, config, handler, policyGate?)`

Factory primitive every agent's per-event factory builds on:

```typescript
import { defineHook } from '@goodfoot/agent-hooks';

const hook = defineHook(
  'UserPromptSubmit',
  { unexpectedError: 'continue' },
  async (input, { logger }) => {
    logger.info('Enriching prompt');
    return { additionalContext: '…' };
  },
  // Optional per-event policy gate injected by each agent; core never
  // hardcodes an event list. Returning false (or throwing) fails closed.
  (eventName, policy) => policy === undefined || policy === 'continue',
);
```

### `Transport` and `drive(transport, hookFn)`

Core owns the try/catch skeleton — stdin read, JSON parse, handler invocation,
outcome classification, buffered single-write emission, process exit — and has
no knowledge of exit codes or stdout policy. Every wire decision belongs to
the agent's transport:

```typescript
import { drive, type Transport } from '@goodfoot/agent-hooks';

const transport: Transport<MyOutput> = {
  finalize: (outcome) => {
    switch (outcome.kind) {
      case 'response':
        return { stdout: JSON.stringify(outcome.output ?? {}), exitCode: 0 };
      case 'block':
        return { stderr: outcome.error.message, exitCode: 2 };
      default:
        return { stderr: 'internal error', exitCode: 1 };
    }
  },
};

await drive(transport, myHook);
```

`finalize(outcome)` is a pure mapping called exactly once per invocation. The
optional `rawStdout(output)` predicate declares which returned outputs carry
a plain-text protocol payload (e.g. worktree events whose stdout the host
reads verbatim); matching outputs are classified as `{ kind: "rawStdout",
stdout }` instead of `response`. Returned outputs are never modified by core.

### Outcomes

`HookOutcome<TOutput>` is a discriminated union:

| `kind` | Payload | Produced when |
|---|---|---|
| `response` | `output: TOutput \| undefined` | handler returned normally (`undefined` = empty response), or a throw was swallowed under `unexpectedError: "continue"` |
| `block` | `error: HookBlockError` | handler threw a `HookBlockError` |
| `handlerError` | `error: unknown; phase` | any other failure, classified at its phase (`read`, `parse`, `handler`, …) |
| `rawStdout` | `stdout: string` | the transport's `rawStdout` predicate matched a normal return |

### `HookBlockError`

```typescript
import { HookBlockError } from '@goodfoot/agent-hooks';

throw new HookBlockError('blocked: writes outside workspace', { tool: 'Bash' });
```

`drive()` classifies a caught `HookBlockError` **before** consulting the
`unexpectedError` policy: it always routes to the `block` outcome, under every
policy value. This is what lets an advisory event's intentional block survive
a crash mid-computation instead of being silently swallowed by the
fail-open policy. Any other throw remains subject to policy exactly as in the
source packages: `"continue"` swallows it into the empty response;
the default `"error"` policy yields the `handlerError` outcome. A normally
returned value always passes through to `finalize` unmodified — core never
inspects returned output for block-signaling fields.

Agents may subclass or re-export `HookBlockError`; each agent's transport
owns the wire translation of the `block` outcome for its events.

### `unexpectedError` policy

- `"error"` (default): unexpected failures surface to the transport as
  `handlerError` outcomes.
- `"continue"`: opt-in fail-open for advisory hooks — unexpected failures are
  swallowed into the empty response, reported through the optional
  `onUnexpectedError` callback and the logger. Never use it for hooks that
  enforce permission, safety, or policy decisions; a `HookBlockError` still
  gets through (see above), but ordinary bugs will not.

Malformed or unreadable stdin is classified at its phase like any other
unexpected failure (`handlerError` with `phase: "parse"`) and logged as
`Failed to parse stdin JSON`; each agent's transport decides the wire shape
for that classification.

### `Logger`

Structured logging ported behavior-identically from the source packages:
silent by default, never writes stdout/stderr, optional JSON Lines file output
via `AGENT_HOOKS_LOG_FILE`, event subscription via `logger.on(level, handler)`.

## Development

```bash
yarn workspace @goodfoot/agent-hooks run typecheck
yarn workspace @goodfoot/agent-hooks run build
yarn workspace @goodfoot/agent-hooks run lint
yarn workspace @goodfoot/agent-hooks run test
```
