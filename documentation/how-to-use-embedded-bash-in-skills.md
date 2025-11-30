# How to Use Embedded Bash in Skills

This guide covers best practices for adding embedded bash environment checks to Claude Code skills. These checks run automatically when the skill loads, providing immediate feedback about dependencies, credentials, and service availability.

## When to Use Embedded Bash

Embedded bash is valuable when a skill requires:

- **External services** (browsers, APIs, databases)
- **Credential files** (OAuth tokens, API keys, certificates)
- **Runtime dependencies** (tsx, node, python)
- **Package dependencies** (npm packages, pip packages)
- **Network connectivity** (local services, remote endpoints)

## Syntax Reference

### Multi-line Block

````markdown
```!
# Commands execute when skill loads
echo "Hello from embedded bash"
```
````

### Inline Substitution

```markdown
Current directory: !`pwd`
```

### Key Behaviors

- All ```` ```! ```` blocks run **in parallel** (not sequentially)
- Each block runs in **isolated context** (variables don't persist between blocks)
- Output is **substituted** into the skill content before Claude sees it
- **Non-zero exit codes cause the skill to fail to load** - see "Exit Code Requirement" below

## Design Process

### Step 1: Identify What to Check

Start by listing everything the skill needs to function:

| Category | Questions to Ask |
|----------|------------------|
| **Files** | What config files are needed? Where are they stored? |
| **Services** | What external services must be running? On what ports? |
| **Runtime** | What interpreters/tools are needed (tsx, python, etc.)? |
| **Packages** | What libraries must be installed? |
| **Network** | Can we reach required endpoints? |
| **Credentials** | What auth tokens/keys are needed? Do they expire? |

### Step 2: Prioritize Checks

Not all checks are equally important. Prioritize by:

1. **Blocking issues** - Things that will definitely cause failure
2. **Likely issues** - Common problems users encounter
3. **Informational** - Nice to know but not critical

Example priority matrix:

| Priority | Browser Skill | Gmail Skill |
|----------|--------------|-------------|
| High | CDP endpoint available | Credential files exist |
| High | tsx installed | Token not corrupted |
| Medium | Container detection | Token expiration status |
| Medium | puppeteer-core installed | googleapis installed |
| Low | Page count | nodemailer installed |

### Step 3: Design Failure Messages

Each check needs clear messaging for all states:

| State | Icon | Message Style |
|-------|------|---------------|
| Success | `✓` | Brief confirmation with key info |
| Blocked | `❌` | Operation cannot proceed - agent must stop |
| Warning | `⚠️` | Problem but can proceed with caution |
| Info | `ℹ️` | Situational awareness, no action needed |

**Good messaging principles:**

```bash
# Bad: Vague error
echo "Error: Setup incomplete"

# Good: Specific problem + action
echo "⚠️  Missing: client_secret.json"
echo "   Download from Google Cloud Console → Credentials"
```

```bash
# Bad: Just status
echo "Token expired"

# Good: Status + what happens next
echo "✓ Credentials ready (token expired, will auto-refresh)"
```

### Step 4: Design Agent-Actionable Instructions

**Critical insight**: The agent reads the embedded bash output and decides what to do. If output just shows warnings, the agent may still attempt operations that will fail. You must explicitly tell the agent whether to STOP or PROCEED.

#### Blocking vs Non-Blocking Issues

| Type | Agent Action | Message Pattern |
|------|--------------|-----------------|
| **Blocking** | Must stop, guide user | `❌ BLOCKED:` + `STOP. Do not attempt...` |
| **Non-blocking** | Can proceed with awareness | `⚠️` warning only |

#### The BLOCKED Pattern

For issues that prevent the skill from functioning:

```bash
if [ ! -d "$CRED_PATH" ]; then
  BLOCKED="yes"
  echo "❌ BLOCKED: ~/.my-skill/ directory not found"
  echo ""
  echo "STOP. Do not attempt skill operations."
  echo "Ask user: \"Credentials aren't configured. Would you like me to help set them up?\""
  echo "If yes, read: ${CLAUDE_PLUGIN_ROOT}/skills/my-skill/advanced/setup.md"
fi
```

**Key elements:**
1. `❌ BLOCKED:` - Clear visual signal
2. `STOP. Do not attempt X operations.` - Explicit instruction
3. `Ask user: "..."` - Exact phrasing for the agent to use
4. `If yes, read: <path>` - Reference to setup documentation

#### Ready Signal

When all checks pass, explicitly signal readiness:

```bash
# At end of all checks - use if statement to ensure exit code 0
if [ -z "$BLOCKED" ]; then
  echo ""
  echo "Ready to execute skill operations."
