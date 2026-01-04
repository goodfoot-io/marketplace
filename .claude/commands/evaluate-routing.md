---
description: Evaluate routing document consistency with referenced skills
argument-hint: <routing-document-path>
---

# Evaluate Routing Logic

Evaluate the consistency between a routing document and all skills it references.

**Target:** $ARGUMENTS (default: `.compare-branch/prompt.md`)

## Phase 1: Extract Routing Structure

Read the routing document and extract:

1. **Input Format** — All field definitions (required and derived)
2. **Routing Conditions** — Which skill is invoked under what conditions
3. **Execution Flow** — What happens before/after skill invocation (status changes, guards)
4. **Skill References** — List all skills mentioned in routing logic

## Phase 2: Parallel Skill Analysis

For each skill referenced, launch a parallel haiku subagent with:
- The relevant **routing context** from the main document (conditions that lead to this skill)
- The **complete skill file** content
- Analysis prompts for:

### Consistency Checks

| Check | Question |
|-------|----------|
| **Reachability** | Can this skill actually be reached via the routing conditions? |
| **State Assumptions** | Does the skill assume state that routing doesn't guarantee? |
| **Field Definitions** | Are all fields the skill uses defined in the main input-format? |
| **Continuation Model** | What happens after the skill completes? Is it explicit? |
| **Case Coverage** | Does the skill handle all cases the routing might send? |

### Issue Categories

Ask each subagent to categorize findings:
- **Critical** — Logic impossibilities (condition can never be true, circular references)
- **Gaps** — Missing field definitions, undefined handoffs
- **Ambiguities** — Multiple interpretations possible
- **Cross-cutting** — Issues affecting multiple skills

## Phase 3: Synthesize and Report

Collect all subagent findings and synthesize into:

1. **Critical Issues** — Must fix for correct operation
2. **Cross-Cutting Gaps** — Issues affecting multiple skills (e.g., missing field in input-format)
3. **Per-Skill Issues** — Specific to individual skills
4. **Recommendations** — Suggested fixes in dependency order

## Phase 4: Placeholder Audit

Scan the routing document for placeholders that should be relocated:

### Placeholder Patterns to Detect

```
[FIELD_NAME] = ... (definition in input-format)
[PLACEHOLDER] references that appear in routing but aren't defined
<section-name> references that don't exist
Skill references like `plugin:skill-name` that aren't loadable
```

### Relocation Rules

**Principle:** The routing document should only contain fields it directly uses for routing decisions. All other fields belong in skills.

| Placeholder Type | Action |
|------------------|--------|
| Field used in routing conditions | Keep in routing document |
| Field used by skills but NOT in routing | Move to each skill's `<input-format>` (duplicate if multiple skills) |
| Field used by ONE skill only | Move to that skill's `<input-format>` |
| Field used by MULTIPLE skills | Duplicate to each skill's `<input-format>` |
| Section reference that doesn't exist | Remove or create the section |
| Skill reference that doesn't exist | Flag as critical error |

**Key insight:** Duplication across skills is acceptable and preferred over keeping unused definitions in the routing document. Each skill should be self-contained with its required field definitions.

### Report Format for Placeholders

```markdown
## Placeholder Audit

### To Remove from Routing Document
- [FIELD] at line X — Not used in routing conditions, only used by skills

### To Add to Skills
- [FIELD] — Add to: `skill-a`, `skill-b` (duplicate to each)

### Missing Definitions
- [FIELD] referenced at line X — Used but never defined

### Invalid References
- `skill:name` at line X — Skill does not exist

### Keep in Routing Document
- [FIELD] at line X — Used in routing condition at line Y
```

## Phase 5: Generate Fix Plan

If issues are found, generate a fix plan:

1. **Audit routing document fields**
   - Identify which fields are used in routing conditions (keep these)
   - Identify which fields are only used by skills (relocate these)
   - Remove unused field definitions

2. **Relocate fields to skills**
   - For each field not used in routing, add to every skill that uses it
   - Duplicate definitions are acceptable — skills should be self-contained
   - Each skill's `<input-format>` should define all fields it uses

3. **Fix routing document**
   - Clarify ambiguous routing conditions
   - Make execution flow consistent
   - Ensure only routing-relevant fields remain

4. **Fix skills** to align with updated routing
   - Update descriptions to match actual routing conditions
   - Handle all cases the routing might send
   - Add explicit STOP/continuation semantics
   - Include all required field definitions in `<input-format>`

5. **Verify references** — Ensure skills reference valid entities

## Execution

Use the Task tool to launch parallel subagents:

```xml
<!-- For each skill -->
<invoke name="Task">
<parameter name="description">analyze-[skill-name]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">
<routing-context>
[Relevant routing conditions for this skill]
</routing-context>

<skill-content>
[Full skill file content]
</skill-content>

<instructions>
List inconsistencies between routing conditions and skill instructions:
1. Can this skill be reached via the stated conditions?
2. Does the skill assume state the routing doesn't provide?
3. Are all fields the skill uses defined?
4. Is continuation/termination explicit?
5. Does the skill handle all cases routing might send?

Return: Bullet list of issues, or "No issues found"
</instructions>
</parameter>
</invoke>
```

After all agents complete, synthesize findings and present the report.
