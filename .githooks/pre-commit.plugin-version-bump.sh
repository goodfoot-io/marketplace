#!/bin/bash
# Bumps the patch version of every plugin with staged changes and propagates
# that version to all of the plugin's declared surfaces, then re-stages them.
#
# Two kinds of plugin, told apart by convention rather than a registry:
#   - A "full" plugin has a skills-src/<name> sibling. Its version lives at
#     plugins-claude/<name>/.claude-plugin/plugin.json and propagates to the
#     Codex manifest, the OpenCode package, the Antigravity manifest, and the
#     marketplace entry via scripts/sync-plugin-versions.sh — the same script
#     CI runs with --check, so a bump this hook makes and a surface CI
#     verifies can never disagree about what a plugin's surfaces are.
#   - Every other plugins-claude/<name> directory is hand-maintained and
#     Claude-only (e.g. typescript-hooks, expansion): only its own manifest
#     and the marketplace entry are bumped.
#
# A plugin's npm package (packages/<name>), where one exists, is a separate
# release line with its own version. Touching it does not bump the plugin,
# and bumping the plugin does not touch it — scripts/release-package.sh owns
# that surface on its own schedule.
#
# The Codex catalog (.agents/plugins/marketplace.json) carries its own
# top-level version, independent of the Claude marketplace catalog's. It
# advances once per commit whenever a bumped full plugin is one of the
# catalog's listed plugins — read from the catalog itself, not a fixed list,
# so a plugin's Codex publication status stays whatever the catalog says it
# is.
set -e

STAGED_FILES=$(git diff --cached --name-only)
[ -z "$STAGED_FILES" ] && exit 0

SKILLS_SRC="skills-src"
MARKETPLACE_JSON=".claude-plugin/marketplace.json"
CODEX_MARKETPLACE_JSON=".agents/plugins/marketplace.json"

[ -d "$SKILLS_SRC" ] || { echo "pre-commit: $SKILLS_SRC is missing, so this hook cannot tell which plugins are full plugins." >&2; exit 1; }
command -v jq &> /dev/null || { echo "pre-commit: jq is required." >&2; exit 1; }

next_version() {
    # next_version <file>; echoes the patch bump without writing it.
    local file="$1" current major minor patch
    current=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$file" | head -1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
    [ -z "$current" ] && return 1
    IFS='.' read -r major minor patch <<< "$current"
    echo "${major}.${minor}.$((patch + 1))"
}

bump_patch() {
    # bump_patch <file>; echoes the new version, or nothing when unparseable
    local file="$1"
    local current next
    current=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$file" | head -1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
    [ -z "$current" ] && return 1
    next=$(next_version "$file")
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "0,/\"version\"[[:space:]]*:[[:space:]]*\"${current}\"/s//\"version\": \"${next}\"/" "$file"
    else
        sed -i "0,/\"version\"[[:space:]]*:[[:space:]]*\"${current}\"/s//\"version\": \"${next}\"/" "$file"
    fi
    echo "$next"
}

bump_marketplace_catalog_version() {
    # bump_marketplace_catalog_version <file>; echoes the new catalog version.
    #
    # The catalog carries its own version track, deliberately separate from the
    # plugin versions in `.plugins[]`. Read through jq, so the value comes from
    # `.version` by name. Written with an awk pass that tracks JSON nesting
    # depth and only rewrites the `"version"` key at depth 1, so the write is
    # addressed by position in the tree rather than position in the file, and
    # every other byte — indentation, key order, the plugin entries — is
    # passed through untouched.
    local file="$1" current next
    current=$(jq -r '.version // empty' "$file" 2>/dev/null) || current=""
    if [[ ! "$current" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "pre-commit: could not read a top-level \"version\" from $file." >&2
        echo "The marketplace catalog has its own version track and this hook has to advance it," >&2
        echo "so a catalog with no readable version is refused rather than skipped: skipping ships" >&2
        echo "bumped plugins under an unchanged catalog version." >&2
        return 1
    fi
    local major minor patch
    IFS='.' read -r major minor patch <<< "$current"
    next="${major}.${minor}.$((patch + 1))"
    # `cur`/`nxt`, not `current`/`next`: `next` is an awk keyword, and
    # `-v next=...` is a run-time error rather than a silent no-op.
    awk -v cur="$current" -v nxt="$next" '
        {
            line = $0
            if (depth == 1 && !done && line ~ /^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"/ \
                && index(line, "\"" cur "\"") > 0) {
                sub(/"version"[[:space:]]*:[[:space:]]*"[^"]*"/, "\"version\": \"" nxt "\"", line)
                done = 1
            }
            print line
            # Depth for the NEXT line. String literals are removed first so a
            # brace or bracket inside a description cannot shift the count.
            stripped = line
            gsub(/\\./, "", stripped)
            gsub(/"[^"]*"/, "", stripped)
            opens = gsub(/[{[]/, "", stripped)
            closes = gsub(/[}\]]/, "", stripped)
            depth += opens - closes
        }
        END { if (!done) exit 1 }
    ' "$file" > "${file}.tmp" || {
        rm -f "${file}.tmp"
        echo "pre-commit: could not locate the top-level \"version\" key in $file to rewrite it." >&2
        return 1
    }
    mv "${file}.tmp" "$file"
    echo "$next"
}

