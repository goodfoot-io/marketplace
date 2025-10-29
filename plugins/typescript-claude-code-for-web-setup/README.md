# TypeScript/JavaScript Web Setup Plugin

A Claude Code plugin that automatically sets up web development environments for TypeScript and JavaScript projects with intelligent package manager detection and configuration.

## Overview

This plugin provides a `SessionStart` hook that automatically:

1. **Detects package manager** - Identifies npm, yarn, pnpm, or bun from `package.json` or lock files
2. **Configures environment** - Sets up corepack, proxy settings, and package manager configuration
3. **Installs dependencies** - Runs the appropriate install command with proper flags
4. **Reports status** - Provides detailed logging and timing information

## Features

### Multi-Package Manager Support

Automatically detects and configures:
- **Yarn** (v1, v2, v3, v4+) - with corepack and proxy workarounds
- **pnpm** - with proxy configuration
- **npm** - with proxy configuration
- **bun** - with environment variable support

### Intelligent Detection

1. **Primary**: Reads `packageManager` field from `package.json`
2. **Fallback**: Detects from lock files (`yarn.lock`, `pnpm-lock.yaml`, `package-lock.json`, `bun.lockb`)
3. **Default**: Falls back to npm if no indicators found

### Proxy Support

- Automatically configures proxy settings from `HTTP_PROXY`/`HTTPS_PROXY` environment variables
- Works around corepack proxy issues by pre-downloading package managers with curl
- Stores configuration in user home directory to avoid uncommitted changes

### Claude Code Web Environment

- Only runs when `CLAUDE_CODE_REMOTE=true` (web environment)
- Skips automatically in local development environments
- Designed for containerized cloud development environments

## Installation

### From Marketplace

```bash
/plugin install typescript-claude-code-for-web-setup@goodfoot-marketplace
```

### From Local Directory

Add to your `.claude/settings.json`:

```json
{
  "plugins": [
    {
      "source": "file:///workspace/plugins/typescript-claude-code-for-web-setup",
      "enabled": true
    }
  ]
}
```

### From Git Repository

```json
{
  "plugins": [
    {
      "source": "git::https://github.com/your-org/typescript-claude-code-for-web-setup.git",
      "enabled": true
    }
  ]
}
```

## Configuration

### Package Manager Selection

#### Explicit Configuration (Recommended)

Add a `packageManager` field to your `package.json`:

```json
{
  "name": "my-project",
  "packageManager": "yarn@4.9.2",
  "dependencies": {
    ...
  }
}
```

Supported formats:
- `"yarn@4.9.2"` - Yarn 4.x
- `"pnpm@8.15.0"` - pnpm 8.x
- `"npm@10.2.0"` - npm 10.x
- `"bun@1.0.0"` - bun 1.x

#### Automatic Detection

If no `packageManager` field exists, the plugin detects from lock files:

| Lock File | Package Manager |
|-----------|----------------|
| `yarn.lock` | yarn |
| `pnpm-lock.yaml` | pnpm |
| `package-lock.json` | npm |
| `bun.lockb` | bun |

### Hook Configuration

The default timeout is 720 seconds (12 minutes). To adjust:

Edit `hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "bypassWorkspaceApproval": true,
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/web-setup",
            "timeout": 900,  // Increase to 15 minutes
            "description": "Install dependencies and build shared packages for web environment (with logging)"
          }
        ]
      }
    ]
  }
}
```

### Proxy Configuration

The plugin respects standard proxy environment variables:

- `HTTP_PROXY` - HTTP proxy URL
- `HTTPS_PROXY` - HTTPS proxy URL

Package manager proxy settings are automatically configured based on these variables.

## Usage

The hook runs automatically when you start a Claude Code session in a web environment. You'll see output like:

