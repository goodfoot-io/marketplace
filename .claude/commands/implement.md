---
description: Execute implementation tasks from a complete plan document
allowed-tools: *
argument-hint: <plan-content-or-file-path>
---

<user-input>
$ARGUMENTS
</user-input>

<input-format>
`<user-input>` should contain either:
1. **File path** to a plan document (e.g., `/workspace/reports/my-plan.md`)
2. **Inline plan content** (the full plan as text)

The plan should define:
- [OBJECTIVES] = What needs to be accomplished
- [TASKS] = Implementation tasks with dependencies
- [SCOPE] = Files/packages that will be affected
- [VALIDATION] = How to verify completion (tests, typecheck, lint)

Variables derived during execution:
- [AFFECTED_PACKAGES] = Packages with modified files (Phase 2)
- [VALIDATION_RESULTS] = Typecheck, test, and lint outcomes (Phase 2)
</input-format>

## Phase 1: Parse and Understand Plan

### Step 1.1: Load Plan Content

If `<user-input>` looks like a file path:
- Use Read tool to load the plan document
- Extract [OBJECTIVES], [TASKS], [SCOPE], and [VALIDATION]

If `<user-input>` is inline content:
- Parse the provided plan directly
- Extract [OBJECTIVES], [TASKS], [SCOPE], and [VALIDATION]

### Step 1.2: Analyze Plan Structure

Parse the plan to identify:
- [OBJECTIVES] = What needs to be accomplished
- [TASKS] = Implementation tasks (sequential or parallel)
- Task interdependencies within [TASKS]
- [SCOPE] = Which files/packages will be affected
- [VALIDATION] = Required validation steps

Use `mcp__codebase__ask` if you need to investigate relevant code (MUST include full paths):

<tool-use-template>
// Examples - adapt to specific plan requirements:
mcp__codebase__ask({
  question: "How is authentication implemented in packages/api/src/auth?"
})

mcp__codebase__ask({
  question: "What files import the User type from packages/shared/types/user.ts?"
})
</tool-use-template>

### Step 1.3: Verify Dependencies (For Parallel Tasks)

If [TASKS] specifies parallel execution, verify task independence:

<tool-use-template>
// Check what files a target depends on
Bash(
  command="print-dependencies packages/api/src/services/user.ts",
  description="List all files that user.ts imports"
)

// Check what would be affected by changes
Bash(
  command="print-inverse-dependencies packages/shared/types/user.ts",
  description="Show files that import this type - impact scope"
)

// If tasks modify overlapping files or dependencies, execute sequentially
</tool-use-template>

### Step 1.4: Output Execution Strategy

Display a concise summary:

```
## Implementation Summary

### Objectives
[OBJECTIVES]

### Tasks
[TASKS] with execution strategy

### Execution Strategy
[Sequential | Parallel (N tasks)] - [Reasoning]

### Validation
[VALIDATION] requirements

Proceeding with implementation...
```

## Phase 2: Execute Implementation

### Step 2.1: Create Tasks

For each task in [TASKS], prepare comprehensive context for the agent:

<tool-use-template>
Task(
  description="[short-task-name]",
  subagent_type="general-purpose",
  prompt=`# Task: [Full description]

## Context
[Explain what needs to be done and why]
[Include relevant architecture/patterns from codebase]

## Files to Modify
[Specific file paths with current state description]

## Requirements
- [Specific requirement 1]
- [Specific requirement 2]
- [Include behavioral tests as part of implementation]

## Existing Patterns
[Show examples from codebase to follow]

## Success Criteria
- Implementation complete and functional
- Tests pass (if applicable)
- Types are correct
- Follows existing code patterns`
)
</tool-use-template>

### Step 2.2: Dispatch Tasks

**For Sequential Tasks:**
Launch tasks one at a time, waiting for each to complete before starting the next.

**For Parallel Tasks** (after independence verification):
Launch all independent tasks in a single message:

```
Task(description="task-1", ...)
Task(description="task-2", ...)
Task(description="task-3", ...)
```

### Step 2.3: Monitor Completion

Track which tasks complete successfully and which encounter issues.

## Phase 3: Validate Results

### Step 3.1: Identify Changed Files

Use git to find all modified files and determine [AFFECTED_PACKAGES]:

<tool-use-template>
Bash(
  command="git diff --name-only HEAD",
  description="List all modified files"
)
</tool-use-template>

### Step 3.2: Run Validation

For each package in [AFFECTED_PACKAGES], run the validation steps from [VALIDATION]:

<tool-use-template>
// Typecheck
Bash(
  command="cd packages/[PACKAGE] && yarn typecheck 2>&1",
  description="Check TypeScript types"
)

// Tests (if test files exist)
Bash(
  command="cd packages/[PACKAGE] && yarn test 2>&1",
  description="Run test suite"
)

// Lint
Bash(
  command="cd packages/[PACKAGE] && yarn lint 2>&1",
  description="Check code style"
)
</tool-use-template>

If any validation fails:
1. Capture the specific errors (file paths, line numbers, error codes)
2. Analyze impact using dependency tools:

<tool-use-template>
// For type errors in a specific file
Bash(
  command="print-inverse-dependencies packages/api/src/types/user.ts",
  description="Show files that import this type - potential impact scope"
)
</tool-use-template>

3. Use `mcp__codebase__ask` to investigate root causes with full paths
4. Report issues to user with analysis

### Step 3.3: Report Results

```
## Implementation Complete

### Objectives Accomplished
[OBJECTIVES]

### Tasks Executed
[TASKS] with completion status (✅ or ❌)

### Files Modified
[file paths from git diff]

### Validation Results
[VALIDATION_RESULTS] for each package in [AFFECTED_PACKAGES]:
- Typecheck: [✅ Pass | ❌ N errors]
- Tests: [✅ Pass | ❌ N failures]
- Lint: [✅ Pass | ❌ N issues]

[If failures exist, include error details and analysis]
```

## Important Notes

**Agent Context**: Agents invoked with Task() have no information about this conversation. Include all necessary context in each task prompt:
- Full file paths (not relative)
- Current state of relevant code
- Specific requirements and patterns
- Expected outcomes

**Task Independence**: Only use parallel execution when tasks are truly independent. When in doubt, use sequential.

**Validation**: All validation must pass. If tests/typecheck fail, investigate and report - do not ignore.

**Plan Fidelity**: Follow the plan's specified approach. If the plan has detailed implementation steps, use them. If uncertainties arise, investigate using codebase analysis tools before proceeding.
