# @goodfoot/claude-code-hooks

> **Deprecated.** `@goodfoot/claude-code-hooks` is superseded by [`@goodfoot/agent-hooks`](https://www.npmjs.com/package/@goodfoot/agent-hooks) (`@goodfoot/agent-hooks/claude-code`), which consolidates Claude Code, Codex, and Antigravity hook support behind one package. This package receives security and data-loss fixes only for six months following this notice, then no further updates. New work should target `@goodfoot/agent-hooks/claude-code`.

**Build Claude Code hooks in TypeScript.**

This package is not just a library; it is a **build system** and a **runtime wrapper**. You write TypeScript, this package compiles it into self-contained executables, and _those_ are what Claude runs.

## Skills

Load the "claude-code-hooks:sdk" skill to enable Claude to use this package.

Run:

`claude plugin marketplace add goodfoot-io/marketplace && claude plugin install claude-code-hooks@goodfoot"`

then:

`claude "Load the 'claude-code-hooks:sdk' skill then scaffold a new hook package in ./packages/hooks that outputs to '.claude/hooks/hooks.json' and contains an example SessionStart hook."`

later:

`claude plugin uninstall claude-code-hooks@goodfoot`

## ⚡ Quick Start

### 1. Install

```bash
yarn add @goodfoot/claude-code-hooks
# or npm install, pnpm, etc.
```

### 2. Write a Hook

Create `hooks/allow-ls.ts`. **Note:** You _must_ use `export default` and the factory function.

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
  const { command } = input.tool_input as { command: string };

  // Use logger, NEVER console.log
  logger.info('Checking command', { command });

  if (command.trim() === 'ls') {
    return preToolUseOutput({
      systemMessage: 'Auto-approved: ls command is safe.',
      hookSpecificOutput: { permissionDecision: 'allow' }
    });
  }

  return preToolUseOutput({
    systemMessage: 'Command passed through for review.'
  });
});
```

### 3. Compile

The CLI compiles your TS into `.mjs` and generates the `hooks.json` manifest.

```bash
# -i: Input glob
# -o: Output manifest path
npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o "dist/hooks.json"
```

Markdown prompt assets work out of the box via the default `.md=text` loader:

```typescript
import preamble from './prompts/session-start.md';
import { sessionStartHook, sessionStartOutput } from '@goodfoot/claude-code-hooks';

