# Plugin Discovery Fix - Final Resolution

## Session: 2025-10-29 (Final Fix)

### The Real Root Cause

After multiple failed attempts, the actual issue was discovered through **path resolution testing**:

**Plugin source paths in marketplace.json are resolved RELATIVE TO THE marketplace.json FILE LOCATION**, not the marketplace root.

### Path Resolution Testing

```bash
# From marketplace root (/home/user/marketplace):
$ ls ./plugins/typescript-hooks
✓ Works

# From marketplace.json location (/home/user/marketplace/.claude-plugin):
$ ls ./plugins/typescript-hooks
✗ FAILS - directory not found

$ ls ../plugins/typescript-hooks
✓ WORKS
```

### The Correct Configuration

Since `marketplace.json` is located at:
```
/home/user/marketplace/.claude-plugin/marketplace.json
```

And plugins are at:
```
/home/user/marketplace/plugins/<plugin-name>/
```

The source paths must use `../plugins/...` to:
1. Go up one directory (from `.claude-plugin/` to marketplace root)
2. Then into the `plugins/` directory

### The Fix

Changed all plugin source paths in `.claude-plugin/marketplace.json`:

```diff
- "source": "./plugins/typescript-hooks"
+ "source": "../plugins/typescript-hooks"
```

Applied to all 6 plugins:
- project
- browser
- vscode
- goodfoot
- typescript-hooks
- typescript-claude-code-for-web-setup

### History of Failed Fixes

1. **Commit e4baa54**: Changed from `./plugins/` to `../plugins/` ✓ THIS WAS CORRECT
2. **Commit ad6b993**: Changed back to `./plugins/` based on incorrect assumption ✗ BROKE IT
3. **This session**: Changed back to `../plugins/` ✓ FINAL FIX

### Previous Incorrect Assumptions

The file `PLUGIN_PATH_RESOLUTION.md` (now deleted) incorrectly claimed:
> "For directory-based marketplaces, paths in marketplace.json are resolved relative to the marketplace root directory"

This was **FALSE**. Paths are actually resolved relative to the marketplace.json file location.

### Verification Required

This fix requires **restarting Claude Code** to verify:

1. **Plugin Loading**: Should find 6 plugins
2. **No Errors**: No "plugin-not-found" errors
3. **Hook Registration**: Should register hooks from plugins
4. **SessionStart Execution**: The web-setup plugin should run automatically
5. **Dependencies**: Should install node_modules

### Verification Commands

```bash
# 1. Check plugin count (should be 6, not 0)
grep "Found.*plugins" /tmp/claude-code.log | head -1

# 2. Check for errors (should be empty)
grep -i "plugin.*not found" /tmp/claude-code.log || echo "✓ No errors"

# 3. Check hook registration
grep "Registered.*hooks" /tmp/claude-code.log | head -1

# 4. Verify SessionStart hook executed
[ -f /tmp/web-setup-hook.log ] && echo "✓ Hook executed" && tail -10 /tmp/web-setup-hook.log

# 5. Check dependencies
[ -d /home/user/marketplace/node_modules ] && echo "✓ Dependencies installed"
```

### Key Takeaway

**For directory-based Claude Code marketplaces with `.claude-plugin/marketplace.json`, all plugin source paths must be relative to the marketplace.json file location, NOT the marketplace root.**

Example correct structure:
```
marketplace-root/
  .claude-plugin/
    marketplace.json  ← paths resolve from HERE
  plugins/
    my-plugin/
      .claude-plugin/
        plugin.json
```

In marketplace.json:
```json
{
  "plugins": [
    {
      "name": "my-plugin",
      "source": "../plugins/my-plugin"  ← correct (goes up then into plugins/)
    }
  ]
}
```