# Is this staged change to a version surface only the version moving?
#
# A version surface is also a real file. The OpenCode package manifest carries
# `main` and the export map; excluding the whole file — so the hook's own
# writes could not re-trigger it — would also exclude every other edit to it,
# which is how `main` was added to eight OpenCode manifests and shipped
# unversioned. Only the version is exempt; everything else in the file is
# content like any other.
#
# Undecidable cases count as content: the cost of that default is one extra
# patch bump, and the cost of the other one is a silent unversioned change.
version_only_change() {
    local file="$1" source_manifest="$2" head staged old_version new_version
    head=$(git show "HEAD:$file" 2>/dev/null) || return 1
    staged=$(git show ":$file" 2>/dev/null) || return 1

    case "$file" in
        *.json)
            # Compared by value, not bytes, so a reformat is still content.
            head=$(jq -S 'del(.version)' <<< "$head" 2>/dev/null) || return 1
            staged=$(jq -S 'del(.version)' <<< "$staged" 2>/dev/null) || return 1
            ;;
        *)
            old_version=$(git show "HEAD:$source_manifest" 2>/dev/null | jq -r '.version // empty' 2>/dev/null) || return 1
            new_version=$(git show ":$source_manifest" 2>/dev/null | jq -r '.version // empty' 2>/dev/null) || return 1
            [ -z "$old_version" ] && return 1
            [ -z "$new_version" ] && return 1
            head=${head//"$old_version"/"$new_version"}
            ;;
    esac

    [ "$head" = "$staged" ]
}

declare -A PROCESSED_PLUGINS
PENDING_BUMPS=()
BUMPED_FULL_NAMES=()
CLAUDE_PLUGINS_BUMPED=0
FULL_PLUGIN_BUMPED=0

mapfile -t FULL_NAMES < <(find "$SKILLS_SRC" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)

