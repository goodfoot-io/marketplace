#!/usr/bin/env bash
# Stop the Chrome process started by start-chrome.sh, if any.
set -euo pipefail

STATE_DIR="$HOME/.cache/browser-use-skill"
PID_FILE="$STATE_DIR/chrome.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "nothing to stop (no pid file at $PID_FILE)"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "stopped Chrome pid $PID"
else
  echo "no running process for pid $PID (already stopped)"
fi

rm -f "$PID_FILE"
