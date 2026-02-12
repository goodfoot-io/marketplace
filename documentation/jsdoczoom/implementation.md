# jsdoczoom Implementation Notes

## Path Resolution

All paths are relative to the current working directory (CWD). Symlinks
are followed. Paths must use forward slashes. Matching is case-sensitive.

### CWD in Monorepos

jsdoczoom always resolves from the CWD. In a monorepo, if you `cd`
into `packages/foo` and run `jsdoczoom "src/**/*.ts"`, it searches
`packages/foo/src/`. If you run from the workspace root, the same
selector searches `./src/`. There is no workspace-root detection or
package-root inference — CWD is always the anchor.

## Selector Type Detection

A selector containing any glob metacharacter (`*`, `?`, `[`, `{`) is
treated as a glob pattern. All other selectors are treated as file
paths. This distinction matters because:

- **Glob selectors**: produce NO_FILES_MATCHED on no results; trigger
  barrel gating when matching barrel files.
- **Path selectors**: produce FILE_NOT_FOUND if the file doesn't exist,
  or NO_SUMMARY_FOUND if the file exists but has no summary levels;
  never trigger barrel gating (always follow leaf drill-down rules).

## File-Level JSDoc Extraction

The file-level JSDoc is the first `/** */` comment block in the file. It
may appear after `import` / `require` statements but must come before any
other code statements (variable declarations, function declarations,
class declarations, etc.).

If a file has multiple `/** */` blocks, only the first one is used for
summary extraction. Subsequent blocks are symbol-level JSDoc and are
included in the "JSDoc + type declarations" level.

## Summary Level Parsing

### @summary Tag Extraction

Tags are extracted in source order from the file-level JSDoc block.
Multi-line @summary content (text continuing on the next line with leading
`*`) is joined with spaces and trimmed. For example:

```
@summary First line
         continues here
```

Becomes: `"First line continues here"`

### Free-Text Description

The free-text description is all text in the JSDoc block before any
`@tag` line. A line starting a new tag is identified by the pattern
`* @tagname` (where `@tagname` is any JSDoc tag like `@summary`,
`@param`, `@returns`, etc.). Literal `@` in prose (like email addresses)
does not start a new tag unless it matches this pattern.

If the free-text is empty or whitespace-only, no description level is
created.

### Level Numbering With Free-Text

Summary levels are ordered from most concise to most detailed:

- L0: first @summary (most concise)
- L1: second @summary
- ...
- LN-1: last @summary
- LN: free-text description (most detailed, if present)

Despite appearing first in the JSDoc source, the free-text description
is returned as the deepest (last) summary level. This is because
@summary tags provide progressive summaries from brief to detailed,
while the free-text description is typically the most comprehensive
explanation.

### Files With No Summaries

A file with no @summary tags and no free-text description has zero summary
levels. It is not a tree node and is excluded from glob results silently.
Targeting it directly by path returns NO_SUMMARY_FOUND.

A file with a free-text description but no @summary tags has one summary
level. It is a valid tree node but fails validation (which requires at
least two @summary tags).

## Depth Cursor Model

The @k in an id is a cursor meaning "level k was already returned."
Requesting F@k returns level k+1. This means:

- `F` (no suffix) returns level 0. The id `F@0` is emitted.
- `F@0` returns level 1. The id `F@1` is emitted.
- `F@k` where k+1 exceeds the final level returns the terminal level
  with more=false. The id is clamped to the terminal level's cursor
  value. For example, if the terminal cursor is N+2, requesting `F@99`
  returns the terminal content with `id: F@(N+2)`.

For a leaf file with summary levels L0 through LN:
- Levels 0 through N: summary content
- Level N+1: JSDoc + type declarations
- Level N+2: full file content (terminal, more=false)

For a barrel file reached via direct path, the same progression applies.
For a barrel file reached via glob, see Barrel Gating below.

## Output Format

The response is always a JSON array, even for a single file. A direct
path selector that matches one file returns a 1-element array.

Items are ordered alphabetically by the `path` field. The `text` field
is UTF-8 encoded; special characters are escaped per the JSON spec.

The `text` field is never empty for files with summary levels. An
@summary tag with only whitespace content is treated as if it were
absent.

## Barrel Gating

### Overview

When a barrel file (index.ts or index.tsx) is reached through glob
navigation, its drill-down sequence ends after summary levels. The next
drill-down reveals the barrel's children rather than continuing into the
barrel's additional levels.

The additional levels for a barrel file are accessible by targeting the
file directly:

    jsdoczoom "src/foo/index.ts"      => barrel L0
    jsdoczoom "src/foo/index.ts@0"    => barrel L1
    jsdoczoom "src/foo/index.ts@1"    => JSDoc + type declarations
    jsdoczoom "src/foo/index.ts@2"    => full file content

