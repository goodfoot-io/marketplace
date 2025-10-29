# Plugin Path Resolution in Directory-Based Marketplaces

## Issue History

This document explains the plugin discovery issue and its resolution.

## The Problem

Between commits `5832297` and `e4baa54`, plugin source paths were changed from:
- `./plugins/typescript-hooks`
- `./plugins/typescript-claude-code-for-web-setup`

To:
- `../plugins/typescript-hooks`
- `../plugins/typescript-claude-code-for-web-setup`

This was based on the incorrect assumption that paths in marketplace.json are resolved relative to the marketplace.json file location.

## The Evidence

From Claude Code logs:
```
[DEBUG] Found 0 plugins (0 enabled, 0 disabled)
[DEBUG] Plugin not available for MCP: typescript-hooks@goodfoot - error type: plugin-not-found
[DEBUG] Plugin not available for MCP: typescript-claude-code-for-web-setup@goodfoot - error type: plugin-not-found
```

## The Root Cause

For **directory-based marketplaces**, paths in marketplace.json are resolved **relative to the marketplace root directory**, not relative to the marketplace.json file location.

### Marketplace Configuration
```json
"extraKnownMarketplaces": {
  "goodfoot": {
    "source": {
      "source": "directory",
      "path": "/home/user/marketplace"
    }
  }
}
```

The marketplace root is: `/home/user/marketplace`
The marketplace.json location: `/home/user/marketplace/.claude-plugin/marketplace.json`
The plugin locations: `/home/user/marketplace/plugins/<plugin-name>/`

### Path Resolution

#### ❌ Incorrect (../plugins/...)
```
marketplace root:  /home/user/marketplace
path in json:      ../plugins/typescript-hooks
resolved path:     /home/user/plugins/typescript-hooks  (doesn't exist!)
```

#### ✅ Correct (./plugins/...)
```
marketplace root:  /home/user/marketplace
path in json:      ./plugins/typescript-hooks
resolved path:     /home/user/marketplace/plugins/typescript-hooks  (exists!)
```

## The Solution

Revert all plugin source paths to use `./plugins/...` format:

```json
{
  "name": "typescript-hooks",
  "source": "./plugins/typescript-hooks",
  ...
}
```

This correctly resolves from the marketplace root directory.

## Verification

After restarting Claude Code with the fix:

1. **Plugin count**: Should find 6 plugins
2. **No errors**: No "plugin-not-found" errors in logs
3. **Hooks work**: SessionStart hook should execute
4. **Dependencies**: Should install automatically via web-setup plugin

## Key Takeaway

**Directory-based marketplace paths are always relative to the marketplace root directory specified in `extraKnownMarketplaces`, not relative to the marketplace.json file location.**
