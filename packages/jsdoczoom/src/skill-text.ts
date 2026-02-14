/**
 * Combines the jsdoc skill guidelines with concrete guidance on writing
 * file-level @summary tags and description paragraphs that pass validation.
 * SKILL_TEXT is emitted verbatim to stdout when the CLI receives `--skill` / `-s`.
 * GUIDANCE maps each validation status to a markdown snippet used in validation
 * output to explain how to fix that category.
 *
 * @summary Skill text and per-category guidance constants for JSDoc writing
 */

import type { ValidationStatus } from "./types.js";

/** Markdown guidance text for each validation status category */
export const GUIDANCE: Record<ValidationStatus, string> = {
	syntax_error: `### Syntax error

The file has TypeScript parse errors that prevent analysis. Fix syntax errors first — no JSDoc validation can run until the file parses cleanly.`,

	missing_jsdoc: `### Missing file-level JSDoc

Add a \`/** ... */\` block before the first code statement (after imports). This block is what jsdoczoom reads for orientation and validation.

\`\`\`typescript
import { resolve } from "node:path";

/**
 * Description paragraph here.
 *
 * @summary One-line overview here
 */

export function example() { ... }
\`\`\``,

	missing_summary: `### The @summary tag

The \`@summary\` tag provides a one-line overview — the first thing someone sees when scanning with jsdoczoom at the shallowest depth.

**Important:** Only exact lowercase \`@summary\` is recognized. \`@Summary\`, \`@SUMMARY\`, and other case variants are ignored.

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
- \`@summary The main module\` — no information about purpose or scope`,

	multiple_summary: `### Multiple @summary tags

Each file must have exactly one \`@summary\` tag. Remove the extra \`@summary\` tags and keep a single one-line overview.`,

	missing_barrel: `### Missing barrel file

Directories with more than 3 TypeScript files should have an \`index.ts\` barrel file. The barrel provides a module-level \`@summary\` and description that helps agents understand what the directory contains before drilling into individual files.

Create an \`index.ts\` that re-exports the directory's public API and add a file-level JSDoc block describing the module's capabilities.`,

	missing_description: `### The description paragraph

The description is prose that appears before any \`@\` tags. It provides the deeper context that the summary cannot — responsibilities, invariants, trade-offs, and failure modes.

**Good descriptions:**
- Explain *why* this file exists and what problem it solves
- State invariants and assumptions that callers or maintainers must know
- Note trade-offs and design decisions
- Mention failure modes and edge cases relevant to the file as a whole
- Are 1–4 sentences, not an essay`,
};

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

These tags power IDE hover tooltips, autocomplete, and signature help. Always include them for public APIs, constructors, and functions:

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

The \`@summary\` tag provides a one-line overview — the first thing someone sees when scanning with jsdoczoom at the shallowest depth.

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

### Barrel files (index.ts / index.tsx)

Barrel files represent their directory. The \`@summary\` and description describe the module, not individual files.

- **\`@summary\`**: What the module does as a unit
- **Description**: The module's capabilities and concerns — describe concepts, not child filenames

\`\`\`typescript
// packages/auth/src/index.ts
/**
 * Provides session lifecycle management, token validation and refresh,
 * and middleware for route-level access control. OAuth2 provider
 * integration is handled here; cryptographic primitives are delegated
 * to the crypto package.
 *
 * @summary Authentication and authorization module
 */
\`\`\`

**Avoid:**
- Listing child filenames in the description
- \`@summary Exports for the auth module\` — describes the mechanism, not the purpose
- \`@summary Index file\` — no information about what the module does

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

### Common lint rules and examples

These rules are enforced in lint mode (\`-l\`). Understanding what passes and fails reduces trial-and-rerun cycles.

#### \`jsdoc/informative-docs\` — descriptions must add meaning

This rule rejects descriptions that merely restate the parameter name, type, or containing symbol name. Descriptions must provide behavioral context.

**Fails:**
- \`@param id - The id\`
- \`@param options - The options object\`
- \`@returns The result\`
- \`@param name - The name string\`

**Passes:**
- \`@param id - Unique identifier used for cache lookup and deduplication\`
- \`@param options - Controls retry behavior, timeout, and error handling strategy\`
- \`@returns Parsed configuration with defaults applied for missing fields\`
- \`@param name - Display name shown in the navigation sidebar\`

**Rule of thumb:** If removing the parameter name from the description leaves no useful information, the description is not informative enough.

#### \`jsdoc/check-tag-names\` — allowed tags only

The lint configuration rejects non-standard JSDoc tags. Common tags to **avoid in JSDoc blocks**:
- \`@remarks\` — move content to the description paragraph (prose before tags)
- \`@packageDocumentation\` — use \`@module\` instead
- \`@concept\`, \`@constraint\` — move content to the description paragraph

Framework directives that look like tags (e.g., \`@vitest-environment\`) should use plain comments instead:
\`\`\`typescript
// @vitest-environment node   ← correct (plain comment)
/** @vitest-environment node */  ← incorrect (treated as JSDoc tag)
\`\`\`

#### \`jsdoc/require-throws\` — document throw conditions

Include \`@throws\` for any function that can throw, including catch-and-rethrow patterns:
\`\`\`typescript
/**
 * @param path - File path to read
 * @returns Parsed configuration object
 * @throws {ConfigError} When the file is missing or contains invalid YAML
 */
\`\`\`

If a function catches errors and rethrows them (wrapped or unwrapped), it still needs \`@throws\`.

### Nested object parameters

When a function accepts an inline object parameter, document each property with a nested \`@param\` tag:

\`\`\`typescript
/**
 * Create a new user account.
 *
 * @param data - Account creation payload
 * @param data.email - Email address used for login and notifications
 * @param data.displayName - Public-facing name shown in the UI
 * @param data.role - Initial permission level assigned to the account
 * @returns The created user record with generated ID
 */
function createUser(data: { email: string; displayName: string; role: Role }): User {
\`\`\`

For React component props, use \`props\` (or \`root0\` if destructured) as the root:

\`\`\`typescript
/**
 * @param props - Component properties
 * @param props.title - Page heading displayed at the top
 * @param props.onSubmit - Callback invoked when the form is submitted
 */
function MyComponent(props: { title: string; onSubmit: () => void }) {
\`\`\`

### Overload documentation

When a function has TypeScript overload signatures, document **both** the overload declarations and the implementation signature:

\`\`\`typescript
/**
 * Parse a value from a string representation.
 *
 * @param input - Raw string to parse
 * @returns Parsed numeric value
 */
function parse(input: string): number;
/**
 * Parse a value from a buffer.
 *
 * @param input - Binary buffer to parse
 * @returns Parsed numeric value
 */
function parse(input: Buffer): number;
/**
 * Parse a value from string or buffer input. String inputs are decoded
 * as UTF-8 before numeric parsing.
 *
 * @param input - String or buffer to parse
 * @returns Parsed numeric value
 * @throws {ParseError} When the input cannot be interpreted as a number
 */
function parse(input: string | Buffer): number {
  // implementation
}
\`\`\`

`;
