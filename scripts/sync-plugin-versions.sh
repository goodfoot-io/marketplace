#!/usr/bin/env bash
set -euo pipefail

# Propagates every registry plugin's version across its four surfaces, treating
# each plugin's declared versionSurfaces.source as the source of truth. The
# layout-checks version-lockstep test fails closed on drift; this script is what
# fixes that drift.
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

REGISTRY="packages/plugin-layout-checks/registry/plugins.json"
MARKETPLACE_JSON=".claude-plugin/marketplace.json"

[ -f "$REGISTRY" ] || { echo "Registry not found at $REGISTRY" >&2; exit 1; }

PLUGIN_COUNT="$(jq '.plugins | length' "$REGISTRY")"
if [ "$PLUGIN_COUNT" -eq 0 ]; then
  echo "Registry declares no plugins; refusing to report success for a no-op sync" >&2
  exit 1
fi

DRIFTED=false

write_version() {
  # write_version <file> <jq-filter> <version>
  local file="$1" filter="$2" version="$3"
  if [ "$CHECK_ONLY" = true ]; then
    echo "  drift: $file" >&2
    DRIFTED=true
  else
    jq --arg version "$version" "$filter" "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    echo "  updated $file"
  fi
}

while IFS=$'\t' read -r NAME MARKETPLACE_NAME SOURCE CODEX_MANIFEST OPENCODE_PACKAGE; do
  for required in "$SOURCE" "$CODEX_MANIFEST" "$OPENCODE_PACKAGE"; do
    [ -f "$required" ] || { echo "$NAME: declared surface $required does not exist" >&2; exit 1; }
  done

  VERSION="$(jq -r '.version' "$SOURCE")"
  if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
    echo "$NAME: could not read a version from $SOURCE" >&2
    exit 1
  fi

  echo "$NAME -> $VERSION"

  [ "$(jq -r '.version' "$CODEX_MANIFEST")" = "$VERSION" ] ||
    write_version "$CODEX_MANIFEST" '.version = $version' "$VERSION"

  [ "$(jq -r '.version' "$OPENCODE_PACKAGE")" = "$VERSION" ] ||
    write_version "$OPENCODE_PACKAGE" '.version = $version' "$VERSION"

  MARKETPLACE_VERSION="$(jq -r --arg name "$MARKETPLACE_NAME" '.plugins[] | select(.name == $name) | .version' "$MARKETPLACE_JSON")"
  if [ -z "$MARKETPLACE_VERSION" ]; then
    echo "$NAME: no $MARKETPLACE_NAME entry in $MARKETPLACE_JSON" >&2
    exit 1
  fi
  if [ "$MARKETPLACE_VERSION" != "$VERSION" ]; then
    if [ "$CHECK_ONLY" = true ]; then
      echo "  drift: $MARKETPLACE_JSON ($MARKETPLACE_NAME)" >&2
      DRIFTED=true
    else
      jq --arg version "$VERSION" --arg name "$MARKETPLACE_NAME" \
        '(.plugins[] | select(.name == $name)).version = $version' "$MARKETPLACE_JSON" > "${MARKETPLACE_JSON}.tmp" &&
        mv "${MARKETPLACE_JSON}.tmp" "$MARKETPLACE_JSON"
      echo "  updated $MARKETPLACE_JSON ($MARKETPLACE_NAME)"
    fi
  fi
done < <(jq -r '.plugins[] | [.name, .marketplace.claude, .versionSurfaces.source, .versionSurfaces.codexManifest, .versionSurfaces.opencodePackage] | @tsv' "$REGISTRY")

if [ "$DRIFTED" = true ]; then
  echo "Version drift detected. Run ./scripts/sync-plugin-versions.sh to fix." >&2
  exit 1
fi

echo "Synced $PLUGIN_COUNT registry plugin(s)."