export default sessionStartHook({}, () => {
  return sessionStartOutput({
    hookSpecificOutput: { additionalContext: preamble }
  });
});
```

For other asset types, opt in explicitly:

```bash
npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o "dist/hooks.json" --loader .txt=text
```

### 4. Configure Claude

Tell Claude where your hooks are. The location depends on your setup:

---

## Scaffolding a New Project

Bootstrap a complete hook project with TypeScript, testing, and build configuration:

```bash
npx @goodfoot/claude-code-hooks --scaffold /path/to/my-hooks --hooks Stop,SubagentStop -o ./hooks.json
```

This creates a ready-to-use project structure:

```
my-hooks/
├── src/
│   ├── stop.ts              # Hook implementation
│   └── subagent-stop.ts     # Hook implementation
├── test/
│   ├── stop.test.ts         # Vitest tests
│   └── subagent-stop.test.ts
├── package.json             # Dependencies + build script
├── tsconfig.json            # TypeScript config
├── vitest.config.ts         # Test config
├── biome.json               # Linting config
└── CLAUDE.md                # Skill loading instruction
```

**Next steps:**

```bash
cd my-hooks
npm install
npm run build   # Outputs hooks.json to specified -o path
npm test        # Run tests
```

### Available Hook Types

The `--hooks` argument accepts a comma-separated list of any of these 22 event types:

| Hook Type            | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `PreToolUse`         | Before a tool executes (allow/deny/modify)                               |
| `PostToolUse`        | After a tool completes successfully                                      |
| `PostToolUseFailure` | After a tool fails                                                       |
| `PostToolBatch`      | Once after every tool call in a batch resolves                          |
| `Notification`       | When Claude requests permissions                                         |
| `UserPromptExpansion` | When a slash command or MCP prompt is expanded                          |
| `UserPromptSubmit`   | When user submits a prompt                                               |
| `SessionStart`       | When session begins                                                      |
| `SessionEnd`         | When session terminates                                                  |
| `Stop`               | After main agent finishes                                                |
| `StopFailure`        | When session stops due to an error                                       |
| `SubagentStart`      | When an Agent tool starts                                                |
| `SubagentStop`       | When an Agent tool completes                                             |
| `PreCompact`         | Before context compaction                                                |
| `PostCompact`        | After context compaction completes                                       |
| `PermissionRequest`  | When permission is requested                                             |
| `PermissionDenied`   | When a permission request is denied; optionally retry via output         |
| `Setup`              | On init, install, or update events                                       |
| `TaskCreated`        | When a new task is created and assigned to a teammate                    |
| `CwdChanged`         | When Claude Code's working directory changes; return `watchPaths` to register paths for `FileChanged` |
| `FileChanged`        | When a watched file changes on disk (`change`, `add`, or `unlink`); return `watchPaths` to update the watched set |
| `MessageDisplay`     | While an assistant message streams; display-only — replace the on-screen delta via `displayContent` |

Hook names are case-insensitive: `stop`, `Stop`, and `STOP` all work.

---

**Standalone Project:**

```bash
# In ~/.claude/config.json or project-local .claude/config.json
{
  "hooks": "/absolute/path/to/your/project/dist/hooks.json"
}
```

**Claude Code Plugin:**
Plugins automatically load `hooks.json` from the plugin root. Place your output there:

```bash
npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o "./hooks.json"
```

The `CLAUDE_PLUGIN_ROOT` variable is set automatically, so paths resolve correctly.

**User-level Hooks:**
For hooks that apply to all sessions, build to `~/.claude/hooks/`:

```bash
npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o ~/.claude/hooks/hooks.json
```

---

## 💀 The "Third Rail" (Critical Safety Rules)

Violating these rules will cause your hooks to fail silently or block Claude entirely.

1.  **NO `console.log`**: The hook communicates with Claude via `stdout`. If you print "Hello world", you corrupt the JSON protocol.
    - **Bad:** `console.log("Checking command")`
    - **Good:** `logger.info("Checking command")`
2.  **Relative Paths via Environment Variable**: The generated `hooks.json` uses `node $CLAUDE_PLUGIN_ROOT/hooks/bin/` paths.
    - Compiled hooks are placed in a `bin/` subdirectory relative to `hooks.json`.
    - The `$CLAUDE_PLUGIN_ROOT` environment variable is set by Claude Code at runtime.
    - Use the `--executable` CLI option to specify a custom executable (e.g., `bun`, `/usr/local/bin/node22`).
3.  **`export default` is Mandatory**: The CLI uses static analysis to find your hooks. It looks specifically for `export default factory(...)`.
    - **Ignored:** `export const myHook = ...`
    - **Ignored:** `module.exports = ...`

---

## 🧰 The Toolbox

### Type-Safe Inputs

Input properties use the wire format (snake_case) directly for consistency.

```typescript
// Claude sends: { "file_path": "src/main.ts", "tool_name": "Read" }
// You receive:
export default preToolUseHook({}, async (input, { logger }) => {
  logger.info('Tool received', { tool: input.tool_name }); // "Read"
  logger.debug('Tool input', { input: input.tool_input }); // { file_path: "src/main.ts" }
});
```

### Output Builders

Don't construct raw JSON. Use the builders to ensure wire-format compatibility.

| Builder                  | Use Case                                                           |
| :----------------------- | :----------------------------------------------------------------- |
| `preToolUseOutput`       | Allow/Deny permissions, modify inputs.                             |
| `postToolUseOutput`      | Inject context after a tool runs (e.g., "File read successfully"). |
| `stopOutput`             | Block Claude from quitting (`decision: 'block'`).                  |
| `userPromptExpansionOutput` | Inject context when a slash command or MCP prompt is expanded.   |
| `userPromptSubmitOutput` | Inject context when the user types a message.                      |

### The Logger

The Logger is **silent by default** — no output to stdout, stderr, or files unless explicitly configured. This design ensures hooks never corrupt the JSON protocol.

**Enable file logging:**

```bash
# Option A: Environment Variable
export CLAUDE_CODE_HOOKS_LOG_FILE=/tmp/claude-hooks.log

