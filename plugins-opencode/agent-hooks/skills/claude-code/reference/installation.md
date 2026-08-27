<instructions>

## Quick Start: Scaffolding (Recommended)

The easiest way to start is to scaffold a complete project with TypeScript, testing, and build scripts configured.

```bash
# Generate a new project in ./my-hooks with Stop and SessionStart hooks
npx @goodfoot/agent-hooks --agent claude-code --scaffold ./my-hooks --hooks Stop,SessionStart -o ./hooks.json
```

**What happens next:**
1. `cd my-hooks`
2. `npm install`
3. `npm run build` (Compiles hooks to the `-o` path)
4. `npm test` (Runs generated tests)

**Available Hook Types:** `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PermissionRequest`, `Setup`

### Scaffolding for Monorepos

Scaffolding works for monorepos — use `-o` to output directly to a plugin directory:

```bash
# Scaffold into packages/, output hooks.json to plugins-opencode/
npx @goodfoot/agent-hooks --agent claude-code --scaffold ./packages/my-hooks \
  --hooks PreToolUse,PostToolUse \
  -o ../../plugins-opencode/my-plugin/hooks/hooks.json
```

This generates the build script:
```json
"build": "npx -y @goodfoot/agent-hooks --agent claude-code -i \"src/**/*.ts\" -o \"../../plugins-opencode/my-plugin/hooks/hooks.json\""
```

**One manual adjustment:** If `@goodfoot/agent-hooks` is a workspace package, change the dependency:
```diff
- "@goodfoot/agent-hooks": "^1.0.0"
+ "@goodfoot/agent-hooks": "workspace:*"
```

## Manual Setup (Alternative)

If you prefer to integrate into an existing project:

### Prerequisites

- Node.js v20+
- Package manager: npm, yarn, pnpm, or bun
- TypeScript project

### Install Dependencies

```bash
yarn add @goodfoot/agent-hooks
yarn add -D tsx typescript
```

### Project Structure

We recommend this layout:

```
project/
├── hooks/
│   ├── allow-read.ts        # Source
├── dist/
│   ├── hooks.json           # Manifest
│   └── bin/                 # Compiled output
```

### The Build System

Hooks **must be compiled**. Run the build CLI:

```bash
npx -y @goodfoot/agent-hooks --agent claude-code -i "hooks/*.ts" -o "dist/hooks.json"
```

### Asset Imports with `--loader`

The compiler bundles hook code with esbuild. Non-code imports must have an esbuild loader.

- `.md` works out of the box because the CLI enables `.md=text` by default.
- Other extensions stay fail-closed until you opt in with repeated `--loader .ext=type` flags.
- Use text imports for small static prompt assets that should become strings at bundle time.

```bash
npx -y @goodfoot/agent-hooks --agent claude-code -i "hooks/*.ts" -o "dist/hooks.json" --loader .txt=text
```

Typical pattern for prompt preambles:

```typescript
import preamble from './prompts/subagent-start.md';
import { subagentStartHook } from '@goodfoot/agent-hooks/claude-code';

export default subagentStartHook({}, () => {
  return {
    hookSpecificOutput: {
      additionalContext: preamble
    }
  };
});
```

If your project also runs Vitest/Vite, configure the same extension handling there. Otherwise source builds can pass while tests still fail on the asset import.

### Custom Node Executable

By default, generated commands use `node` as the executable. Use `--executable` to specify an alternative:

```bash
# Use a specific node version
npx -y @goodfoot/agent-hooks --agent claude-code -i "hooks/*.ts" -o "dist/hooks.json" --executable /usr/local/bin/node22

# Use bun instead of node
npx -y @goodfoot/agent-hooks --agent claude-code -i "hooks/*.ts" -o "dist/hooks.json" --executable bun
```

This affects the generated `hooks.json` commands:
- Default: `node $CLAUDE_PLUGIN_ROOT/bin/hook.mjs`
- With `--executable bun`: `bun $CLAUDE_PLUGIN_ROOT/bin/hook.mjs`

## Configuration

After building (Scaffolded or Manual), tell Claude where to find the manifest.

**Option A: Standalone Project**

Add absolute path to `~/.claude/config.json`:

```json
{ "hooks": "/absolute/path/to/your/project/dist/hooks.json" }
```

**Option B: Claude Code Plugin**

Plugins auto-load `hooks.json` from the plugin root.

```bash
# Build to plugin root
npx -y @goodfoot/agent-hooks --agent claude-code -i "hooks/src/*.ts" -o "./hooks.json"
```

## Verification

Test the compiled hook by piping JSON:

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}' | node dist/bin/allow-read.*.mjs
```

## Monorepo Integration

For monorepo workspaces where hooks are in a separate package:

### Package Structure

```
packages/
├── my-hooks/                    # Hook source package
│   ├── src/
│   │   ├── pre-tool-hook.ts
│   │   └── post-tool-hook.ts
│   ├── test/
│   │   └── pre-tool-hook.test.ts
│   ├── package.json
│   └── tsconfig.json
└── ...
plugins-opencode/
└── my-plugin/
    └── hooks/
        └── hooks.json           # Build output target
```

### package.json

```json
{
  "name": "@myorg/hooks",
  "type": "module",
  "scripts": {
    "build": "npx -y @goodfoot/agent-hooks --agent claude-code -i \"src/**/*.ts\" -o \"../../plugins-opencode/my-plugin/hooks/hooks.json\"",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@goodfoot/agent-hooks": "workspace:^"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

### Build Output

The `-o` path is relative to the package directory. Use `../../` to output to a sibling plugin directory.

**Verify the output path:**

```bash
cd packages/my-hooks
npm run build
# Check: plugins-opencode/my-plugin/hooks/hooks.json should exist
cat ../../plugins-opencode/my-plugin/hooks/hooks.json | jq .
```

</instructions>
