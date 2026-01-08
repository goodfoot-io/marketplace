---
description: Implement an existing plan with automatic validation
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
---

<user-message>
$ARGUMENTS
</user-message>

Follow the `<instructions>` below to implement the plan. Do not skip instructions because the task is simple.

<input-format>
Extract from `<user-message>`:
- [PLAN_PATH] = Path to plan.md file (optional - will search if not provided)

If [PLAN_PATH] is not provided, search for plans in this order:
1. `projects/active/*/plan.md` - Resume in-progress work
2. `projects/new/*/plan.md` - Start new implementation

If multiple plans exist, list them and ask the user to specify which one.
</input-format>

<operational-guidelines>
You should follow these guidelines throughout execution:

1. **Avoid over-engineering** - Only make changes that are directly requested or clearly necessary. Don't add features, refactor code, or make "improvements" beyond what was asked.

2. **Always dispatch tasks** - You should dispatch every implementation task to a opus subagent. Do not implement tasks directly using Edit/Write tools. This applies regardless of task simplicity.

3. **Use opus model** - All subagents should use `model="opus"`.

4. **Use general-purpose subagent** - All subagents should use `subagent_type="general-purpose"`. Do not substitute other agent types.

5. **Self-contained task prompts** - Agents have no conversation context. Include full paths, code snippets, patterns, and requirements in every task prompt.
</operational-guidelines>

<instructions>
## Step 1: Locate and Read Plan

You should locate the plan file:

**If [PLAN_PATH] provided:**
```bash
cat "[PLAN_PATH]"
```

**If [PLAN_PATH] not provided:**
```bash
# Check for active plans first (resume work)
ls -la projects/active/*/plan.md 2>/dev/null

# Then check for new plans
ls -la projects/new/*/plan.md 2>/dev/null
```

If multiple plans found, ask the user which to implement.

You should read the plan and extract:
- [PROJECT_NAME] = From plan title or directory name
- [PROJECT_DIR] = Directory containing plan.md
- [TASKS] = All tasks with dependencies and file assignments
- [VALIDATION_COMMANDS] = Commands from Validation Commands section
- [EXPLORATION_SUMMARY] = Context from Exploration Summary section (if present)

## Step 2: Move Project to Active (if needed)

If the plan is in `projects/new/`, you should move it to active:

```bash
mv projects/new/[PROJECT_NAME] projects/active/ && echo "projects/active/[PROJECT_NAME]"
```

You should update [PROJECT_DIR] to `projects/active/[PROJECT_NAME]`.

If already in `projects/active/`, skip this step.

## Step 3: Dispatch Tasks

You should dispatch tasks to opus subagents using the Task tool. Do not implement tasks directly—always dispatch, even for simple single-file changes.

**Task Consolidation:** You may consolidate multiple plan tasks into a single subagent dispatch when:
- Tasks modify the same file(s)
- Tasks form a tight dependency chain with shared files
- Tasks are in the same package and implement related parts of the same feature

Do not consolidate when:
- Tasks are in different packages (keep parallel for speed)
- Tasks have no file overlap and no dependencies (keep parallel)

Each task prompt should be self-contained with:
- Full file paths (absolute)
- Current file content (read files first)
- Testing requirements from plan
- Patterns from Exploration Summary
- Constraints from plan

**Task Prompt Template:**

```xml
<invoke name="Task">
<parameter name="description">[short-task-name]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">opus</parameter>
<parameter name="prompt">You are implementing a portion of a plan. Other subagents are also working on this plan.

# Task
[Description with testing requirements from plan]

## Plan
@[PROJECT_DIR]/plan.md

## Context
[Why this task exists - from plan rationale]
[Relevant context from Exploration Summary]

## File Ownership
This task owns: [absolute paths from plan]
Do not modify files outside this list.

## Current File Content
[Read and include current content of files to be modified]

## Constraints
[From plan: patterns, interfaces, dependencies to respect]

## Requirements
[List all requirements - if consolidating multiple tasks, include requirements from each]
1. [Requirement from task 1]
2. [Requirement from task 1]
3. [Requirement from task 2 - if consolidated]

## Patterns to Follow
[Code snippets showing conventions - from exploration or file reads]

## Guidelines
- Only make requested changes
- Don't add unrequested features or abstractions
- Keep implementation minimal and focused

## Success Criteria
- [ ] Implementation complete
- [ ] Tests pass (if applicable)
- [ ] Types correct
- [ ] Follows existing patterns</parameter>
</invoke>
```

