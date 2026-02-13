/**
 * Skill text output for the --skill flag.
 *
 * Combines the jsdoc skill guidelines with concrete guidance on writing
 * file-level @summary tags and description paragraphs that pass validation.
 */

export const SKILL_TEXT = `# World-Class JSDoc Guidelines for TypeScript

These guidelines describe the *properties* of excellent inline JSDoc in TypeScript repositories. They are a target to aim for, not a checklist. Use judgment; clarity beats volume.

## Core principle

TypeScript projects already have explicit types. JSDoc should add **intent, behavior, and constraints** rather than repeat what the type system already expresses.

## Would have (high-signal properties)

- **Intent and constraints**: Explains the non-obvious decision, constraint, or tradeoff (e.g., why a particular algorithm is used, why a heuristic exists, or what the runtime environment forbids).
- **Behavioral contract**: Clearly states what inputs are accepted, what outputs represent, and how boundary cases are treated.
- **Domain vocabulary**: Uses project-specific terms consistently so readers can navigate the codebase by vocabulary.
- **Examples that disambiguate**: Includes \`@example\` blocks when behavior is otherwise ambiguous (e.g., parsing rules, path formats, or object schemas). Examples are short and realistic.
- **Runtime effects**: Calls out side effects, temporal dependency (polling vs. event-driven), filesystem reads/writes, or external service behavior when those matter.
- **Edge-case prompts**: Captures "what happens if..." questions that a reviewer would ask, especially where external APIs or platform behavior has caveats.
- **Consistency with existing style**: Matches the formatting conventions already established in the codebase (multi-line descriptions, bullet lists where helpful).
- **Future-proof hints**: Notes invariants and assumptions that must hold if the code evolves.
- **LLM-friendly structure**: Uses short, self-contained paragraphs written in clear International Business English. Avoids prescriptive headers (e.g., "Why:", "Constraint:") in favor of natural prose that states context, purpose, and caveats directly.

## Would not have (low-signal or risky properties)

- **Type restatements**: Repeating TypeScript types in prose (e.g., "@param options - The options object" when the type is already \`Options\`). Keep \`@param\`, \`@returns\`, and \`@throws\` tags—just make the descriptions add meaning beyond the type.
- **Obvious narration**: Comments that paraphrase the code or parameter name without additional insight.
- **Incorrect authority**: Claims that are not enforced by code (e.g., "never throws" when it can, or "always" without guardrails).
- **Redundant verbosity**: Long descriptions that could be expressed more directly, or boilerplate that hides the key idea.
- **Unbounded examples**: Large blocks or full payloads when a minimal example would do.
- **Out-of-date operational details**: References to tooling, CLI flags, or config knobs that are not enforced or checked.
- **Implementation leakage**: Unnecessary internal steps or private details that are likely to change and add churn to docs.
- **Non-ASCII decoration**: Fancy symbols or emojis that do not already exist in the file; keep ASCII unless needed.

## Tag usage cues (not rules)

### IntelliSense tags (always include)

These tags power IDE hover tooltips, autocomplete, and signature help. Always include them for public APIs, constructors, and functions with non-trivial signatures:

- **\`@param\`**: Include for every parameter. Describe the parameter's purpose, valid ranges, or constraints—not just its type.
- **\`@returns\`**: Include when the function returns a value. Describe what the return value represents, especially for edge cases.
- **\`@throws\`**: Include when the function can throw. Describe the conditions that cause the error.
- **\`@template\`**: Include for generic functions and types. Describe what the type parameter represents.

### Cross-reference tags (use to aid navigation)

- **\`@see\`**: Link to related functions, types, or external documentation.
- **\`{@link Symbol}\`**: Inline reference within descriptions. Creates a clickable link to another symbol.

### Structural tags (use when appropriate)

- Use \`@module\` at the top of files that define a cohesive domain concept.
- Use \`@example\` when parsing or formatting behavior could be misread, or when a type is complex.
- Use \`@deprecated\` on exports that are retained for compatibility.
- Prefer short description + bullets for concepts with multiple facets.

---

## Writing file-level @summary and description

Every TypeScript file should have a file-level JSDoc block before the first code statement. This block is what jsdoczoom reads for orientation and validation.

### Structure

\`\`\`typescript
/**
 * Description paragraph goes here. It explains the file's responsibilities,
 * invariants, trade-offs, and failure modes. This is the deepest level of
 * native documentation — enough for someone to understand why this file
 * exists and how it fits into the broader system.
 *
 * @summary Concise one-line overview for quick orientation when scanning a codebase.
 */
\`\`\`

### The @summary tag

The \`@summary\` tag provides a one-line overview — the first thing someone sees when scanning with jsdoczoom at depth 0.

**Good summaries:**
- State what the file *does* or *is responsible for*, not what it contains
- Are self-contained — understandable without reading other files
- Use domain vocabulary consistently with the rest of the codebase
- Fit on a single line (joined if multi-line in source)

**Examples:**
- \`@summary Barrel tree model for hierarchical gating in glob mode\`
- \`@summary Resolve selector patterns to absolute file paths with gitignore filtering\`
- \`@summary CLI entry point — argument parsing, mode dispatch, and exit code handling\`

**Avoid:**
- \`@summary This file contains utility functions\` — says what it *contains*, not what it *does*
- \`@summary Helpers\` — too vague, no domain context
- \`@summary The main module\` — no information about purpose or scope

### The description paragraph

The description is prose that appears before any \`@\` tags. It provides the deeper context that the summary cannot — responsibilities, invariants, trade-offs, and failure modes.

**Good descriptions:**
- Explain *why* this file exists and what problem it solves
- State invariants and assumptions that callers or maintainers must know
- Note trade-offs and design decisions (e.g., "uses priority-order fill to keep the limit algorithm simple")
- Mention failure modes and edge cases relevant to the file as a whole
- Are 1-4 sentences, not an essay

**Examples:**
\`\`\`typescript
/**
 * Walks .gitignore files from cwd to filesystem root, building an ignore
 * filter that glob results pass through. Direct-path lookups bypass the
 * filter since the user explicitly named the file. The ignore instance is
 * created per call — no caching — because cwd may differ between invocations.
 *
 * @summary Resolve selector patterns to absolute file paths with gitignore filtering
 */
\`\`\`

\`\`\`typescript
/**
 * Each file is classified into exactly one status category: the first
 * failing check wins (syntax_error > missing_jsdoc > missing_summary >
 * missing_description). Valid files are omitted from output entirely.
 * The limit parameter caps the total number of invalid paths shown,
 * filled in priority order across groups.
 *
 * @summary Validate file-level JSDoc and group results by status category
 */
\`\`\`

**Avoid:**
- Restating the summary in longer words
- Listing every function in the file
- Implementation details that change frequently (line numbers, internal variable names)

### Placement

The file-level JSDoc block must appear **before the first code statement** (imports are fine above it, but the block must precede any \`export\`, \`const\`, \`function\`, \`class\`, etc.). A common pattern is to place it immediately after imports:

\`\`\`typescript
import { resolve } from "node:path";
import { globSync } from "glob";

/**
 * Description paragraph here.
 *
 * @summary One-line overview here
 */

export function discoverFiles(...) { ... }
\`\`\`

### Validation checks

jsdoczoom validates four things in priority order:

1. **syntax_error** — The file cannot be parsed as TypeScript
2. **missing_jsdoc** — No file-level JSDoc block found before the first code statement
3. **missing_summary** — JSDoc block exists but has no \`@summary\` tag (or only whitespace after it)
4. **missing_description** — JSDoc block has \`@summary\` but no prose paragraph before the tags

A file passes validation when all four checks pass.
`;
