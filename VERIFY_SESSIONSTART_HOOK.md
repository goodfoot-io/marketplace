# SessionStart Hook Verification Prompt

Hello! This is a verification task to check if the `typescript-claude-code-for-web-setup` plugin's SessionStart hook ran when you started this Claude Code session.

## Background

The marketplace repository has a plugin called `typescript-claude-code-for-web-setup` that should automatically run on SessionStart to install dependencies in web environments. We need to verify it executed correctly.

**Plugin Configuration:**
- **Plugin:** `typescript-claude-code-for-web-setup`
- **Hook Type:** SessionStart
- **Log File:** `/tmp/web-setup-hook.log`
- **Purpose:** Auto-install dependencies for TypeScript/JavaScript projects in Claude Code web environments

## Verification Steps

Please run the following checks and report your findings:

### 1. Check if the hook log file exists

```bash
ls -lh /tmp/web-setup-hook.log
```

**Expected:** File should exist if the hook ran.

### 2. View the complete hook execution log

```bash
cat /tmp/web-setup-hook.log
```

**Look for:**
- Timestamp when it ran
- Exit code (should be 0 for success)
- Any error messages
- Whether dependencies were installed

### 3. Check environment variables

```bash
echo "CLAUDE_CODE_REMOTE: ${CLAUDE_CODE_REMOTE:-not set}"
echo "CLAUDE_PLUGIN_ROOT: ${CLAUDE_PLUGIN_ROOT:-not set}"
```

**Expected:**
- `CLAUDE_CODE_REMOTE` should be "true" in web environments
- `CLAUDE_PLUGIN_ROOT` should point to the plugin directory

### 4. Verify plugin is enabled

```bash
# Check Claude settings for enabled plugins
cat ~/.config/claude/settings.json | grep -A 10 "enabledPlugins" | grep "typescript-claude-code-for-web-setup"
```

**Expected:** Plugin should be listed and enabled (value: true)

### 5. Check plugin structure

```bash
# Verify plugin files exist
ls -la ~/.cache/claude/plugins/cache/typescript-claude-code-for-web-setup/hooks/ 2>/dev/null || \
ls -la /home/user/marketplace/plugins/typescript-claude-code-for-web-setup/hooks/
```

**Expected:** Should see hooks.json, web-setup, and web-setup-wrapper files

### 6. Test hook script manually (if not run automatically)

```bash
cd /home/user/marketplace/plugins/typescript-claude-code-for-web-setup/hooks
./web-setup-wrapper
```

**This will:**
- Execute the hook manually
- Show if there are any permission or execution issues
- Generate a new log file

## Debug Information to Collect if Hook Didn't Run

If the hook did not execute, please gather this information:

```bash
# 1. Check if plugin is in marketplace
cat ~/.cache/claude/marketplaces-config.json 2>/dev/null | python3 -m json.tool | grep -A 5 "goodfoot"

# 2. Check plugin loading errors
grep -i "typescript-claude-code-for-web-setup" ~/.claude/claude-code.log 2>/dev/null | tail -20

# 3. Check SessionStart hook registration
echo "Checking for SessionStart hooks..."
find ~/.cache/claude/plugins -name "hooks.json" -exec grep -l "SessionStart" {} \; 2>/dev/null

# 4. Verify marketplace plugin manifest
cat /home/user/marketplace/.claude-plugin/marketplace.json | python3 -m json.tool | grep -A 10 "typescript-claude-code-for-web-setup"

# 5. Check plugin manifest
cat /home/user/marketplace/plugins/typescript-claude-code-for-web-setup/.claude-plugin/plugin.json
```

## Report Template

Please provide your findings in this format:

```
## SessionStart Hook Verification Results

**Date:** [Date/Time of verification]
**Working Directory:** [pwd output]

### Hook Execution Status
- [ ] Log file exists at /tmp/web-setup-hook.log
- [ ] Hook executed successfully (exit code 0)
- [ ] Hook ran automatically on SessionStart
- [ ] Had to run manually

### Log File Contents
[Paste relevant log output or state "Log file not found"]

### Environment Check
- CLAUDE_CODE_REMOTE: [value]
- CLAUDE_PLUGIN_ROOT: [value]

### Plugin Status
- [ ] Plugin is enabled in settings
- [ ] Plugin files are accessible
- [ ] Hook scripts are executable

### Issues Found (if any)
[Describe any problems]

### Manual Execution Result (if needed)
[Output from running web-setup-wrapper manually]

### Additional Notes
[Any other relevant observations]
```

## Success Criteria

✅ **Hook is working correctly if:**
1. Log file `/tmp/web-setup-hook.log` exists
2. Log shows successful execution (exit code 0)
3. Log timestamp is from when this session started
4. No errors in the log output
5. Dependencies were installed (if package.json exists)

❌ **Hook is NOT working if:**
1. Log file doesn't exist
2. Log shows errors or non-zero exit code
3. Plugin is not enabled in settings
4. Hook scripts don't have execute permissions
5. CLAUDE_CODE_REMOTE != "true" (meaning not in web environment)

## Next Steps Based on Results

**If hook worked:** Report success and share log excerpts showing successful execution.

**If hook didn't work:**
1. Provide all debug information above
2. Note whether this is a web environment (check CLAUDE_CODE_REMOTE)
3. Check if there's a package.json in the current directory
4. Try manual execution and report results

Thank you for running this verification!
