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

### Gitignore Support

Files matched by `.gitignore` rules are excluded by default. The
ignore filter walks `.gitignore` files from CWD to filesystem root.
Direct-path lookups bypass the filter since the user explicitly named
the file. The ignore instance is created per call — no caching —
because CWD may differ between invocations.

Use `--no-gitignore` to disable this filtering.

## Selector Type Detection

A selector containing any glob metacharacter (`*`, `?`, `[`, `{`) is
treated as a glob pattern. All other selectors are treated as file
paths. This distinction matters because:

- **Glob selectors**: produce NO_FILES_MATCHED on no results; trigger
  barrel gating when matching barrel files.
- **Path selectors**: produce FILE_NOT_FOUND if the file doesn't exist;
  never trigger barrel gating (always follow leaf drill-down rules).

## File-Level JSDoc Extraction

The file-level JSDoc is the first `/** */` comment block in the file. It
may appear after `import` / `require` statements but must come before any
other code statements (variable declarations, function declarations,
class declarations, etc.).

If a file has multiple `/** */` blocks, only the first one is used for
summary and description extraction. Subsequent blocks are symbol-level
JSDoc.

## Summary and Description Parsing

### @summary Tag Extraction

Only the first non-empty `@summary` tag is used. Additional `@summary`
tags are silently ignored (not an error). Multi-line @summary content
(text continuing on the next line with leading `*`) is joined with
spaces and trimmed. For example:

```
@summary First line
         continues here
```

Becomes: `"First line continues here"`

### Free-Text Description

The free-text description is all text in the JSDoc block before any
`@tag` line. A line starting a new tag is identified by the pattern
`* @tagname` (where `@tagname` is any JSDoc tag like `@summary`,
`@param`, `@returns`, etc.).

If the free-text is empty or whitespace-only, description is null.

### ParsedFileInfo

```typescript
interface ParsedFileInfo {
  path: string;
  summary: string | null;      // First @summary tag text, or null
  description: string | null;  // Free-text before @ tags, or null
  summaryCount: number;        // Number of non-empty @summary tags
  hasFileJsdoc: boolean;       // Whether any file-level JSDoc block exists
}
```

## Fixed Drill-Down Levels

Every file has four fixed levels numbered 1 through 4:

| Level | Content | Condition |
|-------|---------|-----------|
| 1 | @summary text | Present if file has @summary |
| 2 | Description (free-text) | Present if file has description |
| 3 | Type declarations (exported signatures) | Always present |
| 4 | Full file content | Always present (terminal) |

### Null-Level Advancement

When a requested depth has no content (null level), the system advances
to the next non-null level. Levels 3 and 4 are always non-null.

### Output Item Shape

Output items use a discriminated shape based on whether more detail is
available:

- **Non-terminal**: `{ next_id: "F@N+1", text: "..." }` — the `next_id`
  field points to the next level. Use `next_id` as the selector to get
  more detail.
- **Terminal**: `{ id: "F@N", text: "..." }` — the `id` field represents
  the current (final) state. No deeper level exists.

This enables the zoom workflow: see a `next_id` like `F@2`, request `F@2`
to get more detail. When `id` is present instead of `next_id`, there is
no further detail.

### Examples by File Type

**File with @summary + description** (4 populated levels):
- Depth 1 → `next_id: F@2` (summary)
- Depth 2 → `next_id: F@3` (description)
- Depth 3 → `next_id: F@4` (type declarations)
- Depth 4 → `id: F@4` (full file, terminal)

**File with @summary, no description** (3 populated levels):
- Depth 1 → `next_id: F@2` (summary)
- Depth 2 → `next_id: F@4` (type declarations — level 2 null, advances to 3)
- Depth 3 → `next_id: F@4` (type declarations)
- Depth 4 → `id: F@4` (full file, terminal)

**File with description, no @summary** (3 populated levels):
- Depth 1 → `next_id: F@3` (description — level 1 null, advances to 2)
- Depth 2 → `next_id: F@3` (description)
- Depth 3 → `next_id: F@4` (type declarations)
- Depth 4 → `id: F@4` (full file, terminal)

**File with no JSDoc** (2 populated levels):
- Depth 1 → `next_id: F@4` (type declarations — levels 1 and 2 null, advances to 3)
- Depth 4 → `id: F@4` (full file, terminal)

### Depth Clamping

Depths beyond level 4 are clamped to level 4. Requesting `F@99` returns
the full file content with `id: F@4`.

### TERMINAL_LEVEL Constant

The terminal level is always 4. Items with `effectiveDepth < TERMINAL_LEVEL`
produce `next_id`; items at `TERMINAL_LEVEL` produce `id`.

## Output Format

### Normal Mode

The response is a JSON object with `items` and `truncated`:

