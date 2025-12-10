---
description: Plan and implement development tasks with automatic validation
---

```!
mkdir -p projects/new projects/pending projects/active projects/ready-for-review projects/complete projects/icebox
```

<user-message>
$ARGUMENTS
</user-message>

Follow the `<instructions>` below to plan then implement the user's request. Do not skip instructions because the task is simple.

<input-format>
Extract from `<user-message>` or recent conversation:
- [REQUEST] = The development task or goal (required)
- [REQUIREMENTS] = Specific constraints, patterns to follow, or technical requirements (optional)
- [SCOPE_HINT] = Files, packages, or areas mentioned by user (optional)

Derived during execution:
- [PROJECT_NAME] = Semantic kebab-case name from [REQUEST]
- [PROJECT_DIR] = Project directory path
</input-format>

<operational-guidelines>
You should follow these guidelines throughout execution:

1. **Read before modifying** - Read and understand relevant files before proposing code edits. Do not speculate about code you have not inspected.

2. **Avoid over-engineering** - Only make changes that are directly requested or clearly necessary. Don't add features, refactor code, or make "improvements" beyond what was asked. Don't create helpers, utilities, or abstractions for one-time operations.

3. **Always dispatch tasks** - You should dispatch every implementation task to a opus subagent. Do not implement tasks directly using Edit/Write tools. This applies regardless of task simplicity.

4. **Use opus model** - All subagents should use `model="opus"`.

5. **Self-contained task prompts** - Agents have no conversation context. Include full paths, code snippets, patterns, and requirements in every task prompt.
</operational-guidelines>

<exploration>
Launch Explore subagents in parallel. Provide full paths.

```xml
<!-- PATTERN DISCOVERY -->
<invoke name="Task">
<parameter name="description">Discover patterns</parameter>
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">opus</parameter>
<parameter name="prompt">What existing patterns are used for [PROBLEM_AREA] in this codebase? Look for similar implementations, naming conventions, and architectural approaches.</parameter>
</invoke>

<!-- IMPACT ANALYSIS -->
<invoke name="Task">
<parameter name="description">Analyze impact</parameter>
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">opus</parameter>
<parameter name="prompt">What files and modules would be affected if [SCOPE_HINT] changes? Identify consumers, dependents, and integration points.</parameter>
</invoke>

<!-- TEST DISCOVERY -->
<invoke name="Task">
<parameter name="description">Discover tests</parameter>
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">opus</parameter>
<parameter name="prompt">What tests cover [SCOPE_HINT]? What test patterns does this codebase use?</parameter>
</invoke>

<!-- INTERFACE DISCOVERY -->
<invoke name="Task">
<parameter name="description">Discover interfaces</parameter>
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">opus</parameter>
<parameter name="prompt">What types, interfaces, and APIs does [SCOPE_HINT] expose or consume? What contracts must be preserved?</parameter>
</invoke>
```

**Dependency Analysis** (run in parallel with above):
```bash
print-dependencies [SCOPE_HINT_FILES]
print-inverse-dependencies [SCOPE_HINT_FILES]
print-type-analysis [SCOPE_HINT_FILES]
```
</exploration>

<instructions>
## Phase 1: Understand and Confirm

### Step 1.1: Explore Codebase

You should explore the codebase to understand the request:

1. **Launch exploration** - Follow `<exploration>` to discover patterns, impact, tests, and interfaces in parallel
2. **Extract learnings** - Document problem, patterns, constraints, scope, and test gaps
3. **Identify gaps** - Determine what remains unclear
4. **Iterate or proceed** - If gaps exist, launch another targeted round. Otherwise, proceed to Step 1.2.

You should only ask the user questions for major ambiguity that would lead to fundamentally different approaches. Defer minor clarifications to Step 1.5.

**Completion Criteria** - Proceed when you:
- Understand the problem and why it matters
- Know which files need changes and their dependencies
- Have identified patterns to follow
- Have no critical open questions

### Step 1.2: Initialize Project

You should generate a semantic kebab-case name (max 50 chars) and initialize the project:

