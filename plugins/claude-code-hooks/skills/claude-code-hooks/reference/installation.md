# Installation & Setup

> [Back to SKILL.md](../SKILL.md) | [Porting](porting.md) | [Output Builders](output-builders.md) | [Logging](logging.md) | [Environment](environment.md)

<instructions>

## 1. Quick Start: Scaffolding (Recommended)

The easiest way to start is to scaffold a complete project with TypeScript, testing, and build scripts configured.

```bash
# Generate a new project in ./my-hooks with Stop and SessionStart hooks
npx @goodfoot/claude-code-hooks --scaffold ./my-hooks --hooks Stop,SessionStart -o ./hooks.json
```

**What happens next:**
1.  `cd my-hooks`
2.  `npm install`
3.  `npm run build` (Compiles hooks to `dist/hooks.json`)
4.  `npm test` (Runs generated tests)

**Available Hook Types:** `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PermissionRequest`

## 2. Manual Setup (Alternative)

If you prefer to integrate into an existing project:

### 2.1 Prerequisites
- Node.js v20+
- Package manager: npm, yarn, pnpm, or bun
- TypeScript project

### 2.2 Install Dependencies
```bash
yarn add @goodfoot/claude-code-hooks
yarn add -D tsx typescript
```

### 2.3 Project Structure
We recommend this layout:
```
project/
├── hooks/
│   ├── allow-read.ts        # Source
├── dist/
│   ├── hooks.json           # Manifest
│   └── build/               # Compiled output
```

### 2.4 The Build System
Hooks **must be compiled**. Run the build CLI:
```bash
npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o "dist/hooks.json"
```

## 3. Configuration

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
npx -y @goodfoot/claude-code-hooks -i "hooks/src/*.ts" -o "./hooks.json"
```

## 4. Verification

Test the compiled hook by piping JSON:
```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}' | node dist/build/allow-read.*.mjs
```

</instructions>