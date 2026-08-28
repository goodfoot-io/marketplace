#!/bin/bash
# Bumps the patch version of every plugin with staged changes and propagates
# that version to all of the plugin's declared surfaces, then re-stages them.
#
# Bumping and propagating used to be two mechanisms: this hook wrote
# plugins-claude/<name>/.claude-plugin/plugin.json and the marketplace entry, and
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

bump_marketplace_catalog_version() {
    # bump_marketplace_catalog_version <file>; echoes the new catalog version.
    #
    # The catalog carries its own version track, deliberately separate from the
    # plugin versions in `.plugins[]`. This used to read it with
    # `grep ... | head -1` and write it with a `0,/.../` sed — both of which
    # mean "the first `"version"` literal in the file", not "the catalog's".
    # That was only ever right because the top-level key happens to sit above
    # the `plugins` array. Reorder the keys and the same two commands would
    # silently read and bump a plugin entry's version instead, leaving the
    # catalog frozen and one plugin a patch ahead of every other surface.
    #
    # Read through jq, so the value comes from `.version` by name. Written with
    # an awk pass that tracks JSON nesting depth and only rewrites the
    # `"version"` key at depth 1, so the write is addressed by position in the
    # tree rather than position in the file, and every other byte — indentation,
    # key order, the plugin entries — is passed through untouched.
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
# `main` and the export map; a literal surface is source code. Excluding the
# whole file — so the hook's own writes could not re-trigger it — also excluded
# every other edit to it, which is how `main` was added to eight OpenCode
# manifests and shipped unversioned, and how a change to what
# `agent-skills --version` prints would ship the same way. Only the version is
# exempt; everything else in the file is content like any other.
#
# Undecidable cases count as content. The cost of that default is a bump that
# asks for release notes. The cost of the other one is another silent
# unversioned change, which is the bug this exists to close.
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
            # A literal surface holds the version as a bare string with no key
            # to delete, so rewrite HEAD's version to the staged one and
            # require the rest to be untouched. Blanking every semver instead
            # would also blank an unrelated one — a dependency range beside it
            # could change with no bump.
            old_version=$(git show "HEAD:$source_manifest" 2>/dev/null | jq -r '.version // empty' 2>/dev/null) || return 1
            new_version=$(git show ":$source_manifest" 2>/dev/null | jq -r '.version // empty' 2>/dev/null) || return 1
            [ -z "$old_version" ] && return 1
            [ -z "$new_version" ] && return 1
            head=${head//"$old_version"/"$new_version"}
            ;;
    esac

    [ "$head" = "$staged" ]
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
        [.skillsSrc, .claudePluginRoot, .codexPluginRoot, .opencodePluginRoot, (.antigravityPluginRoot // empty),
         (.versionSurfaces.packageJson // empty | sub("/[^/]+$"; ""))] | .[]' "$REGISTRY")

    # The surfaces the registry names outright. Readable with jq alone, which
    # matters below: the changelogs need a second derivation, and that one costs
    # node.
    mapfile -t REGISTRY_SURFACES < <(jq -r --arg name "$NAME" '
        .plugins[] | select(.name == $name) | .versionSurfaces |
        [.source, .codexManifest, .opencodePackage, (.antigravityManifest // empty), (.packageJson // empty),
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
    # Deliberately a prefilter and not the decision: ownership only, so it
    # admits everything the full test below admits and more — a changelog edit
    # and a version-only bump among them. Answering the whole question here
    # instead would count a staged CHANGELOG as bump-triggering content, and the
    # author who had just written 1.0.7's notes would be told to write 1.0.8's:
    # the ratchet the exclusion below exists to prevent, rebuilt one step
    # earlier. A superset can only ever skip work that would have found nothing.
    MAYBE_TOUCHED=0
    while IFS= read -r file; do
        [ -z "$file" ] && continue
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

    # Changelogs are exempt outright: the hook only reads them, and a commit
    # that adds the notes for a release must not demand notes for the release
    # after it.
    CHANGELOGS=$(node scripts/changelog-surfaces.mjs plugin-release "$NAME") || changelog_surfaces_failed "$NAME"
    CHANGELOG_SURFACES=()
    while IFS= read -r changelog_surface; do
        [ -z "$changelog_surface" ] && continue
        CHANGELOG_SURFACES+=("$(jq -r '.path' <<< "$changelog_surface")")
    done <<< "$CHANGELOGS"

    # Version surfaces are exempt only for the version itself. They are what
    # this hook writes, so counting a version move would make every commit it
    # touches justify the next one; counting nothing else in the file let real
    # edits ship unversioned.
    TOUCHED=0
    while IFS= read -r file; do
        [ -z "$file" ] && continue
        for surface in "${CHANGELOG_SURFACES[@]}"; do
            [ "$file" = "$surface" ] && continue 2
        done
        for surface in "${REGISTRY_SURFACES[@]}"; do
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
# bumps any `plugins-claude/<name>/` with a staged non-manifest file, and it used
# to reach registry plugins that this block had deliberately declined to
# bump — so editing only a declared version surface, a CHANGELOG most of
# all, produced an ungated bump through the legacy path: a new version with
# no release notes, which is the exact failure the gate above exists to
# prevent. Registry plugins are bumped by the gated path or not at all.
#
# Both keys are claimed. The legacy loop keys on the directory it captures from
# `plugins-claude/<dir>/`, this block knows the registry `.name`, and the two are equal
# for all eight plugins today with nothing requiring them to stay equal — so a
# plugin whose directory diverged from its name would walk straight back through
# the hole this closes.
while IFS=$'\t' read -r name root; do
    [ -z "$name" ] && continue
    PROCESSED_PLUGINS["claude:${name}"]=${PROCESSED_PLUGINS["claude:${name}"]:-1}
    case "$root" in
        plugins-claude/*)
            dir="${root#plugins-claude/}"
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
    if [[ "$file" =~ ^plugins-claude/([^/]+)/ ]]; then
        PLUGIN_NAME="${BASH_REMATCH[1]}"
        PLUGIN_ROOT="plugins-claude"
        PLUGIN_JSON="plugins-claude/${PLUGIN_NAME}/.claude-plugin/plugin.json"
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
        [.source, .codexManifest, .opencodePackage, (.antigravityManifest // empty), (.packageJson // empty),
         (.literals // [] | .[].path)] | .[]' "$REGISTRY"
        # Guarded: printf on an empty capture emits one blank line, and a blank
        # element in ALL_SURFACES reaches `git add ""`.
        [ -n "$ALL_CHANGELOGS" ] && printf '%s\n' "$ALL_CHANGELOGS" | jq -r '.path')
    git add "${ALL_SURFACES[@]}" .claude-plugin/marketplace.json
fi

if [ "$CLAUDE_PLUGINS_BUMPED" -eq 1 ]; then
    MARKETPLACE_JSON=".claude-plugin/marketplace.json"
    if [ -f "$MARKETPLACE_JSON" ]; then
        MARKETPLACE_VERSION=$(jq -r '.version // empty' "$MARKETPLACE_JSON" 2>/dev/null || true)
        NEW_MARKETPLACE_VERSION=$(bump_marketplace_catalog_version "$MARKETPLACE_JSON") || exit 1
        git add "$MARKETPLACE_JSON"
        echo "Bumped marketplace.json version: ${MARKETPLACE_VERSION} -> ${NEW_MARKETPLACE_VERSION}"
    else
        echo "Warning: $MARKETPLACE_JSON not found, skipping marketplace bump"
    fi
fi

exit 0
