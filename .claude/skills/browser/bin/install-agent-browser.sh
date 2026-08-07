#!/usr/bin/env bash
# Install the `agent-browser` CLI and a Chromium binary it can drive.
# Idempotent: no-ops on each step that's already satisfied.
#
# `agent-browser install` downloads Chrome for Testing, which has no Linux
# ARM64 build ("Chrome for Testing does not provide Linux ARM64 builds").
# On that failure we fall back to a Playwright-managed Chromium build,
# cached under $HOME/.cache/ms-playwright/, and point a stable `chromium`
# symlink at whichever chromium-* build is newest so consumers don't need
# to track the versioned directory name.
set -euo pipefail

PLAYWRIGHT_VERSION="1.61.1"
MS_PLAYWRIGHT_DIR="$HOME/.cache/ms-playwright"
STABLE_CHROMIUM_LINK="$MS_PLAYWRIGHT_DIR/chromium"

# --- Step A: install the CLI ---
if command -v agent-browser > /dev/null 2>&1; then
  echo "agent-browser CLI already installed: $(command -v agent-browser)"
else
  echo "Installing agent-browser CLI..."
  npm install -g agent-browser
fi

# --- Step B: install a browser binary ---
refresh_stable_symlink() {
  local latest
  latest="$(compgen -G "$MS_PLAYWRIGHT_DIR/chromium-*" 2> /dev/null | sort -V | tail -1 || true)"
  if [[ -n "$latest" ]]; then
    ln -sfn "$latest" "$STABLE_CHROMIUM_LINK"
  fi
}

if agent-browser install; then
  echo "agent-browser install succeeded (native Chrome for Testing)."
else
  echo "agent-browser install failed (expected on Linux ARM64) -- falling back to Playwright Chromium."

  if compgen -G "$MS_PLAYWRIGHT_DIR/chromium-*" > /dev/null 2>&1; then
    echo "Playwright Chromium already installed: $(compgen -G "$MS_PLAYWRIGHT_DIR/chromium-*" | sort -V | tail -1)"
  else
    echo "Installing Chromium via playwright@${PLAYWRIGHT_VERSION}..."
    npx --yes "playwright@${PLAYWRIGHT_VERSION}" install chromium
  fi

  refresh_stable_symlink
fi

# Keep the stable symlink current even if agent-browser's own install
# succeeded but a Playwright build also exists (e.g. from a prior run).
if [[ ! -e "$STABLE_CHROMIUM_LINK" ]]; then
  refresh_stable_symlink
fi

# --- Verification ---
if ! command -v agent-browser > /dev/null 2>&1; then
  echo "agent-browser CLI is not on PATH after install." >&2
  exit 1
fi

if [[ -x "$STABLE_CHROMIUM_LINK/chrome-linux/chrome" ]]; then
  echo "Chromium binary ready: $STABLE_CHROMIUM_LINK/chrome-linux/chrome"
elif agent-browser doctor --json > /dev/null 2>&1; then
  echo "Chromium binary ready via agent-browser's own install."
else
  echo "No usable Chromium binary found (neither agent-browser's own install nor the Playwright fallback)." >&2
  exit 1
fi

echo "agent-browser install complete."
