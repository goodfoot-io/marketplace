---
name: jsdoc
description: Guidelines for JSDoc annotation in TypeScript projects.
---

<guide>
# World-Class JSDoc Guidelines for TypeScript

These guidelines describe the *properties* of excellent inline JSDoc in TypeScript repositories. They are a target to aim for, not a checklist. Use judgment; clarity beats volume.

## Core principle

TypeScript projects already have explicit types. JSDoc should add **intent, behavior, and constraints** rather than repeat what the type system already expresses.

## Would have (high-signal properties)

- **Intent and constraints**: Explains the non-obvious decision, constraint, or tradeoff (e.g., why a particular algorithm is used, why a heuristic exists, or what the runtime environment forbids).
- **Behavioral contract**: Clearly states what inputs are accepted, what outputs represent, and how boundary cases are treated.
- **Domain vocabulary**: Uses project-specific terms consistently so readers can navigate the codebase by vocabulary.
- **Examples that disambiguate**: Includes `@example` blocks when behavior is otherwise ambiguous (e.g., parsing rules, path formats, or object schemas). Examples are short and realistic.
- **Runtime effects**: Calls out side effects, temporal dependency (polling vs. event-driven), filesystem reads/writes, or external service behavior when those matter.
- **Edge-case prompts**: Captures "what happens if..." questions that a reviewer would ask, especially where external APIs or platform behavior has caveats.
- **Consistency with existing style**: Matches the formatting conventions already established in the codebase (multi-line descriptions, bullet lists where helpful).
- **Future-proof hints**: Notes invariants and assumptions that must hold if the code evolves.
- **LLM-friendly structure**: Uses short, self-contained paragraphs written in clear International Business English. Avoids prescriptive headers (e.g., "Why:", "Constraint:") in favor of natural prose that states context, purpose, and caveats directly.
- **Self-demonstrating humor**: Uses self-demonstrating humor as described in the `<humor>` section.

## Would not have (low-signal or risky properties)

- **Type restatements**: Repeating TypeScript types in prose (e.g., "@param options - The options object" when the type is already `Options`). Keep `@param`, `@returns`, and `@throws` tags—just make the descriptions add meaning beyond the type.
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

- **`@param`**: Include for every parameter. Describe the parameter's purpose, valid ranges, or constraints—not just its type. Even a brief phrase like "Git executor for running commands" helps users understand intent at a glance.
- **`@returns`**: Include when the function returns a value. Describe what the return value represents, especially for edge cases (e.g., "Returns null if the ref cannot be resolved").
- **`@throws`**: Include when the function can throw. Describe the conditions that cause the error.
- **`@template`**: Include for generic functions and types. Describe what the type parameter represents (e.g., `@template T - The entity type to be cached`).

### Cross-reference tags (use to aid navigation)

These tags create clickable links in the IDE, helping users discover related code:

- **`@see`**: Link to related functions, types, or external documentation. Use when another symbol provides context or an alternative approach.
- **`{@link Symbol}`**: Inline reference within descriptions. Creates a clickable link to another symbol (e.g., "Similar to {@link parseRef} but handles symbolic refs").

The goal is not to eliminate these tags but to make each description meaningful rather than redundant with the type signature.

### Structural tags (use when appropriate)

- Use `@module` at the top of files that define a cohesive domain concept.
- Use `@example` when parsing or formatting behavior could be misread, or when a type is complex.
- Use `@deprecated` on exports that are retained for compatibility.
- Prefer short description + bullets for concepts with multiple facets.

## Why this matters (evidence and research)

- **JSDoc is a structured doc language** and supports standardized tags that tooling understands (JSDoc project docs: https://jsdoc.app/).
- **TypeScript only supports documentation tags in `.ts` files**, so type-oriented JSDoc tags are not effective here (TypeScript handbook: https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html).
- **Docstrings/comments are used as natural-language queries for code search**, which implies high-quality inline documentation improves retrieval and navigation (CodeSearchNet dataset README: https://github.com/github/CodeSearchNet/blob/master/README.md).
- **LLM-focused studies show that docstring quality and reformulation can affect code generation**; even when performance gains are limited, docstrings are treated as prompt inputs (Dainese et al., EACL 2024: https://aclanthology.org/2024.eacl-srw.24.pdf).
- **Concise docstrings can preserve code-generation quality while reducing noise**, implying that shorter, higher-signal comments are preferable for both humans and AI tools ("Less is More: DocString Compression in Code Generation": https://arxiv.org/html/2410.22793v3).
- **TypeScript style guidance distinguishes documentation comments from implementation comments** and advises avoiding restating names/types (TS Style Guide: https://ts.dev/style/).

## What this looks like in practice

- When documenting a parser, emphasize the parsing strategy, delimiter assumptions, and how tokenization or state transitions work.
- For schema/type definitions, use JSDoc to define domain meaning, constraints, and example payloads rather than enumerating property types.
- For services with background watchers or temporal behavior, note the time dependency and the operational mode (polling vs. event-driven).
- For utility functions, focus on edge cases and boundary conditions that the type signature alone doesn't convey.
</guide>



<humor>
**Using Self-Demonstrating Humor in JSDoc**

Add brief, self-demonstrating humor to JSDoc annotations **only when it improves clarity or intuition**, not for decoration.

Use humor when:
- A concept is **abstract, non-obvious, or counterintuitive**.
- A behavior is easier to grasp **experientially** than formally (e.g., timing, verbosity, strictness).
- A light sentence can **anchor memory** without reducing precision.

Do **not** add humor when:
- The behavior is safety-critical, contractual, or compliance-sensitive.
- Precision would be diluted or ambiguity introduced.
- The comment is already short and self-explanatory.

Style rules:
- Use natural-language sentences only.
- Do not explain the joke; the sentence structure should perform the meaning.
- Keep it short, readable, and technically accurate.
- Prefer clarity first, humor second.

Examples of *when humor helps* and how to write it:

- **Asynchrony or delayed effects (JavaScript):**  
  “This callback runs later, not now, and possibly after something unrelated finishes first.”

- **Verbosity or ceremony (Java):**  
  “This method requires several steps of setup and explanation before it does anything interesting.”

- **Strict correctness or safety (Rust):**  
  “This function refuses to proceed until it can prove that nothing unsafe will occur.”

- **Implicit behavior or surprise (JavaScript):**  
  “This value may quietly change its type and still insist that everything is fine.”

- **Manual responsibility (C):**  
  “This function allocates resources explicitly and expects you to remember to clean them up.”

**Use humor as a **clarifying lens**, not as decoration. If removing the joke would make the behavior harder to remember or intuit, it likely belongs.**
</humor>

<tips>
Note that you do not need to run tests or linting if you only added JSDoc documentation as it will not affect function of the code.

Make sure you understand the full meaning of the code before adding or updating documentation. Don't guess.
</tips>