# Option B: CLI Argument — hardcodes path into bundle (runtime CLAUDE_CODE_HOOKS_LOG_FILE overrides)
npx -y @goodfoot/claude-code-hooks ... --log /tmp/claude-hooks.log

# Option C: CLI Argument — embed the env var name instead of a hardcoded path (good for worktrees)
npx -y @goodfoot/claude-code-hooks ... --log-env-var CLAUDE_CODE_HOOKS_LOG_FILE
```

**View logs:**

```bash
tail -f /tmp/claude-hooks.log | jq
```

**Programmatic usage:**

The `Logger` class can be instantiated directly for testing or advanced use cases:

```typescript
import { Logger } from '@goodfoot/claude-code-hooks';

// Silent by default — perfect for unit tests
const logger = new Logger();

// With file output (hardcoded path)
const fileLogger = new Logger({ logFilePath: '/tmp/my-hooks.log' });

// With dynamic path via env var
const envLogger = new Logger({ logEnvVar: 'MY_PLUGIN_LOG_FILE' });

// Subscribe to events programmatically
const unsubscribe = logger.on('error', (event) => {
  sendToMonitoring(event);
});

// Clean up when done
unsubscribe();
fileLogger.close();
```

See the skill documentation for event subscription, log levels, and debugging tips.

### Fail-Open Execution (`unexpectedError: "continue"`)

By default, any unexpected runtime failure — malformed stdin, a thrown handler exception, output serialization, the stdout write, or logger cleanup — writes a stack trace to stderr and exits non-zero. For a handler throw specifically, that means exit code 2 (BLOCK), which Claude sees as a blocking failure — disproportionate for a hook whose only job is to add optional context.

Opt a hook into fail-open behavior by passing `unexpectedError: "continue"` in its config:

```typescript
import { userPromptSubmitHook } from '@goodfoot/claude-code-hooks';

export default userPromptSubmitHook(
  {
    unexpectedError: 'continue',
    onUnexpectedError(error, phase) {
      // Best-effort diagnostics. This callback itself can never fail the
      // invocation — thrown errors here are swallowed.
    },
  },
  async (input, { logger }) => {
    // ...
  },
);
```

Under `unexpectedError: "continue"`:

- Malformed/unreadable stdin already fails open unconditionally for every hook (independent of this setting) — that behavior is unchanged.
- A thrown handler exception, an output-serialization error, a stdout write failure, or a logger-cleanup failure is caught, reported to `onUnexpectedError` (if provided) and the runtime logger, and swallowed.
- The empty output (`{}`, valid for every hook event) is emitted and the process exits `0`.
- An explicit blocking response the handler itself returns (e.g. `teammateIdleOutput({ stderr: '...' })`) is unaffected — it always writes that message and exits `2`. Only *unexpected* exceptions are ever swallowed, never the handler's own intentional decision.
- `onUnexpectedError` and the runtime logger are both best-effort: if either one throws, that failure is swallowed too.

`unexpectedError` defaults to `"error"` (today's behavior), so existing hooks are unaffected. Only opt in for **advisory enrichment hooks** — ones that add optional context and whose failure should be invisible to the user (`UserPromptSubmit`, `SessionStart`/`SubagentStart` context nudges, `PostToolUse`/`Notification` observers). Do not use it for hooks that make permission, safety, or policy decisions (`PreToolUse`, `PermissionRequest`, blocking `Stop`/`SubagentStop` checks) — a swallowed failure there silently grants the decision the hook was supposed to make. Also avoid it on `WorktreeCreate`/`WorktreeRemove`: their plain-text `rawStdout` wire protocol has no safe generic fallback, so a swallowed failure would write literal `{}` where Claude Code expects a path.

---

## 📁 Recommended Plugin Structure

For Claude Code plugins, use this directory layout:

```
plugins/my-plugin/
├── hooks/
│   └── src/
│       ├── block-dangerous.ts
│       └── inject-context.ts
├── hooks.json                    # Build output (auto-loaded by plugin)
└── bin/
    ├── block-dangerous.abc123.mjs
    └── inject-context.def456.mjs
