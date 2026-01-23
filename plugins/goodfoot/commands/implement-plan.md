---
description: Implement an existing plan with automatic validation
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
---

```!
# Enable implement-plan reload after compaction by setting a flag keyed by Claude PID
find_claude_pid() {
  local current_pid=$$
  local max_depth=10
  local depth=0

  while [[ $depth -lt $max_depth && $current_pid -gt 1 ]]; do
    if ps -p $current_pid -o comm= 2>/dev/null | grep -q "^claude$"; then
      echo $current_pid
      return 0
    fi
    current_pid=$(ps -p $current_pid -o ppid= 2>/dev/null | tr -d ' ')
    ((depth++))
  done
  return 1
}

CLAUDE_PID=$(find_claude_pid)
if [[ -n "$CLAUDE_PID" ]]; then
  echo "1" > "/tmp/claude_implement_plan_reload_${CLAUDE_PID}.enabled"
fi
```

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
Follow these guidelines throughout execution:

1. **Avoid over-engineering** - Only make changes that are directly requested or clearly necessary. Don't add features, refactor code, or make "improvements" beyond what was asked.

2. **Always dispatch tasks** - Dispatch every implementation task to a subagent. Do not implement tasks directly using Edit/Write tools. This applies regardless of task simplicity.

3. **Dynamic model selection** - Choose the model based on task complexity:
   - **opus**: Ambiguous requirements, multiple possible approaches, or tasks where you're unsure how to start
   - **sonnet**: Clear goal with multiple steps, building features, or fixing bugs in unfamiliar code
   - **haiku**: Single-step tasks, following established patterns, or making changes you already understand

4. **Use general-purpose subagent** - Implementation and validation subagents should use `subagent_type="general-purpose"`. The refactoring step uses `code-simplifier:code-simplifier`.

5. **Self-contained task prompts** - Agents have no conversation context. Include full paths, code snippets, patterns, and requirements in every task prompt.
</operational-guidelines>

<instructions>
## Step 1: Establish Baseline

Check git state before making changes:

```bash
git status --porcelain
```

**If dirty (uncommitted changes exist):** Ask user how to proceed:
- "Stash changes" → `git stash push -m "pre-implement-plan"`
- "Commit first" → Exit for user to handle
- "Proceed anyway" → Continue (warn: limited rollback capability)

**If clean:** Continue.

## Step 2: Locate and Read Plan

Locate the plan file:

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

Read the plan and extract:
- [PROJECT_NAME] = From plan title or directory name
- [PROJECT_DIR] = Directory containing plan.md
- [TASKS] = All tasks with dependencies and file assignments
- [PLAN_FILES] = All files the plan intends to modify (from task file assignments)
- [VALIDATION_COMMANDS] = Commands from Validation Commands section
- [EXPLORATION_SUMMARY] = Context from Exploration Summary section (if present)

Create baseline checkpoint now that [PROJECT_NAME] is known:

```bash
git tag -f implement/[PROJECT_NAME]/baseline HEAD
```

## Step 3: Move Project to Active (if needed)

If the plan is in `projects/new/`, move it to active:

```bash
mv projects/new/[PROJECT_NAME] projects/active/ && echo "projects/active/[PROJECT_NAME]"
```

Update [PROJECT_DIR] to `projects/active/[PROJECT_NAME]`.

If already in `projects/active/`, skip this step.

## Step 4: Assess Coherence

Analyze tasks along three dimensions before dispatching:

| Dimension | Question |
|-----------|----------|
| **Dependency** | Do files import/reference each other? |
| **Uniformity** | Same operation across files, or varied operations? |
| **Size** | Substantial tasks with clear completion gates? |

**Route based on assessment:**

| Pattern | Route | Description |
|---------|-------|-------------|
| Independent files OR uniform tasks | **Parallel** | Launch concurrent agents |
| Dependent + varied + small | **Coherent** | Single agent handles all |
| Dependent + varied + substantial with clear gates | **Sequential** | Ordered agents, validate between |

**Clear gates** include: type-check passes, tests pass, API functional, UI renders.