### Barrel Detection in Globs

When a barrel is reached via glob, the implementation must track this
context because drill-down behaviour differs from direct path access.

A barrel detected in a glob result must:
1. Suppress child files at depths where the barrel still has summary
   levels to show.
2. Reveal immediate children once the barrel's summary levels are
   exhausted. Each child appears at its shallowest level.
3. When children are revealed, the barrel itself does not appear in
   the output — only its children do.

### `more` Field for Barrels

When a barrel is reached via glob:
- `more=true` while summary levels remain.
- At the transition depth (where children are revealed), the barrel
  is replaced by its children. Each child has its own `more` value.

When a barrel is reached by direct path:
- `more=true` through all levels until "full file content."

### Root-Level Barrel

An `index.ts` at the CWD root (e.g., `./index.ts`) is a valid barrel.
It represents the root directory. Its children are sibling `.ts`/`.tsx`
files and child `*/index.{ts,tsx}` barrels, just like any other barrel.

### Barrel With 0 or 1 Summary Levels

A barrel with 0 summary levels is not a tree node. Its children are
not gated; they appear directly in glob results at their own shallowest
levels.

A barrel with 1 summary level gates its children for one depth. The
first drill-down reveals children.

### Nested Barrels

Barrels nest recursively. When a parent barrel reveals its children
and one of those children is itself a barrel, that child barrel appears
as a regular item. Since the child's id is a direct file path, further
drill-downs on it follow direct-path rules (JSDoc + types, then full
file). To explore the child barrel's own children, issue a new glob
targeting its subdirectory.

Example:

    # Parent barrel (packages/app/src/index.ts, 2 summaries):
    jsdoczoom "packages/app/src/**/*"     => parent L0
    jsdoczoom "packages/app/src/**/*@0"   => parent L1
    jsdoczoom "packages/app/src/**/*@1"   => children, including:
      - packages/app/src/hooks/index.ts@0  (child barrel at L0)
      - packages/app/src/utils.ts@0        (leaf at L0)

    # Drill into child barrel by its id (direct path rules):
    jsdoczoom "packages/app/src/hooks/index.ts@0"  => child barrel L1
    jsdoczoom "packages/app/src/hooks/index.ts@1"  => JSDoc + type declarations
    jsdoczoom "packages/app/src/hooks/index.ts@2"  => full file content

    # To explore the child barrel's children instead, use a glob:
    jsdoczoom "packages/app/src/hooks/**/*"    => child barrel L0 (gating)
    jsdoczoom "packages/app/src/hooks/**/*@0"  => child barrel L1
    jsdoczoom "packages/app/src/hooks/**/*@1"  => hooks/ children

### Child Ordering

When a barrel reveals its children, items are ordered alphabetically
by path. Barrel children and leaf children are intermixed; there is
no separate grouping.

## Glob Matching Details

### Which Files Appear

A glob matches files by path pattern. Files without summary levels
(no file-level JSDoc or no @summary tags / description) are silently
excluded from results. The NO_FILES_MATCHED error fires only when the
glob pattern itself matches no `.ts`/`.tsx` files on disk, or when
every matched file lacks summary levels.

### Independent Depth Advancement

When a glob includes a depth suffix, each matched file advances
independently. A file with 1 summary level reaches "JSDoc + type
declarations" at a lower depth than a file with 3 summary levels.
Each file's `more` field reflects its own state.

## File Extension Rules

### index.ts vs index.tsx

If both index.ts and index.tsx exist in the same directory, index.ts
takes priority as the barrel. index.tsx is treated as a regular leaf
file in that directory.

### Barrel Name Matching

Only files named exactly `index.ts` or `index.tsx` are barrels. Files
like `index.test.ts`, `index.d.ts`, or `index.stories.tsx` are not
barrels — they are regular leaf files (or excluded entirely in the
case of `.d.ts`).

### .d.ts Files

Type declaration files (.d.ts) are excluded from default selectors
and glob matching. They are not tree nodes.

### Supported Extensions

Only `.ts` and `.tsx` files are processed. Other extensions (`.js`,
`.json`, `.mjs`, etc.) are ignored even if matched by a glob.

## PARSE_ERROR in Glob Context

When a glob matches multiple files and one file has a syntax error,
the request does not fail entirely. The file with the error appears
in the JSON array with a PARSE_ERROR entry instead of normal text
content. Other files in the result are unaffected. This allows
partial results when exploring a codebase with some broken files.

For path selectors targeting a single file, PARSE_ERROR is returned
as a fatal error on stderr (exit 1).

## Validation and Depth Suffixes

The `--validate` flag does not accept `@depth` suffixes. If a
selector includes a depth suffix when used with `--validate`,
INVALID_DEPTH is returned (exit 1). Validation always examines the
file-level JSDoc block regardless of depth.

