# @goodfoot/claude-code-hooks

> **The Missing Manual for building type-safe, compiled hooks for Claude Code.**

This package is not just a library; it is a **build system** and a **runtime wrapper**. Unlike standard Node.js scripts, you cannot simply point Claude at these files. You write TypeScript, this package compiles it into self-contained executables, and *those* are what Claude runs.

## ⚡ Quick Start

### 1. Install
```bash
yarn add @goodfoot/claude-code-hooks
# or npm install, pnpm, etc.
```

### 2. Write a Hook
Create `hooks/allow-ls.ts`. **Note:** You *must* use `export default` and the factory function.

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
  const { command } = input.toolInput as { command: string };
  
  // Use logger, NEVER console.log
  logger.info('Checking command', { command });

  if (command.trim() === 'ls') {
    return preToolUseOutput({
      hookSpecificOutput: { permissionDecision: 'allow' }
    });
  }

  return preToolUseOutput({}); // Pass through
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
Tell Claude where your hooks are by pointing to the **generated** JSON.

```bash
# In ~/.claude/config.json or project-local .claude/config.json
{
  "hooks": "/absolute/path/to/your/project/dist/hooks.json"
}
```

---

## 💀 The "Third Rail" (Critical Safety Rules)

Violating these rules will cause your hooks to fail silently or block Claude entirely.

1.  **NO `console.log`**: The hook communicates with Claude via `stdout`. If you print "Hello world", you corrupt the JSON protocol.
    *   **Bad:** `console.log("Checking command")`
    *   **Good:** `context.logger.info("Checking command")`
2.  **Relative Paths via Environment Variable**: The generated `hooks.json` uses `${CLAUDE_PLUGIN_ROOT:-./}/build/` paths.
    *   Compiled hooks are placed in a `build/` subdirectory relative to `hooks.json`.
    *   If `CLAUDE_PLUGIN_ROOT` is set, it's used as the base; otherwise defaults to `./`.
3.  **`export default` is Mandatory**: The CLI uses static analysis to find your hooks. It looks specifically for `export default factory(...)`.
    *   **Ignored:** `export const myHook = ...`
    *   **Ignored:** `module.exports = ...`

---

## 🧰 The Toolbox

### Type-Safe Inputs
The runtime automatically converts snake_case inputs (from Claude) to **camelCase**.

```typescript
// Claude sends: { "file_path": "src/main.ts", "tool_name": "Read" }
// You receive:
export default preToolUseHook({}, async (input) => {
  console.log(input.toolName); // "Read"
  // Note: toolInput contents are NOT transformed recursively by default types, 
  // but the top-level keys are. Check your specific tool's shape!
});
```

### Output Builders
Don't construct raw JSON. Use the builders to ensure wire-format compatibility.

| Builder | Use Case |
| :--- | :--- |
| `preToolUseOutput` | Allow/Deny permissions, modify inputs. |
| `postToolUseOutput` | Inject context after a tool runs (e.g., "File read successfully"). |
| `stopOutput` | Block Claude from quitting (`decision: 'block'`). |
| `userPromptSubmitOutput` | Inject context when the user types a message. |

### The Logger
Logs are written to a file, not the console.

**Enable logging:**
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

---

## 🔍 Debugging Guide

**"My hook isn't running!"**
1.  Did you run the build command? (`npx -y @goodfoot/claude-code-hooks ...`)
2.  Did you `export default` the hook?
3.  Is the path in `hooks.json` correct for *this* machine?
4.  Is the timeout too short? (Units are **milliseconds**, `timeout: 5000` = 5s).

**"Claude shows an error when my hook runs."**
1.  Did you `console.log`? (Check your code).
2.  Did your hook throw an error? (Uncaught errors exit with code 2, which blocks Claude).
3.  Check the log file defined in `CLAUDE_CODE_HOOKS_LOG_FILE`.

**"I can't see the tool input."**
1.  Use the logger to dump it: `logger.info('Input', { input })`.
2.  Remember `input.toolInput` is `unknown`. Cast it safely.

---

## 🏗️ Architecture

1.  **CLI (`claude-code-hooks`)**: Scans your TS files, extracts metadata (events, matchers) via AST, and compiles them using `esbuild`.
2.  **Runtime (`runtime.ts`)**: The compiled files import a runtime wrapper. This wrapper:
    *   Reads `stdin`.
    *   Parses JSON.
    *   CamelCases keys.
    *   Injects `logger`.
    *   Executes your handler.
    *   Formats the output.
    *   Writes to `stdout`.

This separation ensures your hooks are fast, type-safe, and isolated.