**Dispatch Strategy:**
- Parallel groups: You should launch all tasks (or consolidated task groups) in a single message
- Sequential tasks: You should wait for completion before launching the next task
- Consolidated tasks: Combine requirements from multiple plan tasks into one dispatch when consolidation criteria are met

## Step 4: Monitor Completion

You should track task outcomes and note any errors for the validation phase.

## Step 5: Run Validation

Use the Task tool to dispatch a 'general-purpose' subagent to validate the implementation:

```xml
<invoke name="Task">
<parameter name="description">Validate implementation</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">opus</parameter>
<parameter name="prompt"># Task: Validate Implementation

## Plan
@[PROJECT_DIR]/plan.md

## Status Definitions
- **PRODUCTION_READY**: All validation commands pass, no errors
- **CONTINUE**: Core works but has fixable issues (failing tests, type errors)
- **BLOCKED**: System-level impediment (disk full, missing infrastructure)

## Steps

1. Read `[PROJECT_DIR]/plan.md`, extract:
   - Success Criteria
   - Validation Commands (from "## Validation Commands" section)
   - Tasks

2. Execute ALL commands from the plan's "## Validation Commands" section.
   Run every command listed under each package heading.

   If no "## Validation Commands" section exists in the plan, use these defaults:
   ```bash
   cd packages/[package] && yarn typecheck 2>&1
   cd packages/[package] && yarn test 2>&1
   cd packages/[package] && yarn lint 2>&1
   ```

3. Determine status based on results

4. Append to plan.md:

```markdown
## Execution Results

**Completed**: [DATE]
**Status**: [STATUS]

### Quality Assessment
- Type Check: [PASS/FAIL] ([N] errors)
- Tests: [PASS/FAIL] ([X]/[Y] passing)
- Lint: [PASS/FAIL] ([N] issues)

### Issues Found
[List with file:line references]

### Required Actions
[If not PRODUCTION_READY]
```

5. Return:
```
STATUS: [STATUS]
TYPE_ERRORS: [N]
TEST_RESULTS: [N passed, N failed]
LINT_ISSUES: [N]
```</parameter>
</invoke>
```

## Step 6: Handle Results

You should handle results based on status:

**PRODUCTION_READY:**
- You should proceed to Step 7

**CONTINUE:**
1. You should review errors (file:line references)
2. You should dispatch fix tasks to opus subagents (do not fix directly)
3. You should re-run Step 5

**BLOCKED:**
1. You should report the impediment to the user
2. You should keep the project in `projects/active/`

**Report to User:**
```
## Implementation Complete

Plan: `[PROJECT_DIR]/plan.md`
Status: [STATUS]

### Quality Assessment
- Type Check: [PASS/FAIL]
- Tests: [PASS/FAIL]
- Lint: [PASS/FAIL]

### Tasks Completed
[N]/[N] tasks

[If issues: list with file:line references]
```

## Step 7: Move Project to Ready for Review

If PRODUCTION_READY, you should move the project:

```bash
mv projects/active/[PROJECT_NAME] projects/ready-for-review/
```

Otherwise, you should keep the project in `projects/active/` until resolved.

You should report:

```
## Project Ready for Review

Plan: `projects/ready-for-review/[PROJECT_NAME]/plan.md`
Status: PRODUCTION_READY

All tasks completed and validated successfully.
```
</instructions>