```
🌐 Setting up Claude Code web environment...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Started at: 2025-01-15 10:30:00
📦 Detected package manager: yarn
🔧 Enabling Corepack for Yarn support...
📥 Configuring Yarn for proxy environment...
   Using Yarn version: 4.9.2 (from package.json)
   ✓ Yarn 4.9.2 already in cache
🔧 Configuring Yarn proxy settings in user home directory...
   ✓ Proxy configuration stored in ~/.yarnrc.yml
📦 Installing dependencies with yarn (this may take 5-10 minutes)...
✅ Dependencies installed successfully
   Installed: ~150 packages (45M)

✅ Web environment setup complete
   Completed at: 2025-01-15 10:33:45
   Duration: 3m 45s

📝 Available Commands:
   • Run tests:     yarn test
   • Build:         yarn build
   • Dev server:    yarn dev
   • Type check:    yarn typecheck
   • Lint:          yarn lint

ℹ️  Environment Ready:
   • Dependencies installed with yarn
   • Package manager configured for Claude Code web environment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## How It Works

### 1. Environment Check

```bash
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
```

Only runs in Claude Code web environments (containerized remote environments).

### 2. Package Manager Detection

```bash
detect_package_manager() {
  # 1. Check package.json packageManager field
  # 2. Check for lock files
  # 3. Default to npm
}
```

### 3. Package Manager Setup

For each package manager:

**Yarn:**
- Enables corepack
- Downloads and caches specific Yarn version (proxy-aware)
- Configures proxy in `~/.yarnrc.yml`

**pnpm:**
- Enables corepack
- Configures proxy with `pnpm config set`

**npm:**
- Configures proxy with `npm config set`

**bun:**
- Respects `HTTP_PROXY`/`HTTPS_PROXY` environment variables

### 4. Dependency Installation

Runs the appropriate install command:

| Package Manager | Command |
|----------------|---------|
| yarn | `yarn install --immutable` |
| pnpm | `pnpm install --frozen-lockfile` |
| npm | `npm ci` |
| bun | `bun install --frozen-lockfile` |

All commands have a 10-minute timeout.

### 5. Verification & Reporting

- Counts installed packages
- Measures node_modules size
- Detects available npm scripts
- Reports total duration

## Troubleshooting

### Hook Not Running

**Symptom:** No output when starting a Claude Code session

**Causes:**
1. Plugin not enabled in `.claude/settings.json`
2. Not in a web environment (`CLAUDE_CODE_REMOTE` not set)
3. No `package.json` in root directory

**Solution:**
- Verify plugin is enabled
- Check you're in a Claude Code web environment
- Ensure `package.json` exists

### Timeout Errors

**Symptom:** "Command timed out after 600 seconds"

**Causes:**
1. Slow network connection
2. Large number of dependencies
3. Proxy issues

**Solution:**
- Increase timeout in `hooks/hooks.json`
- Check proxy configuration
- Verify network connectivity

### Yarn Download Failures

**Symptom:** "Failed to download Yarn X.Y.Z"

**Causes:**
1. Proxy not configured correctly
2. Network connectivity issues
3. Invalid Yarn version in `package.json`

**Solution:**
- Verify `HTTP_PROXY`/`HTTPS_PROXY` are set correctly
- Check Yarn version exists at `https://repo.yarnpkg.com/<version>/packages/yarnpkg-cli/bin/yarn.js`
- Update `packageManager` field in `package.json`

### Permission Errors

**Symptom:** "Permission denied" or "EACCES" errors

**Causes:**
1. Hook script not executable
2. Insufficient permissions in container

**Solution:**
- Ensure hook is executable: `chmod +x hooks/web-setup`
- Check container permissions

## Development

### Project Structure

```
typescript-claude-code-for-web-setup/
├── plugin.json              # Plugin manifest
├── README.md               # This file
├── hooks/
│   ├── hooks.json          # Hook configuration
│   └── web-setup           # Main hook script
└── tests/
    └── test-web-setup.sh   # Test suite
```

### Testing

Run the test suite:

```bash
cd plugins/typescript-claude-code-for-web-setup
./tests/test-web-setup.sh
```

With debug output:

```bash
DEBUG=1 ./tests/test-web-setup.sh
```

### Manual Testing

Simulate different package managers:

```bash
# Test yarn detection
echo '{"packageManager":"yarn@4.9.2"}' > /tmp/package.json
echo '{}' > /tmp/yarn.lock
cd /tmp && CLAUDE_CODE_REMOTE=true /path/to/web-setup

# Test npm detection
echo '{}' > /tmp/package.json
echo '{}' > /tmp/package-lock.json
cd /tmp && CLAUDE_CODE_REMOTE=true /path/to/web-setup
```

## Differences from Original Script

This plugin is a generic version of the original Photobooth-specific script with these changes:

1. **Multi-package manager support** - Detects and configures npm, yarn, pnpm, and bun
2. **Removed Photobooth references** - Generic messages and no project-specific assumptions
3. **Automatic script detection** - Discovers available npm scripts from package.json
4. **Simplified output** - Removes references to LocalStack and specific test requirements
5. **Better error messages** - More informative error handling

## License

MIT

## Contributing

Contributions are welcome! Please:

1. Test changes thoroughly with all supported package managers
2. Update documentation as needed
3. Follow existing code style
4. Add tests for new functionality

## Resources

- [Claude Code Hooks Documentation](https://docs.claude.com/en/docs/claude-code/hooks.md)
- [Claude Code Plugins Guide](https://docs.claude.com/en/docs/claude-code/plugins.md)
- [Corepack Documentation](https://nodejs.org/api/corepack.html)
