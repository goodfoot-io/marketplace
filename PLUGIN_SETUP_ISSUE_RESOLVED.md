# Claude Code Plugin Setup Issue - Resolution

## Issue Summary

The `typescript-claude-code-for-web-setup` plugin's SessionStart hook was not executing in the Claude Code for Web environment, preventing automatic dependency installation.

## Root Cause Analysis

### What We Found

1. **Marketplace Source Misconfiguration**
   - The `.claude/settings.json` was configured to load the marketplace from GitHub
   - Configuration: `"source": "github", "repo": "goodfoot-io/marketplace"`
   - This was changed in commit `35206e7` from a local directory source

2. **Local Development Context**
   - We are working **inside** the marketplace repository at `/home/user/marketplace`
   - With GitHub source, Claude Code attempts to fetch marketplace from GitHub
   - Local plugin files were not being loaded by Claude Code

3. **Evidence of Non-Execution**
   - ❌ Log file missing: `/tmp/web-setup-hook.log` does not exist
   - ❌ Dependencies not installed: `node_modules/` directory missing
   - ✅ Environment is correct: `CLAUDE_CODE_REMOTE=true`
   - ✅ Plugin is enabled: `"typescript-claude-code-for-web-setup@goodfoot": true`
   - ✅ Plugin structure is valid

### How Marketplace Sources Work

**GitHub Source** (`"source": "github"`)
- Claude Code fetches marketplace from GitHub repository
- Used for external consumers of the marketplace
- Requires network access to GitHub
- Uses cached/remote version of plugins

**Directory Source** (`"source": "directory"`)
- Claude Code loads marketplace from local filesystem
- **Required for local development** inside the marketplace repo
- Uses current working copy of plugins
- No network access needed

## Resolution

### Changes Made

Updated `.claude/settings.json` marketplace source configuration:

```json
// BEFORE (broken for local development)
"extraKnownMarketplaces": {
  "goodfoot": {
    "source": {
      "source": "github",
      "repo": "goodfoot-io/marketplace"
    }
  }
}

// AFTER (fixed for local development)
"extraKnownMarketplaces": {
  "goodfoot": {
    "source": {
      "source": "directory",
      "path": "/home/user/marketplace"
    }
  }
}
```

### File Modified

- `.claude/settings.json` - Marketplace source configuration

## Verification Required

**⚠️ Session Restart Required**

Changes to `.claude/settings.json` require a Claude Code session restart to take effect:

1. Exit the current Claude Code session
2. Start a new session in this workspace
3. The SessionStart hook should execute automatically
4. Expected outcomes:
   - Log file created: `/tmp/web-setup-hook.log`
   - Dependencies installed: `node_modules/` directory present
   - Console output showing setup progress

### How to Verify

After restarting the session:

```bash
# 1. Check if hook executed
cat /tmp/web-setup-hook.log

# 2. Verify dependencies installed
ls -la node_modules/ | head -20

# 3. Confirm package manager detection
# Look for "Detected package manager: yarn" in the log
grep "Detected package manager" /tmp/web-setup-hook.log
```

## Plugin Documentation Review

### Official Claude Code Plugins Documentation

Based on research of official Claude Code documentation:

1. **Plugin Structure**
   - Plugins must have a `.claude-plugin/plugin.json` manifest ✅
   - Hooks are defined in `hooks/hooks.json` ✅
   - SessionStart hooks execute during session initialization ✅

2. **Hook Configuration**
   - Environment variable `${CLAUDE_PLUGIN_ROOT}` provides plugin directory path ✅
   - `bypassWorkspaceApproval: true` allows auto-execution ✅
   - Timeout configurable (currently 720 seconds) ✅

3. **Marketplace Configuration**
   - Marketplace manifest in `.claude-plugin/marketplace.json` ✅
   - Plugins listed with relative paths from marketplace root ✅
   - Plugin entries include name, description, version, tags ✅

### Plugin Structure Verified

```
plugins/typescript-claude-code-for-web-setup/
├── .claude-plugin/
│   └── plugin.json          ✅ Valid manifest
├── hooks/
│   ├── hooks.json          ✅ SessionStart hook configured
│   ├── web-setup           ✅ Main setup script
│   └── web-setup-wrapper   ✅ Logging wrapper
├── tests/
│   └── test-web-setup.sh   ✅ Test suite
└── README.md               ✅ Comprehensive documentation
```

## Recommendations

### For Local Development

When working inside the marketplace repository:
- ✅ Use `directory` source (current configuration)
- ✅ Path points to current workspace: `/home/user/marketplace`

### For Distribution

When publishing the marketplace for external use:
- Use `github` source
- Format: `"repo": "goodfoot-io/marketplace"`
- This allows external users to consume the marketplace from GitHub

### Dual Configuration Strategy

Consider documenting in the README:
1. Default committed configuration should be `github` for external users
2. Developers should locally override to `directory` source
3. Add `.claude/settings.json` to `.gitignore` (if not already)
4. Provide a `.claude/settings.json.example` with both configurations

## Related Files

- `.claude/settings.json` - Marketplace configuration (modified)
- `plugins/typescript-claude-code-for-web-setup/hooks/hooks.json` - Hook definition
- `plugins/typescript-claude-code-for-web-setup/hooks/web-setup-wrapper` - Logging wrapper
- `plugins/typescript-claude-code-for-web-setup/hooks/web-setup` - Main setup script
- `.claude-plugin/marketplace.json` - Marketplace manifest

## Git History

- `35206e7` - Changed marketplace source to GitHub (caused issue)
- Current commit - Reverted to directory source (fixes issue)

## Status

- ✅ Issue identified
- ✅ Root cause determined
- ✅ Configuration fixed
- ⏳ **Restart required to verify fix**
- ⏳ **Dependencies installation pending restart**

---

**Next Steps**: Restart Claude Code session to verify the SessionStart hook executes successfully and installs dependencies.