## Error Conditions

| Code              | When                                                 | Exit |
|-------------------|------------------------------------------------------|------|
| INVALID_SELECTOR  | Selector is not a valid glob or relative path        | 1    |
| INVALID_DEPTH     | @depth is not a non-negative integer, or used with -v | 1    |
| FILE_NOT_FOUND    | Relative path targets a file that does not exist     | 1    |
| NO_FILES_MATCHED  | Glob matched no files with summary levels            | 1    |
| NO_SUMMARY_FOUND  | File exists but has no summary levels                 | 1    |
| PARSE_ERROR       | File is not valid TypeScript                         | 1    |
| VALIDATION_FAILED | --validate: one or more files failed checks          | 2    |
| INTERNAL_ERROR    | Unexpected runtime failure                           | 1    |

FILE_NOT_FOUND is only returned for relative path selectors. For globs,
unmatched patterns produce NO_FILES_MATCHED. NO_SUMMARY_FOUND is only
returned for relative path selectors targeting a specific file.

## Validation Details

Validation is a linting check with stricter requirements than normal
operation. A file with 1 summary level works in normal mode (it appears
in glob results and supports drill-down) but fails validation.

Validation (--validate) accepts both globs and relative path selectors.
For each matched file, it checks:

1. File parses as valid TypeScript (no syntax errors).
2. A file-level `/** */` block exists before any code statements.
3. The block contains at least two @summary tags.
4. Each @summary has non-empty content after trimming.

The output is a JSON object with `files` (per-file results) and
`summary` (counts of passed/failed/total). Exit code 2 if any file
fails; exit code 0 if all pass.

## Whitespace-Only @summary Tags

A @summary tag whose content is empty or whitespace-only after trimming
is treated as absent. It does not create a summary level. For example:

```
/**
 * @summary Real summary.
 * @summary
 * @summary Another real summary.
 */
```

This file has 2 summary levels (the whitespace-only tag is skipped).
Validation also treats it as absent: if a file has 3 @summary tags but
one is whitespace-only, validation sees 2 non-empty @summary tags and
passes.

## @summary Tag Recognition

Only the exact lowercase tag `@summary` is recognized. Variants like
`@Summary`, `@SUMMARY`, `@desc`, or `@description` are ignored for
summary extraction.

A line following `@summary` that does not itself begin a new `@tag`
(matching `* @tagname`) is a continuation of the current summary,
regardless of indentation.

## JSDoc + Type Declarations Level

The "JSDoc + type declarations" level is the equivalent of a `.d.ts`
file with JSDoc. It contains:

- All exported type aliases, interfaces, enums, and class declarations
  (signatures only, no method bodies)
- All exported function and const signatures (no implementation bodies)
- All JSDoc blocks in the file (both file-level and symbol-level)

Import statements and implementation bodies are excluded. Content is
presented in source order. This is the same output a TypeScript
compiler would produce for a `.d.ts` emit, but with JSDoc comments
preserved.

## Full File Content Level

The "full file content" level returns the complete raw file text,
including the file-level JSDoc block, all imports, all code, and all
comments. No filtering or transformation is applied.

## Barrel With Zero Children

If a barrel's directory contains no other .ts or .tsx files (no child
barrels or leaf files), the barrel reveals an empty JSON array `[]`
when children would normally be shown. This is not an error.

## Description-Only Files

A file with a free-text description but no @summary tags has one
summary level (the description). Its drill-down sequence:

    jsdoczoom F        => description text,             id: F@0
    jsdoczoom F@0      => JSDoc + type declarations,    id: F@1
    jsdoczoom F@1      => full file content,             more: false

This file is a valid tree node and appears in glob results, but it
fails validation (which requires at least two @summary tags).

## Validation Output Schema

The --validate output is a JSON object:

```json
{
  "files": [
    {
      "path": "packages/foo/src/bar.ts",
      "passed": true,
      "issues": []
    },
    {
      "path": "packages/foo/src/baz.ts",
      "passed": false,
      "issues": [
        "Missing file-level JSDoc block",
        "Less than 2 @summary tags"
      ]
    }
  ],
  "summary": {
    "total": 2,
    "passed": 1,
    "failed": 1
  }
}
```

Each file entry contains:
- `path`: file path relative to working directory
- `passed`: boolean
- `issues`: array of human-readable failure reasons (empty if passed)

## Path Traversal

Paths with `../` segments are valid as long as they resolve to an
existing file. The resolved path is used in output.

## Performance

jsdoczoom parses files on every invocation (no caching). JSON output
is buffered and returned as a complete array (not streamed). For large
monorepos, use specific paths or narrow globs rather than `**/*.ts`
across the entire tree.
