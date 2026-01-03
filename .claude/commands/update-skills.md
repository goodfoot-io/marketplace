---
description: Update skill files following established patterns and preferences
argument-hint: <skill-name-or-pattern>
---

# Update Skills

Update skill and agent files following established patterns and style conventions.

**Target:** $ARGUMENTS (default: all `issue-*` skills)

**Locations:**
- Skills: `/workspace/public/plugins/claude-code-cli/skills/`
- Agents: `/workspace/public/plugins/claude-code-cli/agents/`
- Style Guide: `/workspace/documentation/claude-code-cli-skill-style-guide.md`

---

## Core Principles

### 1. Comment Instructions: Open-Ended Prose, Not Templates

**Wrong — Fill-in-the-blank template:**
```
POST /issues/[ISSUE_ID]/comments
{
  "body": "## Header\n\n[1-sentence: fill this in]\n\n### Section\n[bullet list: details]",
  "author": "agent"
}
```

**Right — Descriptive prose guidance:**
```markdown
Post a comment explaining [what to communicate]. Include [key information] and [additional context].

```
POST /issues/[ISSUE_ID]/comments
{
  "body": "[comment content]",
  "author": "agent"
}
```
```

### 2. Natural Phrasing

Avoid canned starting clauses. Let the agent compose naturally.

| Avoid | Prefer |
|-------|--------|
| `"I'm starting implementation by [fill in]"` | Describe what you're about to do and why |
| `"## Awaiting Review\n\n[summary]"` | Summarize what was completed and clarify you're waiting for review |
| `"Completed: [task]. [details]"` | Indicate which task you completed and what you actually did |

### 3. STOP Notifications

Every **STOP** must have a preceding comment explaining why the agent stopped. Users should never see work halt without explanation.

**Wrong:**
```markdown
**STOP** — Wait for user feedback.
```

**Right:**
```markdown
Post a comment explaining [what happened and why you're stopping].

```
POST /issues/[ISSUE_ID]/comments
{
  "body": "[comment content]",
  "author": "agent"
}
```

**STOP** — Wait for user feedback.
```

### 4. Progress Comments in Agents

For long-running agents (like `implementer.md`), add progress comments at phase boundaries:
- After preparation/cleanup work
- After investigation/analysis
- After major implementation steps
- After validation

Instructions should be inlined at each phase boundary, not in a separate section.

---

## Comment Instruction Patterns

### Starting Work
> Post a brief comment explaining your implementation approach or what you'll do first. Keep it concrete and specific to this task.

### Progress Updates
> Post a brief progress update indicating which task you completed and what you actually did. Keep it concise.

### Completion (with review)
> Post a summary explaining what you implemented and key decisions you made. List the main files you modified and which validation commands passed. Indicate you're waiting for approval.

### Completion (no review)
> Post a summary comment explaining what you implemented and any important decisions you made. Include which test commands you ran and their results.

### Failure/Blocked
> Post a comment explaining what validation step failed, what specific errors you encountered that you couldn't resolve, and what approaches you attempted. Be detailed enough that the user can understand the problem without reading all the code.

### Awaiting Clarification
> Confirm that you're still waiting for the previously requested information. Reference which specific questions remain unanswered and clarify that work is blocked until they're addressed.

---

## Execution

### Phase 1: Identify Target Files

If $ARGUMENTS is a specific skill name:
- Read `/workspace/public/plugins/claude-code-cli/skills/[skill-name]/SKILL.md`

If $ARGUMENTS is a pattern (e.g., `issue-*`):
- Glob for matching skill directories
- Include `/workspace/public/plugins/claude-code-cli/agents/*.md` if pattern includes agents

If $ARGUMENTS is empty:
- Default to all `issue-*` skills

### Phase 2: Analyze Each File

For each file, identify:
1. **Comment instructions** — `POST /issues/[ISSUE_ID]/comments` blocks
2. **STOP markers** — Any `**STOP**` that lacks a preceding comment instruction
3. **Template patterns** — Fill-in-the-blank patterns like `[1-sentence: ...]`, `[bullet list: ...]`
4. **Canned headers** — Hardcoded headers like `"## Awaiting Review\n\n..."`

### Phase 3: Apply Updates

For each issue found:

#### Replace Template Bodies
```markdown
# Before
"body": "## Header\n\n[1-sentence: description]"

# After
"body": "[comment content]"
```

#### Add Prose Instructions
Insert descriptive prose above the POST block explaining what information to convey.

#### Add Missing STOP Notifications
If a STOP lacks a preceding comment, add one with appropriate guidance.

### Phase 4: Validate

After updates:
1. Run `yarn lint` to check formatting
2. Verify all POST blocks have prose instructions above them
3. Verify all STOPs have preceding comment instructions

---

## Style Guide Reference

Follow `/workspace/documentation/claude-code-cli-skill-style-guide.md` for:
- Front matter format (`name`, `description`)
- Section structure (`<instructions>`, `<placeholder-variables>`)
- Header conventions (`## N. Section Name`)
- Code block formatting (language tags, JSON indentation)
- Placeholder variable format (`[UPPERCASE_UNDERSCORE]`)
- Stop marker format (`**STOP** — reason`)

---

## Checklist

Before completing, verify:

- [ ] All comment instructions use prose guidance, not fill-in-the-blank templates
- [ ] All POST blocks have `"body": "[comment content]"` (not hardcoded content)
- [ ] All STOPs have preceding comment instructions
- [ ] No canned headers (`## Awaiting Review`, `## Blocked`, etc.) in body templates
- [ ] Progress comments are inlined at phase boundaries (for agents)
- [ ] Lint passes: `yarn lint`
