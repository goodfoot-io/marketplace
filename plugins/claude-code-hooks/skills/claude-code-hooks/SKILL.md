---
name: claude-code-hooks
description: Expert system for creating, debugging, and maintaining Claude Code hooks using @goodfoot/claude-code-hooks.
---

<instructions>

## 1. The Build Process (First & Foremost)

Hooks are **compiled executables**, not scripts. You must build them before Claude can see them.

**The Build Command:**
```bash
npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o "dist/hooks.json"
```

**Parameters Explained:**
*   `-i "hooks/*.ts"`: **Input Glob.** This tells the compiler where your TypeScript source files are.
    *   *Critical:* Quote the glob pattern (`"..."`) to prevent your shell from expanding it before the CLI sees it.
*   `-o "dist/hooks.json"`: **Output Manifest.** This is the file you register in your config.
    *   The CLI creates a `build/` folder next to this file containing the compiled `.mjs` executables.
*   `--log "/tmp/hooks.log"` (Optional): **Runtime Log.** Forces all hooks to write `logger` output to this file. Essential for debugging.

## 2. Hook Factory Demonstration

Here is a complete, working example of a `PreToolUse` hook. It uses the Factory Pattern (`preToolUseHook`) and the Output Builder (`preToolUseOutput`).

**Goal:** Prevent accidental deletion of the root directory.

```typescript
// hooks/block-dangerous.ts
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

// 1. Export Default is MANDATORY.
// 2. Factory handles input typing and error wrapping.
// 3. Matcher 'Bash' ensures this only runs for Bash commands.
export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  
  // 4. Input is camelCased (toolInput, toolName).
  // 5. Cast toolInput to the expected shape (it is 'unknown' by default).
  const command = (input.toolInput as { command?: string })?.command ?? '';

  // 6. Logging uses the context logger, NEVER console.log or console.error.
  logger.info('Checking command safety', { command });

  if (command.includes('rm -rf /')) {
    logger.warn('Blocked dangerous root deletion', { command });
    
    // 7. Return structured output using the builder.
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Safety Policy: Root deletion is forbidden.'
      }
    });
  }

  // 8. Default: Allow execution.
  return preToolUseOutput({});
});
```

## 3. The Golden Path for New Hooks

The fastest way to start a new hook project is the scaffold command:

```bash
npx @goodfoot/claude-code-hooks --scaffold /path/to/my-hooks --hooks Stop,SubagentStop -o ./hooks.json
```

This generates a complete TypeScript project with:
- `src/` directory with type-safe hook implementations
- `test/` directory with Vitest tests
- `package.json` with build/test/lint scripts
- `tsconfig.json` configured for ESM and Node 20
- `biome.json` for linting
- `CLAUDE.md` with skill loading instruction

**Next steps after scaffolding:**
```bash
cd my-hooks
npm install
npm run build   # Compiles hooks to the -o path
npm test        # Runs Vitest tests
```

**Available hook types (12 total):**
`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PermissionRequest`

Hook names are case-insensitive.

## 4. Agent Protocol: The "Forensic" Method

When helping a user with hooks, you **MUST** follow this protocol:

1.  **Verify the Package:** Ensure usage of `@goodfoot/claude-code-hooks`.
2.  **Enforce the Build Step:** Remind the user to run `npx ...` after every edit.
3.  **Ban `console.log` & `console.error`:** Aggressively correct any code using `console.log` or `console.error` to use `context.logger`. Stdio is reserved for the protocol; direct writes cause silent failures or UI corruption.
4.  **Check Exports:** TypeScript hooks **must** use `export default hookFactory(...)`.

## 5. Quick Check: Environment & Health

Run this to verify the user's setup:

```! 
# === Hook System Health Check ===
if [ ! -f "package.json" ]; then
  echo "❌ No package.json found. Run 'npm init -y' first."
else
  # Check for package
  if ! npm list @goodfoot/claude-code-hooks >/dev/null 2>&1; then
    echo "❌ @goodfoot/claude-code-hooks is missing."
    echo "   Run: npm install @goodfoot/claude-code-hooks tsx typescript"
  else
    echo "✅ Package installed."
  fi

  # Check for build script
  if ! grep -q "claude-code-hooks" package.json; then
    echo "⚠️ No build script detected in package.json."
    echo "   Recommended: Add '\"build:hooks\": \"claude-code-hooks -i \\\"hooks/*.ts\\\" -o \\\"dist/hooks.json\\\"\"'"
  fi
fi

# Check for TypeScript
if ! command -v tsc >/dev/null 2>&1; then
  echo "⚠️ TypeScript (tsc) not in PATH."
fi
```

## 6. Configuration by Setup Type

**Standalone Project:**
Add the absolute path to your `~/.claude/config.json`:
```json
{ "hooks": "/absolute/path/to/project/dist/hooks.json" }
```

**Claude Code Plugin (Recommended):**
The `hooks.json` is auto-detected if placed in the plugin root.
Build command: `npx -y @goodfoot/claude-code-hooks -i "hooks/src/*.ts" -o "./hooks.json"`

## 7. Reference Links

*   **[Installation & Setup](reference/installation.md)**: Setup guide.
*   **[All 12 Hook Types](reference/output-builders.md)**: Factories, builders, and inputs.
*   **[Porting from Bash](reference/porting.md)**: Migration guide.
*   **[Logging & Debugging](reference/logging.md)**: How to see what's happening.
*   **[Environment Vars](reference/environment.md)**: `getProjectDir`, `persistEnvVar`.

</instructions>