# SKILL.md Style Guide

This style guide defines the standard formatting for SKILL.md files in `public/plugins-claude/claude-code-cli/skills/`.

---

## 1. Front Matter

Use YAML front matter with `name` and `description` fields:

```yaml
---
name: skill-name
description: Brief description of what the skill does
---
```

---

## 2. Document Structure

Wrap the main content in an `<instructions>` tag. Use optional section tags for organization:

```xml
<placeholder-variables>
[VARIABLE_NAME] — Description of the variable
</placeholder-variables>

<tools>
Brief description of available tools/APIs
</tools>

<instructions>
Main skill instructions here
</instructions>
```

### Standard Section Tags

- **`<placeholder-variables>`**: Document input variables
  - **Skill introduces new variables**: Required
  - **Otherwise**: Omit
- **`<tools>`**: List available APIs/tools (optional)
- **`<instructions>`**: Main instruction content (required)

---

## 3. Headers

Use numbered `##` headers for main steps/sections:

```markdown
## 1. First Step

Content here.

## 2. Second Step

Content here.

### 2.1 Subsection

Subsection content.
```

### Header Conventions

- Main sections: `## N. Section Name`
- Subsections: `### N.M Subsection Name` or `### Descriptive Name`
- Do not use `#` (h1) within instructions

---

## 4. Placeholder Variables

Use square brackets with uppercase and underscores:

```
[ISSUE_ID]
[BRANCH_NAME]
[LATEST_USER_COMMENT]
```

### When to Include `<placeholder-variables>`

- **Skill introduces new placeholder variables**: Include the `<placeholder-variables>` section
- **Skill uses only pre-defined variables**: Omit the section

### Variable Documentation Format

Use em-dash (—) to separate variable name from description:

```markdown
<placeholder-variables>
[ISSUE_ID] — The issue identifier from the issue tracker
[STATUS] — Current issue status (e.g., "in_progress", "blocked")
[BRANCH_NAME] — `issue-[ISSUE_ID]-[slugified-title]` (`:` and `/` replaced with `-`)
</placeholder-variables>
```

### Shell Variables

In bash code blocks, use `$VARIABLE` for runtime shell variables:

```bash
CURRENT_SHA=$(git rev-parse HEAD)
echo "Current commit: $CURRENT_SHA"
```

---

## 5. Code Blocks

### Language Tags

| Content Type | Tag | Example |
|--------------|-----|---------|
| Shell commands | `` ```bash `` | Git commands, scripts |
| REST API calls | `` ``` `` (none) | HTTP methods with JSON |
| XML/Invoke syntax | `` ```xml `` | Task/Skill invocations |

### Bash Example

```bash
cd ".worktrees/[BRANCH_NAME]"
git status
WORKTREE_BASELINE=$(git log --format=%H --grep="checkpoint: [ISSUE_ID]" -1)
```

### REST API Example

```
POST /issues/[ISSUE_ID]/comments
{
  "body": "## Comment Title\n\nComment content here.",
  "author": "agent"
}
```

```
PATCH /issues/[ISSUE_ID]
{
  "status": "in_progress",
  "needsAgentAttention": false
}
```

### Formatting Rules

- Use 2-space indentation for JSON
- Place HTTP method and endpoint on first line
- JSON body follows on subsequent lines
- No trailing commas in JSON

---

## 6. Lists

### Bullet Lists

Use dashes for unordered lists:

```markdown
- First item
- Second item
- Third item
```

### Numbered Lists

Use numbers for sequential steps within prose:

```markdown
1. Analyze the error message
2. Identify the root cause
3. Implement the fix
```

### Nested Lists

Indent with 2 spaces:

```markdown
- Parent item
  - Child item
  - Another child
