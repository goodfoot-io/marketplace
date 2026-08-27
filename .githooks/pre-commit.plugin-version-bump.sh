#!/bin/bash
# Bumps the patch version of every plugin with staged changes and propagates
# that version to all of the plugin's declared surfaces, then re-stages them.
#
# Bumping and propagating used to be two mechanisms: this hook wrote
# plugins/<name>/.claude-plugin/plugin.json and the marketplace entry, and
# scripts/sync-plugin-versions.sh knew about the Codex manifest, the OpenCode
# package, the npm package, and the `--version` literal. Nothing ran the second
# one, so every hook-driven commit left those surfaces one patch behind and the
# gap was closed by hand afterwards, commit by commit. Bump and propagation are
# now one operation, and the sync script is the only thing that knows what a
# plugin's surfaces are.
set -e

STAGED_FILES=$(git diff --cached --name-only)
[ -z "$STAGED_FILES" ] && exit 0

REGISTRY="packages/plugin-layout-checks/registry/plugins.json"
HAVE_JQ=false
command -v jq &> /dev/null && HAVE_JQ=true

bump_patch() {
    # bump_patch <file>; echoes the new version, or nothing when unparseable
    local file="$1"
    local current
    current=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$file" | head -1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
    [ -z "$current" ] && return 1
    IFS='.' read -r major minor patch <<< "$current"
    local next="${major}.${minor}.$((patch + 1))"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "0,/\"version\"[[:space:]]*:[[:space:]]*\"${current}\"/s//\"version\": \"${next}\"/" "$file"
    else
        sed -i "0,/\"version\"[[:space:]]*:[[:space:]]*\"${current}\"/s//\"version\": \"${next}\"/" "$file"
    fi
    echo "$next"
}

declare -A PROCESSED_PLUGINS
CLAUDE_PLUGINS_BUMPED=0
REGISTRY_PLUGIN_BUMPED=0

