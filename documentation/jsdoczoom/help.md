NAME
    jsdoczoom - Hierarchical JSDoc reader for TypeScript codebases

SYNOPSIS
    jsdoczoom [selector[@depth]]
    jsdoczoom -v [selector]
    jsdoczoom -h | --help

DESCRIPTION
    jsdoczoom reads TypeScript source files and returns progressive detail
    as JSON. It parses files directly with no prebuilt index.

    A selector is a glob or a relative file path. A selector containing
    glob characters (*, ?, [, {) is treated as a glob; otherwise it is
    treated as a file path. Paths are relative to the current working
    directory and must use forward slashes. Matching is case-sensitive.
    An optional @<depth> suffix controls drill-down depth.

    Only .ts and .tsx files are processed. Type declaration files
    (.d.ts) are excluded even if matched by a glob pattern. Defaults
    when no selector is given: **/*.ts and **/*.tsx.

OPTIONS
    -h, --help       Show help and exit.
    -v, --validate   Validate matched files (see VALIDATION).
                     @depth suffixes are not accepted with -v.

JSDOC CONVENTION
    jsdoczoom extracts from the first /** */ block in each file (the
    file-level JSDoc). This block must appear before any code statements;
    it may follow import declarations.

    Only lowercase @summary is recognized. Summary levels are numbered
    starting from 0 (most concise). The free-text description (text
    before any @tags) is the last-returned summary level — despite
    appearing first in the source, it gets the highest level number.

    Example:
      /**
       * Comprehensive explanation of responsibilities and trade-offs.
       *
       * @summary Concise one-liner.
       * @summary More detail about key mechanisms.
       */

    This file has 3 summary levels:
      L0 = "Concise one-liner."                     (first @summary)
      L1 = "More detail about key mechanisms."       (second @summary)
      L2 = "Comprehensive explanation of..."         (free-text)

    A @summary tag with only whitespace content is treated as absent
    and does not create a level.

    A file with free-text but no @summary tags has 1 summary level.
    A file with no @summary tags and no free-text has 0 levels and is
    excluded from glob results; targeting it by path returns
    NO_SUMMARY_FOUND.

DRILL-DOWN
    Each response includes an id field. Pass it back as the selector to
    get the next level of detail.

    For a file with summary levels L0, L1, ..., LN:
      jsdoczoom F        => L0,  id: F@0
      jsdoczoom F@0      => L1,  id: F@1
      ...
      jsdoczoom F@N      => JSDoc + type declarations,  id: F@(N+1)
      jsdoczoom F@(N+1)  => full file content (unmodified source), more: false

    The id is a cursor: F@k means level k was just returned.
    Requesting F@k returns level k+1. To start at level 0, use the
    bare path with no @depth suffix. Requesting a depth beyond the
    final level returns the terminal level with more=false and the id
    clamped (e.g., F@99 on a file whose terminal cursor is 3 returns
    id F@3).

    The "JSDoc + type declarations" level is the equivalent of a .d.ts
    file with JSDoc: exported signatures, types, and interfaces with
    documentation, but no implementation bodies.

    When a glob matches multiple files, each file advances through its
    own levels independently. A file with 1 summary level reaches its
    terminal level sooner than a file with 3.

    For barrels (index.ts / index.tsx), see TREE MODEL.

TREE MODEL
    Files with at least one summary level are nodes. Files named
    index.ts or index.tsx are barrel nodes that represent their directory.

    A barrel's immediate children are:
      - child barrels: <dir>/*/index.{ts,tsx}
      - leaf files:    <dir>/*.{ts,tsx}, excluding the barrel itself

    Children are one level deep only (non-recursive). A child that is
    itself a barrel appears as a regular item; to explore its own
    children, issue a separate glob targeting its subdirectory. If both
    index.ts and index.tsx exist, index.ts takes priority as the barrel.

    Barrel gating applies only via glob. When a barrel is reached via
    glob, its summary levels are returned first. Once exhausted, the
    next drill-down returns its children (each at their shallowest
    level) as a flat array.

    When a barrel is targeted by direct path, it behaves like a leaf
    file: summary levels, then JSDoc + type declarations, then full
    file content. Children are never revealed via direct path.

    Example (barrel at src/foo/index.ts with 2 @summary tags):
      jsdoczoom "src/foo/**/*"    => barrel L0  (id: src/foo/index.ts@0)
      jsdoczoom "src/foo/**/*@0"  => barrel L1  (id: src/foo/index.ts@1)
      jsdoczoom "src/foo/**/*@1"  => [child1 at L0, child2 at L0, ...]
      (barrel had 2 levels: L0, L1. After @1, children are revealed.)

OUTPUT
    Response is always a JSON array. Each item:
      id    string   Drill-down cursor for the next request
      path  string   File path relative to working directory
      more  boolean  False only at the terminal level
      text  string   Content at this level

    Items are ordered alphabetically by path. If a file in a glob has
    a syntax error, it appears in the array with a PARSE_ERROR entry
    instead of text content; other files are unaffected.

VALIDATION
    jsdoczoom -v [selector]

    Validates matched files. Checks:
      - Valid TypeScript syntax
      - File-level JSDoc block is present
      - At least two @summary tags (free-text description does not
        count toward this requirement)
      - Each @summary has non-empty content (whitespace-only tags are
        treated as absent)

    Output is a JSON object. Exit code 2 if any file fails; 0 if all
    pass. Example:

      {
        "files": [
          {"path": "src/foo.ts", "passed": true, "issues": []},
          {"path": "src/bar.ts", "passed": false,
           "issues": ["Less than 2 @summary tags"]}
        ],
        "summary": {"total": 2, "passed": 1, "failed": 1}
      }

    Note: files with fewer than two @summary tags still work in normal
    mode — they just fail validation. Validation is a linting check
    with stricter requirements than normal operation.

ERRORS
    On failure, jsdoczoom writes a JSON error to stderr and exits 1.

      { "error": { "code": "...", "message": "..." } }

    Codes:
      INVALID_SELECTOR   Selector is not a valid glob or path.
      INVALID_DEPTH      Depth suffix is not a non-negative integer,
                         or used with --validate.
      FILE_NOT_FOUND     Path selector targets a nonexistent file.
      NO_FILES_MATCHED   Glob matched no .ts/.tsx files, or all matched
                         files lack summary levels.
      NO_SUMMARY_FOUND   File exists but has no summary levels (no
                         @summary tags and no free-text description).
      PARSE_ERROR        File is not valid TypeScript.
      VALIDATION_FAILED  One or more files failed validation (exit 2).
      INTERNAL_ERROR     Unexpected failure.

EXIT STATUS
    0   Success
    1   Error
    2   Validation failed (--validate only)

EXAMPLES
    # Get L0 summaries for all TypeScript files
    jsdoczoom
    # Returns JSON array with each file at its shallowest summary.

    # Drill deeper using a returned id
    jsdoczoom "packages/foo/src/hooks/index.ts"
    # Returns L0. Response includes id: "packages/foo/src/hooks/index.ts@0"
    jsdoczoom "packages/foo/src/hooks/index.ts@0"
    # Returns L1.

    # Request a specific depth across a glob
    jsdoczoom "src/**/*.ts@2"
    # Each file independently returns its level 3 (or terminal if fewer levels).

    # Explore a barrel's children via glob
    jsdoczoom "packages/foo/src/**/*"
    # Barrel at index.ts returns L0. Drill through its summaries, then
    # children appear as a flat array.

    # Access a barrel's own full content via direct path
    jsdoczoom "packages/foo/src/index.ts@2"
    # Returns JSDoc + type declarations (not children).

    # Validate documentation standards
    jsdoczoom -v "packages/**/src/**/*.ts"
    # Exit 0 if all files pass; exit 2 if any fail.