- Next parent
```

---

## 7. Tables

Use tables for **reference data and static classifications**, not for decision logic with actions. For conditional routing, use the bolded condition prefix format (see Section 11).

### Appropriate Table Uses

**Category definitions:**
```markdown
| Issue Type | Characteristics | Delegation Strategy |
|------------|-----------------|---------------------|
| Coherent | Effort compounds across todos | Single agent for all todos |
| Fragmented | Effort is isolated per todo | One agent per independent group |
```

**Reference mappings (excuse → reality):**
```markdown
| Excuse | Reality |
|--------|---------|
| "Only the new test fails" | New test proves new code is broken |
| "Flaky test" | Race condition that crashes production |
```

**Component inventories:**
```markdown
| Tag | Purpose |
|-----|---------|
| `<placeholder-variables>` | Document input variables |
| `<tools>` | List available APIs/tools |
| `<instructions>` | Main instruction content |
```

### Table Formatting

- Use backticks for code/variables in cells
- Align pipes for readability
- Keep cell content concise
- Never embed conditional logic (if/else) within cells

---

## 8. Emphasis

### Bold

Use for keywords, actions, and important terms:

```markdown
**STOP** — Do not proceed further.
**Required Fields:** body, author
**Resume:** Continue from checkpoint.
```

### Inline Code

Use backticks for variables, commands, and technical terms:

```markdown
Set `needsAgentAttention` to `false`.
Run `git status` to check the state.
```

### Em-Dash

Use em-dash (—) as a separator in definitions and halt conditions:

```markdown
[VARIABLE] — Description of the variable
**STOP** — Reason for stopping
```

---

## 9. Stop/Halt Markers

Use bold with em-dash for stop conditions:

```markdown
**STOP** — Do not proceed. The issue requires user input.
```

Or standalone for immediate halt:

```markdown
HALT
```

---

## 10. Task and Skill Invocation

### Skill Invocation

```xml
<invoke name="Skill">
  <parameter name="skill">claude-code-cli:skill-name</parameter>
</invoke>
```

### Task Invocation

```xml
<invoke name="Task">
  <parameter name="description">brief-task-description</parameter>
  <parameter name="subagent_type">agent-type</parameter>
  <parameter name="prompt">
Detailed task instructions here.
Include all necessary context.
  </parameter>
</invoke>
```

---

## 11. Conditional Logic

Use **bolded condition prefix** format for all conditionals. This format optimizes for LLM comprehension by making each execution path explicit and visually distinct.

### Primary Format: Bolded Condition Prefix

Each condition is a bullet point with a **bold prefix** followed by a colon and the action:

```markdown
Based on evaluation result:
- **PRODUCTION_READY**: Post completion comment, proceed to Step 5
- **CONTINUE**: Increment cycle counter, create fix todos, return to Step 2
- **BLOCKED**: Document issues, set `needs_review`, HALT
```

### Flattening Nested Conditions

Never embed `if/else` logic inside a single bullet. Instead, flatten each path into its own line:

```markdown
<!-- AVOID: Nested logic in single bullet -->
- **CONTINUE**: Increment cycle. If ≥2: set `needs_review`, HALT. Else: create todos, return to 2.2.

<!-- PREFERRED: Flattened to separate bullets -->
- **CONTINUE and cycle ≥ 2**: Set `needs_review`, HALT
- **CONTINUE and cycle < 2**: Create "[Eval fix]" todos, return to Step 2.2
```

### Sub-conditions with Nested Bullets

When a condition has multiple sub-paths, use nested bullets:

```markdown
Based on status:
- **COMPLETED**: Mark todo completed, commit changes, post to issue, continue
- **NEEDS_REVISION**: Update todo with attempt count, revert to checkpoint
  - **If attempts < 3**: Re-delegate to agent
  - **If attempts ≥ 3**: Mark blocked, post failure comment