```json
{
  "items": [
    {"next_id": "src/foo.ts@2", "text": "..."},
    {"id": "src/bar.ts@4", "text": "..."}
  ],
  "truncated": false
}
```

Items are ordered alphabetically by their key (`next_id` or `id`).
The `text` field is UTF-8 encoded.

An @summary tag with only whitespace content is treated as if it were
absent (null).

### Error Items in Glob Results

If a file in a glob has a syntax error, it appears in the items array
as an error entry:

```json
{"id": "broken.ts",
 "error": {"code": "PARSE_ERROR", "message": "..."}}
```

Error items have no `text` field and no `next_id`. Other files are
unaffected. For path selectors targeting a single file, PARSE_ERROR is
returned as a fatal error on stderr (exit 1).

### Truncation

The `--limit N` option (default 100) caps the number of items returned.
When the total exceeds the limit, `truncated` is true and items are
sliced to the first `limit` entries.

## Barrel Gating

### Overview

When a barrel file (index.ts or index.tsx) is reached through glob
navigation and has a @summary, it gates its children for two depths.
At depth 1, the barrel's @summary is shown. At depth 2, the barrel's
description is shown (or null-skips to transition if no description).
At depth 3+, the barrel transitions: it disappears from output and
its children appear at `depth - 2`.

### Barrel JSDoc Convention

Because a barrel gates its children for two depths, its @summary and
description are the only things visible before children appear. This
makes the barrel's JSDoc a navigation gateway.

The barrel **@summary** follows the same rules as leaf files: state what
the module *does* as a unit, not what it contains.

The barrel **description** should describe the module's capabilities and
concerns in conceptual terms. An agent reading the description should be
able to answer "Does this module contain what I'm looking for?" without
needing to see child filenames. Avoid listing children by name — this
couples documentation to file structure and duplicates what depth 3
reveals automatically.

### Barrel Display Path

Barrel files use their parent directory path in output ids instead of
the index.ts filename. For example, `src/foo/index.ts` produces ids
like `src/foo@1`, not `src/foo/index.ts@1`. A barrel at the CWD root
uses `"."` as its path (e.g., `.@1`).

### Barrel Without @summary

A barrel without a @summary does not gate. It appears in glob results
as a regular file alongside its children. Both the barrel and its
children are processed normally. The barrel still uses its directory
path for the id.

### Barrel Gating Depth

Gating spans two depths (based on @summary and description):

- `depth < 3`: barrel's own level at the requested depth (gates children)
- `depth >= 3`: barrel transitions, children appear at `childDepth = depth - 2`

Null-skip: if `depth == 2` but barrel has no description, the barrel
advances to transition depth (children appear immediately).

### Direct Path Access

When a barrel is targeted by direct path, it behaves like a leaf file:
levels 1-4, no children revealed. The id still uses the directory path.
To explore a barrel's children, use a glob targeting its directory.

### Barrel Detection

Only files named exactly `index.ts` or `index.tsx` are barrels. Files
like `index.test.ts`, `index.d.ts`, or `index.stories.tsx` are not
barrels.

### Barrel Children

A barrel's immediate children are:
- child barrels: `<dir>/*/index.{ts,tsx}`
- leaf files: `<dir>/*.{ts,tsx}`, excluding the barrel itself

Children are one level deep only (non-recursive).

### Root-Level Barrel

An `index.ts` at the CWD root is a valid barrel. Its children are
sibling `.ts`/`.tsx` files and child `*/index.{ts,tsx}` barrels. Its
id path is `"."`.

### Nested Barrels

When a parent barrel reveals its children and one is itself a barrel,
the child barrel appears as a regular item at its own shallowest level.
Its id uses the child's directory path. To explore the child barrel's
own children, issue a new glob targeting its subdirectory.

### Barrel With Zero Children

If a barrel's directory contains no other .ts or .tsx files, the barrel
reveals an empty items array when children would normally be shown.
This is not an error.

### Child Ordering

When a barrel reveals its children, items are ordered alphabetically
by their key (next_id or id).

### Gated File Set

A file that is a child of a barrel with a @summary is "gated" — it
does not appear directly in glob results when the barrel is still
showing its own summary or description. A barrel that is itself gated
by a parent barrel is not processed independently.

## Glob Matching Details

### Which Files Appear

A glob matches files by path pattern. All matched `.ts`/`.tsx` files
are included in results, regardless of whether they have JSDoc or
@summary tags. Files without summaries advance to their earliest
available level (typically level 3, type declarations).

The NO_FILES_MATCHED error fires only when the glob pattern matches
no `.ts`/`.tsx` files on disk.

### Independent Depth Advancement

When a glob includes a depth suffix, each matched file advances
independently through its own levels. A file with no JSDoc reaches
type declarations at level 3, while a file with @summary and
description has two intermediate levels before type declarations.

