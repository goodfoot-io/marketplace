---
description: Update Task() prompts to use correct point of view from sub-agent perspective
---

Update Task() tool prompt instructions to properly reflect that the orchestrating agent is "the user" from the sub-agents' perspective.

<user-message>
$ARGUMENTS
</user-message>

<input-format>
The `<user-message>` references one or more files containing Task() tool usages. Each file path is designated as [INPUT_FILE].

<example>
If the `<user-message>` is "Fix POV in .claude/commands/prove-it.md", then:
- [INPUT_FILE] = `.claude/commands/prove-it.md`
</example>
</input-format>

<modification-note>
**Direct modification:** Files will be updated in place. No new versions are created.

This command specifically targets Task() tool invocations and updates the `prompt` parameter to use correct point of view.
</modification-note>

<pov-correction-rules>
## Point of View Rules for Task() Prompts

When the orchestrating agent invokes Task() to create sub-agents, the orchestrating agent becomes "the user" from the sub-agent's perspective.

### Incorrect References (Third Person)
These imply external entities separate from the orchestrating agent:
- "the coordinator will synthesize"
- "the user makes final decisions"
- "the orchestrating agent will review"
- "report back to the coordinator"
- "the main agent will process"
- "your manager will decide"
- "the controller handles"

### Correct References (First Person)
The orchestrating agent should speak as "I" in Task() prompts:
- "I will synthesize"
- "I will make final decisions"
- "I will review"
- "report back to me"
- "I will process"
- "I will decide"
- "I handle"

### Acceptable Third-Person References
Some third-person references are acceptable when they refer to entities OTHER than the orchestrating agent:
- "other agents are performing parallel evaluations" ✓ (refers to peer sub-agents)
- "the end user requested this feature" ✓ (refers to the actual human user)
- "the codebase contains" ✓ (refers to external system)
- "the repository shows" ✓ (refers to external system)

### Context Awareness
The correction applies specifically within Task() `prompt` parameters. Text outside of Task() invocations should generally NOT be modified unless it's instructions for how to write Task() prompts.

<example>
Before:
```
Task(description="review-code",
    subagent_type="code-review",
    prompt="Review the code. Other agents are working on this. The coordinator will synthesize all feedback and the user makes final decisions.")
```

After:
```
Task(description="review-code",
    subagent_type="code-review",
    prompt="Review the code. Other agents are working on this. I will synthesize all feedback and make final decisions.")
```
</example>

<example>
Before:
```
<instructions>
Evaluate this approach. Remember that the orchestrating agent will review all submissions, other agents are evaluating in parallel, and the user has final say.
</instructions>
```

After:
```
<instructions>
Evaluate this approach. Remember that I will review all submissions, other agents are evaluating in parallel, and I have final say.
</instructions>
```
</example>
</pov-correction-rules>

<instructions>
## Step 1: Read and Analyze

Read [INPUT_FILE] and identify all Task() tool invocations and any template/example sections that demonstrate how to write Task() prompts.

For each Task() invocation, examine the `prompt` parameter content for POV issues.

## Step 2: Identify POV Issues

Search for patterns indicating incorrect third-person references to the orchestrating agent:
- "coordinator"
- "orchestrating agent"
- "main agent"
- "manager"
- "controller"
- Passive constructions like "will be synthesized" (should be "I will synthesize")
- References to "the user" when it means the orchestrating agent (not the end user)

Mark each instance that needs correction.

## Step 3: Apply POV Corrections

For each identified issue:
1. Determine if the reference is to the orchestrating agent
2. Replace third-person references with first-person ("I", "me", "my")
3. Ensure the change maintains grammatical correctness
4. Preserve all other content exactly

Apply corrections to:
- Task() `prompt` parameters
- Template sections showing how to write Task() prompts
- Example Task() invocations in documentation

Do NOT modify:
- References to peer agents ("other agents")
- References to external systems
- References to the actual end user
- Content outside Task() contexts unless it's instructions about writing Task() prompts

## Step 4: Validate Changes

Verify each correction:
- Maintains the same meaning
- Uses grammatically correct first person
- Doesn't introduce new ambiguities
- Preserves all other prompt content

## Step 5: Apply Changes

Update [INPUT_FILE] directly using the Edit tool with all POV corrections applied.
</instructions>

<examples>
<example>
**Simple Task Prompt**

Before:
```markdown
Task(description="analyze-performance",
    prompt="Analyze the performance metrics. The coordinator will review your findings and the user will make the final decision.")
```

After:
```markdown
Task(description="analyze-performance",
    prompt="Analyze the performance metrics. I will review your findings and make the final decision.")
```
</example>

<example>
**Instructions Block in Task Prompt**

Before:
```markdown
prompt="<task>Review this code</task>
<instructions>
Provide detailed feedback. Other agents are reviewing different modules. The orchestrating agent will compile all reviews and present to the user for final approval.
</instructions>"
```

After:
```markdown
prompt="<task>Review this code</task>
<instructions>
Provide detailed feedback. Other agents are reviewing different modules. I will compile all reviews and make the final approval decision.
</instructions>"
```
</example>

<example>
**Template Section**

Before:
```markdown
## Tool Use Template

Task(description="task-name",
    prompt="<instructions>
    Complete your analysis. Remember that other agents are working in parallel, the coordinator synthesizes results, and the user decides next steps.
    </instructions>")
```

After:
```markdown
## Tool Use Template

Task(description="task-name",
    prompt="<instructions>
    Complete your analysis. Remember that other agents are working in parallel, I will synthesize results, and I decide next steps.
    </instructions>")
```
</example>

<example>
**Complex Multi-Clause Correction**

Before:
```markdown
prompt="Evaluate the proposal thoroughly. Your feedback will be combined with other agents' evaluations by the coordinator, who will then present a synthesis to the user for their final decision on whether to proceed."
```

After:
```markdown
prompt="Evaluate the proposal thoroughly. I will combine your feedback with other agents' evaluations, synthesize the results, and make the final decision on whether to proceed."
```
</example>

<example>
**Preserving Valid Third-Person References**

Before:
```markdown
prompt="Test the authentication flow. Other agents are testing different endpoints. The end user expects sub-200ms response times. The coordinator will aggregate results."
```

After:
```markdown
prompt="Test the authentication flow. Other agents are testing different endpoints. The end user expects sub-200ms response times. I will aggregate results."
```

Note: "other agents" and "the end user" remain unchanged because they refer to entities other than the orchestrating agent.
</example>
</examples>
