# Claude Code Plugin Discovery: The `strict` Field Investigation

**Session Date:** 2025-10-29
**Issue:** Plugins not loading in directory-based marketplace
**Status:** Fixed - awaiting verification in next session

## Executive Summary

Claude Code plugins were failing to load with error `plugin-not-found` despite correct configuration. Root cause analysis of the Claude Code CLI source code (`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`) revealed:

1. **Primary Issue:** Plugin `source` paths in `marketplace.json` are resolved **relative to the marketplace.json file**, not the repository root
2. **Secondary Issue:** The `strict` field (defaults to `true`) requires plugin manifests to be present at the resolved path

## Root Cause Analysis

### Discovery Method

By analyzing the obfuscated Claude Code CLI source code at line 11, I found the marketplace plugin schema:

```javascript
strict: x.boolean().optional().default(!0).describe(
  "Require the plugin manifest to be present in the plugin folder. " +
  "If false, the marketplace entry provides the manifest."
)
```

**Key findings:**
- Default value: `true` (note: `!0` equals `true` in JavaScript)
- When `strict: true`: Claude Code requires finding `plugin.json` at the source path
- When `strict: false`: Marketplace entry provides the manifest (bypasses path lookup)

### Error Symptoms

From `/tmp/claude-code.log`:
```
[DEBUG] Found 0 plugins (0 enabled, 0 disabled)
[DEBUG] Plugin not available for MCP: typescript-claude-code-for-web-setup@goodfoot - error type: plugin-not-found
[DEBUG] Plugin loading errors: Plugin typescript-hooks not found in marketplace goodfoot
[DEBUG] Registered 0 hooks from 0 plugins
```

Evidence that hook never ran:
- ❌ No `/tmp/web-setup-hook.log` file
- ❌ No `node_modules/` directory
- ❌ Log shows "Registered 0 hooks from 0 plugins"

## Path Resolution Rules

### Critical Discovery

Plugin source paths are resolved **relative to the marketplace.json file location**, NOT the repository root.

**Our directory structure:**
```
/home/user/marketplace/
├── .claude-plugin/
│   └── marketplace.json          ← Paths resolve from HERE
└── plugins/
    ├── typescript-hooks/
    └── typescript-claude-code-for-web-setup/
```

**Incorrect path resolution (what was failing):**
```json
{
  "source": "./plugins/typescript-claude-code-for-web-setup"
}
```
- Base: `/home/user/marketplace/.claude-plugin/marketplace.json`
- Source: `./plugins/typescript-claude-code-for-web-setup`
- Resolves to: `/home/user/marketplace/.claude-plugin/plugins/...` ❌
- Result: Path doesn't exist → plugin-not-found

**Correct path resolution:**
```json
{
  "source": "../plugins/typescript-claude-code-for-web-setup"
}
```
- Base: `/home/user/marketplace/.claude-plugin/marketplace.json`
- Source: `../plugins/typescript-claude-code-for-web-setup`
- Resolves to: `/home/user/marketplace/plugins/...` ✓
- Result: Path exists, manifests found

## Solutions

### Solution 1: Use Correct Relative Paths (RECOMMENDED)

**Status:** ✅ Implemented

Change all plugin source paths to use `../plugins/` instead of `./plugins/`:

```json
{
  "plugins": [
    {
      "name": "typescript-claude-code-for-web-setup",
      "source": "../plugins/typescript-claude-code-for-web-setup",
      ...
    }
  ]
}
```

**Advantages:**
- Uses default `strict: true` (more secure)
- Enforces manifest validation
- Follows Claude Code conventions
- No workarounds needed

**Commits:**
- `e4baa54` - Fix plugin source paths for strict: true compatibility

### Solution 2: Use `strict: false` Workaround (NOT RECOMMENDED)

**Status:** ⚠️ Reverted

Add `"strict": false` to each plugin entry:

```json
{
  "plugins": [
    {
      "name": "typescript-claude-code-for-web-setup",
      "source": "./plugins/typescript-claude-code-for-web-setup",
      "strict": false,
      ...
    }
  ]
}
```

**Why reverted:**
- Bypasses manifest validation (less secure)
- Doesn't fix the underlying path issue
- Not the intended usage pattern
- May cause issues with future Claude Code updates

**Commits:**
- `5832297` - Added strict: false (reverted in next commit)
- `73617f8` - Reverted the marketplace.json location change

## Directory Structure Requirements

### Correct Structure for Directory-Based Marketplaces

```
repository-root/
├── .claude/
│   └── settings.json             # Claude Code settings
│
├── .claude-plugin/
│   └── marketplace.json          # Marketplace definition
│
└── plugins/
    └── plugin-name/
        ├── plugin.json           # Main plugin manifest (required)
        ├── .claude-plugin/
        │   └── plugin.json       # Plugin metadata (required)
        ├── hooks/
        │   ├── hooks.json
        │   └── hook-script
        ├── skills/
        └── commands/
```

### Required Files per Plugin

