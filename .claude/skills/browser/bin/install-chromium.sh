#!/usr/bin/env bash
# Install the headless Chromium binary that start-chrome.sh launches for the
# `browser-use` CLI. Idempotent: no-ops if a chromium-* build is already cached.
#
# Deliberately does NOT depend on packages/e2e or its node_modules — this
# skill must work standalone in any devcontainer built from the same base
# image (which already bakes in the OS-level shared libraries Chromium
# needs), not only in this repo checkout. `npx --yes` pulls the `playwright`
# CLI package on demand instead.
#
# PLAYWRIGHT_VERSION should be kept in sync with packages/e2e/package.json's
# `playwright` devDependency (and the hoisted /workspace/node_modules/playwright).
set -euo pipefail

PLAYWRIGHT_VERSION="1.61.1"

if compgen -G "$HOME/.cache/ms-playwright/chromium-*" > /dev/null 2>&1; then
  echo "Chromium already installed: $(compgen -G "$HOME/.cache/ms-playwright/chromium-*" | sort -V | tail -1)"
  exit 0
fi

echo "Installing Chromium via playwright@${PLAYWRIGHT_VERSION}..."
npx --yes "playwright@${PLAYWRIGHT_VERSION}" install chromium
