---
name: create-plan
description: Create an implementation plan for a development task
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
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

## Step 3: Structure Tasks for TDD

Each task is a self-contained unit executed by **one subagent** through all three phases sequentially:

| Phase | Deliverable | Validation |
|-------|-------------|------------|
| **1. Types & Stubs** | Interfaces, type aliases, function stubs that `throw new Error('Not Implemented')` | Typecheck passes |
| **2. Tests** | Tests using `it.skip` for expected behaviors | Tests run (all skipped) |
| **3. Implementation** | Working code, unskipped tests | Tests pass |

**Execution model:**
- One subagent executes all three phases for a task, adjusting as it learns
- Parallelization happens **across independent tasks**, not across phases
- Dependencies specify full task completion (all phases), not individual phases

**Task consolidation:**
- If types are used by **one** task → Include in that task's Phase 1
- If types are used by **multiple** tasks → Separate type-only task (Phase 1 only)

**Task categories:**
- New functions → All three phases in a single task
- Bug fixes → Phase 2 (reproduction test), then Phase 3 (fix + unskip)
- Refactoring → Phase 2 (coverage gaps), then Phase 3 (refactor + unskip)
- Shared types only → Phase 1 only

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

### Task 1: [Task name]
**Rationale:** [Why this task exists]
**Files:** [paths]

| Phase | Deliverable | Validation |
|-------|-------------|------------|
| Types & Stubs | Define `[InterfaceName]`; stub `[functionName]()` with `throw new Error('Not Implemented')` | typecheck |
| Tests | `it.skip`: [behavior 1], [behavior 2], [edge case] | tests run |
| Implementation | [Logic description] | tests pass |

**Dependencies:** None

### Task 2: [Task name]
**Rationale:** [Why this task exists]
**Files:** [paths]

| Phase | Deliverable | Validation |
|-------|-------------|------------|
| Types & Stubs | Define `[Type]`; stub methods with `throw new Error('Not Implemented')` | typecheck |
| Tests | `it.skip`: [behavior] | tests run |
| Implementation | [Logic description] | tests pass |

**Dependencies:** Task 1

## Validation Commands

### packages/[package-1]
- Type check: `cd packages/[package-1] && yarn typecheck`
- Test: `cd packages/[package-1] && yarn test`
- Lint: `cd packages/[package-1] && yarn lint`

## Exploration Summary
[Key patterns, constraints, and context discovered during exploration]

### Task Dependency Order
[Tasks in execution order based on dependencies]
1. Task 1: [Feature] - no dependencies (can run in parallel with Task 2)
2. Task 2: [Feature] - no dependencies (can run in parallel with Task 1)
3. Task 3: [Feature] - depends on Task 1
</parameter>
</invoke>
```

## Step 5: Review and Refine

You should launch a Plan subagent to critically evaluate the plan. The subagent has no conversation context—construct the prompt from your exploration findings and the plan you just wrote.

**What the reviewer needs:**

| Element | Why | Source |
|---------|-----|--------|
| Plan path and goal | Understand what's being evaluated | [PROJECT_DIR]/plan.md, [REQUEST] |
| User requirements | Constraints that cannot be removed or simplified | [REQUEST], [REQUIREMENTS] |
| Reference files | Compare approach against existing patterns | Files discovered in Step 1 |
| Specific questions | Focus evaluation on plan's actual structure | Task groups and dependencies from the plan |
| Domain concerns | Identify gaps specific to this problem | Technical considerations from exploration |

**Constructing the prompt:**

1. State the goal and list user requirements as fixed constraints (from [REQUEST] and [REQUIREMENTS])
2. List the reference files from exploration with brief descriptions of why each matters
3. Ask pointed questions about the plan's design decisions—task grouping, dependencies, implementation approach
4. List technical concerns relevant to this domain (not generic concerns)
5. Request feedback with file paths and line numbers

```xml
<invoke name="Task">
<parameter name="description">Review [PROJECT_NAME] plan</parameter>
<parameter name="subagent_type">Plan</parameter>
<parameter name="prompt"><task>
Critically evaluate the implementation plan at [FULL_PLAN_PATH]. This plan aims to [GOAL_FROM_REQUEST].

[EVALUATION_CRITERIA_DERIVED_FROM_EXPLORATION_AND_PLAN]

Provide specific, actionable feedback with references to file paths and line numbers. If you identify gaps, propose concrete additions.
</task>

<instructions>
Evaluate design decisions in this plan—task grouping, dependencies, implementation approach. User requirements are fixed constraints; do not recommend removing or simplifying them.

Conclude with:

## Assessment
[MAJOR_CHANGES | MINOR_CHANGES | READY]

## Recommendations
[Specific improvements, if any]
</instructions></parameter>
</invoke>
```

**Example evaluation criteria** (for a drag-drop parity plan):

```
1. **TDD Structure**: Does each task follow the complete TDD flow?
   - Types & Stubs: Are interfaces defined and stubs throwing `Error('Not Implemented')`?
   - Tests: Are `it.skip` tests specified for each expected behavior?
   - Implementation: Is the logic description sufficient for a single agent to complete?
   - Validation: Are typecheck/test gates specified?

2. **Task Independence**: Can tasks be executed by separate agents in parallel?
   - Are dependencies specified as full tasks (not individual phases)?
   - Are types consolidated with their implementation when used by only one task?

3. **Pattern Alignment**: Does the proposed pattern match existing code?
   - /workspace/packages/extension/src/providers/TreeDragAndDropController.ts

4. **Test Coverage**: Are these behaviors covered in Phase 2?
   - Happy path, error cases, edge cases
   - Cross-reference existing test patterns in the codebase
```

The criteria above are specific to that plan—yours should be specific to the plan you wrote.

**Interpreting the assessment:**

| Assessment | Action |
|------------|--------|
| READY | Proceed to Step 6 |
| MINOR_CHANGES | Apply changes that don't conflict with user requirements, proceed to Step 6 |
| MAJOR_CHANGES | Apply changes that don't conflict with user requirements, repeat evaluation |

**Revision cycle:**

After any major changes—whether from evaluation recommendations or user feedback—re-run the Plan subagent evaluation:
1. Read the current plan
2. Apply changes (from evaluation or user)
3. Write the revised plan to `[PROJECT_DIR]/plan.md`
4. Launch the Plan subagent again with the same prompt structure
5. Repeat until assessment is READY or MINOR_CHANGES

Do not iterate more than 3 times. If still receiving MAJOR_CHANGES after 3 cycles, proceed to Step 6 and note unresolved concerns in the summary.

## Step 6: Present to User

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
- Tasks: [N] tasks (each executed by one subagent through all phases)
- TDD flow: Types & Stubs → Tests (`it.skip`) → Implementation
- Files affected: [N]
- Review cycles: [N] ([final assessment])

### Next Steps
To implement this plan, run:
```
/goodfoot:implement-plan [PROJECT_DIR]/plan.md
```

Or review and modify the plan first, then run the implement command.
```

Do not proceed to implementation. The plan is complete.
</instructions>
