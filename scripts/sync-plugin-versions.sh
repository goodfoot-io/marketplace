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
MISSING_NOTES=false

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

while IFS=$'\t' read -r NAME MARKETPLACE_NAME SOURCE CODEX_MANIFEST OPENCODE_PACKAGE PACKAGE_JSON; do
  [ "$PACKAGE_JSON" = "null" ] && PACKAGE_JSON=""
  for required in "$SOURCE" "$CODEX_MANIFEST" "$OPENCODE_PACKAGE" ${PACKAGE_JSON:+"$PACKAGE_JSON"}; do
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

  # The published npm package, where a plugin ships one. agent-skills is the
  # only such plugin today, and its package version drifting from the plugin
  # version is what made "which build produced this output" unanswerable.
  if [ -n "$PACKAGE_JSON" ]; then
    [ "$(jq -r '.version' "$PACKAGE_JSON")" = "$VERSION" ] ||
      write_version "$PACKAGE_JSON" '.version = $version' "$VERSION"
  fi

  # Versions embedded in source rather than in a JSON field. jq cannot reach
  # them, so they were the surfaces nothing propagated to.
  # Read by index rather than @tsv: the declared pattern is a regex, and @tsv
  # escapes backslashes, so every `\.` would reach node as `\\.` and match
  # nothing — a silent pass in check mode dressed as a loud one.
  LITERAL_COUNT="$(jq -r --arg name "$NAME" '.plugins[] | select(.name == $name) | .versionSurfaces.literals // [] | length' "$REGISTRY")"
  LITERAL_INDEX=0
  while [ "$LITERAL_INDEX" -lt "$LITERAL_COUNT" ]; do
    LITERAL_FILTER='.plugins[] | select(.name == $name) | .versionSurfaces.literals['"$LITERAL_INDEX"']'
    LITERAL_PATH="$(jq -r --arg name "$NAME" "$LITERAL_FILTER"'.path' "$REGISTRY")"
    LITERAL_MATCH="$(jq -r --arg name "$NAME" "$LITERAL_FILTER"'.match' "$REGISTRY")"
    [ -f "$LITERAL_PATH" ] || { echo "$NAME: declared literal surface $LITERAL_PATH does not exist" >&2; exit 1; }
    if [ "$CHECK_ONLY" = true ]; then
      node scripts/rewrite-version-literal.mjs "$LITERAL_PATH" "$LITERAL_MATCH" "$VERSION" --check || DRIFTED=true
    else
      node scripts/rewrite-version-literal.mjs "$LITERAL_PATH" "$LITERAL_MATCH" "$VERSION"
    fi
    LITERAL_INDEX=$((LITERAL_INDEX + 1))
  done

  # Release notes. Verified in both modes and written in neither: the other
  # surfaces hold a version and nothing else, so propagation can set the field,
  # but a CHANGELOG entry's body is a sentence only the author of the change can
  # write. Stamping a bare heading would close this gate while leaving the user
  # who opens the file knowing only which version they installed.
  #
  # Which files those are comes from scripts/changelog-surfaces.mjs, the same
  # derivation the hook and the layout suite read, so none of the three can
  # disagree about whether a plugin has release notes to check.
  while IFS= read -r CHANGELOG_PATH; do
    [ -z "$CHANGELOG_PATH" ] && continue
    node scripts/check-changelog-entry.mjs "$CHANGELOG_PATH" "$VERSION" || MISSING_NOTES=true
  done < <(node scripts/changelog-surfaces.mjs "$NAME")

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
done < <(jq -r '.plugins[] | [.name, .marketplace.claude, .versionSurfaces.source, .versionSurfaces.codexManifest, .versionSurfaces.opencodePackage, (.versionSurfaces.packageJson // "null")] | @tsv' "$REGISTRY")

if [ "$MISSING_NOTES" = true ]; then
  # Each failure above already printed check-changelog-entry.mjs's own
  # path-aware remediation; a second, path-blind instruction here would
  # contradict it for a plugins/<name>/CHANGELOG.md path, the same wrong-tool
  # misdirection check-changelog-entry.mjs's remediation() now avoids.
  echo "Release notes are missing for the version(s) above; no script can write them for you." >&2
  exit 1
fi

if [ "$DRIFTED" = true ]; then
  echo "Version drift detected. Run ./scripts/sync-plugin-versions.sh to fix." >&2
  exit 1
fi

echo "Synced $PLUGIN_COUNT registry plugin(s)."