```

Build command:

```bash
npx -y @goodfoot/claude-code-hooks -i "hooks/src/*.ts" -o "./hooks.json"
```

---

## 🤝 Coexistence with Other Hooks

The build tool is designed to **play well with others**:

- **External hooks are preserved**: Hooks not in `__generated.files` are never touched
- **Atomic writes**: Uses temp-file-then-rename for safe updates
- **Clean rebuilds**: Only removes files it previously generated

You can safely:

- Mix TypeScript hooks with shell script hooks in the same `hooks.json`
- Let multiple tools contribute to the same manifest
- Manually add hooks without worrying about them being overwritten

---

## 🔍 Debugging Guide

**"My hook isn't running!"**

1.  Did you run the build command? (`npx -y @goodfoot/claude-code-hooks ...`)
2.  Did you `export default` the hook?
3.  Is the path in `hooks.json` correct for _this_ machine?
4.  Is the timeout too short? (Units are **milliseconds**, `timeout: 5000` = 5s).

**"Claude shows an error when my hook runs."**

1.  Did you `console.log`? (Check your code).
2.  Did your hook throw an error? (Uncaught errors exit with code 2, which blocks Claude — unless the hook opts into `unexpectedError: 'continue'`; see "Fail-Open Execution" above).
3.  Check the log file defined in `CLAUDE_CODE_HOOKS_LOG_FILE`.

**"I can't see the tool input."**

1.  Use the logger to dump it: `logger.info('Input', { input })`.
2.  Remember `input.tool_input` is `unknown`. Cast it safely, or use typed matchers.

**"My prompt asset import fails in tests."**

1.  `text` imports are bundled at build time and return a string. Keep them to small static assets such as prompt preambles.
2.  If your tests run through Vitest/Vite, configure the same extension there (`.md` as text, or your chosen loader), otherwise `claude-code-hooks` builds can pass while test-time module loading still fails.

---

## 🏗️ Architecture

1.  **CLI (`claude-code-hooks`)**: Scans your TS files, extracts metadata (events, matchers) via AST, and compiles them using `esbuild`.
    - Supports explicit esbuild loaders for non-code assets via `--loader`.
    - Ships with `.md=text` enabled for markdown prompt assets.
2.  **Runtime (`runtime.ts`)**: The compiled files import a runtime wrapper. This wrapper:
    - Reads `stdin`.
    - Parses JSON (wire format with snake_case properties).
    - Injects context (`logger`, and `persistEnvVar`/`persistEnvVars` for SessionStart hooks).
    - Executes your handler.
    - Formats the output.
    - Writes to `stdout` — except on an intentional block (a handler-returned `stderr`, e.g. `teammateIdleOutput({ stderr })`), where nothing is written to `stdout` at all: Claude Code's hook-result parser treats any stdout that parses as valid JSON as success regardless of exit code, so blocking only takes effect when stdout carries no JSON.

This separation ensures your hooks are fast, type-safe, and isolated.