- **BLOCKED**: Document in issue, mark todo blocked, continue
```

### Applicability Patterns

For file-type or context-based conditions, use "If X" prefix:

```markdown
Based on changes:
- **Always applicable**: code-reviewer (general quality)
- **If test files changed**: pr-test-analyzer
- **If comments/docs added**: comment-analyzer
- **If error handling changed**: silent-failure-hunter
- **After passing review**: code-simplifier (polish and refine)
```

### Sequential Decision Points

For ordered evaluation (first match wins), state the evaluation order explicitly:

```markdown
Determine path using the first matching condition:
- **Worktree exists**: Resume — Navigate to existing worktree
- **Branch exists (no worktree)**: Recreate — Attach worktree to branch
- **Otherwise**: New — Create worktree with `instant-worktree`
```

### Inline Conditions (Simple Cases Only)

For single, simple conditions within prose, use inline format:

```markdown
If `[STATUS]` == "blocked": Post a blocker comment and **STOP**.
```

### When to Use Tables vs Bolded Prefix

| Scenario | Format | Reason |
|----------|--------|--------|
| Decision routing (status → action) | Bolded prefix | Each path is explicit |
| Nested conditionals | Bolded prefix with nesting | Avoids embedded if/else |
| Simple mappings (no nesting) | Either format | Tables acceptable for flat lookups |
| Reference data (excuse → reality) | Table | Not decision logic |
| Category definitions | Table | Static classification |

### Avoid: Tables with Embedded Logic

Tables should not contain conditional logic within cells:

```markdown
<!-- AVOID: Logic embedded in cell -->
| Status | Action |
|--------|--------|
| CONTINUE | Increment cycle. If ≥2: HALT. Else: retry. |

<!-- PREFERRED: Flattened bolded prefix -->
Based on status:
- **CONTINUE and cycle ≥ 2**: Set `needs_review`, HALT
- **CONTINUE and cycle < 2**: Create fix todos, return to Step 2.2
```

---

## 12. Comments in API Bodies

Use markdown formatting within API comment bodies:

```
POST /issues/[ISSUE_ID]/comments
{
  "body": "## Section Header\n\nParagraph text here.\n\n- Bullet point\n- Another point",
  "author": "agent"
}
```

### Newline Escaping

- Use `\n` for newlines within JSON strings
- Use `\n\n` for paragraph breaks

---

## Complete Example

```yaml
---
name: issue-example
description: Example skill demonstrating style guide conventions
---
```

```xml
<placeholder-variables>
[ISSUE_ID] — The issue identifier
[STATUS] — Current issue status
[BRANCH_NAME] — Working branch name
</placeholder-variables>

<tools>
POST /issues/[ISSUE_ID]/comments — Add a comment to the issue
PATCH /issues/[ISSUE_ID] — Update issue fields
</tools>

<instructions>

## 1. Evaluate Current State

Based on issue status:
- **blocked**: Go to Step 2
- **in_progress**: Go to Step 3
- **Otherwise**: Set status to `in_progress`, then go to Step 3

## 2. Handle Blocked State

Post a comment explaining the blocker:

```
POST /issues/[ISSUE_ID]/comments
{
  "body": "## Blocked\n\nThis issue is blocked pending resolution.",
  "author": "agent"
}
```

**STOP** — Wait for blocker resolution.

## 3. Continue Implementation

```bash
cd ".worktrees/[BRANCH_NAME]"
git status
```

Update the issue status:

```
PATCH /issues/[ISSUE_ID]
{
  "status": "in_progress",
  "needsAgentAttention": false
}
```

</instructions>
```

---

## 13. Summary of Key Conventions

| Element | Convention |
|---------|------------|
| Placeholder variables | `[UPPERCASE_UNDERSCORE]` |
| Shell variables | `$VARIABLE` |
| Variable descriptions | Em-dash separator (—) |
| Main sections | `## N. Section Name` |
| Code blocks | Language tags for bash/xml, none for API |
| JSON indentation | 2 spaces |
| Emphasis | `**bold**` for keywords |
| Inline code | Backticks for technical terms |
| Stop markers | `**STOP** — reason` |
| Conditionals | `- **Condition**: Action` (bolded prefix format) |
| Tables | Reference data only, not decision logic |
| Section wrappers | `<instructions>` required; `<placeholder-variables>` for new variables |
