# @goodfoot/claude-code-hooks

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

The `--hooks` argument accepts a comma-separated list of any of these 12 event types:

| Hook Type            | Description                                |
| -------------------- | ------------------------------------------ |
| `PreToolUse`         | Before a tool executes (allow/deny/modify) |
| `PostToolUse`        | After a tool completes successfully        |
| `PostToolUseFailure` | After a tool fails                         |
| `Notification`       | When Claude requests permissions           |
| `UserPromptSubmit`   | When user submits a prompt                 |
| `SessionStart`       | When session begins                        |
| `SessionEnd`         | When session terminates                    |
| `Stop`               | After main agent finishes                  |
| `SubagentStart`      | When a Task tool starts                    |
| `SubagentStop`       | When a Task tool completes                 |
| `PreCompact`         | Before context compaction                  |
| `PermissionRequest`  | When permission is requested               |

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
| `userPromptSubmitOutput` | Inject context when the user types a message.                      |

### The Logger

The Logger is **silent by default** — no output to stdout, stderr, or files unless explicitly configured. This design ensures hooks never corrupt the JSON protocol.

**Enable file logging:**

```bash
# Option A: Environment Variable
export CLAUDE_CODE_HOOKS_LOG_FILE=/tmp/claude-hooks.log

# Option B: CLI Argument (during build)
npx -y @goodfoot/claude-code-hooks ... --log /tmp/claude-hooks.log
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

// With file output
const fileLogger = new Logger({ logFilePath: '/tmp/my-hooks.log' });

// Subscribe to events programmatically
const unsubscribe = logger.on('error', (event) => {
  sendToMonitoring(event);
});

// Clean up when done
unsubscribe();
fileLogger.close();
```

See the skill documentation for event subscription, log levels, and debugging tips.

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
2.  Did your hook throw an error? (Uncaught errors exit with code 2, which blocks Claude).
3.  Check the log file defined in `CLAUDE_CODE_HOOKS_LOG_FILE`.

**"I can't see the tool input."**

1.  Use the logger to dump it: `logger.info('Input', { input })`.
2.  Remember `input.tool_input` is `unknown`. Cast it safely, or use typed matchers.

---

## 🏗️ Architecture

1.  **CLI (`claude-code-hooks`)**: Scans your TS files, extracts metadata (events, matchers) via AST, and compiles them using `esbuild`.
2.  **Runtime (`runtime.ts`)**: The compiled files import a runtime wrapper. This wrapper:
    - Reads `stdin`.
    - Parses JSON (wire format with snake_case properties).
    - Injects context (`logger`, and `persistEnvVar`/`persistEnvVars` for SessionStart hooks).
    - Executes your handler.
    - Formats the output.
    - Writes to `stdout`.

This separation ensures your hooks are fast, type-safe, and isolated.
