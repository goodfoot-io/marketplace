# `@goodfoot/agent-hooks`

**Build AI coding agent hooks in TypeScript — one package, any supported agent.**

Compiled bundles omit inline sourcemaps by default. Pass `--sourcemap` when original TypeScript locations are needed in runtime stack traces.

`@goodfoot/agent-hooks` is the unified successor to `@goodfoot/claude-code-hooks` and
`@goodfoot/codex-hooks`: a shared agent-neutral core (hook factory primitive, transport
driver, `Logger`, env/stdin utilities) with a per-agent entry point on top. Write
TypeScript hooks, compile them with the bundled CLI, and run the resulting
self-contained executables under Claude Code, Codex, OpenCode, or Antigravity.

**Status: `1.0.8`.** Four host entry points ship: `@goodfoot/agent-hooks/claude-code`
(full parity with `@goodfoot/claude-code-hooks`), `@goodfoot/agent-hooks/codex` (full
parity with `@goodfoot/codex-hooks`), `@goodfoot/agent-hooks/opencode` (native support
for OpenCode's in-process plugin model — see [OpenCode](#opencode) below), and
`@goodfoot/agent-hooks/antigravity` (five typed events, host-native output builders,
manifest generation, scaffolding, and an exit-0 payload transport). The Antigravity
surface is pinned to and behaviorally verified against `agy` 1.1.22.

## Install

Two things ship under the `agent-hooks` name. The **npm package** is the hook API and the
compiler CLI. The **plugin** carries the `agent-hooks` skill, which teaches a coding agent
how to write and compile hooks against this package — install it in whichever agent you
develop with.

### The npm package

```bash
yarn add @goodfoot/agent-hooks
# or npm install, pnpm, etc.
```

### The plugin, for development

All four hosts install from
[`goodfoot-io/marketplace`](https://github.com/goodfoot-io/marketplace). Claude Code and
Codex add the repository as a marketplace and install by name. Antigravity installs one
plugin root at a time. OpenCode needs a checkout, because these plugin packages are not
published to npm.

Note that the plugin and the npm package version independently — the plugin version you
install will not match the package version above.

#### Claude Code

```bash
claude plugin marketplace add goodfoot-io/marketplace
claude plugin install agent-hooks@goodfoot
```

Verify with `claude plugin list` — `agent-hooks@goodfoot` should be listed as enabled.
`claude plugin details agent-hooks` reports the component inventory, confirming the skill
itself arrived rather than just the plugin.

#### Codex

```bash
codex plugin marketplace add goodfoot-io/marketplace
codex plugin add agent-hooks@goodfoot
```

The marketplace source must be a repository, git URL, or directory; passing the manifest
path itself is rejected. A bare plugin name is rejected even when exactly one marketplace
is configured — qualify it as `agent-hooks@goodfoot` or pass `--marketplace goodfoot`. If
you set `CODEX_HOME`, create that directory first; Codex will not create it and fails with
`failed to resolve CODEX_HOME`.

Verify with `codex plugin list`, which lists every marketplace plugin with a `STATUS`
column. Do not use `codex plugin list --json` for this: on codex-cli 0.150.1 its
`available` array is empty even when the plain listing shows all seven plugins, so a
correctly installed plugin can look missing. The skill tree lands under
`$CODEX_HOME/plugins/cache/goodfoot/agent-hooks/<version>/skills`.

#### Antigravity

`agy` installs one plugin root at a time, from a git URL with the in-repo path appended:

```bash
agy plugin install https://github.com/goodfoot-io/marketplace.git/plugins-antigravity/agent-hooks
```

There is no marketplace form that installs several at once: pointing `agy plugin install`
at the repository root is rejected with `could not detect plugin structure`, as is the
`#subdir` fragment form other tools accept. A local path works the same way: `agy plugin
install ./plugins-antigravity/agent-hooks`.

To add the sibling plugins, repeat the command for each root you want —
`plugins-antigravity/` carries `agent-hooks`, `agent-skills`, `claude-code-skill-reader`,
`gmail`, `goodfoot`, `jsdoczoom`, and `linear`.

A successful install reports `skills : 1 processed`; `agents`, `commands`, `mcpServers`,
and `hooks` report `skipped (not found)`, expected for a skills-only plugin. Files land
in `~/.gemini/config/plugins/agent-hooks/`. Verify with `agy plugin list`, which reports
`"components": ["skills"]` for the installed plugin.

This marketplace plugin installs the authoring skill only. Hook projects use the npm
package separately: import `@goodfoot/agent-hooks/antigravity` and compile with
`agent-hooks --agent antigravity`. The compiler writes the host-native `hooks.json` at
the plugin root plus its executable bundles under `bin/`; install that resulting plugin
root with `agy plugin install <dir>`. Scaffolding an Antigravity hook project also emits
the root `plugin.json` required by that install command.

#### OpenCode

These plugin packages are not published to npm, so `opencode plugin` takes a path into a
checkout rather than a module name:

```bash
git clone https://github.com/goodfoot-io/marketplace.git
opencode plugin "$PWD/marketplace/plugins-opencode/agent-hooks"
```

Pass a path, not a bare name. `opencode plugin` resolves a specifier containing a
separator as a path — absolute, `./`-prefixed, and plain relative forms all load on
OpenCode 1.18.23. A single segment with no separator (`agent-hooks`) is instead resolved as an
npm package name and silently fails to load, with nothing logged. The absolute form
above avoids the ambiguity.

That is the whole install — no `opencode.json` editing. `opencode plugin` writes only the
top-level `plugin` key, and OpenCode keeps `plugin` and `skills` as disjoint config keys,
so registering the module would not by itself surface its skills. The plugin closes that
gap from the inside: its `config` hook runs against the resolved config before use and
appends its own bundled `skills/` directory to `skills.paths`, resolved relative to
wherever the package was installed. Installing is enough.

Without flags this installs into the current project's `.opencode/opencode.json`. Add
`-g` to install into the global config instead.

Verify with `opencode debug skill`. Its output is large and embeds whole skill bodies:
redirect it to a file and search there. Piping it to `head` truncates the JSON mid-string
and reports a present skill as missing.

Installing this skill is separate from compiling hooks *for* OpenCode, covered in
[OpenCode](#opencode) below.

#### Updating an existing install

Re-running the install command does not move the version on every host.

- **Claude Code** — `plugin install` is a no-op once the plugin is installed: it reports
  success and leaves the old version pinned. Use `claude plugin marketplace update
  goodfoot`, then `claude plugin update agent-hooks@goodfoot`. A restart applies it.
- **Codex** — `codex plugin marketplace upgrade goodfoot` moves the installed version;
  there is no separate plugin-update command.
- **Antigravity** — re-run `agy plugin install`.
- **OpenCode** — pull the checkout; the plugin resolves its skills from that directory, so
  no reinstall is needed. Re-run with `-f` to replace a pinned plugin version.

Check the installed version rather than the exit code. Several hosts report success while
leaving a stale version in place, and a newer directory in a host's cache proves only that
it was fetched, not that it is the active install.

## Quick Start

### 1. Write a hook

Import factories from your target agent's entry point. **Note:** you must use
`export default` and the factory function — the CLI's build step relies on it.

Claude Code (`@goodfoot/agent-hooks/claude-code`):

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/agent-hooks/claude-code';

export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
  const { command } = input.tool_input as { command: string };

  // Use logger, NEVER console.log
  logger.info('Checking command', { command });

  if (command.trim() === 'ls') {
    return preToolUseOutput({
      systemMessage: 'Auto-approved: ls command is safe.',
      hookSpecificOutput: { permissionDecision: 'allow' },
    });
  }

  return preToolUseOutput({ systemMessage: 'Command passed through for review.' });
});
```

Codex (`@goodfoot/agent-hooks/codex`):

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/agent-hooks/codex';

export default preToolUseHook(async (input, { logger }) => {
  logger.info('Checking tool call', { tool: input.tool_name });
  return preToolUseOutput({});
});
```

### 2. Compile

The `--agent` flag is required and never inferred — always pass it explicitly:

```bash
npx -y @goodfoot/agent-hooks --agent claude-code -i "hooks/**/*.ts" -o "./dist/hooks.json"
npx -y @goodfoot/agent-hooks --agent codex -i "src/**/*.ts" -o ".codex/hooks.json"
```

Or scaffold a starter project:

```bash
npx -y @goodfoot/agent-hooks --agent claude-code --scaffold ./my-hooks --hooks Stop,SubagentStop -o dist/hooks.json
```

Run `npx -y @goodfoot/agent-hooks --help` for the full flag reference, including
Codex-specific options (e.g. `--plugin-root`), `--log`/`--log-env-var`, `--executable`,
and `--loader`.

### 3. Run

The compiled output is a self-contained executable per hook; point your agent's hook
configuration (Claude Code's `hooks.json`, Codex's plugin `hooks.json`) at the compiled
files, same as with the deprecated per-agent packages.

## Hook events

Each entry point exports one factory function and one matching output builder per
supported event. Import both from the same entry point (`@goodfoot/agent-hooks/claude-code`
or `@goodfoot/agent-hooks/codex`) — do not mix events or output builders across agents.

- **Claude Code** (`src/agents/claude-code`): the full 30-factory surface ported from
  `@goodfoot/claude-code-hooks`, including `preToolUseHook`, `postToolUseHook`,
  `sessionStartHook`, `notificationHook`, `permissionRequestHook`, `elicitationHook`,
  task/teammate hooks, `worktreeCreateHook`, and the `tool-helpers` type guards
  (`isBashTool`, `isEditTool`, …).
- **Codex** (`src/agents/codex`): the 10-factory surface ported from
  `@goodfoot/codex-hooks`, including `preToolUseHook`, `postToolUseHook`,
  `sessionStartHook`, `stopHook`, `subagentStartHook`/`subagentStopHook`,
  `userPromptSubmitHook`, `preCompactHook`/`postCompactHook`, and `permissionRequestHook`.

## OpenCode

OpenCode's plugin model is a long-lived, in-process JS module with a stable callback map
(`Hooks`) — not the one-shot stdin/stdout command-hook model Claude Code and Codex use, so
`@goodfoot/agent-hooks/opencode` does **not** route through `defineHook`/`Transport`/`drive`.
It ships its own primitives instead:

```typescript
import { defineOpenCodePlugin, guardAdvisory, createRootSessionRegistry } from '@goodfoot/agent-hooks/opencode';

const sessions = createRootSessionRegistry();

export default defineOpenCodePlugin({
  id: 'my-plugin',
  server: async ({ client }) => ({
    event: guardAdvisory('event', async ({ event }) => {
      if (event.type === 'session.created') {
        sessions.observe(event.properties.info.id, event.properties.info.parentID);
      } else if (event.type === 'session.updated') {
        sessions.observeResumed(event.properties.info.id, event.properties.info.parentID);
      }
    }, 'continue'),

    'tool.execute.before': async (input, output) => {
      if (input.tool === 'bash' && sessions.isRoot(input.sessionID)) {
        output.args = { ...output.args, timeout: 30_000 };
      }
    },
  }),
});
```

- **`defineOpenCodePlugin({ id, server })`** validates and returns the `{ id, server }`
  module shape OpenCode's real loader (`getServerPlugin`) accepts as a default export —
  a bare `server` function also satisfies the loader and needs no wrapper.
- **`guardAdvisory(name, handler, policy, onError?)`** applies the same opt-in
  `"continue"` fail-open policy described below, restricted at the type level to
  *advisory* callback names — `permission.ask` is the one policy-enforcing callback
  (a real allow/deny security decision) and is rejected at compile time, since silently
  swallowing its failure would skip that decision instead of making it.
- **`createRootSessionRegistry()`** tracks session parentage and resumption across the
  plugin's lifetime: a resumed session does not necessarily re-emit `session.created`, so
  `observe`/`observeResumed` record first-seen-event distinctly and `isRoot`/`isResumed`
  answer from that record.

`Hooks` also includes `config?: (input: Config) => Promise<void>`, which runs against the
resolved config before use and can mutate it. That is how a plugin contributes
configuration it would otherwise need the user to hand-write — the plugins in this
repository use it to append their own `skills/` directory to `skills.paths`, so installing
one delivers its skills without any `opencode.json` edit.

Compile with the same unified CLI, but `--agent opencode` treats `-o`/`--output` as a
plugin-artifact **directory**, not a manifest path — OpenCode config references built
files directly, so there is no `hooks.json`-equivalent manifest or shebang wrapper:

```bash
npx -y @goodfoot/agent-hooks --agent opencode -i "src/**/*.ts" -o "./.opencode/plugin"
```

Point `opencode.json`'s plugin list (or the equivalent config in your OpenCode host) at
the compiled `.mjs` file(s) under that output directory.

`@opencode-ai/plugin` is an **optional peer dependency** — only required if you import
`@goodfoot/agent-hooks/opencode`; Claude Code and Codex hook authors never need it
installed.

## Fail-open advisory hooks

Both entry points support the same opt-in `unexpectedError: "continue"` hook config used
by the deprecated packages: unexpected runtime failures (stdin read, parse, handler
execution, output serialization, stdout write, logger cleanup) are swallowed into the
empty response instead of surfacing a failed-hook error. It is rejected — at the type
level and at runtime — for events where fail-open would be unsafe (`PreToolUse`,
`PermissionRequest`, blocking `Stop`/`SubagentStop`, `WorktreeCreate`/`WorktreeRemove` on
Claude Code; permission/blocking events on Codex). A thrown `HookBlockError` always wins
over this policy and still blocks.

## Core API

The root export (`@goodfoot/agent-hooks`, no subpath) exposes only the agent-neutral
core that each entry point is built on. It has no knowledge of exit codes or stdout
policy — that's owned entirely by each agent's transport. Use this if you're extending
an existing entry point or adding support for a new agent; hook authors targeting
Claude Code or Codex should import from the per-agent entry point instead.

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

## Exports map policy

The `exports` map is an explicit, closed list of subpaths. It deliberately
does **not** include a `./*` wildcard subpath (unlike the deprecated source
packages): a wildcard would make every internal module independently importable,
defeating the root-export lint. This is a permanent rule enforced by the
package's own test suite (`tests/export-surface.test.ts`), which also carries
a fail-case fixture proving the check rejects a wildcard entry.

## Migrating from `@goodfoot/claude-code-hooks` / `@goodfoot/codex-hooks`

Both source packages are deprecated in favor of this one. Migration is a dependency
swap, not a behavior change:

1. Replace the dependency: `@goodfoot/claude-code-hooks` → `@goodfoot/agent-hooks`, or
   `@goodfoot/codex-hooks` → `@goodfoot/agent-hooks`.
2. Update imports to the matching entry point: `@goodfoot/agent-hooks/claude-code` or
   `@goodfoot/agent-hooks/codex`. Factory and output-builder names are unchanged.
3. Update `build` scripts and any committed `hooks.json` to invoke the `agent-hooks` CLI
   binary with the required `--agent <claude-code|codex>` flag.

## Development

```bash
yarn workspace @goodfoot/agent-hooks run typecheck
yarn workspace @goodfoot/agent-hooks run build
yarn workspace @goodfoot/agent-hooks run lint
yarn workspace @goodfoot/agent-hooks run test
```
