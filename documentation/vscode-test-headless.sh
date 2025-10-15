#!/bin/bash

# Ensure git is available in PATH
export PATH=/usr/bin:/usr/local/bin:$PATH
# Also set GIT_EXEC_PATH to help git find its components
export GIT_EXEC_PATH=/usr/bin

# Kill any existing Xvfb processes (but not dbus-daemon if it's system-wide)
pkill -9 Xvfb 2>/dev/null || true

# Clean up any existing display locks
rm -f /tmp/.X99-lock 2>/dev/null || true

# Check if X11 directory exists with proper permissions, create if needed
if [ ! -d /tmp/.X11-unix ] || [ ! -w /tmp/.X11-unix ]; then
  mkdir -p /tmp/.X11-unix 2>/dev/null || true
  chmod 1777 /tmp/.X11-unix 2>/dev/null || true
fi

# Start a session dbus for Electron (it needs session bus, not system bus)
# We use --autolaunch to ensure the daemon stays alive
if command -v dbus-launch &> /dev/null; then
  eval $(dbus-launch --sh-syntax 2>/dev/null) || true
  export DBUS_STARTED=1
  # Give dbus time to fully initialize
  sleep 0.5
fi

# Start Xvfb in the background with proper settings
echo "Starting Xvfb virtual display for VS Code tests..."
Xvfb :99 \
  -screen 0 1024x768x24 \
  -ac \
  -nolisten tcp \
  -nolisten unix \
  +extension GLX \
  +extension RANDR \
  +extension RENDER \
  2>/dev/null &
XVFB_PID=$!

# Give Xvfb time to start
sleep 2

# Check if Xvfb started successfully
if ! kill -0 $XVFB_PID 2>/dev/null; then
  echo "Failed to start Xvfb"
  exit 1
fi

# Set the display and other environment variables to minimize warnings
export DISPLAY=:99
export ELECTRON_DISABLE_SANDBOX=1
export ELECTRON_DISABLE_GPU_SANDBOX=1
export ELECTRON_DISABLE_SECURITY_WARNINGS=1
export ELECTRON_TRASH=gio

# Configure VS Code test runner to use a shorter path (prevents IPC handle warning)
export VSCODE_TEST_USER_DIR="/tmp/vscode-test"
mkdir -p "$VSCODE_TEST_USER_DIR" 2>/dev/null || true

echo "Running VS Code extension tests..."

# Run the VS Code tests with shorter user data directory
yarn vscode-test --user-data-dir="$VSCODE_TEST_USER_DIR"
VSCODE_EXIT_CODE=$?

# Kill Xvfb gracefully first, then forcefully if needed
echo "Cleaning up Xvfb..."
kill $XVFB_PID 2>/dev/null || true
sleep 1
# Force kill if still running
if kill -0 $XVFB_PID 2>/dev/null; then
  kill -9 $XVFB_PID 2>/dev/null || true
fi

# Kill dbus daemon if we started it
if [ ! -z "$DBUS_SESSION_BUS_PID" ] && [ "$DBUS_STARTED" = "1" ]; then
  kill -9 $DBUS_SESSION_BUS_PID 2>/dev/null || true
fi

# Clean up display lock and test directory
rm -f /tmp/.X99-lock 2>/dev/null || true
rm -rf "$VSCODE_TEST_USER_DIR" 2>/dev/null || true

# Exit with the VS Code test exit code
exit $VSCODE_EXIT_CODE
