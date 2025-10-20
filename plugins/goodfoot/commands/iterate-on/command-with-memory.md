---
description: Iteratively improve a slash command to match reference analysis with memory integration
---

Test and iteratively refine a slash command using accumulated wisdom from past sessions, updating shared memory with new insights.

<user-message>
$ARGUMENTS
</user-message>

<input-format>
The user's input will contain example usage of a slash command, criteria or a technique for evaluating the result, and an optional constraint on which files in the slash command's integration chain may be edited.

We refer to the example usage as [SLASH_COMMAND_EXAMPLE_USAGE], the slash command itself as [SLASH_COMMAND], and the criteria or technique as [EVALUATION] in this document, and the files in the slash command's integration chain that may be edited as [EDITABLE_FILE_LIST].

For example, [SLASH_COMMAND_EXAMPLE_USAGE] might be `/review:find-inconsistencies @reports/technical-data.md`, [SLASH_COMMAND] might be `/review:find-inconsistencies`, [EVALUATION] might be `Identify as many of the key inconsistencies from @reports/technical-data-evaluation-report.md as possible.`, and [EDITABLE_FILE_LIST] might be `@.claude/commands/review/find-inconsistencies.md @.claude/agents/test-analysis.md`
</input-format>

<testing>
Always use the Bash tool to run tests. Note: Only slash commands can be tested this way.
<tool-use-template>
Bash(
  command='claude -p "[SLASH_COMMAND_EXAMPLE_USAGE]" --mcp-config \'{"mcpServers":{}}\' --disallowedTools "[TOOLS_NOT_NEEDED]"',
  timeout=600000
)
</tool-use-template>
Determine which tool functions the [SLASH_COMMAND_EXAMPLE_USAGE] needs, then disallow all others. Replace [TOOLS_NOT_NEEDED] with this list, as defined in @documentation/claude-code-slash-commands.md

Example: Pure analysis command → disallow "Bash, Edit, MultiEdit, Write, TodoWrite"
</testing>

<slash-command-internal-transformations>
- **The !`echo '$AR''GUMENTS'` variable:** The string !`echo '"$AR''GUMENTS"'` is replaced with the user-defeind text following a slash command. In `/echo Foo`, the first !`echo '"$AR''GUMENTS"'` in `.claude/commands/echo.md` becomes "Foo"
- **Embedded Bash commands like !`echo -e '!\u0060pwd\u0060'`:** Stdout replaces the command in the final slash command user message. For example, !`echo -e '!\u0060echo "Bar"\u0060'` becomes "Bar". Consider stdout as document content, not the command itself.
</slash-command-internal-transformations>

<additional-resources>
- CLAUDE.md: All slash commands will be prepended with the content of @CLAUDE.md which may be relevant to the command
- Slash Commands: @documentation/claude-code-slash-commands.md in @.claude/commands
- Subagents: @documentation/claude-code-subagents.md in @.claude/agents
- Local Utilities: @.devcontainer/utilities
</additional-resources>

## Phase 1: Define [INTEGRATION_CHAIN_FILE_LIST]

**Purpose**: Identify all components and their relationships in the integration chain by tracing actual execution flow and explicit references.

1.1. Use the Task tool to invoke a `general-purpose` subagent:

<tool-use-template>
Task(
  description="Map integration chain components and relationships",
  subagent_type="general-purpose",
  prompt=`Follow the instructions in \@.claude/commands/utilities/map-integration-chain.md replacing !`echo '$AR''GUMENTS'` with: "[SLASH_COMMAND]"`
)
</tool-use-template>

1.2. Use the returned "Files to Analyze" as the [INTEGRATION_CHAIN_FILE_LIST].

## Phase 2: Create a baseline evaluation

2.1. Use the Bash tool to run [SLASH_COMMAND_EXAMPLE_USAGE] per `<testing>`.

2.2. Evaluate results against [EVALUATION].

## Phase 3: Modify the slash command

3.1. Read accumulated wisdom from past improvement sessions:
- If @.claude/memory/command-improvement-tips.md exists, read it for insights
- Apply relevant tips to inform your theories

3.2. Review the most recent evaluation results.

3.3. If the user specified [EDITABLE_FILE_LIST]:
- 3.3.1. Review the role of each file in [INTEGRATION_CHAIN_FILE_LIST]
- 3.3.2. Think deeply. Create three draft theories on how to improve the slash command's performance according to [EVALUATION] by editing one or more files in [EDITABLE_FILE_LIST]. Consider insights from memory.
- 3.3.3. For each draft theory, identify 1-3 pieces of supporting evidence and 1-3 pieces of contradicting evidence.
- 3.3.4. Choose the best theory and make improvements to one or more of the files in [EDITABLE_FILE_LIST].

3.4. If the user did not specify [EDITABLE_FILE_LIST]:
- 3.4.1. Review the role of each file in [INTEGRATION_CHAIN_FILE_LIST]
- 3.4.2. Think deeply. Create three draft theories on how to improve the slash command's performance according to [EVALUATION] by editing one or more files in [INTEGRATION_CHAIN_FILE_LIST]. Consider insights from memory.
- 3.4.3. For each draft theory, identify 1-3 pieces of supporting evidence and 1-3 pieces of contradicting evidence.
- 3.4.4. Choose the best theory and make improvements to one or more of the files in [INTEGRATION_CHAIN_FILE_LIST].

## Phase 4: Perform an evaluation of the modified command

4.1. Use the Bash tool to run [SLASH_COMMAND_EXAMPLE_USAGE] per `<testing>`.

4.2. Evaluate results against [EVALUATION].

## Phase 5: Revert modifications if performance has not improved

5.1. If Phase 4 evaluation results show no improvement over the previous evaluation, revert the modifications.

## Phase 6: Output results and iterate

6.1. Output the Phase 4 evaluation results and reasoning behind your Phase 5 decision.

6.2. After each iteration, consider updating memory:
- If new insights contradict existing knowledge in @.claude/memory/command-improvement-tips.md, update it
- If new insights significantly extend existing knowledge, append them
- Focus on generalizable principles that apply beyond this specific command

6.3. If there have been fewer than ten iterations, return to Phase 3 and continue the iterative improvement process.

<constraints>
**The improved slash command must be generalizable.** Avoid using literal examples from any file in [INTEGRATION_CHAIN_FILE_LIST].
</constraints>