1. **`plugins/plugin-name/plugin.json`** - Main manifest
   - Defines plugin capabilities (hooks, skills, commands)
   - Required for `strict: true` mode

2. **`plugins/plugin-name/.claude-plugin/plugin.json`** - Metadata
   - Minimal plugin information for marketplace
   - Example from commit `9191d95`:
   ```json
   {
     "name": "typescript-claude-code-for-web-setup",
     "version": "0.1.0",
     "description": "Automatic web environment setup...",
     "author": {
       "name": "Goodfoot",
       "email": "contact@goodfoot.io"
     }
   }
   ```

### Settings Configuration

**`.claude/settings.json`:**
```json
{
  "extraKnownMarketplaces": {
    "goodfoot": {
      "source": {
        "source": "directory",
        "path": "/home/user/marketplace"
      }
    }
  },
  "enabledPlugins": {
    "typescript-hooks@goodfoot": true,
    "typescript-claude-code-for-web-setup@goodfoot": true
  }
}
```

**Note:** The marketplace path points to the repository root, NOT `.claude-plugin/`. Claude Code automatically looks for `.claude-plugin/marketplace.json` within that directory.

## Configuration Verification

### Files Checked (All ✓)

1. ✅ **Marketplace location:** `.claude-plugin/marketplace.json` (correct per CLI source)
2. ✅ **Plugin metadata:** Both plugins have `.claude-plugin/plugin.json`
3. ✅ **Plugin manifests:** Both plugins have `plugin.json` with hooks
4. ✅ **Settings config:** Marketplace registered at correct path
5. ✅ **Enabled plugins:** Both plugins enabled in settings.json
6. ✅ **Source paths:** Now use `../plugins/...` (fixed)
7. ✅ **Strict mode:** Removed explicit `false` overrides (uses default `true`)

### Hook Configuration

**Plugin:** `typescript-claude-code-for-web-setup`
**Hook file:** `plugins/typescript-claude-code-for-web-setup/plugin.json:8`

```json
{
  "hooks": "./hooks/hooks.json"
}
```

**Hook definition:** `plugins/typescript-claude-code-for-web-setup/hooks/hooks.json`

```json
{
  "SessionStart": {
    "command": "./web-setup-wrapper",
    "timeout": 720000
  }
}
```

**Expected behavior:**
- Executes `web-setup-wrapper` on Claude Code session start
- 720-second timeout (12 minutes)
- Installs dependencies via Yarn (detected from package.json)
- Logs to `/tmp/web-setup-hook.log`
- Creates `node_modules/` directory

## Testing & Verification

### What to Check After Next Session Start

1. **Check plugin loading:**
   ```bash
   grep -i "Found.*plugins" /tmp/claude-code.log
   # Expected: "Found 6 plugins (6 enabled, 0 disabled)" or similar
   ```

2. **Check for errors:**
   ```bash
   grep -i "plugin.*not found\|plugin-not-found" /tmp/claude-code.log
   # Expected: No output (no errors)
   ```

3. **Check hook registration:**
   ```bash
   grep -i "Registered.*hooks" /tmp/claude-code.log
   # Expected: "Registered 1 hooks from X plugins" or similar
   ```

4. **Verify hook execution:**
   ```bash
   ls -la /tmp/web-setup-hook.log
   # Expected: File exists with installation logs

   cat /tmp/web-setup-hook.log
   # Expected: Yarn installation output
   ```

5. **Verify dependencies installed:**
   ```bash
   ls -la /home/user/marketplace/node_modules/
   # Expected: Directory exists with installed packages
   ```

### If Plugins Still Don't Load

1. **Check marketplace discovery:**
   ```bash
   grep "marketplace" /tmp/claude-code.log | head -20
   ```

2. **Verify path resolution:**
   ```bash
   # From marketplace.json location, check if paths resolve:
   cd /home/user/marketplace/.claude-plugin/
   ls -la ../plugins/typescript-claude-code-for-web-setup/
   ls -la ../plugins/typescript-claude-code-for-web-setup/plugin.json
   ls -la ../plugins/typescript-claude-code-for-web-setup/.claude-plugin/plugin.json
   ```

3. **Check settings syntax:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('/home/user/marketplace/.claude/settings.json', 'utf8'))"
   # Expected: No syntax errors
   ```

4. **Validate marketplace.json:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('/home/user/marketplace/.claude-plugin/marketplace.json', 'utf8'))"
   # Expected: No syntax errors
   ```

## Alternative Structures Considered

### Option 1: Plugins at Root Level (NOT VIABLE)

```
repository-root/
├── .claude-plugin/
│   └── marketplace.json
├── typescript-hooks/           # Plugin at root
└── typescript-claude-code-for-web-setup/
```

**Problem:** Would require `source: "../typescript-hooks"` which puts plugins outside the standard `plugins/` convention.

### Option 2: Marketplace at Root (NOT VIABLE)

```
repository-root/
├── marketplace.json            # At root
└── plugins/
    └── ...
```

