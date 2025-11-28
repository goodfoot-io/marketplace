# How to Add Skills to Project Agents

This guide documents the process for adding skills with optional additional context to subagents defined in `plugins/project/agents/`. It follows the pattern established when adding the `project:refactoring` skill to the refactor agent.

## When to Add Skills to an Agent

Add a skill when:

1. **The agent's system instructions are already substantial** - Adding more content would bloat the prompt and consume context budget unnecessarily
2. **Additional context is needed only in specific situations** - Not every invocation requires the full methodology
3. **The knowledge is reusable** - Other agents or commands might benefit from the same information
4. **Deep methodology exists separately** - Research documents, style guides, or best practices exist that should inform the agent's decisions

Do not add a skill when:

- The agent's instructions are concise and the additional content is always relevant
- The content is purely operational (step-by-step instructions the agent always follows)
- The information is specific to a single use case with no reuse potential

## Skill Architecture: The Router Pattern

The recommended pattern separates concerns:

```
Agent System Instructions (agents/*.md)
├── Operational instructions (what to do, when, how)
├── Core philosophy (brief)
└── skills: [project:skill-name]  ← Links to skill

Skill (skills/skill-name/)
├── SKILL.md                      ← Minimal router
└── supporting-documents.md       ← Deep methodology
```

### Why This Pattern?

| Component | Contains | Loaded |
|-----------|----------|--------|
| Agent instructions | Operational steps, constraints, output format | Always |
| SKILL.md router | Conditional guidance: "If X, read Y" | Always (minimal) |
| Supporting documents | Deep methodology, examples, decision frameworks | On-demand |

This keeps the agent's base context lean while providing access to rich methodology when needed.

## Step-by-Step Process

### Step 1: Identify the Gap

Compare the agent's current instructions against available methodology or research.

**Questions to ask:**
- What decisions does the agent make that require nuanced judgment?
- Is there existing documentation (research reports, style guides) with deeper guidance?
- What situations would benefit from additional context?

**Example from refactor agent:**

The agent had operational instructions for refactoring actions but lacked:
- Framework for distinguishing essential vs accidental complexity
- Guidance on when duplication is acceptable
- Safeguards against accidentally removing necessary code
- Philosophy for behaviour-driven test refinement

These gaps were identified by comparing `agents/refactor.md` against `documentation/refactoring-report.md`.

### Step 2: Design the Skill Structure

Determine what documents the skill needs:

1. **Identify decision categories** - Group the additional guidance by situation type
2. **Name each document descriptively** - Names should indicate when to use them
3. **Plan the router conditions** - Define "If X, read Y" rules

**Example structure:**

```
skills/refactoring/
├── SKILL.md                    # Router
├── complexity-assessment.md    # When: unsure if complexity is essential
├── duplication-judgment.md     # When: deciding to consolidate or tolerate
├── test-refinement.md          # When: refactoring tests
└── protective-heuristics.md    # When: considering removing unclear code
```

### Step 3: Update the Agent Frontmatter

Add the `skills` field to the agent's YAML frontmatter:

```yaml
---
name: agent-name
description: Agent description
tools: "*"
skills: project:skill-name
---
```

For multiple skills, use array syntax:

```yaml
skills:
  - project:skill-one
  - project:skill-two
```

### Step 4: Create the Skill Directory

```bash
mkdir -p plugins/project/skills/skill-name
```

### Step 5: Write the SKILL.md Router

The router should be minimal—its job is to direct the agent to the right document based on the situation.

**Template:**

```markdown
---
name: skill-name
description: Brief description of what this skill provides and when it applies.
---

<routing-instructions>
This skill provides additional methodology for [domain]. Load the relevant document when you encounter the corresponding situation.

## [Category 1]

**When [situation description]:**
Read @document-one.md

Indicators:
- [Signal that this situation applies]
- [Another signal]

## [Category 2]

**When [situation description]:**
Read @document-two.md

Indicators:
- [Signal that this situation applies]
- [Another signal]
</routing-instructions>
```

**Key principles:**
- Keep the router under 50 lines
- Use clear "When X, read Y" format
- Include indicators to help the agent recognise when to load each document

### Step 6: Write Supporting Documents

Each supporting document should be instructional and use semantic XML tags for structure.

