---
name: claude-code-hooks
description: Expert system for creating, debugging, and maintaining Claude Code hooks using @goodfoot/claude-code-hooks.
---

<instructions>

## 1. Agent Protocol: The "Forensic" Method

When helping a user with hooks, you **MUST** follow this protocol to prevent common failures:

1.  **Verify the Package:** Ensure usage of `@goodfoot/claude-code-hooks` (NOT `claude-code-hooks`).
2.  **Enforce the Build Step:** Users often forget this is a *compiled* system. Always remind them to run the `npx` build command after editing.
3.  **Ban `console.log`:** Aggressively correct any code using `console.log` to use `context.logger`. `console.log` corrupts the JSON protocol.
4.  **Check Exports:** TypeScript hooks **must** use `export default hookFactory(...)`. Named exports are ignored by the compiler.
5.  **Validate Matchers:** Ensure matchers in `hooks.json` are valid regex strings (e.g., `"Bash|Write"`).

## 2. Quick Check: Environment & Health

Run this to verify the user's setup before making changes:

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
    echo "   Recommended: Add '"build:hooks": "claude-code-hooks -i \"hooks/*.ts\" -o \"dist/hooks.json\""'"
  fi
fi

# Check for TypeScript
if ! command -v tsc >/dev/null 2>&1; then
  echo "⚠️ TypeScript (tsc) not in PATH."
fi
```

## 3. The "Golden Path" for New Hooks

To create a working hook, follow this exact sequence:

1.  **Create File:** `hooks/my-hook.ts`
2.  **Implement:** Use the factory pattern (see patterns below).
3.  **Build:** `npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o "dist/hooks.json"`
4.  **Register:** Depends on your setup (see below).

### Configuration by Setup Type

**Standalone Project:**
Add to `~/.claude/config.json` or `.claude/config.json`:
```json
{ "hooks": "/absolute/path/to/project/dist/hooks.json" }
```

**Claude Code Plugin (Recommended Structure):**
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

**User-level Hooks:**
Build to `~/.claude/hooks/` for hooks that apply to all sessions:
```bash
npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o ~/.claude/hooks/hooks.json
```

## 4. Hook Patterns (Copy-Paste Ready)

### 4.1 Security: Block Dangerous Commands (PreToolUse)

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  const cmd = (input.toolInput as { command?: string })?.command ?? '';
  
  // FAIL-SAFE: Block root deletions
  if (cmd.includes('rm -rf /')) {
    logger.warn('Blocked dangerous command', { cmd });
    return preToolUseOutput({
      hookSpecificOutput: { 
        permissionDecision: 'deny',
        permissionDecisionReason: 'Root deletion detected' 
      }
    });
  }

  return preToolUseOutput({});
});
```

### 4.2 Context: Inject Guidelines (SessionStart)

```typescript
import { sessionStartHook, sessionStartOutput } from '@goodfoot/claude-code-hooks';

export default sessionStartHook({ matcher: 'startup' }, (input, { logger }) => {
  logger.info('Session starting', { cwd: input.cwd });
  
  return sessionStartOutput({
    systemMessage: 'CRITICAL: Always use TypeScript. Never use "any".'
  });
});
```

### 4.3 Safety: Prevent Stop on Uncommitted Changes (Stop)

```typescript
import { stopHook, stopOutput } from '@goodfoot/claude-code-hooks';
import { execSync } from 'child_process';

export default stopHook({}, (input, { logger }) => {
  try {
    const status = execSync('git status --porcelain', { cwd: input.cwd, encoding: 'utf-8' });
    if (status.trim()) {
      return stopOutput({
        decision: 'block',
        reason: 'You have uncommitted changes. Please commit or stash them.'
      });
    }
  } catch (e) {
    logger.debug('Git check failed', { error: String(e) });
  }
  
  return stopOutput({ decision: 'approve' });
});
```

## 5. Build System Details

### Output Structure
The build tool creates a `build/` subdirectory for compiled hooks:
```
dist/
├── hooks.json              # Manifest (points to build/)
└── build/
    ├── my-hook.abc123.mjs  # Compiled hooks
    └── other-hook.def456.mjs
```

### Path Resolution
Command paths use `${CLAUDE_PLUGIN_ROOT:-./}/build/filename.mjs`:
- In plugins, `CLAUDE_PLUGIN_ROOT` is set automatically
- For standalone projects, defaults to `./` (relative to `hooks.json`)

### Incremental Rebuilds
Rebuilding preserves hooks from other sources:
- External hooks (not in `__generated.files`) are kept
- Old generated `.mjs` files are removed
- New compiled hooks are merged in

## 6. Troubleshooting Matrix

| Symptom | Probable Cause | Fix |
| :--- | :--- | :--- |
| **Hook ignores me** | Forgot to rebuild | Run `npx -y @goodfoot/claude-code-hooks ...` |
| **Hook ignores me** | `hooks.json` path is relative | Use absolute path in `~/.claude/config.json` |
| **Claude crashes/errors** | Used `console.log` | Change to `logger.info()` |
| **Type Error** | Wrong Factory/Builder pair | Check `reference/output-builders.md` |
| **"Command not found"** | `hooks.json` points to wrong file | Re-run build to regenerate paths |
| **Missing build/ directory** | Outdated build | Re-run build (now uses `build/` subdir) |

## 7. Reference Links

*   **[Installation & Setup](reference/installation.md)**: Setup guide.
*   **[All 12 Hook Types](reference/output-builders.md)**: Factories, builders, and inputs.
*   **[Porting from Bash](reference/porting.md)**: Migration guide.
*   **[Logging & Debugging](reference/logging.md)**: How to see what's happening.
*   **[Environment Vars](reference/environment.md)**: `getProjectDir`, `persistEnvVar`.

</instructions>