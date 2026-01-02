# Installation & Setup

> [Back to SKILL.md](../SKILL.md) | [Porting](porting.md) | [Output Builders](output-builders.md) | [Logging](logging.md)

Complete guide for setting up `@goodfoot/claude-code-hooks` from scratch.

## Prerequisites

- Node.js v20+
- Package manager: npm, yarn, pnpm, or bun
- TypeScript project (recommended)

## Step 1: Install Dependencies

```bash
# Using yarn (recommended)
yarn add @goodfoot/claude-code-hooks
yarn add -D tsx typescript

# Using npm
npm install @goodfoot/claude-code-hooks
npm install -D tsx typescript

# Using pnpm
pnpm add @goodfoot/claude-code-hooks
pnpm add -D tsx typescript
```

## Step 2: Create Hooks Directory

```bash
mkdir -p .claude/hooks
```

Recommended structure:

```
your-project/
├── .claude/
│   ├── hooks/
│   │   ├── pre-tool-use.ts      # PreToolUse hook
│   │   ├── session-start.ts     # SessionStart hook
│   │   └── stop.ts              # Stop hook
│   └── hooks.json               # Hook configuration
├── package.json
└── tsconfig.json
```

## Step 3: Create hooks.json

Create `.claude/hooks.json`:

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash|Write|Edit",
      "hooks": [
        {
          "type": "command",
          "command": "tsx .claude/hooks/pre-tool-use.ts"
        }
      ]
    }
  ],
  "SessionStart": [
    {
      "matcher": "startup",
      "hooks": [
        {
          "type": "command",
          "command": "tsx .claude/hooks/session-start.ts"
        }
      ]
    }
  ]
}
```

## Step 4: Create Your First Hook

Create `.claude/hooks/pre-tool-use.ts`:

```typescript
#!/usr/bin/env tsx
import { preToolUseOutput, type PreToolUseInput } from '@goodfoot/claude-code-hooks';

// Helper to read all stdin
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

// Main hook logic
async function main() {
  const input: PreToolUseInput = JSON.parse(await readStdin());

  // Example: Log what tool is being used
  // (logging to file - see logging.md for details)

  // Allow all tools by default
  const output = preToolUseOutput({ allow: true });
  process.stdout.write(JSON.stringify(output.stdout));
  process.exit(output.exitCode);
}

main();
```

## Step 5: Test Your Hook

Test the hook manually by piping JSON input:

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls -la"}}' | tsx .claude/hooks/pre-tool-use.ts
```

Expected output:
```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}
```

## TypeScript Configuration

For optimal type checking, add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Hook File Template

Use this template for any hook type:

```typescript
#!/usr/bin/env tsx
import {
  // Replace with appropriate output builder
  preToolUseOutput,
  // Replace with appropriate input type
  type PreToolUseInput
} from '@goodfoot/claude-code-hooks';

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  // Parse input - type assertion ensures type safety
  const input: PreToolUseInput = JSON.parse(await readStdin());

  // Your hook logic here
  // Access input fields in camelCase: input.toolName, input.toolInput, etc.

  // Return appropriate output
  const output = preToolUseOutput({ allow: true });
  process.stdout.write(JSON.stringify(output.stdout));
  process.exit(output.exitCode);
}

main();
```

## Matcher Patterns

Matchers use regex to filter when hooks fire:

| Pattern | Matches |
|---------|---------|
| `Bash` | Only Bash tool |
| `Bash\|Write` | Bash OR Write tool |
| `Bash\|Write\|Edit` | Bash OR Write OR Edit |
| `.*` | All tools |
| `startup` | SessionStart on startup only |
| `startup\|resume` | SessionStart on startup or resume |

**Important**: Use escaped pipes (`\|`) in JSON for OR patterns.

## Project-Level vs User-Level Hooks

| Location | Scope | Use Case |
|----------|-------|----------|
| `.claude/hooks.json` | Project | Project-specific rules |
| `~/.claude/hooks.json` | User | Global personal hooks |
| `~/.config/claude/hooks.json` | User (XDG) | Global on XDG systems |

Project-level hooks take precedence when both exist.

## Validation Checklist

After setup, verify:

- [ ] `tsx` is installed and in PATH
- [ ] `@goodfoot/claude-code-hooks` is installed
- [ ] `hooks.json` is valid JSON
- [ ] Hook files have shebang (`#!/usr/bin/env tsx`)
- [ ] Hook files are executable (`chmod +x` if needed)
- [ ] Test piping JSON produces valid output
- [ ] Exit codes are correct (0 for success, 2 for block)

## Common Installation Issues

### tsx Not Found

```bash
# Add to devDependencies
yarn add -D tsx

# Or install globally
yarn global add tsx
```

### Permission Denied

```bash
# Make hook executable
chmod +x .claude/hooks/pre-tool-use.ts
```

### Module Not Found

Ensure `@goodfoot/claude-code-hooks` is installed in the project where hooks run:

```bash
# Check if installed
ls node_modules/@goodfoot/claude-code-hooks

# Reinstall if needed
yarn add @goodfoot/claude-code-hooks
```

### Path Issues

Use absolute paths in `hooks.json` if relative paths don't work:

```json
{
  "command": "/absolute/path/to/tsx /absolute/path/to/hook.ts"
}
```

Or use environment variables:

```json
{
  "command": "tsx ${PWD}/.claude/hooks/pre-tool-use.ts"
}
```
