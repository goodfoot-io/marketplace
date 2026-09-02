#!/usr/bin/env bash
set -euo pipefail

# Propagates each skills-src plugin's Claude manifest version — the source of
# truth — to its Codex, OpenCode, and Antigravity manifests, and to its entry
# in the Claude marketplace catalog. One version per plugin, one source per
# version; this script is what keeps the other three platform manifests, and
# the catalog, from drifting away from it.
#
# Plugin identity and surface paths both follow the fixed convention every
# other build/lint driver uses (see scripts/agent-skills-registry.mts): a
# plugin is any directory under skills-src/, and its per-platform manifest
# always lives at plugins-<platform>/<name>/<platform-specific manifest path>.
# Hand-maintained Claude-only plugins (no skills-src/<name> sibling, e.g.
# typescript-hooks) are out of scope here — they carry no cross-platform
# manifests to sync; .githooks/pre-commit.plugin-version-bump.sh bumps their
# single Claude manifest directly.
#
# A plugin's npm package (packages/<name>), where one exists, is a separate
# release line with its own version — not a surface this script touches.
#
# Usage: ./scripts/sync-plugin-versions.sh [--check]
#   --check  report drift and exit non-zero instead of writing (CI mode)
# Requires: jq

command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }

CHECK_ONLY=false
if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=true
elif [ -n "${1:-}" ]; then
  echo "Unknown argument: $1" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

MARKETPLACE_JSON=".claude-plugin/marketplace.json"
SKILLS_SRC="skills-src"

[ -d "$SKILLS_SRC" ] || { echo "$SKILLS_SRC not found" >&2; exit 1; }

mapfile -t NAMES < <(find "$SKILLS_SRC" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
if [ "${#NAMES[@]}" -eq 0 ]; then
  echo "$SKILLS_SRC declares no plugins; refusing to report success for a no-op sync" >&2
  exit 1
fi

DRIFTED=false

write_version() {
  # write_version <file> <version>
  local file="$1" version="$2"
  if [ "$CHECK_ONLY" = true ]; then
    echo "  drift: $file" >&2
    DRIFTED=true
  else
    jq --arg version "$version" '.version = $version' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    echo "  updated $file"
  fi
}

for NAME in "${NAMES[@]}"; do
  SOURCE="plugins-claude/$NAME/.claude-plugin/plugin.json"
  CODEX_MANIFEST="plugins-codex/$NAME/.codex-plugin/plugin.json"
  OPENCODE_PACKAGE="plugins-opencode/$NAME/package.json"
  ANTIGRAVITY_MANIFEST="plugins-antigravity/$NAME/plugin.json"

  for required in "$SOURCE" "$CODEX_MANIFEST" "$OPENCODE_PACKAGE" "$ANTIGRAVITY_MANIFEST"; do
    [ -f "$required" ] || { echo "$NAME: expected surface $required does not exist" >&2; exit 1; }
  done

  VERSION="$(jq -r '.version' "$SOURCE")"
  if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
    echo "$NAME: could not read a version from $SOURCE" >&2
    exit 1
  fi

  echo "$NAME -> $VERSION"

  [ "$(jq -r '.version' "$CODEX_MANIFEST")" = "$VERSION" ] ||
    write_version "$CODEX_MANIFEST" "$VERSION"

  [ "$(jq -r '.version' "$OPENCODE_PACKAGE")" = "$VERSION" ] ||
    write_version "$OPENCODE_PACKAGE" "$VERSION"

  [ "$(jq -r '.version' "$ANTIGRAVITY_MANIFEST")" = "$VERSION" ] ||
    write_version "$ANTIGRAVITY_MANIFEST" "$VERSION"

  MARKETPLACE_VERSION="$(jq -r --arg name "$NAME" '.plugins[] | select(.name == $name) | .version' "$MARKETPLACE_JSON")"
  if [ -z "$MARKETPLACE_VERSION" ]; then
    echo "$NAME: no $NAME entry in $MARKETPLACE_JSON" >&2
    exit 1
  fi
  if [ "$MARKETPLACE_VERSION" != "$VERSION" ]; then
    if [ "$CHECK_ONLY" = true ]; then
      echo "  drift: $MARKETPLACE_JSON ($NAME)" >&2
      DRIFTED=true
    else
      jq --arg version "$VERSION" --arg name "$NAME" \
        '(.plugins[] | select(.name == $name)).version = $version' "$MARKETPLACE_JSON" > "${MARKETPLACE_JSON}.tmp" &&
        mv "${MARKETPLACE_JSON}.tmp" "$MARKETPLACE_JSON"
      echo "  updated $MARKETPLACE_JSON ($NAME)"
    fi
  fi
done

if [ "$DRIFTED" = true ]; then
  echo "Version drift detected. Run ./scripts/sync-plugin-versions.sh to fix." >&2
  exit 1
fi

echo "Synced ${#NAMES[@]} plugin(s)."
