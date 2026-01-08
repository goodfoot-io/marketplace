---
description: Create an implementation plan for a development task
disable-model-invocation: true
---

```!
mkdir -p projects/new projects/pending projects/active projects/ready-for-review projects/complete projects/icebox
```

<user-message>
$ARGUMENTS
</user-message>

```!
"${CLAUDE_PLUGIN_ROOT}"/bin/analyze-typescript-files << 'EOF'
$ARGUMENTS
EOF
```

Follow the `<instructions>` below to create an implementation plan for the user's request. Do not skip instructions because the task is simple.

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

1. **Read before planning** - Read and understand relevant files before proposing changes. Do not speculate about code you have not inspected.

2. **Avoid over-engineering** - Only plan changes that are directly requested or clearly necessary. Don't add features, refactor code, or make "improvements" beyond what was asked.

3. **Use haiku model** - All exploration subagents should use `model="haiku"`.

4. **Self-contained exploration prompts** - Exploration agents have no conversation context. Include full paths and specific questions in every prompt.
</operational-guidelines>

<exploration>
Launch Explore subagents in parallel. Provide full paths.

```xml
<!-- PATTERN DISCOVERY -->
<invoke name="Task">
<parameter name="description">Discover patterns</parameter>
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">What existing patterns are used for [PROBLEM_AREA] in this codebase? Look for similar implementations, naming conventions, and architectural approaches.</parameter>
</invoke>

<!-- IMPACT ANALYSIS -->
<invoke name="Task">
<parameter name="description">Analyze impact</parameter>
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">What files and modules would be affected if [SCOPE_HINT] changes? Identify consumers, dependents, and integration points.</parameter>
</invoke>

<!-- TEST DISCOVERY -->
<invoke name="Task">
<parameter name="description">Discover tests</parameter>
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">What tests cover [SCOPE_HINT]? What test patterns does this codebase use?</parameter>
</invoke>

<!-- INTERFACE DISCOVERY -->
<invoke name="Task">
<parameter name="description">Discover interfaces</parameter>
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">What types, interfaces, and APIs does [SCOPE_HINT] expose or consume? What contracts must be preserved?</parameter>
</invoke>
```

**Dependency Analysis** (run in parallel with above):
```bash
!` echo "${CLAUDE_PLUGIN_ROOT}"`/bin/print-dependencies [SCOPE_HINT_FILES]
!` echo "${CLAUDE_PLUGIN_ROOT}"`/bin/print-inverse-dependencies [SCOPE_HINT_FILES]
!` echo "${CLAUDE_PLUGIN_ROOT}"`/bin/print-type-analysis [SCOPE_HINT_FILES]
```
</exploration>

<instructions>
## Step 1: Explore Codebase

You should explore the codebase to understand the request:

1. **Launch exploration** - Follow `<exploration>` to discover patterns, impact, tests, and interfaces in parallel
2. **Extract learnings** - Document problem, patterns, constraints, scope, and test gaps
3. **Identify gaps** - Determine what remains unclear
4. **Iterate or proceed** - If gaps exist, launch another targeted round. Otherwise, proceed to Step 2.

You should only ask the user questions for major ambiguity that would lead to fundamentally different approaches. Defer minor clarifications to Step 5 when presenting the plan.

**Completion Criteria** - Proceed when you:
- Understand the problem and why it matters
- Know which files need changes and their dependencies
- Have identified patterns to follow
- Have no critical open questions

## Step 2: Initialize Project

You should generate a semantic kebab-case name (max 50 chars) and initialize the project:

```bash
PROJECT_DIR=$(!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/initialize-project "[PROJECT_NAME]") && echo "$PROJECT_DIR"
```

## Step 3: Create Implementation Plan

You should bake testing requirements into each task description:
- New features → "Write behavioral tests first, then implement"
- Bug fixes → "Write test that reproduces bug, then fix"
- Refactoring → "Verify test coverage, add tests if gaps, then refactor"
- Config/docs → "No behavioral tests needed"

You should group tasks by parallelization potential:
- **Can parallelize**: Different packages, no file overlap, no dependency conflicts
- **Must sequence**: Creates dependency, overlapping files, same feature area

## Step 4: Write Plan

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

## Exploration Summary
[Key patterns, constraints, and context discovered during exploration that implementers need to know]
</parameter>
</invoke>
```

## Step 5: Present to User

You should open the plan for user review:

```xml
<invoke name="mcp__plugin_vscode_vscode__open_files">
<parameter name="workspace_path">!`pwd`</parameter>
<parameter name="files">[{"filePath": "[PROJECT_DIR]/plan.md"}]</parameter>
</invoke>
```

You should report:

```
## Plan Created

Plan location: `[PROJECT_DIR]/plan.md`

### Summary
- Problem: [one sentence]
- Tasks: [N] tasks ([N] parallel, [N] sequential)
- Files affected: [N]

### Next Steps
To implement this plan, run:
```
/goodfoot:implement-plan [PROJECT_DIR]/plan.md
```

Or review and modify the plan first, then run the implement command.
```

Do not proceed to implementation. The plan is complete.
</instructions>
