NAME
    jsdoczoom - Hierarchical JSDoc reader for TypeScript codebases

SYNOPSIS
    jsdoczoom [options] [selector[@depth]]
    jsdoczoom -v [selector]
    jsdoczoom -s
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

    Files matched by .gitignore are excluded by default. Use
    --no-gitignore to include them.

OPTIONS
    -h, --help       Show help and exit.
    -v, --validate   Validate matched files (see VALIDATION).
                     @depth suffixes are silently ignored with -v.
    -s, --skill      Print JSDoc writing guidelines for LLM consumption.
    --pretty         Format JSON output with 2-space indent.
    --limit N        Max results shown (default 100).
    --no-gitignore   Include files ignored by .gitignore.

JSDOC CONVENTION
    jsdoczoom extracts from the first /** */ block in each file (the
    file-level JSDoc). This block must appear before any code statements;
    it may follow import declarations.

    Each file has two optional documentation fields:

      @summary    A concise one-line overview (lowercase only).
      description Free-text prose before any @tags.

    Only the first non-empty @summary tag is used. Additional @summary
    tags are silently ignored. A @summary tag with only whitespace
    content is treated as absent.

    Example:
      /**
       * Comprehensive explanation of responsibilities and trade-offs.
       *
       * @summary Concise one-liner.
       */

    This file has:
      @summary    = "Concise one-liner."
      description = "Comprehensive explanation of..."

DRILL-DOWN
    Each file has four fixed levels, numbered 1 through 4:

      Level 1: @summary text
      Level 2: description (free-text before @tags)
      Level 3: type declarations (exported signatures)
      Level 4: full file content (terminal)

    If a level is empty for a given file (e.g., no @summary), that
    level is skipped and the next non-empty level is returned instead.

    When more detail is available beyond the current level, the output
    item contains a next_id pointing to the next level. At the terminal
    level (or when no deeper level exists), the item contains an id
    representing the current state.

    Examples:
      File with @summary + description:
        jsdoczoom F        => @summary text,  next_id: F@2
        jsdoczoom F@2      => description,    next_id: F@3
        jsdoczoom F@3      => type decls,     next_id: F@4
        jsdoczoom F@4      => full file,      id: F@4

      File with @summary but no description:
        jsdoczoom F        => @summary text,  next_id: F@2
        jsdoczoom F@2      => type decls,     next_id: F@4
        (level 2 is empty, so it advances to level 3)

      File with no @summary and no description:
        jsdoczoom F        => type decls,     next_id: F@4
        (levels 1 and 2 are empty, so it advances to level 3)

    Requesting a depth beyond the terminal level returns the terminal
    level with id clamped to @4 (e.g., F@99 returns the full file with
    id F@4).

    When a glob matches multiple files, each file advances through its
    own levels independently.

    For barrels (index.ts / index.tsx), see TREE MODEL.

TREE MODEL
    Files named index.ts or index.tsx are barrel nodes that represent
    their directory. In output, barrel ids use the directory path
    instead of the index.ts filename (e.g., src/foo@1, not
    src/foo/index.ts@1). A root-level barrel uses "." as its path.

    A barrel's immediate children are:
      - child barrels: <dir>/*/index.{ts,tsx}
      - leaf files:    <dir>/*.{ts,tsx}, excluding the barrel itself

    Children are one level deep only (non-recursive). A child that is
    itself a barrel appears as a regular item; to explore its own
    children, issue a separate glob targeting its subdirectory. If both
    index.ts and index.tsx exist, index.ts takes priority as the barrel.

    Barrel gating applies only via glob. A barrel with a @summary
    gates its children for two depths:

      Depth 1: barrel's @summary shown (children hidden)
      Depth 2: barrel's description shown (children hidden),
               or if no description, null-skip to transition
      Depth 3+: barrel transitions — barrel disappears from output,
                children appear at depth - 2

    A barrel without a @summary does not gate; it and its children
    all appear directly in glob results.

    When a barrel is targeted by direct path, it behaves like a leaf
    file: levels 1-4, no children revealed. The id uses the directory
    path.

    Because a barrel gates its children, the barrel's @summary and
    description serve as a navigation gateway. Write the @summary to
    state what the module does as a unit. Write the description to
    cover the module's capabilities and concerns in conceptual terms
    — not child filenames — so an agent can decide whether to drill
    deeper. See jsdoczoom -s for detailed writing guidelines.

    Example (barrel at src/foo/index.ts with @summary + description):
      jsdoczoom "src/foo/**/*"    => barrel @summary  (next_id: src/foo@2)
      jsdoczoom "src/foo/**/*@2"  => barrel description (next_id: src/foo@3)
      jsdoczoom "src/foo/**/*@3"  => [child1 at L1, child2 at L1, ...]
      (barrel had @summary + description. After depths 1-2, children
      are revealed at depth 3.)

    Example (barrel with @summary but no description):
      jsdoczoom "src/foo/**/*"    => barrel @summary  (next_id: src/foo@2)
      jsdoczoom "src/foo/**/*@2"  => [child1 at L1, child2 at L1, ...]
      (no description, so depth 2 null-skips to transition.)

