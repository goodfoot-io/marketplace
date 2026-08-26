#!/usr/bin/env bash
set -e

# Propagates the goodfoot version across its four tri-platform surfaces,
# treating plugins-claude/goodfoot/.claude-plugin/plugin.json as the source
# of truth. The layout-checks version-lockstep test fails closed on drift;
# this script is what fixes that drift.
#
# Usage: ./scripts/sync-plugin-versions.sh
# Requires: jq

command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

SOURCE_MANIFEST="plugins-claude/goodfoot/.claude-plugin/plugin.json"
CODEX_MANIFEST="plugins-codex/goodfoot/.codex-plugin/plugin.json"
OPENCODE_PACKAGE="plugins-opencode/goodfoot/package.json"
MARKETPLACE_JSON=".claude-plugin/marketplace.json"

VERSION="$(jq -r '.version' "$SOURCE_MANIFEST")"

if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
  echo "Could not read a version from $SOURCE_MANIFEST" >&2
  exit 1
fi

jq --arg version "$VERSION" '.version = $version' "$CODEX_MANIFEST" > "${CODEX_MANIFEST}.tmp" && mv "${CODEX_MANIFEST}.tmp" "$CODEX_MANIFEST"
jq --arg version "$VERSION" '.version = $version' "$OPENCODE_PACKAGE" > "${OPENCODE_PACKAGE}.tmp" && mv "${OPENCODE_PACKAGE}.tmp" "$OPENCODE_PACKAGE"
jq --arg version "$VERSION" '(.plugins[] | select(.name == "goodfoot")).version = $version' "$MARKETPLACE_JSON" > "${MARKETPLACE_JSON}.tmp" && mv "${MARKETPLACE_JSON}.tmp" "$MARKETPLACE_JSON"

echo "Synced goodfoot to $VERSION across $CODEX_MANIFEST, $OPENCODE_PACKAGE, and $MARKETPLACE_JSON"