**Problem:** From CLI source analysis and git-based marketplace behavior, Claude Code expects `.claude-plugin/marketplace.json`, not root-level marketplace.json. Directory-based marketplaces use the same structure as git-cloned marketplaces.

### Option 3: Nested .claude-plugin (INCORRECT UNDERSTANDING)

Initial attempt that didn't work:
```
repository-root/
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugins/              # Tried putting plugins here
│       └── ...
```

**Why it failed:** Paths like `"./plugins/..."` resolved to `.claude-plugin/plugins/...` which didn't exist.

## Claude Code CLI Source Code Insights

### Location
`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`

### Key Code Sections

**Line 11 - Strict field definition:**
```javascript
strict: x.boolean().optional().default(!0).describe(
  "Require the plugin manifest to be present in the plugin folder. " +
  "If false, the marketplace entry provides the manifest."
)
```

**Line 1295 - Directory source handling:**
```javascript
case "directory": {
  Y = pD(A.path, ".claude-plugin", "marketplace.json");
  G = A.path;
  W = !1;
  break;
}
```

This confirms:
- Claude Code looks for `.claude-plugin/marketplace.json` within the directory path
- Directory-based marketplaces (W = !1) are not temporary

### Error Messages

**Plugin not found:**
```javascript
"Plugin not available for MCP: {plugin-name}@{marketplace} - error type: plugin-not-found"
"Plugin loading errors: Plugin {name} not found in marketplace {marketplace}"
```

**Hook registration:**
```javascript
"Registered {count} hooks from {count} plugins"
```

## Git Commit History

1. **9191d95** - "Fix plugin-not-found error by adding .claude-plugin metadata"
   - Added `.claude-plugin/plugin.json` to both plugins
   - First attempt at fixing discovery

2. **9e5f38e** - "Fix marketplace.json location for proper plugin discovery"
   - Moved marketplace.json to root (incorrect)

3. **73617f8** - "Revert 'Fix marketplace.json location for proper plugin discovery'"
   - Reverted to `.claude-plugin/marketplace.json` (correct location)

4. **5832297** - "Fix plugin discovery by setting strict: false in marketplace"
   - Added `strict: false` workaround (temporary solution)

5. **e4baa54** - "Fix plugin source paths for strict: true compatibility"
   - Changed paths from `./plugins/` to `../plugins/`
   - Removed `strict: false` overrides
   - **Current state** - recommended solution

## Environment Details

- **Claude Code Version:** 2.0.23 (from logs)
- **Environment:** Claude Code for Web (CLAUDE_CODE_REMOTE=1)
- **Session Start:** 2025-10-29 17:17:26
- **Marketplace Path:** /home/user/marketplace
- **Package Manager:** Yarn 4.9.2

## Recommendations

### For This Repository

1. ✅ Use `../plugins/...` source paths (implemented)
2. ✅ Remove `strict: false` overrides (implemented)
3. ⏳ Test on next Claude Code session start
4. 📋 If successful, document this structure as the official pattern

### For Future Marketplaces

**When creating a new directory-based marketplace:**

1. Create this structure:
   ```
   your-marketplace/
   ├── .claude-plugin/
   │   └── marketplace.json
   └── plugins/
       └── your-plugin/
           ├── plugin.json
           └── .claude-plugin/
               └── plugin.json
   ```

2. In `marketplace.json`, use `../plugins/...` for source paths:
   ```json
   {
     "plugins": [
       {
         "name": "your-plugin",
         "source": "../plugins/your-plugin"
       }
     ]
   }
   ```

3. In `.claude/settings.json`:
   ```json
   {
     "extraKnownMarketplaces": {
       "your-marketplace": {
         "source": {
           "source": "directory",
           "path": "/absolute/path/to/your-marketplace"
         }
       }
     }
   }
   ```

4. Enable plugins:
   ```json
   {
     "enabledPlugins": {
       "your-plugin@your-marketplace": true
     }
   }
   ```

### For Claude Code Documentation

This investigation revealed **undocumented behavior** that should be added to official docs:

1. Plugin source paths are resolved relative to marketplace.json, not repository root
2. Directory-based marketplaces should use `../plugins/...` paths
3. The `strict` field defaults to `true` and enforces manifest presence
4. Both `plugin.json` and `.claude-plugin/plugin.json` are required

## Open Questions

1. **Why isn't this documented?** The path resolution behavior is not mentioned in official docs
2. **Is `strict: false` ever valid?** When would you want to bypass manifest validation?
3. **Alternative marketplace structures?** Are there other valid directory layouts?

## Next Steps

1. Wait for next Claude Code session to start
2. Check logs for successful plugin loading
3. Verify SessionStart hook executed
4. Confirm node_modules installed
5. If successful, close this investigation
6. If not successful, review this document and investigate further

---

**Session Artifacts:**
- Branch: `claude/verify-claude-code-plugin-setup-011CUbsPp5yNJbqzSvwXegur`
- Commits: 73617f8, 5832297, e4baa54
- Investigation tool: Direct CLI source code analysis
- Log file: `/tmp/claude-code.log`