## File Extension Rules

### index.ts vs index.tsx

If both index.ts and index.tsx exist in the same directory, index.ts
takes priority as the barrel. index.tsx is treated as a regular leaf
file.

### .d.ts Files

Type declaration files (.d.ts) are excluded from default selectors
and glob matching. They are not tree nodes.

### Supported Extensions

Only `.ts` and `.tsx` files are processed. Other extensions (`.js`,
`.json`, `.mjs`, etc.) are ignored even if matched by a glob.

## Validation Details

### Validation Checks

Validation checks six conditions. Per-file checks are in priority order
(first failing check wins). Directory checks run independently.

Per-file checks:
1. **syntax_error** — File cannot be parsed as TypeScript
2. **missing_jsdoc** — No file-level JSDoc block before first code statement
3. **missing_summary** — JSDoc block exists but no @summary tag
4. **multiple_summary** — More than one @summary tag in the JSDoc block
5. **missing_description** — @summary exists but no description paragraph

Directory checks:
6. **missing_barrel** — Directory has >3 .ts/.tsx files (excluding barrels) and no index.ts or index.tsx

A file passes only when all per-file checks pass. Valid files are omitted
from output. Missing barrel results list directory paths (e.g., `"."`,
`"src/utils"`).

### Validation Output

Output is a JSON object with status groups. Each group contains
guidance text and file paths:

```json
{
  "missing_jsdoc": {"guidance": "...", "files": ["src/bar.ts"]},
  "missing_summary": {"guidance": "...", "files": ["src/baz.ts"]},
  "missing_barrel": {"guidance": "...", "files": ["src/utils"]}
}
```

- Empty groups are omitted from output
- Valid files are not shown
- Groups are filled in priority order when applying the limit
- missing_barrel files are directory paths, not file paths

### Validation and Depth Suffixes

The `--validate` flag silently ignores `@depth` suffixes. The depth
is stripped and validation proceeds using only the pattern.

### Validation Limit

The `--limit N` parameter caps the total number of invalid file paths
across all groups. Groups are filled in priority order (syntax_error,
missing_jsdoc, missing_summary, multiple_summary, missing_description,
missing_barrel) until the limit is reached.

## Error Conditions

| Code              | When                                                 | Exit |
|-------------------|------------------------------------------------------|------|
| INVALID_SELECTOR  | Selector is not a valid glob or relative path        | 1    |
| INVALID_DEPTH     | @depth is not a non-negative integer                  | 1   |
| FILE_NOT_FOUND    | Relative path targets a file that does not exist     | 1    |
| NO_FILES_MATCHED  | Glob matched no .ts/.tsx files on disk               | 1    |
| PARSE_ERROR       | File is not valid TypeScript                         | 1    |
| VALIDATION_FAILED | --validate: one or more files failed checks          | 2    |
| INTERNAL_ERROR    | Unexpected runtime failure                           | 1    |

FILE_NOT_FOUND is only returned for relative path selectors. For globs,
unmatched patterns produce NO_FILES_MATCHED.

Error output on stderr is always compact JSON regardless of `--pretty`.

## Stdin Mode

When stdin is piped (not a TTY), file paths are read one per line.
Blank lines and leading/trailing whitespace are ignored.

If a selector argument is also provided when stdin is active, only
the `@depth` suffix is extracted from the selector (the pattern
portion is ignored). This allows `find . | jsdoczoom @2` to apply
depth 2 to all stdin paths.

Stdin paths are resolved to absolute paths relative to CWD. Only
`.ts`/`.tsx` files are processed (other extensions are filtered out).
Barrel gating is not applied in stdin mode — all paths are treated
as leaf files.

## Whitespace-Only @summary Tags

A @summary tag whose content is empty or whitespace-only after trimming
is treated as absent (null). It does not count as a valid summary. For
example:

```
/**
 * Description text.
 * @summary Real summary.
 * @summary
 */
```

This file has summary = "Real summary." (the whitespace-only tag is
ignored).

## @summary Tag Recognition

Only the exact lowercase tag `@summary` is recognized. Variants like
`@Summary`, `@SUMMARY`, `@desc`, or `@description` are ignored for
summary extraction.

A line following `@summary` that does not itself begin a new `@tag`
(matching `* @tagname`) is a continuation of the summary, regardless
of indentation.

## Path Traversal

Paths with `../` segments are valid as long as they resolve to an
existing file. The resolved path (relative to CWD) is used in output
ids.

## Performance

jsdoczoom parses files on every invocation (no caching). JSON output
is buffered and returned as a complete object (not streamed). The
`--limit` option (default 100) prevents excessive output for large
codebases. Use specific paths or narrow globs rather than `**/*.ts`
across an entire monorepo.