**Template:**

```markdown
# Document Title

<purpose>
Describe what this document provides and when to use it.
</purpose>

<core-principle>
## Main Concept

Explain the fundamental principle or framework.
</core-principle>

<detailed-guidance>
## Specific Guidance

### Subsection with Examples

Provide concrete examples showing before/after or good/bad patterns.

**Example:**
```typescript
// Before: [problematic pattern]
const example = ...

// After: [improved pattern]
const example = ...
```
</detailed-guidance>

<decision-process>
## Decision Process

1. Step one
2. Step two
3. Step three
</decision-process>

<checklist>
## Checklist

- [ ] Item one
- [ ] Item two
</checklist>
```

**Key principles:**
- Use semantic XML tags (`<purpose>`, `<core-principle>`, `<decision-process>`, etc.)
- Include concrete code examples with before/after comparisons
- Provide checklists and decision trees for complex judgments
- Write in international business English (clear, direct, professional)
- Make documents instructional, not merely descriptive

### Step 7: Verify the Structure

```bash
# Check all files exist
ls -la plugins/project/skills/skill-name/

# Verify SKILL.md has correct frontmatter
head -20 plugins/project/skills/skill-name/SKILL.md

# Verify agent frontmatter includes skill
head -10 plugins/project/agents/agent-name.md
```

## Complete Example: Refactoring Skill

### Agent Frontmatter Update

```yaml
# plugins/project/agents/refactor.md
---
name: refactor
description: Only use this agent when it is requested by name.
tools: "*"
color: teal
model: inherit
skills: project:refactoring
---
```

### Skill Router

```markdown
# plugins/project/skills/refactoring/SKILL.md
---
name: refactoring
description: Decision routing for complex refactoring scenarios.
---

<routing-instructions>
## Complexity Decisions

**When unsure whether complexity is essential or accidental:**
Read @complexity-assessment.md

## Duplication Decisions

**When deciding whether to consolidate or tolerate duplication:**
Read @duplication-judgment.md

## Test Refactoring

**When refactoring tests or questioning test structure:**
Read @test-refinement.md

## Removal Decisions

**When considering removing code you do not fully understand:**
Read @protective-heuristics.md
</routing-instructions>
```

### Supporting Document Example

```markdown
# plugins/project/skills/refactoring/complexity-assessment.md

<purpose>
This document provides a systematic approach to distinguishing essential
complexity from accidental complexity.
</purpose>

<core-distinction>
## Essential vs. Accidental Complexity

**Essential complexity** originates from the problem domain...

**Accidental complexity** originates from the solution...
</core-distinction>

<assessment-questions>
## Questions to Determine Complexity Type

### Question 1: Does the plan require this sophistication?
...
</assessment-questions>
```

## Applying to Other Agents

### Candidates for Skills

| Agent | Potential Skill | Content Source |
|-------|-----------------|----------------|
| `implementer` | `project:implementation-patterns` | Coding standards, TDD methodology |
| `plan-assessor` | `project:plan` | Plan structure, quality assessment (merged) |
| `implementation-evaluator` | `project:evaluation-criteria` | Quality metrics, readiness definitions |
| `codebase-explainer` | `project:explanation-techniques` | Already exists as a skill |
| `sledgehammer` | `project:recovery-patterns` | Regression recovery strategies |

### Assessment Questions

Before adding a skill to an agent, ask:

1. **Is the agent's prompt already long?** If under 200 lines, consider adding content directly
2. **Is the additional guidance situational?** If always needed, embed in agent instructions
3. **Does deep methodology exist?** If not, write it first as a standalone document
4. **Would other agents benefit?** If yes, skill provides reuse value

## Summary

The process for adding skills to agents:

1. **Identify gaps** between agent instructions and available methodology
2. **Design structure** with router and supporting documents by decision category
3. **Update agent frontmatter** with `skills: project:skill-name`
4. **Create skill directory** under `plugins/project/skills/`
5. **Write minimal router** in `SKILL.md` with "If X, read Y" conditions
6. **Write supporting documents** with semantic XML tags, examples, and decision frameworks
7. **Verify structure** and test agent invocation

This pattern keeps agent prompts lean while providing rich, on-demand methodology for complex decisions.