# Full plugins first. A staged change anywhere the plugin owns — authored
# templates, or any of its four platform trees — is a change to that plugin,
# so the bump follows ownership rather than one directory prefix. Every full
# plugin is claimed below, bumped or not, so the legacy loop after it cannot
# reach one that was deliberately declined here.
for NAME in "${FULL_NAMES[@]}"; do
    PROCESSED_PLUGINS["claude:${NAME}"]=1

    SOURCE="plugins-claude/${NAME}/.claude-plugin/plugin.json"
    OWNED=(
        "${SKILLS_SRC}/${NAME}"
        "plugins-claude/${NAME}"
        "plugins-codex/${NAME}"
        "plugins-opencode/${NAME}"
        "plugins-antigravity/${NAME}"
    )
    SURFACES=(
        "$SOURCE"
        "plugins-codex/${NAME}/.codex-plugin/plugin.json"
        "plugins-opencode/${NAME}/package.json"
        "plugins-antigravity/${NAME}/plugin.json"
    )

    TOUCHED=0
    while IFS= read -r file; do
        [ -z "$file" ] && continue
        for surface in "${SURFACES[@]}"; do
            if [ "$file" = "$surface" ]; then
                version_only_change "$file" "$SOURCE" && continue 2
                break
            fi
        done
        for owned in "${OWNED[@]}"; do
            case "$file" in "$owned"/*) TOUCHED=1; break 2;; esac
        done
    done <<< "$STAGED_FILES"

    [ "$TOUCHED" -eq 0 ] && continue
    [ -f "$SOURCE" ] || { echo "Warning: $SOURCE not found, skipping version bump for $NAME"; continue; }

    NEXT=$(next_version "$SOURCE") || {
        echo "Warning: Could not parse version from $SOURCE, skipping"
        continue
    }
    PENDING_BUMPS+=("${NAME}"$'\t'"${SOURCE}"$'\t'"${NEXT}")
done

for pending in "${PENDING_BUMPS[@]}"; do
    IFS=$'\t' read -r NAME SOURCE NEXT <<< "$pending"
    NEW_VERSION=$(bump_patch "$SOURCE")
    echo "Bumped ${NAME} version: -> ${NEW_VERSION}"
    CLAUDE_PLUGINS_BUMPED=1
    FULL_PLUGIN_BUMPED=1
    BUMPED_FULL_NAMES+=("$NAME")
done

# Marketplace plugins outside the full-plugin set keep the original
# single-surface behaviour: they have no Codex, OpenCode, or Antigravity
# surface to propagate to.
while IFS= read -r file; do
    [ -z "$file" ] && continue
    PLUGIN_NAME=""
    if [[ "$file" =~ ^plugins-claude/([^/]+)/ ]]; then
        PLUGIN_NAME="${BASH_REMATCH[1]}"
        PLUGIN_JSON="plugins-claude/${PLUGIN_NAME}/.claude-plugin/plugin.json"
    else
        continue
    fi

    [[ -n "${PROCESSED_PLUGINS[claude:${PLUGIN_NAME}]}" ]] && continue

    PLUGIN_STAGED_FILES=$(echo "$STAGED_FILES" | grep "^plugins-claude/${PLUGIN_NAME}/" || true)
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

    if [ -f "$MARKETPLACE_JSON" ]; then
        jq --arg name "$PLUGIN_NAME" --arg version "$NEW_VERSION" \
            '(.plugins[] | select(.name == $name)).version = $version' \
            "$MARKETPLACE_JSON" > "${MARKETPLACE_JSON}.tmp" && mv "${MARKETPLACE_JSON}.tmp" "$MARKETPLACE_JSON"
        echo "Synced ${PLUGIN_NAME} version in marketplace.json: ${NEW_VERSION}"
    fi

    CLAUDE_PLUGINS_BUMPED=1
    PROCESSED_PLUGINS["claude:${PLUGIN_NAME}"]=1
    # A herestring, not a pipe: the loop has to run in this shell or every
    # PROCESSED_PLUGINS claim and the bumped flag are lost with the subshell.
done <<< "$STAGED_FILES"

# One propagation for all full plugins bumped above, through the same script
# CI checks with --check.
if [ "$FULL_PLUGIN_BUMPED" -eq 1 ]; then
    ./scripts/sync-plugin-versions.sh
    for NAME in "${FULL_NAMES[@]}"; do
        git add \
            "plugins-claude/${NAME}/.claude-plugin/plugin.json" \
            "plugins-codex/${NAME}/.codex-plugin/plugin.json" \
            "plugins-opencode/${NAME}/package.json" \
            "plugins-antigravity/${NAME}/plugin.json"
    done
    git add "$MARKETPLACE_JSON"
fi

if [ "$CLAUDE_PLUGINS_BUMPED" -eq 1 ]; then
    if [ -f "$MARKETPLACE_JSON" ]; then
        MARKETPLACE_VERSION=$(jq -r '.version // empty' "$MARKETPLACE_JSON" 2>/dev/null || true)
        NEW_MARKETPLACE_VERSION=$(bump_marketplace_catalog_version "$MARKETPLACE_JSON") || exit 1
        git add "$MARKETPLACE_JSON"
        echo "Bumped marketplace.json version: ${MARKETPLACE_VERSION} -> ${NEW_MARKETPLACE_VERSION}"
    else
        echo "Warning: $MARKETPLACE_JSON not found, skipping marketplace bump"
    fi
fi

# The Codex catalog only lists the full plugins it publishes (voice, for
# instance, is deliberately absent). Bump its own version track once per
# commit, but only when a bumped plugin is actually one of its entries.
if [ "$FULL_PLUGIN_BUMPED" -eq 1 ] && [ -f "$CODEX_MARKETPLACE_JSON" ]; then
    CODEX_CATALOG_HIT=0
    for NAME in "${BUMPED_FULL_NAMES[@]}"; do
        if jq -e --arg name "$NAME" '.plugins[]? | select(.name == $name)' "$CODEX_MARKETPLACE_JSON" > /dev/null 2>&1; then
            CODEX_CATALOG_HIT=1
            break
        fi
    done
    if [ "$CODEX_CATALOG_HIT" -eq 1 ]; then
        CODEX_MARKETPLACE_VERSION=$(jq -r '.version // empty' "$CODEX_MARKETPLACE_JSON" 2>/dev/null || true)
        NEW_CODEX_MARKETPLACE_VERSION=$(bump_marketplace_catalog_version "$CODEX_MARKETPLACE_JSON") || exit 1
        git add "$CODEX_MARKETPLACE_JSON"
        echo "Bumped ${CODEX_MARKETPLACE_JSON} version: ${CODEX_MARKETPLACE_VERSION} -> ${NEW_CODEX_MARKETPLACE_VERSION}"
    fi
fi

exit 0