OUTPUT
    Response is a JSON object with items and a truncated flag:

      {
        "items": [
          {"next_id": "src/foo.ts@2", "text": "..."},
          {"id": "src/bar.ts@4", "text": "..."}
        ],
        "truncated": false
      }

    Each item is one of two shapes:

      Non-terminal (more detail available):
        next_id  string   Points to next level (file@depth)
        text     string   Content at this level

      Terminal (deepest level):
        id       string   Current level cursor (file@depth)
        text     string   Content at this level

    Items are ordered alphabetically by their key (next_id or id).
    If a file in a glob has a syntax error, it appears with an error
    entry instead of text:

      {"id": "broken.ts",
       "error": {"code": "PARSE_ERROR", "message": "..."}}

    The truncated field:
      truncated  boolean  True if results exceeded --limit

VALIDATION
    jsdoczoom -v [selector]

    Validates matched files. Checks (in priority order):
      1. Valid TypeScript syntax
      2. File-level JSDoc block is present
      3. @summary tag is present (non-empty content)
      4. Exactly one @summary tag (no duplicates)
      5. Description paragraph is present (free-text before @tags)
      6. Directories with >3 .ts/.tsx files have a barrel (index.ts)

    Output groups invalid files by status category. Valid files are
    omitted. Empty groups are omitted. Exit code 2 if any file fails;
    0 if all pass.

      {
        "missing_jsdoc": {"guidance": "...", "files": ["src/bar.ts"]},
        "missing_summary": {"guidance": "...", "files": ["src/baz.ts"]},
        "missing_barrel": {"guidance": "...", "files": ["src/utils"]}
      }

    Status categories (in priority order):
      syntax_error         File cannot be parsed as TypeScript.
      missing_jsdoc        No file-level JSDoc block found.
      missing_summary      JSDoc block exists but no @summary tag.
      multiple_summary     More than one @summary tag in the JSDoc block.
      missing_description  @summary exists but no description paragraph.
      missing_barrel       Directory has >3 .ts/.tsx files and no index.ts.

    Use --limit to cap the total number of invalid file paths shown
    across all groups.

STDIN
    Pipe file paths one per line:

      find . -name "*.ts" | jsdoczoom
      find . -name "*.ts" | jsdoczoom @2
      find . -name "*.ts" | jsdoczoom -v

    When stdin is provided, the file list comes from stdin. If a
    selector argument is also provided, only the @depth suffix is
    used (the pattern is ignored).

ERRORS
    On failure, jsdoczoom writes a JSON error to stderr and exits 1.

      { "error": { "code": "...", "message": "..." } }

    Codes:
      INVALID_SELECTOR   Selector is not a valid glob or path.
      INVALID_DEPTH      Depth suffix is not a non-negative integer.
      FILE_NOT_FOUND     Path selector targets a nonexistent file.
      NO_FILES_MATCHED   Glob matched no .ts/.tsx files on disk.
      PARSE_ERROR        File is not valid TypeScript.
      VALIDATION_FAILED  One or more files failed validation (exit 2).
      INTERNAL_ERROR     Unexpected failure.

    Error output on stderr is always compact JSON regardless of
    --pretty.

EXIT STATUS
    0   Success
    1   Error
    2   Validation failed (--validate only)

EXAMPLES
    # Get shallowest available content for all TypeScript files
    jsdoczoom
    # Returns JSON object with items and truncated flag.

    # Drill deeper using a returned next_id
    jsdoczoom "packages/foo/src/hooks/index.ts"
    # Returns shallowest level. Barrel id uses directory path.
    # If next_id is "packages/foo/src/hooks@2", request that:
    jsdoczoom "packages/foo/src/hooks/index.ts@2"
    # Returns description (or advances to type declarations).

    # Request a specific depth across a glob
    jsdoczoom "src/**/*.ts@2"
    # Each file independently returns its level at depth 2 (or
    # advances past empty levels to the next available).

    # Explore a barrel's children via glob
    jsdoczoom "packages/foo/src/**/*"
    # Barrel at index.ts returns @summary. At depth 2, barrel
    # description is shown. At depth 3, barrel transitions and
    # children appear.

    # Access a barrel's own full content via direct path
    jsdoczoom "packages/foo/src/index.ts@4"
    # Returns full file content (not children).

    # Pretty-print output
    jsdoczoom --pretty "src/**/*.ts"

    # Validate documentation standards
    jsdoczoom -v "packages/**/src/**/*.ts"
    # Exit 0 if all files pass; exit 2 if any fail.

    # Get JSDoc writing guidelines
    jsdoczoom -s
