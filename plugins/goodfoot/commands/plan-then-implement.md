---
description: Plan and implement development tasks with automatic validation
allowed-tools: *
---

<user-message>
$ARGUMENTS
</user-message>

<input-format>
`<user-message>` should describe:
- What needs to be built, fixed, or changed
- Any specific requirements or constraints
- Files, packages, or areas of the codebase involved

Extract the following from `<user-message>`:
- [REQUEST] = The development task or goal (required)
- [REQUIREMENTS] = Specific constraints, patterns to follow, or technical requirements (optional)
- [SCOPE_HINT] = Files, packages, or areas mentioned by user (optional - command will investigate codebase to determine full scope)

Variables derived during execution:
- [OBJECTIVES] = Parsed goals and success criteria (Phase 1.1)
- [TASKS] = Implementation tasks with dependencies (Phase 1.3)
- [AFFECTED_PACKAGES] = Packages with modified files (Phase 3.1)
- [VALIDATION_RESULTS] = Typecheck, test, and lint outcomes (Phase 3.2)
</input-format>

<instructions>
## Phase 1: Understand and Confirm

### Step 1.1: Analyze Request

Parse the user's request to identify:
- **Objectives**: What needs to be accomplished
- **Scope**: Which files/packages will be affected
- **Constraints**: Technical requirements, dependencies, patterns to follow
- **Success Criteria**: How to verify completion

Use Task with "codebase-analysis" subagent to investigate relevant code (MUST include full paths):

```xml
<!-- Examples - adapt to specific request: -->
<invoke name="Task">
<parameter name="subagent_type">vscode:Analysis</parameter>
<parameter name="description">Authentication implementation</parameter>
<parameter name="prompt">How is authentication implemented in packages/api/src/auth?</parameter>
</invoke>

<invoke name="Task">
<parameter name="subagent_type">vscode:Analysis</parameter>
<parameter name="description">User type imports</parameter>
<parameter name="prompt">What files import the User type from packages/shared/types/user.ts?</parameter>
</invoke>

<invoke name="Task">
<parameter name="subagent_type">vscode:Analysis</parameter>
<parameter name="description">Repository patterns</parameter>
<parameter name="prompt">What Repository pattern implementations exist in packages/api/src/repositories?</parameter>
</invoke>
```

### Step 1.2: Analyze Dependencies

For multi-task work, use dependency analysis tools to check for conflicts:

```bash
# Check what files a target depends on
print-dependencies packages/api/src/services/user.ts

# Check what would be affected by changes
print-inverse-dependencies packages/shared/types/user.ts

# Optional: Analyze complexity for refactoring tasks
print-type-analysis packages/api/src/services/user.ts | grep -A 1 'complexity:'
# High complexity scores (>10) indicate areas needing careful attention
```

This helps identify if tasks can run in parallel or must be sequential.

### Step 1.3: Create Implementation Plan

Based on analysis, generate tasks as either:

**Sequential Tasks** (default when unsure):
- Tasks that create something another task uses
- Tasks modifying files with overlapping dependencies
- Tasks in the same feature area or numbered sequence

**Parallel Tasks** (efficient when independence verified):
- Different packages/features with verified no file overlap
- Independent work (e.g., "Add logging" + "Style footer" + "Update README")
- Use `print-dependencies` to check for conflicts - if none found, parallelize safely
- Benefits: Faster execution, multiple agents working simultaneously

**For each task, determine testing requirements during planning**:

Analyze the task type and write the task description accordingly:

- **New features/logic** → Task includes: "Write behavioral tests first, then implement to make them pass"
- **Bug fixes** → Task includes: "Write test that reproduces the bug, then fix to make it pass"
- **Refactoring** → Task includes: "Verify existing test coverage, add tests if gaps exist, then refactor"
- **Config/docs/styling** → Task states: "No behavioral tests needed, verify changes work"

For each task, define:
- **Task Description**: Clear objective WITH testing requirements baked in
- **Affected Files**: Specific paths (including test files when tests are required)
- **Dependencies**: What this task requires from others

### Step 1.4: Present Plan and Confirm

Display the plan with dependency verification results:

```
## Implementation Plan

### Objectives
[What will be accomplished]

### Tasks
[For sequential: numbered list with dependencies noted]
[For parallel: grouped by independence with verification]

1. Task 1: [Description with testing requirements baked in]
   - Files: [paths - include test files when tests are required]
   - Dependencies: [N files] (from print-dependencies)
   - Depends on: [none or task IDs]

2. Task 2: [Description with testing requirements baked in]
   - Files: [paths]
   - Dependencies: [N files]
   - Depends on: Task 1

### Dependency Analysis
[If parallel considered]:
- Checked file overlap: ✅ None / ❌ Found overlap
- Tasks are independent: ✅ Verified / ⚠️ Sequential required

### Validation (after all tasks)
- Run tests in: [packages]
- Typecheck: [packages]
- Lint: [packages]

### Execution Strategy
[Sequential | Parallel (N tasks)] - [Reasoning with dependency check results]
```