When uncertain between Coherent and Sequential, choose **Sequential**. Checkpoints have low cost; missed validation opportunities have high cost.

## Step 5: Select Model and Dispatch Tasks

Create pre-implementation checkpoint:

```bash
git add -A
git commit --allow-empty -m "checkpoint: before implementation

Project: [PROJECT_NAME]
Tasks: [N] tasks to implement"
git tag -f implement/[PROJECT_NAME]/pre-implementation HEAD
```

Dispatch tasks to subagents using the Task tool. Do not implement tasks directly—always dispatch, even for simple single-file changes.

### Model Selection

For each task or task group, select the appropriate model:

| Model | When to Use |
|-------|-------------|
| **opus** | Ambiguous requirements, multiple approaches possible, unfamiliar territory |
| **sonnet** | Clear goal with multiple steps, building features, fixing bugs in unfamiliar code |
| **haiku** | Single-step tasks, established patterns, changes you already understand |

### Task Prompt Requirements

Each task prompt should be self-contained with:
- Full file paths (absolute)
- Current file content (read files first)
- Testing requirements from plan
- Patterns from Exploration Summary
- Constraints from plan

### Dispatch by Coherence Route

**Parallel Route** - Launch all independent tasks in a single message:

```xml
<invoke name="Task">
<parameter name="description">[task-group-a]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">[MODEL based on complexity]</parameter>
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
[List all requirements]
1. [Requirement 1]
2. [Requirement 2]

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
<invoke name="Task">
<parameter name="description">[task-group-b]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">[MODEL based on complexity]</parameter>
<parameter name="prompt">[Same structure as above]</parameter>
</invoke>
```

**Sequential Route** - Each phase must pass validation before the next begins:

```
┌─────────────────────────────────────────────────────┐
│  For each phase:                                    │
│                                                     │
│    Dispatch phase tasks                             │
│            ↓                                        │
│    Wait for completion                              │
│            ↓                                        │
│    Run validation (typecheck, test, lint)           │
│            ↓                                        │
│    ┌───────┴───────┐                                │
│    │               │                                │
│  Pass            Fail → Fix errors, re-validate     │
│    │                                                │
│    ↓                                                │
│  Next phase (or Step 6 if final phase)              │
└─────────────────────────────────────────────────────┘
```

Do not dispatch the next phase until the current phase passes validation.

**Coherent Route** - Single agent handles all related tasks:

```xml
<invoke name="Task">
<parameter name="description">[all-related-tasks]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">[MODEL - typically opus for coherent work]</parameter>
<parameter name="prompt">You are implementing a complete feature. Complete all tasks in sequence.

# Tasks
[List all tasks to complete in order]

## Plan
@[PROJECT_DIR]/plan.md

## Context
[Full context for the coherent work]

## File Ownership
This task owns: [all files for this coherent group]

## Current File Content
[Read and include current content of ALL files]

## Requirements
[Combined requirements from all tasks]

## Guidelines
- Complete tasks in dependency order
- Only make requested changes
- Don't add unrequested features or abstractions

## Success Criteria
- [ ] All tasks complete
- [ ] Tests pass
- [ ] Types correct
- [ ] Follows existing patterns</parameter>
</invoke>
```

## Step 6: Validation Gate

Create post-implementation checkpoint:

```bash
git add -A
git commit --allow-empty -m "checkpoint: after implementation, before validation

Project: [PROJECT_NAME]"
git tag -f implement/[PROJECT_NAME]/post-implementation HEAD
```

### Check for Unexpected Modifications

Verify that only plan-owned files were modified:

```bash
# Files modified since baseline
MODIFIED=$(git diff implement/[PROJECT_NAME]/baseline --name-only)

# Check for files outside [PLAN_FILES]
# (Compare MODIFIED against the list of plan-owned files)
UNEXPECTED=$(comm -23 <(echo "$MODIFIED" | sort) <(echo "[PLAN_FILES]" | sort))
```

**If unexpected modifications exist:** Report them to user and ask how to proceed:
- "Keep" → Continue with modifications in place
- "Stash" → `git stash push -m "unexpected-changes" -- $UNEXPECTED`
- "Discard" → `git checkout implement/[PROJECT_NAME]/baseline -- $UNEXPECTED`

