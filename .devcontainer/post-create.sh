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

    # Start system dbus daemon
    sudo dbus-daemon --system --fork

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

# Create X11 unix directory with proper permissions for Xvfb
sudo mkdir -p /tmp/.X11-unix
sudo chmod 1777 /tmp/.X11-unix
echo "✓ X11 directory prepared for headless testing"

claude mcp add file -- node /workspace/.devcontainer/utilities/file-mcp-server.mjs || true
claude mcp add vscode -- npx -y @vscode-mcp/vscode-mcp-server@latest || true
claude mcp add codebase -- node /workspace/.devcontainer/utilities/codebase-mcp-server.mjs || true
claude mcp add browser -- node /workspace/.devcontainer/utilities/browser-mcp-server.mjs --browserUrl "http://192.168.65.254:9222/" || true

# claude mcp remove file
# claude mcp remove vscode 
# claude mcp remove codebase 
# claude mcp remove browser
# claude mcp add chrome -- npx -y chrome-devtools-mcp@latest --browserUrl "http://192.168.65.254:9222/"

