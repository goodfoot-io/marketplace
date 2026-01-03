# Installation & Setup

> [Back to SKILL.md](../SKILL.md) | [Porting](porting.md) | [Output Builders](output-builders.md) | [Logging](logging.md) | [Environment](environment.md)

<instructions>

## 1. Prerequisites

- Node.js v20+
- Package manager: npm, yarn, pnpm, or bun
- TypeScript project (recommended)

## 2. Install Dependencies

You need the hooks package and TypeScript tools:

```bash
# Using yarn
yarn add @goodfoot/claude-code-hooks
yarn add -D tsx typescript

# Using npm
npm install @goodfoot/claude-code-hooks
npm install -D tsx typescript
```

## 3. Project Structure

We recommend placing hooks in a dedicated `hooks/` directory.

```
your-project/
├── hooks/
│   ├── allow-read.ts        # PreToolUse hook
│   └── setup-env.ts         # SessionStart hook
├── dist/
│   ├── hooks.json           # Generated manifest
│   └── build/
│       ├── allow-read.abc123.mjs   # Compiled hooks
│       └── setup-env.def456.mjs
├── package.json
└── tsconfig.json
```

## 4. The Build System

Hooks **must be compiled** to run. You cannot point Claude at the `.ts` files directly.

The build tool (`claude-code-hooks`) does three things:
1.  Compiles your TS into standalone `.mjs` executables in a `build/` subdirectory.
2.  Embeds the runtime wrapper (handling JSON protocol, camelCase conversion).
3.  Generates a `hooks.json` manifest with paths using `${CLAUDE_PLUGIN_ROOT:-./}/build/`.

**Run the build:**

```bash
npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o "dist/hooks.json"
```

**Incremental Rebuilds:**
When rebuilding, the tool automatically:
- Removes old generated `.mjs` files
- Preserves external hooks not created by this package
- Updates the manifest with new compiled hooks

## 5. Configuration

After building, tell Claude where to find the manifest. The location depends on your setup:

**Option A: Standalone Project**
Add to `~/.claude/config.json` or `.claude/config.json`:
```json
{
  "hooks": "/absolute/path/to/your/project/dist/hooks.json"
}
```

**Option B: Claude Code Plugin (Recommended)**
Plugins auto-load `hooks.json` from the plugin root. Use this structure:
```
plugins/my-plugin/
├── hooks/
│   └── src/
│       └── my-hook.ts       # Source files
├── hooks.json               # Build output (auto-loaded)
└── build/
    └── my-hook.abc123.mjs   # Compiled hooks
```
Build command:
```bash
npx -y @goodfoot/claude-code-hooks -i "hooks/src/*.ts" -o "./hooks.json"
```
`CLAUDE_PLUGIN_ROOT` is set automatically, so paths resolve correctly.

**Option C: User-level Hooks**
Build to `~/.claude/hooks/` for hooks that apply to all sessions:
```bash
npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o ~/.claude/hooks/hooks.json
```

## 6. Coexistence with Other Hook Sources

The build tool is designed to **coexist safely** with other hook sources:

- **External hooks are preserved**: Hooks not tracked in `__generated.files` are never touched
- **Atomic updates**: Uses temp-file-then-rename for safe writes
- **Clean rebuilds**: Old generated files are removed before new ones are written

This means you can:
- Mix TypeScript hooks with shell script hooks in the same `hooks.json`
- Let multiple tools contribute to the same manifest
- Manually add hooks without worrying about them being overwritten

## 7. Verification

Run this test to ensure your hook is compiled and executable:

```bash
# Pipe a mock JSON payload into the compiled file
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}' | node build/allow-read.*.mjs
```

If successful, you will see a JSON response. If you see nothing or an error, check the logs.

</instructions>