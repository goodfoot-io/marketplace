---
description: Integrate a new instruction or value
---

Integrate new instructions, goals, or details into existing slash commands or subagent system instructions. Think intensely about each step.

<user-message>
$ARGUMENTS
</user-message>

<input-format>
The `<user-message>` references either a slash command or subagent system instructions. The file path for the relevant slash command or subagent system instructions is designated as [INPUT_FILE].

Any new instruction, goal, or detail to add or modify is designated as [MODIFICATION].

**Example**: If the `<user-message>` is "Add logging output at every step to the /output-summary slash command", then:
- [INPUT_FILE] = `.claude/commands/output-summary.md`
- [MODIFICATION] = `Add logging output at every step`
</input-format>

<versioning>
**Pattern**: `[original-name]-v[N].[ext]`
- First revision: `example.md` → `example-v2.md`
- Subsequent revisions: `example-v2.md` → `example-v3.md`
- Never overwrite existing versions
- Increment version number until an available slot is found
</versioning>

<content-preservation-guidelines>
**Preserve without modification:**
- Filenames and file paths
- External references
- YAML frontmatter
- Embedded bash commands (e.g., !`echo -e '!\u0060pwd\u0060'` or !`echo -e '!\u0060echo "Bar"\u0060'`) unless modifying command output is necessary
- Variables like !`echo '$AR''GUMENTS'`
- Acronyms (API, SDK, REST, etc.) and technical jargon when contextually clear

Maintain all code, patterns, and specifications exactly as written.
</content-preservation-guidelines>

<additional-resources>
- CLAUDE.md: All slash commands are prepended with @CLAUDE.md content when relevant
- Slash Commands: @documentation/claude-code-slash-commands.md in @.claude/commands
- Subagents: @documentation/claude-code-subagents.md in @.claude/agents
- Local Utilities: @.devcontainer/utilities
</additional-resources>


# Step 1: Consolidate and inline instructions

Consolidate and inline any instructions or subroutines within [INPUT_FILE] that can be combined or inlined without altering the outcome. This creates [STREAMLINED_INSTRUCTIONS].

Output the [STREAMLINED_INSTRUCTIONS].

# Step 2: Integrate modifications

Integrate [MODIFICATION] into [STREAMLINED_INSTRUCTIONS] to produce [MODIFIED_INSTRUCTIONS]. 

**IMPORTANT: Maintain balance between [MODIFICATION] and other directives in [STREAMLINED_INSTRUCTIONS]. Incorporate [MODIFICATION] seamlessly, as if it were part of the original instructions. The [MODIFICATION] should complement, not dominate, the existing content. Ensure clarity and eliminate redundancy.**

When [MODIFICATION] contradicts any portions of [STREAMLINED_INSTRUCTIONS], prioritize [MODIFICATION] as the authoritative directive.

Output the [MODIFIED_INSTRUCTIONS].

# Step 3: Restore preserved content

Reintegrate preserved content as specified in `<content-preservation-guidelines>` from [INPUT_FILE] into [MODIFIED_INSTRUCTIONS]. This produces [FINAL_OUTPUT].

Output the [FINAL_OUTPUT].

# Step 4: Save new version

Write [FINAL_OUTPUT] to a new versioned file following the `<versioning>` pattern. The new file path becomes [FINAL_OUTPUT_FILE].

**Do not modify [FINAL_OUTPUT].**

Output the [FINAL_OUTPUT_FILE].