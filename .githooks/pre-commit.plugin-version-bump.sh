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
# Treat a rename as deletion plus addition here. Default rename detection omits
# the old path from a D-only query, which would let CHANGELOG.md become NOTES.md
# while existence-based discovery quietly forgot the established surface.
DELETED_FILES=$(git diff --cached --no-renames --diff-filter=D --name-only)

REGISTRY="packages/plugin-layout-checks/registry/plugins.json"
HAVE_JQ=false
command -v jq &> /dev/null && HAVE_JQ=true

next_version() {
    # next_version <file>; echoes the patch bump without writing it, so the
    # changelog gate below can name the exact version an author must document
    # before anything on disk has moved.
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

changelog_surfaces_failed() {
    # Called when scripts/changelog-surfaces.mjs exits non-zero. Callers invoke
    # it with `|| changelog_surfaces_failed`, never inside `< <(...)` or `$(...)`
    # — those run in a subshell where `exit` would end the subshell and let the
    # hook carry on with the empty list it just failed to fill.
    if ! command -v node &> /dev/null; then
        echo "pre-commit: node is required to run scripts/changelog-surfaces.mjs, and is not installed." >&2
        echo "This commit changes ${1:-a plugin}, so its release notes have to be checked before its" >&2
        echo "version moves. Put node on this shell's PATH and commit again — under nvm, a GUI git" >&2
        echo "client often starts without it." >&2
        exit 1
    fi
    echo "pre-commit: scripts/changelog-surfaces.mjs failed for ${1:-all plugins}; refusing the commit." >&2
    echo "A failed lookup and an empty list are not the same answer. Reading this through a process" >&2
    echo "substitution made them identical — set -e cannot see a failure inside one — so a failing" >&2
    echo "script or a redirected registry produced no changelogs to check, and the gate below passed" >&2
    echo "an undocumented release with exit 0. Run \`node scripts/changelog-surfaces.mjs plugin-release ${1:-}\` to see why." >&2
    exit 1
}

declare -A PROCESSED_PLUGINS
PENDING_BUMPS=()
CLAUDE_PLUGINS_BUMPED=0
REGISTRY_PLUGIN_BUMPED=0

# Registry plugins first. A staged change anywhere the plugin owns — authored
# templates, any of its three platform trees, its npm package — is a change to
# that plugin, so the bump follows ownership rather than one directory prefix.
# The registry is the only thing that tells this hook which plugins are gated.
# Without it the hook cannot know, and the legacy loop below would cut an
# ungated release for a registry plugin: a bump with no changelog gate and no
# propagation, exit 0. This block used to be conditional, which meant a missing
# jq or an unparseable registry silently selected exactly that path. Refusing is
# the only answer that cannot ship the wrong thing quietly.
if [ "$HAVE_JQ" != true ]; then
    echo "pre-commit: jq is required to read $REGISTRY, and is not installed." >&2
    echo "Install jq and commit again." >&2
    exit 1
fi
if [ ! -f "$REGISTRY" ]; then
    echo "pre-commit: $REGISTRY is missing, so this hook cannot tell which plugins it gates." >&2
    exit 1
fi
if ! jq -e . "$REGISTRY" > /dev/null 2>&1; then
    echo "pre-commit: $REGISTRY is not parseable JSON, so this hook cannot tell which plugins it gates." >&2
    echo "Restore it and commit again." >&2
    exit 1
fi

while IFS=$'\t' read -r NAME SOURCE; do
    mapfile -t OWNED < <(jq -r --arg name "$NAME" '
        .plugins[] | select(.name == $name) |
        [.skillsSrc, .claudePluginRoot, .codexPluginRoot, .opencodePluginRoot,
         (.versionSurfaces.packageJson // empty | sub("/[^/]+$"; ""))] | .[]' "$REGISTRY")

    # The surfaces the registry names outright. Readable with jq alone, which
    # matters below: the changelogs need a second derivation, and that one costs
    # node.
    mapfile -t REGISTRY_SURFACES < <(jq -r --arg name "$NAME" '
        .plugins[] | select(.name == $name) | .versionSurfaces |
        [.source, .codexManifest, .opencodePackage, (.packageJson // empty),
         (.literals // [] | .[].path)] | .[]' "$REGISTRY")

    # Discovery is intentionally based on files that exist, so a plugin that
    # has never had release notes is allowed to remain that way. A staged
    # deletion is different: absence from the working tree must not erase the
    # fact that this commit removes an established release surface. Refuse it
    # before the existence-based lookup can turn the deletion into an empty
    # worklist and authorize the bump it triggers.
    mapfile -t CHANGELOG_CANDIDATES < <(jq -r --arg name "$NAME" '
        .plugins[] | select(.name == $name) |
        [.claudePluginRoot + "/CHANGELOG.md",
         (.versionSurfaces.packageJson // empty | sub("/[^/]+$"; "/CHANGELOG.md"))] | .[]' "$REGISTRY")
    for changelog in "${CHANGELOG_CANDIDATES[@]}"; do
        if grep -Fqx "$changelog" <<< "$DELETED_FILES"; then
            echo "pre-commit: refusing deletion of $changelog; it is an established release-notes surface for $NAME." >&2
            echo "Restore the changelog before committing so a release cannot be authorized without its notes." >&2
            exit 1
        fi
    done

    # Could this plugin possibly be in scope? Asked before anything costs node,
    # so a commit with nothing to do with any plugin does not need node to be
    # installed. The lookup used to come first, which meant a contributor whose
    # PATH had no node — a GUI git client under nvm, say — could not commit a
    # README typo in this repository. Failing closed is right when the thing
    # that cannot be checked is in scope; outside it, it is just an outage.
    #
    # Deliberately a prefilter and not the decision. It excludes only the
    # registry surfaces, so it admits everything the full test below admits and
    # more — a changelog edit among them. Answering the whole question here
    # instead would count a staged CHANGELOG as bump-triggering content, and the
    # author who had just written 1.0.7's notes would be told to write 1.0.8's:
    # the ratchet the exclusion below exists to prevent, rebuilt one step
    # earlier. A superset can only ever skip work that would have found nothing.
    MAYBE_TOUCHED=0
    while IFS= read -r file; do
        [ -z "$file" ] && continue
        for surface in "${REGISTRY_SURFACES[@]}"; do
            [ "$file" = "$surface" ] && continue 2
        done
        for owned in "${OWNED[@]}"; do
            case "$file" in "$owned"/*) MAYBE_TOUCHED=1; break 2;; esac
        done
    done <<< "$STAGED_FILES"
    [ "$MAYBE_TOUCHED" -eq 0 ] && continue

    if ! command -v node &> /dev/null; then
        changelog_surfaces_failed "$NAME"
    fi
    IDENTITY=$(node scripts/release-identity.mjs "$NAME" plugin) || {
        echo "pre-commit: could not resolve the $NAME plugin release identity; refusing the commit." >&2
        exit 1
    }
    IDENTITY_SOURCE=$(jq -r '.versionSource' <<< "$IDENTITY")
    RELEASE_LABEL=$(jq -r '.label' <<< "$IDENTITY")
    if [ "$SOURCE" != "$IDENTITY_SOURCE" ]; then
        echo "pre-commit: $NAME plugin release identity uses $IDENTITY_SOURCE, but versionSurfaces.source declares $SOURCE; refusing the commit." >&2
        exit 1
    fi

    # Version surfaces are what this hook writes. Counting them as changes
    # would make every commit it touches justify the next one — and for the
    # changelogs, which the hook only reads, a commit that adds the notes
    # for a release would demand notes for the release after it.
    CHANGELOGS=$(node scripts/changelog-surfaces.mjs plugin-release "$NAME") || changelog_surfaces_failed "$NAME"
    SURFACES=("${REGISTRY_SURFACES[@]}")
    while IFS= read -r changelog_surface; do
        [ -z "$changelog_surface" ] && continue
        SURFACES+=("$(jq -r '.path' <<< "$changelog_surface")")
    done <<< "$CHANGELOGS"

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

    NEXT=$(next_version "$SOURCE") || {
        echo "Warning: Could not parse version from $SOURCE, skipping"
        continue
    }
    PENDING_BUMPS+=("${NAME}"$'\t'"${IDENTITY_SOURCE}"$'\t'"${RELEASE_LABEL}"$'\t'"${NEXT}")
done < <(jq -r '.plugins[] | [.name, .versionSurfaces.source] | @tsv' "$REGISTRY")

# Gate every pending bump before performing any of them. A release whose
# notes are missing is refused with nothing written, so the author fixes the
# CHANGELOG and re-commits rather than finding half the surfaces already
# advanced by the run that rejected them.
#
# Which files count as notes is derived from what exists on disk, not from a
# registry list. The list was filled in for one plugin of eight, so this loop
# ran for agent-skills and iterated an empty array — reporting success — for
# everyone else, agent-hooks included, which is how it reached 1.0.3 against a
# changelog ending at 1.0.0.
for pending in "${PENDING_BUMPS[@]}"; do
    IFS=$'\t' read -r NAME SOURCE RELEASE_LABEL NEXT <<< "$pending"
    CHANGELOGS=$(node scripts/changelog-surfaces.mjs plugin-release "$NAME") || changelog_surfaces_failed "$NAME"
    while IFS= read -r CHANGELOG_SURFACE; do
        [ -z "$CHANGELOG_SURFACE" ] && continue
        CHANGELOG_PATH=$(jq -r '.path' <<< "$CHANGELOG_SURFACE")
        CHANGELOG_LABEL=$(jq -r '.label' <<< "$CHANGELOG_SURFACE")
        CHANGELOG_SOURCE=$(jq -r '.versionSource' <<< "$CHANGELOG_SURFACE")
        node scripts/check-changelog-entry.mjs "$CHANGELOG_PATH" "$NEXT" "$CHANGELOG_LABEL" "$CHANGELOG_SOURCE" || {
            # Exit 3 is "could not check", exit 1 is "nothing to find". Told
            # apart here for the same reason sync-plugin-versions.sh tells them
            # apart: on a shallow checkout the line above says the history
            # cannot be read, and following it with "that release has no notes"
            # sends the author to write an entry that is already written.
            CHECK_STATUS=$?
            if [ "$CHECK_STATUS" -eq 3 ]; then
                echo "This commit bumps ${NAME} to ${NEXT}, and that release's notes could not be checked." >&2
            else
                echo "This commit bumps ${NAME} to ${NEXT}, and that release has no notes." >&2
            fi
            echo "Nothing has been written; resolve the above and commit again." >&2
            exit 1
        }
    done <<< "$CHANGELOGS"
done

for pending in "${PENDING_BUMPS[@]}"; do
    IFS=$'\t' read -r NAME SOURCE RELEASE_LABEL NEXT <<< "$pending"
    NEW_VERSION=$(bump_patch "$SOURCE")
    echo "Bumped ${NAME} version: -> ${NEW_VERSION}"
    PROCESSED_PLUGINS["claude:${NAME}"]=1
    CLAUDE_PLUGINS_BUMPED=1
    REGISTRY_PLUGIN_BUMPED=1
done

# Every registry plugin is claimed here, bumped or not. The loop below
# bumps any `plugins/<name>/` with a staged non-manifest file, and it used
# to reach registry plugins that this block had deliberately declined to
# bump — so editing only a declared version surface, a CHANGELOG most of
# all, produced an ungated bump through the legacy path: a new version with
# no release notes, which is the exact failure the gate above exists to
# prevent. Registry plugins are bumped by the gated path or not at all.
#
# Both keys are claimed. The legacy loop keys on the directory it captures from
# `plugins/<dir>/`, this block knows the registry `.name`, and the two are equal
# for all eight plugins today with nothing requiring them to stay equal — so a
# plugin whose directory diverged from its name would walk straight back through
# the hole this closes.
while IFS=$'\t' read -r name root; do
    [ -z "$name" ] && continue
    PROCESSED_PLUGINS["claude:${name}"]=${PROCESSED_PLUGINS["claude:${name}"]:-1}
    case "$root" in
        plugins/*)
            dir="${root#plugins/}"
            dir="${dir%%/*}"
            PROCESSED_PLUGINS["claude:${dir}"]=${PROCESSED_PLUGINS["claude:${dir}"]:-1}
            ;;
    esac
done < <(jq -r '.plugins[] | [.name, .claudePluginRoot] | @tsv' "$REGISTRY")

# Marketplace plugins outside the registry keep the original single-surface
# behaviour: they have no declared Codex or OpenCode surface to propagate to.
while IFS= read -r file; do
    [ -z "$file" ] && continue
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

# One propagation for all registry plugins bumped above, through the same
# script CI checks with --check. A bump this hook makes and a surface CI
# verifies can no longer disagree about what a plugin's surfaces are.
if [ "$REGISTRY_PLUGIN_BUMPED" -eq 1 ]; then
    ./scripts/sync-plugin-versions.sh
    # Changelogs are staged too, though the hook never writes them: the entry
    # the gate above read from the working tree has to reach the commit, or the
    # bump ships without the notes that authorised it.
    ALL_CHANGELOGS=$(node scripts/changelog-surfaces.mjs plugin-release) || changelog_surfaces_failed
    mapfile -t ALL_SURFACES < <(jq -r '
        .plugins[].versionSurfaces |
        [.source, .codexManifest, .opencodePackage, (.packageJson // empty),
         (.literals // [] | .[].path)] | .[]' "$REGISTRY"
        # Guarded: printf on an empty capture emits one blank line, and a blank
        # element in ALL_SURFACES reaches `git add ""`.
        [ -n "$ALL_CHANGELOGS" ] && printf '%s\n' "$ALL_CHANGELOGS" | jq -r '.path')
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
