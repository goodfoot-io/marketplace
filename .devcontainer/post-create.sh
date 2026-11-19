#!/bin/bash

set -e

# Make all scripts in utilities directory executable
if [ -d "/workspace/.devcontainer/utilities" ]; then
    echo "Making scripts in /workspace/.devcontainer/utilities executable..."
    chmod +x /workspace/.devcontainer/utilities/*
fi

# Start system dbus daemon if not already running
echo "Setting up dbus for VS Code extension testing..."
if ! pgrep -x "dbus-daemon" > /dev/null; then
    # Ensure dbus directories exist with proper permissions
    sudo mkdir -p /run/dbus /var/run/dbus
    sudo chmod 755 /run/dbus /var/run/dbus

    # Container snapshots/restarts can retain stale PID files; use process checks instead.
    sudo dbus-daemon --system --fork --nopidfile

    # Wait for socket to be created
    sleep 1

    # Verify dbus is running
    if [ -S /run/dbus/system_bus_socket ] || [ -S /var/run/dbus/system_bus_socket ]; then
        echo "✓ System dbus daemon started successfully"
    else
        echo "⚠ Warning: dbus daemon started but socket not found"
    fi
else
    echo "✓ System dbus daemon already running"
fi

# --- Linear CLI (linctl) auth --------------------------------------------------
# linctl (built in the Dockerfile) uses a real Linear personal API key here —
# unlike the milesrowan container, the devcontainer does not go through OneCLI.
# The key is LINCTL_API_KEY in the gitignored .devcontainer/.env, which
# docker-compose.yml loads via env_file. `linctl auth status` exits 0 even when
# unauthenticated, so match its output instead. Report-only: a missing key must
# not block container creation.
if command -v linctl >/dev/null 2>&1; then
  if LINCTL_SKIP_AUTO_MCP_SYNC=1 linctl auth status 2>&1 | grep -q 'Not authenticated'; then
    echo "⚠ linctl is not authenticated — set LINCTL_API_KEY in .devcontainer/.env (Linear → Settings → API → Personal API keys) and rebuild"
  else
    echo "✓ linctl authenticated"
  fi
fi

# Create X11 unix directory with proper permissions for Xvfb
sudo mkdir -p /tmp/.X11-unix
sudo chmod 1777 /tmp/.X11-unix
echo "✓ X11 directory prepared for headless testing"

# Create VSCode MCP Bridge socket directory with proper permissions
echo "Setting up VSCode MCP Bridge socket directory..."
mkdir -p /home/node/.local/share/yutengjing-vscode-mcp
chmod 755 /home/node/.local/share/yutengjing-vscode-mcp
echo "✓ VSCode MCP Bridge socket directory created"

claude mcp add file -- node /workspace/.devcontainer/utilities/file-mcp-server.mjs || true
claude mcp add vscode -- npx -y @vscode-mcp/vscode-mcp-server@latest || true
claude mcp add codebase -- node /workspace/.devcontainer/utilities/codebase-mcp-server.mjs || true
claude mcp add browser -- node /workspace/.devcontainer/utilities/browser-mcp-server.mjs --browserUrl "http://192.168.65.254:9222/" || true

# claude mcp remove file
# claude mcp remove vscode
# claude mcp remove codebase
# claude mcp remove browser
# claude mcp add chrome -- npx -y chrome-devtools-mcp@latest --browserUrl "http://192.168.65.254:9222/"

# Note: Tailscale and the rootless sshd are now started automatically by the base
# image's entrypoint on every container start, so they are no longer invoked here.

# Shared runtime setup from the base image: Rust (latest stable) + clippy/rustfmt,
# uv, Antigravity, and the zsh theme — all installed into the persisted /home/node.
/usr/local/share/devcontainer/post-create-common.sh