**Example task descriptions:**
- "Implement user authentication service - write behavioral tests first, then implement"
- "Fix null pointer in profile loader - write test that reproduces bug, then fix"
- "Update TypeScript config to ES2022 - no tests needed, verify compilation"

Ask: **"Does this plan look correct? Should I proceed with implementation?"**

**CRITICAL: DO NOT CONTINUE TO PHASE 2 until user confirms.**

## Phase 2: Execute Implementation

### Step 2.1: Create Tasks

For each task, prepare comprehensive context with testing requirements from the plan:

```xml
<invoke name="Task">
<parameter name="description">[short-task-name]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt"># Task: [Full description with testing requirements from plan]

## Context
[Explain what needs to be done and why]
[Include relevant architecture/patterns from codebase]

## Files to Create/Modify
[Specific paths - include test files when tests are required]

## Requirements
[Specific requirement 1 - include test requirements from task description]
[Specific requirement 2]
[If task requires tests: "Write behavioral tests that verify [specific behaviors]"]
[If task requires tests: "Then implement code to make tests pass"]

## Existing Patterns
[Show examples from codebase to follow]

## Success Criteria
- Implementation complete and functional
- [Tests pass (if tests required)]
- Types are correct
- Follows existing code patterns</parameter>
</invoke>
```

### Step 2.2: Verify Independence (For Parallel Only)

Before launching parallel tasks, verify they won't conflict:

```bash
# Example: Checking if two tasks can run in parallel
# Task A modifies: packages/api/src/auth.ts
# Task B modifies: packages/ui/src/login.ts

# Check if auth.ts depends on anything login.ts touches
print-dependencies packages/api/src/auth.ts | grep -q 'packages/ui/src/login.ts'
# exit 0=conflict, 1=safe

# Check if login.ts depends on anything auth.ts touches
print-dependencies packages/ui/src/login.ts | grep -q 'packages/api/src/auth.ts'
# exit 0=conflict, 1=safe

# If both checks return exit code 1 (no match), tasks are safe to parallelize
```

### Step 2.3: Dispatch Tasks

**For Sequential Tasks:**
Launch tasks one at a time, waiting for each to complete before starting the next.

**For Parallel Tasks** (after independence verification):
Launch all independent tasks in a single message:

```xml
<invoke name="Task">
<parameter name="description">task-1</parameter>
<!-- ... additional parameters ... -->
</invoke>

<invoke name="Task">
<parameter name="description">task-2</parameter>
<!-- ... additional parameters ... -->
</invoke>

<invoke name="Task">
<parameter name="description">task-3</parameter>
<!-- ... additional parameters ... -->
</invoke>
```

### Step 2.4: Monitor Completion

Track which tasks complete successfully and which encounter issues.

## Phase 3: Validate Results

### Step 3.1: Identify Changed Files

Use git to find all modified files:

```bash
git diff --name-only HEAD
```

### Step 3.2: Run Validation

For each affected package, run:

```bash
# Typecheck
cd packages/[PACKAGE] && yarn typecheck 2>&1

# Tests (if test files exist)
cd packages/[PACKAGE] && yarn test 2>&1

# Lint
cd packages/[PACKAGE] && yarn lint 2>&1
```

If any validation fails:
1. Capture the specific errors (file paths, line numbers, error codes)
2. Analyze impact using dependency tools:

```bash
# For type errors in a specific file
print-inverse-dependencies packages/api/src/types/user.ts
```

3. Use Task with "codebase-analysis" subagent to investigate root causes with full paths
4. Report issues to user with analysis

### Step 3.3: Report Results

```
## Implementation Complete

### Tasks Executed
✅ Task 1: [description]
✅ Task 2: [description]
[Or ❌ for failures]

### Files Modified
- [file paths from git diff]

### Validation Results
- Typecheck: [✅ Pass | ❌ N errors]
- Tests: [✅ Pass | ❌ N failures]
- Lint: [✅ Pass | ❌ N issues]

[If failures exist, include error details and analysis]
```
</instructions>

<things-to-remember>
**Planning Determines Testing**: During plan creation (Step 1.3), analyze each task and bake testing requirements into the task description:
- New features/logic → "Write behavioral tests first, then implement"
- Bug fixes → "Write test that reproduces bug, then fix"
- Refactoring → "Verify existing coverage, then refactor"
- Config/docs/styling → "No tests needed, verify changes work"
- **Never create separate "testing" tasks** - testing is part of the task description

**Agent Context**: Agents invoked with Task() have no information about this conversation. Include all necessary context in each task prompt:
- Full file paths (not relative)
- Current state of relevant code
- Testing requirements from the plan's task description
- Implementation requirements and patterns
- Expected outcomes

**Task Independence**: Only use parallel execution when tasks are truly independent. When in doubt, use sequential.

**Validation Purpose**: Phase 3 runs all tests (including those written during tasks) to verify the complete implementation.
</things-to-remember>