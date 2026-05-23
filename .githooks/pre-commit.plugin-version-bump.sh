#!/bin/bash
# Auto-bump the patch version of any plugin with staged changes, and bump the
# Claude marketplace.json metadata version when any Claude plugin is bumped.
# Auto-fixing + re-staging only; never blocks the commit.
set -e

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

# Track which plugins have been processed to avoid double-bumping
declare -A PROCESSED_PLUGINS

# Track if any Claude plugins were bumped
CLAUDE_PLUGINS_BUMPED=0

for file in $STAGED_FILES; do
    PLUGIN_ROOT=""
    PLUGIN_NAME=""
    PLUGIN_JSON=""
    PLUGIN_KIND=""

    if [[ "$file" =~ ^plugins/([^/]+)/ ]]; then
        PLUGIN_ROOT="plugins"
        PLUGIN_NAME="${BASH_REMATCH[1]}"
        PLUGIN_JSON="plugins/${PLUGIN_NAME}/.claude-plugin/plugin.json"
        PLUGIN_KIND="claude"
    elif [[ "$file" =~ ^codex-plugins/([^/]+)/ ]]; then
        PLUGIN_ROOT="codex-plugins"
        PLUGIN_NAME="${BASH_REMATCH[1]}"
        PLUGIN_JSON="codex-plugins/${PLUGIN_NAME}/.codex-plugin/plugin.json"
        PLUGIN_KIND="codex"
    fi

    if [ -n "$PLUGIN_NAME" ]; then

        # Skip if we've already processed this plugin
        PROCESSED_KEY="${PLUGIN_KIND}:${PLUGIN_NAME}"
        if [[ -n "${PROCESSED_PLUGINS[$PROCESSED_KEY]}" ]]; then
            continue
        fi

        # Skip if the only change is to plugin.json itself (avoid infinite loops)
        PLUGIN_STAGED_FILES=$(echo "$STAGED_FILES" | grep "^${PLUGIN_ROOT}/${PLUGIN_NAME}/" || true)
        NON_PLUGIN_JSON_FILES=$(echo "$PLUGIN_STAGED_FILES" | grep -Fvx "$PLUGIN_JSON" || true)

        if [ -z "$NON_PLUGIN_JSON_FILES" ]; then
            # Only plugin.json is staged, skip version bump
            PROCESSED_PLUGINS[$PROCESSED_KEY]=1
            continue
        fi

        # Check if plugin.json exists
        if [ ! -f "$PLUGIN_JSON" ]; then
            echo "Warning: $PLUGIN_JSON not found, skipping version bump for $PLUGIN_NAME"
            PROCESSED_PLUGINS[$PROCESSED_KEY]=1
            continue
        fi

        # Read current version
        CURRENT_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$PLUGIN_JSON" | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')

        if [ -z "$CURRENT_VERSION" ]; then
            echo "Warning: Could not parse version from $PLUGIN_JSON, skipping"
            PROCESSED_PLUGINS[$PROCESSED_KEY]=1
            continue
        fi

        # Parse version components
        IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

        # Bump patch version
        NEW_PATCH=$((PATCH + 1))
        NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"

        # Update plugin.json with new version
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS sed requires empty string for -i
            sed -i '' "s/\"version\"[[:space:]]*:[[:space:]]*\"${CURRENT_VERSION}\"/\"version\": \"${NEW_VERSION}\"/" "$PLUGIN_JSON"
        else
            # Linux sed
            sed -i "s/\"version\"[[:space:]]*:[[:space:]]*\"${CURRENT_VERSION}\"/\"version\": \"${NEW_VERSION}\"/" "$PLUGIN_JSON"
        fi

        # Stage the updated plugin.json
        git add "$PLUGIN_JSON"

        echo "Bumped ${PLUGIN_NAME} version: ${CURRENT_VERSION} -> ${NEW_VERSION}"

        if [ "$PLUGIN_KIND" = "claude" ]; then
            # Also update the Claude marketplace plugin version entry
            MARKETPLACE_JSON=".claude-plugin/marketplace.json"
            if [ -f "$MARKETPLACE_JSON" ]; then
                if command -v jq &> /dev/null; then
                    jq --arg name "$PLUGIN_NAME" --arg version "$NEW_VERSION" \
                        '(.plugins[] | select(.name == $name)).version = $version' \
                        "$MARKETPLACE_JSON" > "${MARKETPLACE_JSON}.tmp" && \
                        mv "${MARKETPLACE_JSON}.tmp" "$MARKETPLACE_JSON"
                    echo "Synced ${PLUGIN_NAME} version in marketplace.json: ${NEW_VERSION}"
                else
                    echo "Warning: jq not found, marketplace.json plugin version not synced"
                fi
            fi
            CLAUDE_PLUGINS_BUMPED=1
        fi

        PROCESSED_PLUGINS[$PROCESSED_KEY]=1
    fi
done

# If any Claude plugins were bumped, also bump the Claude marketplace version
if [ "$CLAUDE_PLUGINS_BUMPED" -eq 1 ]; then
    MARKETPLACE_JSON=".claude-plugin/marketplace.json"

    if [ -f "$MARKETPLACE_JSON" ]; then
        # Read current marketplace version from metadata.version
        MARKETPLACE_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$MARKETPLACE_JSON" | head -1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')

        if [ -n "$MARKETPLACE_VERSION" ]; then
            # Parse version components
            IFS='.' read -r M_MAJOR M_MINOR M_PATCH <<< "$MARKETPLACE_VERSION"

            # Bump patch version
            NEW_M_PATCH=$((M_PATCH + 1))
            NEW_MARKETPLACE_VERSION="${M_MAJOR}.${M_MINOR}.${NEW_M_PATCH}"

            # Update marketplace.json with new version (only first occurrence in metadata)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS sed
                sed -i '' "0,/\"version\"[[:space:]]*:[[:space:]]*\"${MARKETPLACE_VERSION}\"/s//\"version\": \"${NEW_MARKETPLACE_VERSION}\"/" "$MARKETPLACE_JSON"
            else
                # Linux sed
                sed -i "0,/\"version\"[[:space:]]*:[[:space:]]*\"${MARKETPLACE_VERSION}\"/s//\"version\": \"${NEW_MARKETPLACE_VERSION}\"/" "$MARKETPLACE_JSON"
            fi

            # Stage the updated marketplace.json
            git add "$MARKETPLACE_JSON"

            echo "Bumped marketplace.json version: ${MARKETPLACE_VERSION} -> ${NEW_MARKETPLACE_VERSION}"
        else
            echo "Warning: Could not parse version from $MARKETPLACE_JSON, skipping marketplace bump"
        fi
    else
        echo "Warning: $MARKETPLACE_JSON not found, skipping marketplace bump"
    fi
fi

exit 0
