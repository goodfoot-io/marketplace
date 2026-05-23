#!/bin/bash
# Ensure each Claude marketplace.json plugin entry's version matches its
# plugin.json version, re-staging marketplace.json on any drift.
# Auto-fixing + re-staging only; never blocks the commit.
set -e

command -v jq >/dev/null 2>&1 || exit 0   # graceful no-op if jq is absent

MARKETPLACE_JSON=".claude-plugin/marketplace.json"
[ -f "$MARKETPLACE_JSON" ] || exit 0

VERSIONS_SYNCED=0

# Get list of all plugins from marketplace.json
PLUGIN_NAMES=$(jq -r '.plugins[].name' "$MARKETPLACE_JSON" 2>/dev/null || true)

for PLUGIN_NAME in $PLUGIN_NAMES; do
    PLUGIN_JSON="plugins/${PLUGIN_NAME}/.claude-plugin/plugin.json"

    if [ -f "$PLUGIN_JSON" ]; then
        MARKETPLACE_VERSION=$(jq -r --arg name "$PLUGIN_NAME" '.plugins[] | select(.name == $name) | .version // empty' "$MARKETPLACE_JSON")
        PLUGIN_VERSION=$(jq -r '.version' "$PLUGIN_JSON")

        # Auto-sync if marketplace version differs from plugin.json version
        if [ -n "$MARKETPLACE_VERSION" ] && [ "$MARKETPLACE_VERSION" != "$PLUGIN_VERSION" ]; then
            jq --arg name "$PLUGIN_NAME" --arg version "$PLUGIN_VERSION" \
                '(.plugins[] | select(.name == $name)).version = $version' \
                "$MARKETPLACE_JSON" > "${MARKETPLACE_JSON}.tmp" && \
                mv "${MARKETPLACE_JSON}.tmp" "$MARKETPLACE_JSON"
            echo "Auto-synced ${PLUGIN_NAME} version in marketplace.json: ${MARKETPLACE_VERSION} -> ${PLUGIN_VERSION}"
            VERSIONS_SYNCED=1
        fi
    fi
done

# Stage marketplace.json if any versions were synced
if [ "$VERSIONS_SYNCED" -eq 1 ]; then
    git add "$MARKETPLACE_JSON"
fi

exit 0
