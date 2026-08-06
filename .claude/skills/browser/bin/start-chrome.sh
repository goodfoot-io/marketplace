#!/usr/bin/env bash
# Launch (or confirm already-running) a local headless Chromium with a CDP
# port open at BU_CDP_URL, for the `browser-use` CLI to drive directly —
# no Browser Use Cloud daemon involved. Idempotent and fail-closed.
set -euo pipefail

: "${BU_CDP_URL:?BU_CDP_URL must be set (see /workspace/.devcontainer/.env)}"

PORT="$(node -e "console.log(new URL(process.env.BU_CDP_URL).port)")"
if [[ -z "$PORT" ]]; then
  echo "Could not derive a port from BU_CDP_URL=$BU_CDP_URL" >&2
  exit 1
fi

STATE_DIR="$HOME/.cache/browser-use-skill"
PROFILE_DIR="$STATE_DIR/profile"
PID_FILE="$STATE_DIR/chrome.pid"
LOG_FILE="$STATE_DIR/chrome.log"
mkdir -p "$PROFILE_DIR"

if curl -s -o /dev/null "$BU_CDP_URL/json/version"; then
  echo "already running: $BU_CDP_URL"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROME_DIR="$(compgen -G "$HOME/.cache/ms-playwright/chromium-*" | sort -V | tail -1 || true)"
CHROME_BIN="${CHROME_DIR:+$CHROME_DIR/chrome-linux/chrome}"

if [[ -z "$CHROME_DIR" || ! -x "$CHROME_BIN" ]]; then
  echo "Chromium binary not found -- run $SCRIPT_DIR/install-chromium.sh first" >&2
  exit 1
fi

echo "Launching $CHROME_BIN on port $PORT (profile: $PROFILE_DIR)"

nohup "$CHROME_BIN" \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --remote-debugging-port="$PORT" \
  --remote-debugging-address=127.0.0.1 \
  --user-data-dir="$PROFILE_DIR" \
  about:blank \
  > "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"

for _ in $(seq 1 30); do
  if curl -s -o /dev/null "$BU_CDP_URL/json/version"; then
    echo "Chrome ready on $BU_CDP_URL"
    exit 0
  fi
  sleep 0.5
done

echo "Chrome did not become ready on $BU_CDP_URL within 15s -- see $LOG_FILE" >&2
exit 1