fi
```

This gives the agent a clear green light to proceed.

**Important:** Do NOT use `[ -z "$BLOCKED" ] && echo "Ready"` as the last line. If `BLOCKED` is set, the `[` command returns exit code 1, which causes the entire skill to fail to load. Always use an `if` statement for the final status check.

### Step 5: Reference Plugin Documentation

Use `CLAUDE_PLUGIN_ROOT` to reference documentation within your plugin. This environment variable is available in embedded bash and contains the absolute path to your plugin directory.

#### The CLAUDE_PLUGIN_ROOT Variable

```bash
# Available in embedded bash - points to plugin root
echo "Plugin path: ${CLAUDE_PLUGIN_ROOT}"
# Output: Plugin path: /workspace/plugins/my-plugin
```

#### Referencing Setup Documentation

When the agent needs to read additional documentation to help the user:

```bash
if [ ! -f "$CRED_PATH/config.json" ]; then
  BLOCKED="yes"
  echo "❌ BLOCKED: config.json not found"
  echo ""
  echo "STOP. Do not attempt operations."
  echo "Setup guide: ${CLAUDE_PLUGIN_ROOT}/skills/my-skill/advanced/setup.md"
fi
```

The agent will see the expanded path and can read the file to get detailed setup instructions.

#### Path Expansion Examples

```bash
# Reference skill documentation
echo "Setup guide: ${CLAUDE_PLUGIN_ROOT}/skills/my-skill/advanced/oauth-setup.md"
# Expands to: Setup guide: /workspace/plugins/gmail/skills/gmail/advanced/oauth-setup.md

# Reference plugin root files
echo "See: ${CLAUDE_PLUGIN_ROOT}/README.md"
# Expands to: See: /workspace/plugins/gmail/README.md
```

## Testing Process

### Test Each Scenario

Before finalizing, test every possible state:

```bash
# 1. Happy path - everything works
# 2. Missing directory
# 3. Missing individual files
# 4. Invalid/corrupted files
# 5. Expired credentials
# 6. Missing dependencies
# 7. Service not running
# 8. Non-standard configuration (different ports, paths)
```

### Test Script Template

```bash
#!/bin/bash
# Test all scenarios for a skill's embedded bash

echo "=== Scenario 1: Happy Path ==="
# Set up complete environment
# Run check
# Verify output shows success

echo "=== Scenario 2: Missing Directory ==="
# Remove directory
# Run check
# Verify output shows correct error + fix

echo "=== Scenario 3: Partial Setup ==="
# Create directory but not all files
# Run check
# Verify progressive error messages

# ... continue for each scenario
```

### Verify Error Handling

For each check, ensure:

1. **No silent failures** - Every path produces output
2. **Graceful degradation** - Missing optional deps don't block
3. **Clear next steps** - User knows exactly what to do
4. **Cross-platform support** - Works on Linux, macOS, containers

## Common Patterns

### Progressive Status Checks

Check prerequisites in order, stopping at first failure:

```bash
CRED_PATH="$HOME/.my-skill"

if [ ! -d "$CRED_PATH" ]; then
  echo "⚠️  Setup required: $CRED_PATH not found"
  echo "   mkdir -p $CRED_PATH && see docs/setup.md"
elif [ ! -f "$CRED_PATH/config.json" ]; then
  echo "⚠️  Missing: config.json"
  echo "   Create config file - see docs/setup.md"
elif [ ! -f "$CRED_PATH/credentials.json" ]; then
  echo "⚠️  Missing: credentials.json (config.json ✓)"
  echo "   Run authorization flow"
else
  echo "✓ Configuration complete"
fi
```

### Service Discovery with Port Scanning

```bash
FOUND_PORT=""
for PORT in 9222 9223 9224; do
  if curl -s --connect-timeout 1 "http://localhost:$PORT/health" >/dev/null 2>&1; then
    FOUND_PORT=$PORT
    break
  fi
done

if [ -n "$FOUND_PORT" ]; then
  [ "$FOUND_PORT" != "9222" ] && echo "ℹ️  Service on non-standard port $FOUND_PORT"
  echo "✓ Service available on port $FOUND_PORT"
else
  echo "ℹ️  No service found (checked ports 9222-9224)"
  echo "   Start with: my-service --port=9222"
fi
```

### Container Environment Detection

```bash
CONTAINER_TYPE="" HOST_IP="127.0.0.1"

if [ -f /.dockerenv ] || grep -sq "docker\|containerd" /proc/1/cgroup 2>/dev/null; then
  IP=$(getent hosts host.docker.internal 2>/dev/null | awk '{print $1}')
  [ -n "$IP" ] && CONTAINER_TYPE="Docker" && HOST_IP="$IP"
elif [ -f /run/.containerenv ]; then
  IP=$(getent hosts host.containers.internal 2>/dev/null | awk '{print $1}')
  [ -n "$IP" ] && CONTAINER_TYPE="Podman" && HOST_IP="$IP"
elif grep -sq "microsoft\|WSL" /proc/version 2>/dev/null; then
  IP=$(ip route show default 2>/dev/null | awk '{print $3}')
  [ -n "$IP" ] && CONTAINER_TYPE="WSL" && HOST_IP="$IP"
fi

[ -n "$CONTAINER_TYPE" ] && echo "📦 $CONTAINER_TYPE detected - Host: $HOST_IP"
```

### Runtime/Package Checks

```bash
# Runtime check with install instructions
if command -v tsx >/dev/null 2>&1; then
  echo "✓ tsx $(tsx --version 2>&1 | head -1)"
else
  echo "⚠️  tsx not found"
  if command -v npm >/dev/null 2>&1; then
    echo "   Install: npm install -g tsx"
  elif command -v yarn >/dev/null 2>&1; then
    echo "   Install: yarn global add tsx"
  else
    echo "   Install Node.js first, then: npm install -g tsx"
  fi
fi

# Package check (npm)
if [ -d "node_modules/my-package" ]; then
  VER=$(node -p "require('my-package/package.json').version" 2>/dev/null || echo "?")
  echo "✓ my-package@$VER"
elif command -v npm >/dev/null 2>&1 && npm list my-package 2>/dev/null | grep -q my-package; then
  echo "✓ my-package (npm)"
else
  echo "⚠️  my-package not found - npm install my-package"
fi
```

### Token/Credential Validation

```bash
CRED_PATH="$HOME/.my-skill"

if [ -f "$CRED_PATH/tokens.json" ]; then
  # Validate JSON syntax
  if node -e "JSON.parse(require('fs').readFileSync('$CRED_PATH/tokens.json'))" 2>/dev/null; then

    # Check expiration
    EXPIRY=$(node -p "JSON.parse(require('fs').readFileSync('$CRED_PATH/tokens.json')).expiry_date || 0" 2>/dev/null)
    NOW_MS=$(($(date +%s) * 1000))

    if [ -n "$EXPIRY" ] && [ "$EXPIRY" != "0" ] && [ "$EXPIRY" -gt "$NOW_MS" ] 2>/dev/null; then
      REMAINING_MIN=$(((EXPIRY - NOW_MS) / 60000))
      echo "✓ Token valid for ${REMAINING_MIN}m"
    else
      echo "✓ Token expired (will auto-refresh)"
    fi

    # Check for refresh capability
    HAS_REFRESH=$(node -p "JSON.parse(require('fs').readFileSync('$CRED_PATH/tokens.json')).refresh_token ? 'yes' : 'no'" 2>/dev/null)
    [ "$HAS_REFRESH" != "yes" ] && echo "  ⚠️  No refresh_token - re-auth needed when token expires"

    # Warn about token age (for services with refresh token expiry)
    if stat --version 2>/dev/null | grep -q GNU; then
      FILE_MTIME=$(stat -c %Y "$CRED_PATH/tokens.json")
    else
      FILE_MTIME=$(stat -f %m "$CRED_PATH/tokens.json" 2>/dev/null || stat -c %Y "$CRED_PATH/tokens.json")
    fi
    AGE_DAYS=$(( ($(date +%s) - FILE_MTIME) / 86400 ))
    [ $AGE_DAYS -gt 150 ] && echo "  ⚠️  Token ${AGE_DAYS} days old - may expire soon"

  else
    echo "⚠️  tokens.json is invalid JSON"
  fi
fi
```

### Optional Dependencies

For optional features, use informational messaging (not warnings):

```bash
# Only show if present (silent if missing)
if [ -d "node_modules/optional-package" ]; then
  VER=$(node -p "require('optional-package/package.json').version" 2>/dev/null || echo "?")
  echo "✓ optional-package@$VER (feature X supported)"
fi

# Or show as info (not warning) if missing
if [ -d "node_modules/optional-package" ]; then
  echo "✓ optional-package installed (feature X supported)"
else
  echo "ℹ️  optional-package not installed (feature X unavailable)"
fi
```

## Cross-Platform Considerations

### Commands That Differ

| Operation | Linux | macOS | Solution |
|-----------|-------|-------|----------|
| File mtime | `stat -c %Y` | `stat -f %m` | Check for GNU stat first |
| IP addresses | `hostname -I` | `ipconfig getifaddr en0` | Try both with fallback |
| Memory info | `free -m` | `vm_stat` | Skip or use node |
| Process search | `pgrep` | `pgrep` (may differ) | Use `ps aux \| grep` as fallback |

### Safe Cross-Platform Pattern

```bash
# Check which variant we have
if stat --version 2>/dev/null | grep -q GNU; then
  # GNU (Linux)
  FILE_MTIME=$(stat -c %Y "$FILE")
else
  # BSD (macOS) with fallback
  FILE_MTIME=$(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE")
fi
```

## Anti-Patterns to Avoid

### Silent Failures

```bash
# Bad: No output on failure
curl -s http://localhost:9222/json/version >/dev/null && echo "✓ Connected"

# Good: Always produce output
if curl -s --connect-timeout 2 http://localhost:9222/json/version >/dev/null 2>&1; then
  echo "✓ Connected"
else
  echo "ℹ️  Service not available on localhost:9222"
fi
```

### Assuming Commands Exist

```bash
# Bad: jq might not be installed
CONFIG=$(jq '.setting' config.json)

# Good: Use node (more likely available) or check first
if command -v jq >/dev/null 2>&1; then
  CONFIG=$(jq '.setting' config.json)
elif command -v node >/dev/null 2>&1; then
  CONFIG=$(node -p "require('./config.json').setting")
else
  echo "⚠️  Cannot parse config (install jq or node)"
fi
```

### Blocking on Optional Features

```bash
# Bad: Fails skill load for optional feature
[ -d "node_modules/optional" ] || { echo "ERROR: optional not found"; exit 1; }

# Good: Informational only
if [ -d "node_modules/optional" ]; then
  echo "✓ optional feature available"
fi
# (no else - just don't mention it)
```

### Exposing Secrets

```bash
# Bad: Shows full token
echo "Token: $(cat ~/.creds/token.json)"

# Good: Show status only, or mask
echo "✓ Token file present"
# Or if you must show identity:
CLIENT_ID=$(node -p "JSON.parse(require('fs').readFileSync('$CRED_PATH/creds.json')).client_id" 2>/dev/null)
echo "✓ Client: ${CLIENT_ID:0:8}...${CLIENT_ID: -4}"
```

### Non-Zero Exit Codes

The script's exit code is the exit code of its last command. If the last command fails (returns non-zero), the entire skill fails to load.

```bash
# Bad: If BLOCKED is set, [ returns exit code 1, skill fails to load
[ -z "$BLOCKED" ] && echo "Ready to execute operations."

# Good: if statement always returns 0, skill loads successfully
if [ -z "$BLOCKED" ]; then
  echo "Ready to execute operations."
fi
```

Other commands that can cause non-zero exit codes:
- `grep` returns 1 when no matches found
- `[ condition ]` returns 1 when condition is false
- `command && other` returns non-zero if `command` fails

Always ensure your last command succeeds, or use an `if` statement.

## Complete Example

Here's a complete embedded bash block following all best practices, including agent-actionable instructions:

```bash
```!
# === My Skill Environment Check ===
CRED_PATH="$HOME/.my-skill"
BLOCKED=""

# 1. Container detection (informational)
CONTAINER_TYPE="" SERVICE_HOST="127.0.0.1"
if [ -f /.dockerenv ] || grep -sq "docker" /proc/1/cgroup 2>/dev/null; then
  IP=$(getent hosts host.docker.internal 2>/dev/null | awk '{print $1}')
  [ -n "$IP" ] && CONTAINER_TYPE="Docker" && SERVICE_HOST="$IP"
fi
[ -n "$CONTAINER_TYPE" ] && echo "📦 $CONTAINER_TYPE detected - Host: $SERVICE_HOST"

# 2. Service availability (blocking if not found)
FOUND_PORT=""
for PORT in 8080 8081 3000; do
  URL="http://${SERVICE_HOST}:${PORT}"
  if RESPONSE=$(curl -s --connect-timeout 1 "$URL/health" 2>/dev/null) && [ -n "$RESPONSE" ]; then
    FOUND_PORT=$PORT
    break
  fi
done

if [ -n "$FOUND_PORT" ]; then
  [ "$FOUND_PORT" != "8080" ] && echo "ℹ️ Service on non-standard port $FOUND_PORT"
  echo "✓ Service ready on $SERVICE_HOST:$FOUND_PORT"
else
  BLOCKED="yes"
  echo "❌ BLOCKED: No service found on $SERVICE_HOST"
  echo ""
  echo "STOP. Do not attempt skill operations."
  echo "Ask user to start the service:"
  echo "  my-service --port=8080"
fi

# 3. Credential files (blocking if missing)
if [ ! -d "$CRED_PATH" ]; then
  BLOCKED="yes"
  echo "❌ BLOCKED: $CRED_PATH directory not found"
  echo ""
  echo "STOP. Do not attempt skill operations."
  echo "Ask user: \"Credentials aren't configured. Would you like me to help set them up?\""
  echo "If yes, read: ${CLAUDE_PLUGIN_ROOT}/skills/my-skill/advanced/setup.md"
elif [ ! -f "$CRED_PATH/config.json" ]; then
  BLOCKED="yes"
  echo "❌ BLOCKED: config.json not found"
  echo ""
  echo "STOP. Do not attempt skill operations."
  echo "User needs to create config file."
  echo "Setup guide: ${CLAUDE_PLUGIN_ROOT}/skills/my-skill/advanced/setup.md"
else
  if node -e "JSON.parse(require('fs').readFileSync('$CRED_PATH/config.json'))" 2>/dev/null; then
    echo "✓ Configuration valid"
  else
    BLOCKED="yes"
    echo "❌ BLOCKED: config.json is corrupted (invalid JSON)"
    echo ""
    echo "STOP. Do not attempt skill operations."
    echo "User needs to fix or recreate config file."
  fi
fi

# 4. Runtime (blocking if missing)
if command -v tsx >/dev/null 2>&1; then
  echo "✓ tsx $(tsx --version 2>&1 | head -1)"
else
  BLOCKED="yes"
  echo "❌ BLOCKED: tsx not installed"
  echo "   Cannot execute scripts. Install with: npm install -g tsx"
fi

# 5. Required package (blocking if missing)
if [ -d "node_modules/required-pkg" ]; then
  VER=$(node -p "require('required-pkg/package.json').version" 2>/dev/null || echo "?")
  echo "✓ required-pkg@$VER"
else
  BLOCKED="yes"
  echo "❌ BLOCKED: required-pkg not installed"
  echo "   Cannot execute scripts. Install with: npm install required-pkg"
fi

# 6. Optional package (non-blocking, silent if missing)
if [ -d "node_modules/optional-pkg" ]; then
  VER=$(node -p "require('optional-pkg/package.json').version" 2>/dev/null || echo "?")
  echo "✓ optional-pkg@$VER (feature X enabled)"
fi

# 7. Final status - use if statement to ensure exit code 0
if [ -z "$BLOCKED" ]; then
  echo ""
  echo "Ready to execute skill operations."
fi
```
```

**Example outputs:**

Blocked (credentials missing):
```
❌ BLOCKED: ~/.my-skill/ directory not found

STOP. Do not attempt skill operations.
Ask user: "Credentials aren't configured. Would you like me to help set them up?"
If yes, read: /workspace/plugins/my-plugin/skills/my-skill/advanced/setup.md
✓ tsx tsx v4.20.6
✓ required-pkg@1.0.0
```

Ready (all checks pass):
```
📦 Docker detected - Host: 192.168.65.254
✓ Service ready on 192.168.65.254:8080
✓ Configuration valid
✓ tsx tsx v4.20.6
✓ required-pkg@1.0.0
✓ optional-pkg@2.0.0 (feature X enabled)

Ready to execute skill operations.
```

## Checklist

Before finalizing your embedded bash:

**Agent Instructions:**
- [ ] Blocking issues use `❌ BLOCKED:` prefix
- [ ] Blocking issues include `STOP. Do not attempt X operations.`
- [ ] Blocking issues suggest what to ask/tell the user
- [ ] Setup documentation paths use `${CLAUDE_PLUGIN_ROOT}` variable
- [ ] All checks pass → `Ready to execute X operations.` message

**Message Quality:**
- [ ] Every code path produces output (no silent failures)
- [ ] Success messages are brief with key info (`✓ Service ready on :8080`)
- [ ] Warning messages include specific fix actions
- [ ] Optional dependencies don't show warnings when missing

**Technical:**
- [ ] **Script always exits with code 0** (use `if` statement for final status, not `&&`)
- [ ] Cross-platform commands have fallbacks
- [ ] Timeouts are set on network operations (`--connect-timeout`)
- [ ] Secrets/tokens are not exposed in output
- [ ] Non-standard configurations are detected and noted
- [ ] All realistic scenarios have been tested
- [ ] Error messages reference relevant documentation
