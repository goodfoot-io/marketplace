# Installation & Setup

> [Back to SKILL.md](../SKILL.md) | [Porting](porting.md) | [Output Builders](output-builders.md) | [Logging](logging.md)

<instructions>

## 1. Prerequisites

- Node.js v20+
- Package manager: npm, yarn, pnpm, or bun
- TypeScript project (recommended)

## 2. Install Dependencies

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

## 3. Create Hooks Directory

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

## 4. Create hooks.json

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

## 5. Create Your First Hook

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
  const output = preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
  process.stdout.write(JSON.stringify(output.stdout));
  process.exit(output.exitCode);
}

main();
```

## 6. Test Your Hook

Test the hook manually by piping JSON input:

```bash
echo '{"hookEventName":"PreToolUse","toolName":"Bash","toolInput":{"command":"ls -la"}}' | tsx .claude/hooks/pre-tool-use.ts
```

Expected output (when using `hookSpecificOutput`):
```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}
```

## 7. TypeScript Configuration

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

## 8. Hook File Template

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
  const output = preToolUseOutput({
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
  process.stdout.write(JSON.stringify(output.stdout));
  process.exit(output.exitCode);
}

main();
```

## 9. Matcher Patterns

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

## 10. Project-Level vs User-Level Hooks

Based on scope needed:
- **Project-specific rules**: Use `.claude/hooks.json`
- **Global personal hooks**: Use `~/.claude/hooks.json`
- **Global on XDG systems**: Use `~/.config/claude/hooks.json`

Project-level hooks take precedence when both exist.

## 11. Validation Checklist

After setup, verify:

- [ ] `tsx` is installed and in PATH
- [ ] `@goodfoot/claude-code-hooks` is installed
- [ ] `hooks.json` is valid JSON
- [ ] Hook files have shebang (`#!/usr/bin/env tsx`)
- [ ] Hook files are executable (`chmod +x` if needed)
- [ ] Test piping JSON produces valid output
- [ ] Exit codes are correct (0 for success, 2 for block)

## 12. Common Installation Issues

### 12.1 tsx Not Found

```bash
# Add to devDependencies
yarn add -D tsx

# Or install globally
yarn global add tsx
```

### 12.2 Permission Denied

```bash
# Make hook executable
chmod +x .claude/hooks/pre-tool-use.ts
```

### 12.3 Module Not Found

Ensure `@goodfoot/claude-code-hooks` is installed in the project where hooks run:

```bash
# Check if installed
ls node_modules/@goodfoot/claude-code-hooks

# Reinstall if needed
yarn add @goodfoot/claude-code-hooks
```

### 12.4 Path Issues

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

</instructions>
