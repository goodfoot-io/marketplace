---
description: Generate minimal project state documentation focusing on non-extractable architectural knowledge
allowed-tools: [Read, Grep, Glob, mcp__codebase__ask]
---

<user-message>
$ARGUMENTS
</user-message>

<input-format>
The `<user-message>` references one or more files or components to document. These are designated [PACKAGES].

**Example 1**: If the `<user-message>` is "Document `package.json` and `packages/models`", then:
- [PACKAGES] = `package.json` and `packages/models`
- [SEMANTIC_NAME] = `root-package-file-and-models-package`

**Example**: If the `<user-message>` is "Document `packages/website/server`", then:
- [PACKAGES] = `packages/website/server`
- [SEMANTIC_NAME] = `website-package-server`
</input-format>

<documentation-philosophy>
Modern tooling (LSP, grep, git) makes most code documentation obsolete. Document only what can't be easily discovered:
- Architectural decisions and their rationale
- Non-obvious behaviors and gotchas
- Performance trade-offs with specific numbers
- State management strategies
- External integration quirks
</documentation-philosophy>

<extractable-information>
**Do NOT document these (easily discovered via tooling):**
- Interface definitions (LSP hover/go-to-definition)
- File locations (symbol search)
- Command mappings (grep for string)
- Dependencies (package.json)
- Line numbers (obsolete immediately)
- Type signatures (TypeScript provides)
- Build commands (package.json scripts)
</extractable-information>

Analyze the project codebase to identify and document only the non-extractable architectural knowledge. Focus on the "why" rather than the "what" or "where".

Generate a report containing:

## 1. Architecture Decisions
Document design choices with their rationale and impact.

<example>
Tree structures pre-built as Maps for O(1) lookups vs. linear filtering
Pagination slices existing data rather than fetching more from Git
Git operations cached for 3 seconds to balance freshness vs. subprocess overhead
</example>

## 2. Non-Obvious Behaviors
Explain behaviors that would surprise developers or aren't evident from reading code.

<example>
"Load More" doesn't call Git, just expands the view window on cached data
Targeted refresh uses path mapping to avoid full tree rebuilds
File watchers are debounced to prevent refresh storms
</example>

## 3. Performance Constraints & Trade-offs
Include specific numbers and thresholds discovered through testing.

<example>
PAGE_SIZE=1000: Tested limit before VS Code tree performance degrades
3s cache TTL: Balance between fresh data and Git subprocess cost
Progress UI delayed 500ms to avoid flicker on fast operations
</example>

## 4. Gotchas & Edge Cases
Document non-obvious edge cases and their handling.

<example>
Detached HEAD state shows as "HEAD (detached at xyz)"
Binary files detected via Git but not diffable
Renamed files require special URI handling for diffs
</example>

## 5. State Management Strategy
Explain what persists, what clears when, and why.

<example>
Workspace state persists: selected branch, view mode
Tree state clears on: branch change, mode toggle, external changes
Pagination state is per-folder and resets on refresh
</example>

## 6. Integration Points
Document external system behaviors and constraints.

<example>
Context menus delegate to VS Code built-ins
File decorations use theme colors (gitDecoration.*)
Virtual file system provides diff content
</example>

<validation-checklist>
Before including information, ask:
- Can this be found with grep/search? If yes, exclude it
- Can LSP tools reveal this? If yes, exclude it
- Would this surprise an experienced developer? If yes, include it
- Is this a specific number from testing/profiling? If yes, include it
- Does this explain "why" rather than "what"? If yes, include it
</validation-checklist>

<output-requirements>
Write the documentation to: `reports/project-state/[SEMANTIC_NAME].md`
Use code blocks only for critical examples
Focus on knowledge that would take hours to rediscover
</output-requirements>

Think deeply about what architectural knowledge would be most valuable to preserve. The goal is to create a document that remains useful even as the codebase evolves, focusing on decisions and constraints rather than implementation details.