---
description: Map the instructions in a document
argument-hint: <document-path>
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
---

<user-message>
$ARGUMENTS
</user-message>

Restructure the markdown document in `<user-message>` for improved clarity and organization. The document may be a slash command, skill, prompt, subagent system instruction, or any other markdown file containing conditional instructions.

Execute the `claude-opus-4-5-migration:claude-opus-4-5-migration` skill before starting.

# Goal

Simplify the document's structure without losing fidelity of purpose. Rephrasing for clarity is encouraged as long as intent and details are preserved. 

# Phase 1: Extract instructions

Read the document and output a flat list of every instruction it contains. Strip all formatting elements (headers, phases, tables, lists) to produce plain natural-language statements. This enables direct analysis of what the document actually instructs.

# Phase 2: Propose a new structure

Based on the extracted instructions, propose a reorganized structure. Consider grouping related instructions, reordering for logical flow, and eliminating redundancy. The final structure may reintroduce formatting elements (headers, lists, tables) where they improve clarity. Retain `<semantic-xml-tag>` groupings where appropriate, and introduce new tag groupings as necessary to improve readability.

# Phase 3: Critique via subagents

Launch two `goodfoot:simple` subagents in parallel using the `Task()` tool. Each subagent should critique the proposed structure from a different perspective. Present only the proposed structure—do not explain your reasoning to the subagents.

**Every version should be critiqued via subagents.**

# Phase 4: Iterate on feedback

Evaluate the subagents' feedback and incorporate actionable suggestions. If you modify the proposed structure, return to Phase 3 for another round of critique. Continue iterating until the feedback no longer provides meaningful improvements.

# Phase 5: Present to User

Present the proposed structure to the user, and output a one-paragraph summary explaining the changes. If the user offers feedback, incorporate it into the revised structure and return to phase 3. If the user confirms, proceed to phase 6.

# Phase 6: Apply changes

Update the document with the final structure. 