Do not discard without explicit user consent.

**Requirement:** ALL validation commands must pass before proceeding.

Run validation commands from the plan's "## Validation Commands" section. If no validation commands are specified, use these defaults:

```bash
cd packages/[package] && yarn typecheck 2>&1
cd packages/[package] && yarn test 2>&1
cd packages/[package] && yarn lint 2>&1
```

### On Failure

1. **Error in code you can modify** → Dispatch fix task to subagent, re-run validation
2. **Error outside your scope** → Block immediately and report to user

### Validation Loop

Continue the fix-and-validate cycle until:
- **All validations pass** → Proceed to Step 7
- **Error is outside scope** → Report blocker to user, keep project in `projects/active/`, **STOP**
- **Fix attempts exceed 3 for the same error** → Report blocker to user, keep project in `projects/active/`, **STOP**

### Fix Task Dispatch

When dispatching fix tasks, include the exact error output:

```xml
<invoke name="Task">
<parameter name="description">Fix [error-type]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">[MODEL - haiku for simple fixes, sonnet for complex]</parameter>
<parameter name="prompt"># Task: Fix Validation Error

## Error Output
```
[Exact error output with file:line references]
```

## Plan
@[PROJECT_DIR]/plan.md

## File Ownership
This task owns: [files mentioned in error]

## Current File Content
[Content of files with errors]

## Guidelines
- Fix only the specific error shown
- Do not refactor or improve surrounding code
- Maintain existing patterns

## Success Criteria
- [ ] Error resolved
- [ ] No new errors introduced</parameter>
</invoke>
```

## Step 7: Refactor

Create pre-refactor checkpoint:

```bash
git add -A
git commit --allow-empty -m "checkpoint: before refactoring

Project: [PROJECT_NAME]
Status: Validation passed"
git tag -f implement/[PROJECT_NAME]/pre-refactor HEAD
```

Delegate refactoring to improve code quality while preserving behavior.

### Dispatch Refactoring

```xml
<invoke name="Task">
<parameter name="description">Refactor implementation</parameter>
<parameter name="subagent_type">code-simplifier:code-simplifier</parameter>
<parameter name="prompt">
# Task: Refactor Recent Implementation

## Plan
@[PROJECT_DIR]/plan.md

## Focus Areas
1. Eliminate dead code
2. Simplify logic (guard clauses, smaller functions)
3. Remove over-engineering (YAGNI)
4. Improve naming (align with plan intent)
5. Harmonize patterns (match codebase conventions)
6. Refine tests (remove redundant, focus on behavior)

## Constraints
- Preserve observable behavior
- Maintain test coverage
- Stay within plan scope
- Validate after each change

## Guidelines
- Only refactor files modified by the implementation
- Do not add new features or capabilities
- Keep changes minimal and focused on clarity
</parameter>
</invoke>
```

### Process Result

Based on agent status:
- **COMPLETED**: Proceed to Step 8
- **HAS_RECOMMENDATIONS**: Log recommendations, proceed to Step 8
- **BLOCKED**: Document reasons, proceed to Step 8

## Step 8: Post-Refactor Validation

Re-run the validation commands (typecheck, test, lint) to ensure refactoring didn't introduce regressions.

**If validation passes:** Commit refactoring changes and proceed to Step 9:
```bash
git add -A
git commit -m "refactor: simplify implementation

Project: [PROJECT_NAME]"
```

**If validation fails:** Revert only plan-owned files to pre-refactor state, then proceed to Step 9:
```bash
# Identify files changed by refactoring that are in [PLAN_FILES]
REFACTOR_CHANGES=$(git diff implement/[PROJECT_NAME]/pre-refactor --name-only)
PLAN_CHANGES=$(comm -12 <(echo "$REFACTOR_CHANGES" | sort) <(echo "[PLAN_FILES]" | sort))

# Revert only those files
git checkout implement/[PROJECT_NAME]/pre-refactor -- $PLAN_CHANGES
```

## Step 9: Evaluate Quality