# Registry plugins first. A staged change anywhere the plugin owns — authored
# templates, any of its three platform trees, its npm package — is a change to
# that plugin, so the bump follows ownership rather than one directory prefix.
if [ "$HAVE_JQ" = true ] && [ -f "$REGISTRY" ]; then
    while IFS=$'\t' read -r NAME SOURCE; do
        mapfile -t OWNED < <(jq -r --arg name "$NAME" '
            .plugins[] | select(.name == $name) |
            [.skillsSrc, .claudePluginRoot, .codexPluginRoot, .opencodePluginRoot,
             (.versionSurfaces.packageJson // empty | sub("/[^/]+$"; ""))] | .[]' "$REGISTRY")

        # Version surfaces are what this hook writes. Counting them as changes
        # would make every commit it touches justify the next one.
        mapfile -t SURFACES < <(jq -r --arg name "$NAME" '
            .plugins[] | select(.name == $name) | .versionSurfaces |
            [.source, .codexManifest, .opencodePackage, (.packageJson // empty),
             (.literals // [] | .[].path)] | .[]' "$REGISTRY")

        TOUCHED=0
        while IFS= read -r file; do
            [ -z "$file" ] && continue
            for surface in "${SURFACES[@]}"; do
                [ "$file" = "$surface" ] && continue 2
            done
            for owned in "${OWNED[@]}"; do
                case "$file" in "$owned"/*) TOUCHED=1; break 2;; esac
            done
        done <<< "$STAGED_FILES"

        [ "$TOUCHED" -eq 0 ] && continue
        [ -f "$SOURCE" ] || { echo "Warning: $SOURCE not found, skipping version bump for $NAME"; continue; }

        NEW_VERSION=$(bump_patch "$SOURCE") || {
            echo "Warning: Could not parse version from $SOURCE, skipping"
            continue
        }
        echo "Bumped ${NAME} version: -> ${NEW_VERSION}"
        PROCESSED_PLUGINS["claude:${NAME}"]=1
        CLAUDE_PLUGINS_BUMPED=1
        REGISTRY_PLUGIN_BUMPED=1
    done < <(jq -r '.plugins[] | [.name, .versionSurfaces.source] | @tsv' "$REGISTRY")
fi

# Marketplace plugins outside the registry keep the original single-surface
# behaviour: they have no declared Codex or OpenCode surface to propagate to.
for file in $STAGED_FILES; do
    PLUGIN_NAME=""
    if [[ "$file" =~ ^plugins/([^/]+)/ ]]; then
        PLUGIN_NAME="${BASH_REMATCH[1]}"
        PLUGIN_ROOT="plugins"
        PLUGIN_JSON="plugins/${PLUGIN_NAME}/.claude-plugin/plugin.json"
    else
        continue
    fi

    [[ -n "${PROCESSED_PLUGINS[claude:${PLUGIN_NAME}]}" ]] && continue

    PLUGIN_STAGED_FILES=$(echo "$STAGED_FILES" | grep "^${PLUGIN_ROOT}/${PLUGIN_NAME}/" || true)
    NON_PLUGIN_JSON_FILES=$(echo "$PLUGIN_STAGED_FILES" | grep -Fvx "$PLUGIN_JSON" || true)
    if [ -z "$NON_PLUGIN_JSON_FILES" ]; then
        PROCESSED_PLUGINS["claude:${PLUGIN_NAME}"]=1
        continue
    fi

    if [ ! -f "$PLUGIN_JSON" ]; then
        echo "Warning: $PLUGIN_JSON not found, skipping version bump for $PLUGIN_NAME"
        PROCESSED_PLUGINS["claude:${PLUGIN_NAME}"]=1
        continue
    fi

    NEW_VERSION=$(bump_patch "$PLUGIN_JSON") || {
        echo "Warning: Could not parse version from $PLUGIN_JSON, skipping"
        PROCESSED_PLUGINS["claude:${PLUGIN_NAME}"]=1
        continue
    }
    git add "$PLUGIN_JSON"
    echo "Bumped ${PLUGIN_NAME} version: -> ${NEW_VERSION}"

    MARKETPLACE_JSON=".claude-plugin/marketplace.json"
    if [ -f "$MARKETPLACE_JSON" ] && [ "$HAVE_JQ" = true ]; then
        jq --arg name "$PLUGIN_NAME" --arg version "$NEW_VERSION" \
            '(.plugins[] | select(.name == $name)).version = $version' \
            "$MARKETPLACE_JSON" > "${MARKETPLACE_JSON}.tmp" && mv "${MARKETPLACE_JSON}.tmp" "$MARKETPLACE_JSON"
        echo "Synced ${PLUGIN_NAME} version in marketplace.json: ${NEW_VERSION}"
    elif [ -f "$MARKETPLACE_JSON" ]; then
        echo "Warning: jq not found, marketplace.json plugin version not synced"
    fi

    CLAUDE_PLUGINS_BUMPED=1
    PROCESSED_PLUGINS["claude:${PLUGIN_NAME}"]=1
done

# One propagation for all registry plugins bumped above, through the same
# script CI checks with --check. A bump this hook makes and a surface CI
# verifies can no longer disagree about what a plugin's surfaces are.
if [ "$REGISTRY_PLUGIN_BUMPED" -eq 1 ]; then
    ./scripts/sync-plugin-versions.sh
    mapfile -t ALL_SURFACES < <(jq -r '
        .plugins[].versionSurfaces |
        [.source, .codexManifest, .opencodePackage, (.packageJson // empty),
         (.literals // [] | .[].path)] | .[]' "$REGISTRY")
    git add "${ALL_SURFACES[@]}" .claude-plugin/marketplace.json
fi

if [ "$CLAUDE_PLUGINS_BUMPED" -eq 1 ]; then
    MARKETPLACE_JSON=".claude-plugin/marketplace.json"
    if [ -f "$MARKETPLACE_JSON" ]; then
        MARKETPLACE_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$MARKETPLACE_JSON" | head -1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
        if [ -n "$MARKETPLACE_VERSION" ]; then
            IFS='.' read -r M_MAJOR M_MINOR M_PATCH <<< "$MARKETPLACE_VERSION"
            NEW_MARKETPLACE_VERSION="${M_MAJOR}.${M_MINOR}.$((M_PATCH + 1))"
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "0,/\"version\"[[:space:]]*:[[:space:]]*\"${MARKETPLACE_VERSION}\"/s//\"version\": \"${NEW_MARKETPLACE_VERSION}\"/" "$MARKETPLACE_JSON"
            else
                sed -i "0,/\"version\"[[:space:]]*:[[:space:]]*\"${MARKETPLACE_VERSION}\"/s//\"version\": \"${NEW_MARKETPLACE_VERSION}\"/" "$MARKETPLACE_JSON"
            fi
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