```bash
PROJECT_DIR=$(`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/initialize-project "[PROJECT_NAME]") && echo "$PROJECT_DIR"
```

### Step 1.3: Create Implementation Plan

You should bake testing requirements into each task description:
- New features → "Write behavioral tests first, then implement"
- Bug fixes → "Write test that reproduces bug, then fix"
- Refactoring → "Verify test coverage, add tests if gaps, then refactor"
- Config/docs → "No behavioral tests needed"

You should group tasks by parallelization potential:
- **Can parallelize**: Different packages, no file overlap, no dependency conflicts
- **Must sequence**: Creates dependency, overlapping files, same feature area

### Step 1.4: Write Plan

You should write the plan using this template:

```xml
<invoke name="Write">
<parameter name="file_path">[PROJECT_DIR]/plan.md</parameter>
<parameter name="content"># Implementation Plan: [PROJECT_NAME]

## Problem
[What user pain or technical debt does this address?]

## Success Criteria
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]
- [ ] All tests pass
- [ ] Types check correctly

## Constraints
- [Pattern to follow]
- [Interface to preserve]
- [Dependency to respect]

## Out of Scope
- [Deferred to future work]

## Tasks

### Parallel Group 1

1. **[Task name]** - [testing requirement]
   - Rationale: [Why this task exists]
   - Files: [paths]
   - Parallel with: Task 2

### Sequential

2. **[Task name]** - [testing requirement]
   - Rationale: [Why this task exists]
   - Files: [paths]
   - Depends on: Task 1

## Validation Commands

### packages/[package-1]
- Type check: `cd packages/[package-1] && yarn typecheck`
- Test: `cd packages/[package-1] && yarn test`
- Lint: `cd packages/[package-1] && yarn lint`
</parameter>
</invoke>
```

### Step 1.5: Present to User

You should open the plan for user review:

```xml
<invoke name="mcp__plugin_vscode_vscode__open_files">
<parameter name="workspace_path">!`pwd`</parameter>
<parameter name="files">[{"filePath": "[PROJECT_DIR]/plan.md"}]</parameter>
</invoke>
```

You should ask: **"I've written the plan to `[PROJECT_DIR]/plan.md`. Does this look correct? Should I proceed with implementation?"**

You should wait for user confirmation before continuing to Phase 2.

## Phase 2: Execute Implementation

### Step 2.1: Move Project to Active

You should move the project to active status:

```bash
mv projects/new/[PROJECT_NAME] projects/active/ && echo "projects/active/[PROJECT_NAME]"
```

You should update [PROJECT_DIR] to `projects/active/[PROJECT_NAME]`.

### Step 2.2: Dispatch Tasks

You should dispatch every task to a opus subagent using the Task tool. Do not implement tasks directly—always dispatch, even for simple single-file changes.

Each task prompt should be self-contained with full file paths, code snippets, testing requirements, and discovered patterns.

**Task Prompt Template:**

```xml
<invoke name="Task">
<parameter name="description">[short-task-name]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">opus</parameter>
<parameter name="prompt"># Task: [Description with testing requirements]

## Context
[Why this task exists, what problem it solves]

## File Ownership
This task owns: [absolute paths]
Do not modify files outside this list.

## Constraints
[Patterns, interfaces, dependencies to respect]

## Requirements
1. [Requirement]
2. [Requirement]

## Patterns to Follow
[Code snippets showing conventions]

## Guidelines
- Read files before modifying them
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
- Parallel groups: You should launch all tasks in a single message
- Sequential tasks: You should wait for completion before launching the next task

### Step 2.3: Monitor Completion

You should track task outcomes and note any errors for the validation phase.

## Phase 3: Validate Results

### Step 3.1: Run Validation

You should run validation using a opus subagent:

```xml
<invoke name="Task">
<parameter name="description">Validate implementation</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">opus</parameter>
<parameter name="prompt"># Task: Validate Implementation

## Context
Project plan: @[PROJECT_DIR]/plan.md

## Status Definitions
- **PRODUCTION_READY**: All validation commands pass, no errors
- **CONTINUE**: Core works but has fixable issues (failing tests, type errors)
- **BLOCKED**: System-level impediment (disk full, missing infrastructure)

## Steps

1. Read `[PROJECT_DIR]/plan.md`, extract:
   - Success Criteria
   - Validation Commands
   - Tasks

2. Execute ALL validation commands:
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

### Step 3.2: Handle Results

You should handle results based on status:

**PRODUCTION_READY:**
- You should proceed to Step 3.3

**CONTINUE:**
1. You should review errors (file:line references)
2. You should fix issues (may require additional tasks)
3. You should re-run Step 3.1

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

### Step 3.3: Move Project to Ready for Review

If PRODUCTION_READY, you should move the project:

```bash
mv projects/active/[PROJECT_NAME] projects/ready-for-review/
```

Otherwise, you should keep the project in `projects/active/` until resolved.
</instructions>
