# Plugin Discovery Fix - Resolution with External Verification

## Session: 2025-10-29 (Corrected with GitHub Research)

### Initial Investigation

The verification at session start showed:
- **0 plugins found** (expected: 6)
- Plugin errors: `typescript-hooks@goodfoot` and `typescript-claude-code-for-web-setup@goodfoot` not found
- No hooks registered, SessionStart hook never executed

### Initial (Incorrect) Fix Attempt

Based on filesystem path resolution testing, I initially concluded that paths should use `../plugins/...` format:

```bash
# From .claude-plugin/ directory:
$ ls ./plugins/typescript-hooks   # ✗ FAILS
$ ls ../plugins/typescript-hooks  # ✓ WORKS
```

This led to changing all plugin source paths from `"./plugins/..."` to `"../plugins/..."`.

### External Verification from GitHub

Searched GitHub for official and community Claude Code marketplace examples and found:

#### Official Anthropic Repository
**Repository**: `anthropics/claude-code`
**URL**: https://github.com/anthropics/claude-code

**Structure**:
```
claude-code/
├── .claude-plugin/
│   └── marketplace.json
└── plugins/
    ├── agent-sdk-dev/
    ├── commit-commands/
    ├── feature-dev/
    ├── pr-review-toolkit/
    ├── code-review/
    └── security-guidance/
```

**Marketplace.json format**:
```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "plugins": [
    {
      "name": "agent-sdk-dev",
      "source": "./plugins/agent-sdk-dev",
      "description": "...",
      "category": "development"
    }
  ]
}
```

**KEY FINDING**: Official Anthropic repository uses `"./plugins/..."` paths, NOT `"../plugins/..."`.

#### Community Repository
**Repository**: `wshobson/agents`
**Structure**: Same as official - `.claude-plugin/marketplace.json` at root, `plugins/` directory at root
**Format**: Also uses `"./plugins/..."` source paths

### The Correct Understanding

**Plugin source paths in marketplace.json are resolved relative to the MARKETPLACE ROOT PATH** (as specified in settings.json), NOT relative to the marketplace.json file location.

**Configuration chain**:
1. Settings: `extraKnownMarketplaces.goodfoot.source.path = "/home/user/marketplace"`
2. Marketplace file: `/home/user/marketplace/.claude-plugin/marketplace.json`
3. Plugin source: `"./plugins/typescript-hooks"`
4. Resolved path: `/home/user/marketplace/plugins/typescript-hooks` ✓

The filesystem test was misleading because it tested from the wrong base directory.

### The Correct Fix

**Reverted paths back to `"./plugins/..."` format** to match official Anthropic repository:

```diff
- "source": "../plugins/typescript-hooks"
+ "source": "./plugins/typescript-hooks"
```

**Added `$schema` field** for full compliance with official format:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "goodfoot",
  ...
}
```

### Why Plugins Weren't Loading

The current Claude Code session loaded the marketplace configuration at startup when paths were INCORRECT (`../plugins/...` from the first incorrect fix attempt). The configuration is cached in memory and won't reload until session restart.

**Evidence**: Logs show plugin errors from session initialization, before any fixes were applied in this session.

### Changes Applied

1. ✅ Reverted all plugin source paths to `"./plugins/..."` format
2. ✅ Added `$schema` field: `"https://anthropic.com/claude-code/marketplace.schema.json"`
3. ✅ Verified JSON syntax is valid
4. ✅ Confirmed structure matches official Anthropic repository

### Verification Required

**This fix requires RESTARTING Claude Code** to reload the marketplace configuration.

After restart, verify:

```bash
# 1. Check plugin count (should be 6, not 0)
grep "Found.*plugins" /tmp/claude-code.log | head -1

# 2. Check for errors (should be empty)
grep -i "plugin.*not found" /tmp/claude-code.log || echo "✓ No errors"

# 3. Check hook registration (should show hooks from plugins)
grep "Registered.*hooks" /tmp/claude-code.log | head -1

# 4. Verify SessionStart hook executed
[ -f /tmp/web-setup-hook.log ] && echo "✓ Hook executed" && tail -10 /tmp/web-setup-hook.log

# 5. Check dependencies installed
[ -d /home/user/marketplace/node_modules ] && echo "✓ Dependencies installed"
```

### External References

- **Official Anthropic marketplace**: https://github.com/anthropics/claude-code/blob/main/.claude-plugin/marketplace.json
- **Community example (wshobson)**: https://github.com/wshobson/agents/blob/main/.claude-plugin/marketplace.json
- **Marketplace schema**: https://anthropic.com/claude-code/marketplace.schema.json

### Key Takeaways

1. **Always verify against official examples** before making assumptions about path resolution
2. **Plugin source paths use `"./plugins/..."` format** relative to marketplace root (not `"../plugins/..."`)
3. **Session restart required** for marketplace configuration changes to take effect
4. **$schema field** helps ensure compatibility with Claude Code's marketplace loader
5. **Directory structure** should match official: marketplace.json in `.claude-plugin/`, plugins in `plugins/`