Dispatch a subagent to evaluate the implementation for production readiness:

```xml
<invoke name="Task">
<parameter name="description">Evaluate implementation quality</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">[MODEL - typically sonnet]</parameter>
<parameter name="prompt"># Task: Evaluate Implementation Quality

## Plan
@[PROJECT_DIR]/plan.md

## Status Definitions
- **PRODUCTION_READY**: Implementation meets all success criteria, code quality is acceptable
- **CONTINUE**: Core works but has quality issues that should be addressed (not validation failures)
- **BLOCKED**: Fundamental design issues or missing requirements that can't be fixed without re-planning

## Evaluation Criteria

1. **Requirements Coverage**: Does the implementation satisfy all success criteria in the plan?
2. **Code Quality**: Is the code maintainable, readable, and following project conventions?
3. **Edge Cases**: Are error conditions and edge cases handled appropriately?
4. **Test Coverage**: Are the changes adequately tested?
5. **Integration**: Does the implementation integrate cleanly with existing code?

## Steps

1. Read the plan's Success Criteria section
2. Review the implementation against each criterion
3. Assess code quality and completeness
4. Determine status

## Return Format
```
STATUS: [STATUS]
CRITERIA_MET: [N]/[N]
QUALITY_NOTES: [observations about code quality]
ISSUES: [List any concerns, or "None"]
RECOMMENDATIONS: [If CONTINUE, list specific improvements needed]
```</parameter>
</invoke>
```

### Handle Evaluation Result

Based on evaluation status:

**PRODUCTION_READY:**
- Proceed to Step 10

**CONTINUE:**
1. Review recommendations
2. Dispatch fix/improvement tasks to subagents
3. Re-run validation (typecheck, test, lint)
4. Commit changes:
   ```bash
   git add -A
   git commit -m "fix: address evaluation feedback

   Project: [PROJECT_NAME]
   Cycle: [N]"
   ```
5. Re-run Step 9 (Evaluate Quality)
6. If evaluation cycles exceed 2, proceed to Step 10 with current state

Note: Subsequent cycles skip Steps 7-8 (Refactor and Post-Refactor Validation) since refactoring already occurred.

**BLOCKED:**
1. Report fundamental issues to user
2. Keep the project in `projects/active/`
3. **STOP**

## Step 10: Report Results

Report implementation status to user:

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

## Step 11: Final Commit and Move Project

Commit any remaining uncommitted changes:

```bash
git add -A
git diff --cached --quiet || git commit -m "feat: implement [PROJECT_NAME]

[BRIEF_SUMMARY_OF_IMPLEMENTATION]"
```

**Only if status is PRODUCTION_READY**, move the project:

```bash
mv projects/active/[PROJECT_NAME] projects/ready-for-review/
```

Report:

```
## Project Ready for Review

Plan: `projects/ready-for-review/[PROJECT_NAME]/plan.md`

All tasks completed and validated successfully.
```

**If status is not PRODUCTION_READY** (e.g., evaluation cycles exceeded), keep project in `projects/active/` and inform user that manual review is needed.

### Checkpoint Cleanup (Optional)

After successful completion, checkpoints can be cleaned up:

```bash
git tag -d implement/[PROJECT_NAME]/baseline \
         implement/[PROJECT_NAME]/pre-implementation \
         implement/[PROJECT_NAME]/post-implementation \
         implement/[PROJECT_NAME]/pre-refactor 2>/dev/null
```

### Available Checkpoints

The following checkpoints are created during execution for rollback:

| Tag | Created At | Purpose |
|-----|------------|---------|
| `implement/[PROJECT_NAME]/baseline` | Step 2 | Original state before any changes |
| `implement/[PROJECT_NAME]/pre-implementation` | Step 5 | Before task dispatch |
| `implement/[PROJECT_NAME]/post-implementation` | Step 6 | After implementation, before validation |
| `implement/[PROJECT_NAME]/pre-refactor` | Step 7 | After validation passes, before refactoring |

**Note:** Reverts are scoped to [PLAN_FILES] only—files outside the plan's scope are never modified or discarded without explicit user consent.
</instructions>
