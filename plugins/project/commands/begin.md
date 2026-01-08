---
description: Simplified orchestration focused on coordination over complex validation
disable-model-invocation: true
---

<user-message>
```!
mkdir -p projects/new projects/pending projects/active projects/ready-for-review projects/complete projects/icebox
# Use write-arguments utility to synchronize user arguments
"${CLAUDE_PLUGIN_ROOT}"/bin/write-arguments "$ARGUMENTS"
```
</user-message>

<narrative-output-style>
Throughout all phases, document your analysis and decision-making in natural technical prose as you work.
This is not a post-hoc summary but real-time documentation of your thought process.

Your narrative should flow naturally with your work, providing transparency into:
- What you discover as you read each file
- How findings connect to form patterns
- Why certain decisions follow from the evidence
- Which trade-offs you're considering in real-time

</narrative-output-style>

<orchestrator-role>

## Orchestrator Role

CRITICAL: The orchestrator ONLY coordinates - it does NOT implement.

### Direct Fixes
- Syntax errors visible in error output
- Import statement corrections (e.g., missing .js extensions)
- Config file typos
- Test setup/polyfills

### Delegated Tasks
- New features
- Business logic changes
- Complex debugging
- Multi-file refactoring
- Anything requiring investigation
- Library integrations
- API changes
- Database modifications
- ANY user feature requests
- Validation issues (linting, type checking, testing) beyond trivial syntax errors

### Golden Rule
If the user asks you to implement something → Create todo → Delegate to project:implementer
Never use Read/Write/Edit/MultiEdit for feature implementation.
Only use TodoWrite and Task tools for coordination.

### Investigation Before Delegation

When validation discovers linting, type checking, or testing issues:

1. Run validation to get specific errors
2. Investigate root cause using appropriate tools (see tool selection below)
3. Create todo with investigation findings
4. Delegate to project:implementer with root cause context

**Tool selection for investigation:**

| Investigation Type | Tool | Why |
|-------------------|------|-----|
| Find files by name/pattern | `Explore` agent (haiku) or `Glob` | Simple location, minimal context |
| List directory contents | `Explore` agent (haiku) | Quick discovery |
| Type error root cause | `mcp__plugin_vscode_codebase__ask` | Needs LSP type definitions |
| Test failure analysis | `mcp__plugin_vscode_codebase__ask` | Needs code flow tracing |
| Dependency/impact analysis | `mcp__plugin_vscode_codebase__ask` | Needs reference tracing |
| Understanding how code works | `mcp__plugin_vscode_codebase__ask` | Deep analysis required |

**Important**: Neither Explore agent nor `mcp__plugin_vscode_codebase__ask` have conversation context. Include FULL paths in every invocation.

Issues requiring investigation and delegation:
- Skipped tests (investigate why they're skipped, delegate fix)
- Integration errors (investigate dependencies, delegate resolution)
- Uncaught regressions (investigate when introduced, delegate fix)
- Type errors beyond missing imports
- Test failures and timeouts
- Lint errors requiring logic changes

### Examples

Fix Directly:
```typescript
// Error: Missing import extension
import { foo } from './bar';  // ❌
import { foo } from './bar.js';  // ✅ Just fix it

// Error: Cannot find module 'jest-preset'
setupFiles: ['jest'] // ❌
setupFiles: ['jest-preset'] // ✅ Just fix it
```

Investigate Then Delegate:
```typescript
// Test failing with "Expected 5 got undefined"
// → Investigate: Why is the value undefined? Check function logic, data flow
// → Delegate to project:implementer with root cause

// "Connection pool exhausted"
// → Investigate: Where are connections opened? Are they closed properly?
// → Delegate to project:implementer with findings

// TypeScript error TS2322: Type 'X' is not assignable to type 'Y'
// → Investigate: What are types X and Y? Where's the mismatch?
// → Delegate to project:implementer with type analysis

// 5 tests skipped in auth.test.ts
// → Investigate: Why are they skipped? What do they test?
// → Delegate to project:implementer to enable and fix
```

### Delegation Protocol

If investigation is needed, do it first:

```xml
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">TypeScript error TS2322 at packages/api/src/auth.ts:45: 'Type X not assignable to Y'. Show BOTH type definitions and explain the mismatch.</parameter>
</invoke>
```

// Then: Include findings in delegation

```xml
<!-- Get project path and name for delegation -->
<invoke name="Task">
<parameter name="description">Fix type mismatch</parameter>
<parameter name="subagent_type">project:implementer</parameter>
<parameter name="prompt">
Name: [PROJECT_NAME]
Directory: @[PROJECT_PATH]
Plan: @[PROJECT_PATH]/plan.md
Log: @[PROJECT_PATH]/log.md

## Issue
[Error details from validation]

## Root Cause (from investigation)
[Include codebase tool findings]

## Checkpoint
SHA: [CHECKPOINT_SHA]

## Requirements
Fix and validate with zero errors.
</parameter>
</invoke>
```
</orchestrator-role>

<implementation-philosophy>

## 🛑 ZERO-TOLERANCE TEST POLICY (NON-NEGOTIABLE)

Every test failure is a production failure. No exceptions.

### These rationalizations are NEVER acceptable:
- ❌ "Only the new test is failing" → New test proves new code is broken
- ❌ "It's a WebSocket/connection issue" → Production will have same issue
- ❌ "Tests timeout in the environment" → Code has cleanup/leak problems
- ❌ "Unrelated tests are failing" → Your changes broke something
- ❌ "It works locally" → Must work in CI/test environment too
- ❌ "The test is flaky" → Flaky = race condition that will crash production
- ❌ "It's a pre-existing issue" → Pre-existing issues MUST be fixed
- ❌ "E2E failures are environmental" → E2E failures ARE implementation bugs
- ❌ "E2E tests can be ignored if unit tests pass" → ALL tests must pass

### The only acceptable state: ALL tests pass, ZERO errors

### Fix-First Mandate
1. Attempt fixes in this order:
   - Direct code fixes (missing imports, type errors)
   - Test infrastructure fixes (connection pools, timeouts)
   - Environment fixes (dependencies, configurations)
2. Only mark as BLOCKED after:
   - Fix attempts fail after 2 iterations
   - Issue requires external dependencies not in project
   - Issue requires permissions unavailable
3. Never skip pre-existing issues - They block production readiness

Testing Context:
- 🚫 Mocks blocked by pretooluse hook - use real dependencies only
- Pre-production system - no migrations, no compatibility layers
- Test failures = automatic checkpoint reversion (no override)

Implementation Definition: Every implementation task includes comprehensive behavioral tests as an inseparable part of the work. Tests are not separate work - they prove implementation is correct.

When this orchestrator encounters plan items about testing, it interprets them as already included in the implementation task - never create separate todos for tests.
</implementation-philosophy>

<seriously-do-not-use-mocks>
Most development errors in this project come from improper use of mocks. If mocks are causing issues, try to re-implement the tests without mocks. Avoid mocks at all costs.
</seriously-do-not-use-mocks>

<failure-analysis-procedure>
## Failure Analysis Procedure

**When to use:**
- Implementation task returns NEEDS_REVISION status
- Validation reveals errors after implementation
- Test failures occur without clear cause
- Type errors require deeper investigation
- Errors have increased (regression detected)
- Multiple attempts have failed and you need deeper analysis

**How to use:**

Load the failure analysis skill and follow the procedure:

```xml
<invoke name="Skill">
<parameter name="skill">project:failure-analysis</parameter>
</invoke>
```

The skill will guide you through:
1. Invoking general-purpose agent with systematic analysis steps
2. Running validation commands and categorizing failures
3. Identifying root causes, anti-patterns, and working patterns
4. Generating comprehensive failure analysis report
5. Reading and extracting findings from the report
6. Appending analysis to project log.md
7. Updating todo descriptions with failure insights
</failure-analysis-procedure>


<task-prompt-template>
## Task Prompt Template

Use this template for all Task delegations to project:implementer:

```xml
<invoke name="Task">
<parameter name="description">[Task description from todo]</parameter>
<parameter name="subagent_type">project:implementer</parameter>
<parameter name="prompt">
Name: [PROJECT_NAME]
Path: [PROJECT_PATH]
Plan: @[PROJECT_PATH]/plan.md
Log: @[PROJECT_PATH]/log.md

## Implementation Objective
[Specific feature or component to implement with behavioral tests]

## Checkpoint Reference
Task checkpoint SHA: [TASK_CHECKPOINT]

## Validation Requirement (ZERO-TOLERANCE)
⚠️ ANY test failure = task fails. No exceptions.
Run ALL commands from plan.md Validation Commands section
If no Validation Commands in plan: run typecheck, test, AND lint
Required: ZERO errors from ALL validation commands
Current baseline: [BASELINE_ERRORS] errors, [BASELINE_FAILURES] test failures

## Investigation-to-Action Protocol
When codebase analysis identifies issues:
1. Create fix task immediately using TodoWrite
2. Document root cause and fix attempts in log
3. Only mark BLOCKED after 2 fix iterations fail

This completes todo: [todo-id]
</parameter>
</invoke>
```
</task-prompt-template>

<validation-discovery-pipeline>
## Validation-Discovery Pipeline

A unified pattern that combines validation execution with automatic discovery when failures occur.

### Stage 1: Read Validation Commands
First: Read @!`PROJECT_PATH=$(wait-for-project-name 2); if [ -n "$PROJECT_PATH" ]; then echo "$PROJECT_PATH/plan.md"; else echo "[PROJECT_PATH]/plan.md"; fi` to get Validation Commands section

### Stage 2: Execute Validation
Execute EVERY command listed under Validation Commands section.

If no Validation Commands section exists, use defaults:
```bash
cd packages/[PACKAGE_NAME] && yarn typecheck 2>&1
cd packages/[PACKAGE_NAME] && yarn test 2>&1
cd packages/[PACKAGE_NAME] && yarn lint 2>&1
```

### Stage 3: Process Results

**SUCCESS PATH**
✅ All validations passed:
- Zero errors from every validation command
- No test failures
- Return success status
- Stop pipeline here

**FAILURE PATH**
❌ Validation failed:
- Continue to Stage 4 for discovery

### Stage 4: Error Discovery (Only on failure)

Capture from output:
- Error codes (TS2322, TS2554, etc.)
- EXACT file:line:column locations
- Complete error messages (copy them exactly)
- Test suite and test case names
- Any "open handles" or timeout warnings

### Stage 5: Deep Analysis (Only when errors discovered)

**Tool selection for error analysis:**
- Use `mcp__plugin_vscode_codebase__ask` for type errors, test failures, and implementation verification (requires LSP, code tracing)
- Use `Explore` agent (haiku) only for simple file location queries

⚠️ **CRITICAL**: Neither tool has conversation context. Include FULL paths in EVERY question.

Execute parallel analysis for discovered errors:

```xml
<!-- Type error analysis - requires LSP type definitions -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">TypeScript error TS2322 at packages/api/src/auth/handler.ts:45:8: 'Type User not assignable to AuthUser'. Show BOTH complete type definitions from their source files, highlight EVERY property difference, and provide 3 different ways to fix this with code examples.</parameter>
</invoke>

<!-- Function signature analysis - requires code tracing -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">TypeScript error TS2554 at packages/api/src/services/user.ts:89:15: 'Expected 2 arguments but got 1'. Show the complete function signature, the exact call site with surrounding context, identify what the missing argument should be, and show the corrected code.</parameter>
</invoke>

<!-- Test failure analysis - requires async flow tracing -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">Test 'Authentication › should validate token' timing out in packages/api/tests/auth.test.ts. Show the COMPLETE test code, trace ALL async operations, check for missing awaits or unresolved promises, and identify why it's not completing.</parameter>
</invoke>

<!-- Implementation verification - requires code comparison -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">Does packages/api/src/services/user.ts implement ALL requirements from plan.md section 2.1? Show the actual implementation code and compare with each requirement.</parameter>
</invoke>

<!-- Simple file location - use Explore agent when you need to find related files -->
<invoke name="Task">
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">Find all test files related to authentication in packages/api/tests/ and packages/api/src/**/*.test.ts</parameter>
</invoke>

<!-- Simple file location - find where a module is exported from -->
<invoke name="Task">
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">Where is the AuthUser type exported from in packages/api/src/? List all files that define or re-export AuthUser.</parameter>
</invoke>
```

### Stage 6: Delegate Resolution (When non-trivial errors discovered)

After deep analysis, delegate to project:implementer unless the fix is trivial:

**Delegate these issues:**
- Type errors requiring logic changes
- Test failures and timeouts
- Skipped tests needing enablement
- Integration errors between components
- Lint errors requiring refactoring

**Fix directly only:**
- Missing import extensions (.js)
- Simple config typos
- Obvious syntax errors

Use the delegation protocol from `<orchestrator-role>` section with investigation findings.

### Success Criteria

✅ **Pipeline succeeds when:**
- Executed ALL commands from plan.md Validation Commands section
- Zero errors from every validation command
- No skipped commands (typecheck, test, lint all required)
- No command timeouts

❌ **Pipeline fails and continues to discovery when:**
- ANY Validation Commands report errors
- Validation regression detected (errors increased from baseline)
- Test failures present or increased
- Commands timeout (hanging tests = code bug)
</validation-discovery-pipeline>

<execution-strategy-rules>
## Execution Strategy Rules

### DEFAULT: SEQUENTIAL EXECUTION
ALL TASKS EXECUTE SEQUENTIALLY unless they meet strict independence criteria.

### Sequential Execution (Default)
Use for:
- Any task that creates something another task uses
- Any task modifying shared code, types, or models
- Any task where you're unsure about dependencies
- Tasks from the same plan section or feature area

### Parallel Execution (RARE EXCEPTION)
Requires ALL conditions:
- Completely different packages with zero shared imports
- No overlapping files (verify: git diff --name-only shows no conflicts)

### Package Locking
- Only one agent per package at a time
- If packages import from each other → Sequential required

### Examples
**SAFE parallel tasks (rare):**
- "Style landing page footer" + "Add debug logging"
- "Update README.md" + "Add LICENSE file"

**UNSAFE parallel (NEVER do this):**
- "Create UserModel" + "Implement UserService"
- "Define API types" + "Implement API handlers"
- Any numbered sequence from plan (2.1, 2.2, 2.3)
</execution-strategy-rules>



<instructions>
```!
# Wait for arguments to be available
ARGS=$("${CLAUDE_PLUGIN_ROOT}"/bin/wait-for-arguments)

# Select project based on arguments or find the oldest eligible one
SELECTED_PROJECT=$("${CLAUDE_PLUGIN_ROOT}"/bin/get-next-project)

# Wait for project selection to complete
PROJECT_PATH=$("${CLAUDE_PLUGIN_ROOT}"/bin/wait-for-project-name 2)

if [ -z "$PROJECT_PATH" ]; then
    NO_PROJECT_FOUND=true
else
    NO_PROJECT_FOUND=false
fi

if [ "$NO_PROJECT_FOUND" = "false" ]; then

    # Extract just the project name for use in prompts
    PROJECT_NAME=$(basename "$PROJECT_PATH")

    # Define BACKTICK for use in markdown code blocks
    BACKTICK='`'

    # Activate the selected project
    ACTIVE_PROJECT=$("${CLAUDE_PLUGIN_ROOT}"/bin/activate-project "$PROJECT_PATH")
    if [ -z "$ACTIVE_PROJECT" ]; then
        echo "Error: Failed to activate project $PROJECT_PATH" >&2
        exit 0
    fi

    # Update PROJECT_PATH to the active location
    PROJECT_PATH="$ACTIVE_PROJECT"

    # Update IPC state so subsequent wait-for-project-name calls get the correct path
    "${CLAUDE_PLUGIN_ROOT}"/bin/update-project-path "$PROJECT_PATH" >/dev/null 2>&1

    echo "## Phase 1: Initialize Project"
    echo ""
    echo "Name: $PROJECT_NAME"
    echo "Path: $PROJECT_PATH"
    echo "Plan: @$PROJECT_PATH/plan.md"
    echo "Log: @$PROJECT_PATH/log.md"
    echo ""
    echo "**Note**: Scratchpad artifacts from planning are at \`$PROJECT_PATH/scratchpad/\`. Plans use \`[PROJECT_PATH]\` as a placeholder - substitute with the actual project path above."
    echo ""
else
    # Define BACKTICK for use in markdown code blocks
    BACKTICK='`'

    echo "## Phase 1: Select Project"
    echo ""
    echo "Available projects:"
    # Enable nullglob to handle empty directories without errors
    setopt nullglob 2>/dev/null || true
    for dir in projects/pending projects/active projects/ready-for-review; do
        if [ -d "$dir" ]; then
            for project in "$dir"/*; do
                if [ -d "$project" ]; then
                    echo "- $project"
                fi
            done
        fi
    done
    # Restore default glob behavior
    unsetopt nullglob 2>/dev/null || true
    echo ""
    echo "Ask the user which project they'd like to work on."
    echo ""
    echo "When they respond, use:"
    echo '`"${CLAUDE_PLUGIN_ROOT}"/bin/activate-project-with-args "[FULL USER RESPONSE]"`'
fi
```

## Phase 2: Verify Session State

Check for partially completed work without recent evaluation.

If the project has been activated and contains implementation work:

2.1. Read log.md to check for recent evaluation reports
2.2. Look for Implementation Summaries but no corresponding Evaluation Report in the latest iteration
2.3. If implementation work exists without recent evaluation (indicating possible session disruption), proceed directly to Phase 8 for evaluation (skip refactoring for session recovery)
2.4. After evaluation completes, return to Phase 3

## Phase 3: Determine Next Work

### 3.1: Assess Current State

First, run the `<validation-discovery-pipeline>` to understand the current state of the codebase. This will:
- Execute all validation commands
- If errors exist, automatically perform deep analysis to identify root causes
- Provide insights that must inform task prioritization

Then read the project files to understand current state:

**3.1.1. Read log.md to catalog:**
- Implementation Summaries with "Status: COMPLETED" (what was successfully built)
- NEEDS_REVISION entries and their discoveries (what needs refinement)
- Latest Evaluation Report (what quality issues exist)
- Files Created/Modified sections (what artifacts exist)
- Previous revision attempts and their history

**3.1.2. Read plan.md to identify:**
- All required features and objectives
- Expected deliverables
- Success criteria

**3.1.3. Consider any user input as additional context:**
- Feature requests or modifications
- Bug reports or issues
- Changes to requirements
- Refinements to existing work

**3.1.4. Determine the implementation priorities:**

3.1.4.1. Quality issues first (zero-tolerance test policy):
         - ANY test failures must be fixed immediately
         - TypeScript errors take precedence
         - Lint issues should be addressed
         - For non-trivial issues: investigate root cause then delegate to project:implementer

3.1.4.2. Then address work from all sources:
         - User requests (new or modified requirements)
         - Plan requirements not yet implemented
         - NEEDS_REVISION items with discovery context
         - Quality improvements from evaluation

### 3.2: Generate Work Items

Core Principle: All work becomes todos, treated equally in Phase 4.

Work comes from four equal sources:

1. **Plan requirements** - Unimplemented features from plan.md
2. **Quality issues** - Errors/failures from evaluation or validation
3. **User input** - Feature requests, bug reports, modifications
4. **Revision items** - Failed tasks with new discovery context

#### Converting Work to Todos

**From plan.md requirements:**
- "Implement X" → Todo: "Complete X with behavioral tests (include test setup if first task)"
- "Test X" → Skip (tests included in implementation)
- "Create tests for X" → Skip (tests included in implementation)

**From user input:**
- "Fix the auth bug" → Todo: "Fix authentication bug with regression tests"
- "Add rate limiting" → Todo: "Implement rate limiting with behavioral tests"
- "Change X to use Y" → Todo: "Refactor X to use Y with tests"
- Convert immediately when received, don't wait

**From quality issues (validation failures):**
- TypeScript error (non-trivial) → Todo: "Investigate and fix TS2322 error in auth.ts:45"
- Test failure → Todo: "Investigate and fix failing user service test"
- Skipped tests → Todo: "Investigate why tests are skipped, enable and fix them"
- Integration error → Todo: "Investigate integration error between X and Y, fix root cause"
- Lint error (requires logic change) → Todo: "Investigate and resolve lint error in handler.ts"
- Group related issues when logical

**From NEEDS_REVISION items:**
- Include discovery context in todo
- Reference previous attempt learnings
- Set status to "pending" for retry

The first implementation task MUST include any necessary test setup.
Only create separate test todos when explicitly stated in plan.md for:
- Retrofitting tests to existing untested code (not new implementations)
- Specialized performance/load testing requiring external tools

Direct fixes (skip todo creation):
- Syntax errors with obvious fix
- Import path corrections (missing .js extension)
- Config typos

Everything else → Todo → Investigation (if needed) → Delegation to project:implementer

<example>
```xml
<invoke name="TodoWrite">
<parameter name="todos">
[
  // Sequential tasks from plan - DO NOT PARALLELIZE
  {
    "content": "Create user model and types in packages/shared [Plan 2.1]",
    "status": "pending",
    "activeForm": "Creating user model and types"
  },
  {
    "content": "Implement user service with model from 2.1 [Plan 2.2 - REQUIRES 2.1]",
    "status": "pending",
    "activeForm": "Implementing user service"
  },
  // Quality issues requiring investigation and delegation
  {
    "content": "Investigate and fix 5 skipped tests in auth.test.ts",
    "status": "pending",
    "activeForm": "Investigating skipped auth tests"
  },
  {
    "content": "Investigate type error TS2322 in user.ts:89, delegate fix",
    "status": "pending",
    "activeForm": "Investigating type error"
  },
  // Independent tasks - RARE parallel candidates
  {
    "content": "Add footer styling to packages/ui [Plan 5.1 - INDEPENDENT]",
    "status": "pending",
    "activeForm": "Adding footer styling"
  },
  {
    "content": "Configure logging in packages/logger [Plan 6.1 - INDEPENDENT]",
    "status": "pending",
    "activeForm": "Configuring logging"
  }
]
</parameter>
</invoke>
```
</example>

All todos flow through the same Phase 4-6 execution pipeline with:
- Checkpointing before execution
- Investigation for non-trivial validation issues
- Delegation to project:implementer
- Validation with zero-tolerance policy
- Unified recovery mechanisms in Phase 6
- Up to 4 total attempts (3 normal, then blocked)

## Phase 4: Prepare Implementation

### 4.1: Initialize Checkpointing

Create a base checkpoint before any implementation work:

```bash
git add -A
git commit -m "$(cat <<'EOF'
checkpoint: [PROJECT_NAME] iteration start

Project: [PROJECT_NAME]
State: Beginning new implementation iteration
Pending tasks: [NUMBER_OF_TODOS] items from plan.md

This checkpoint preserves the baseline before any code changes.
If implementation encounters issues, we can return to this known-good state.
EOF
)"
# Store BASE_CHECKPOINT SHA
```

### 4.2: Choose Execution Strategy

Refer to `<execution-strategy-rules>` to determine sequential vs parallel execution.

## Phase 5: Execute and Validate

⚠️ REMINDER: Zero-tolerance test policy is active. ANY test failure triggers Phase 6 recovery.

Choose ONE of the following execution strategies based on task dependencies:

### 5.1: Execute Sequential Tasks (DEFAULT)

Create checkpoint before each task:

```bash
git commit -m "$(cat <<'EOF'
checkpoint: before [TASK_DESCRIPTION]

Project: [PROJECT_NAME]
Next task: [TASK_DESCRIPTION]
Progress: [COMPLETED_COUNT] of [TOTAL_COUNT] tasks complete

Previous work is stable and validated. This checkpoint captures that state
before attempting the next task, enabling rollback if needed.
EOF
)"
# Store TASK_CHECKPOINT SHA
```

Capture baseline metrics from all plan packages (typecheck errors, test failures, E2E failures).

**For quality issue todos (investigation required):**
1. Mark todo as in_progress
2. Execute investigation using codebase analysis tools (Stage 5 from validation-discovery-pipeline)
3. Document findings
4. Launch delegation task to project:implementer using `<task-prompt-template>` with investigation results
5. Proceed to validation after implementer completes

**For feature/implementation todos:**
1. Launch task directly using `<task-prompt-template>`

After task completes:

**5.1.1. Check task status:**
- If Status: COMPLETED → Proceed to validation
- If Status: NEEDS_REVISION or BLOCKED → Skip validation, go to Phase 6
- If Task returns `<error>` block → Skip validation, go to Phase 6

**5.1.2. Validate the implementation** (for COMPLETED status only):
Execute `<validation-discovery-pipeline>`. The pipeline will automatically:
- Run validation (Stages 1-3)
- If errors found, continue to discovery and analysis (Stages 4-5)
- Provide deep insights for recovery if validation fails

**5.1.3. Process validation results:**

✅ **SUCCESS PATH** - COMPLETED + ALL validations pass:
- Commit using heredoc:
  ```bash
  git commit -m "$(cat <<'EOF'
completed: [TASK_DESCRIPTION]

Project: [PROJECT_NAME]
Task: [TASK_DESCRIPTION]

[BRIEF_SUMMARY_OF_WHAT_WAS_IMPLEMENTED]

Validation: All type checks, tests, and linting passed with zero errors.
Progress: [COMPLETED_COUNT] of [TOTAL_COUNT] tasks now complete.
EOF
)"
  ```
- Mark todo as completed in TodoWrite
- If more todos remain → Continue to next todo
- If no more todos remain → Proceed to Phase 7 (Refactor)

❌ **FAILURE PATH** - Any validation failure:
- Use Stage 5-6 analysis results to understand root causes
- If non-trivial errors discovered, create investigation and delegation todos
- Proceed to Phase 6 for recovery with these insights

### 5.2: Execute Parallel Tasks (EXCEPTION - rare cases only)

Verify independence using `<execution-strategy-rules>`.

Create single checkpoint for batch:

```bash
git commit -m "$(cat <<'EOF'
checkpoint: before parallel batch

Project: [PROJECT_NAME]
Parallel tasks: [LIST_TASK_DESCRIPTIONS]

These tasks have no shared dependencies and will execute concurrently.
This checkpoint preserves the current state so we can isolate any issues
that arise during parallel execution.
EOF
)"
# Store BATCH_CHECKPOINT SHA
```

Capture baseline metrics from all plan packages.

Launch all parallel tasks together using `<task-prompt-template>` for each task in a single message.

After all parallel tasks complete:

**5.2.1. Check all task statuses:**
- If ALL report Status: COMPLETED → Proceed to batch validation
- If ANY report NEEDS_REVISION/BLOCKED → Skip validation, go to Phase 6
- If ANY return `<error>` block → Skip validation, go to Phase 6

**5.2.2. Validate the entire batch** (only if all COMPLETED):
Execute `<validation-discovery-pipeline>` for all affected packages. The pipeline will:
- Run validation across all packages (Stages 1-3)
- If errors found in any package, continue to discovery and analysis (Stages 4-6)
- Provide deep insights and delegation for recovery if validation fails

**5.2.3. Process batch validation results:**

✅ **SUCCESS PATH** - All COMPLETED + ALL validations pass (pipeline stops at Stage 3):
- Commit batch using heredoc:
  ```bash
  git commit -m "$(cat <<'EOF'
completed: parallel batch

Project: [PROJECT_NAME]
Tasks completed:
- [TASK_1_DESCRIPTION]: [BRIEF_SUMMARY_1]
- [TASK_2_DESCRIPTION]: [BRIEF_SUMMARY_2]

All parallel tasks succeeded independently. Cross-package validation
confirmed no integration issues between the concurrent changes.

Validation: All type checks, tests, and linting passed with zero errors.
Progress: [COMPLETED_COUNT] of [TOTAL_COUNT] tasks now complete.
EOF
)"
  ```
- Mark all todos as completed in TodoWrite
- If more todos/batches remain → Continue to next batch/todo
- If no more todos remain → Proceed to Phase 7 (Refactor)

❌ **FAILURE PATH** - Any validation regression (pipeline continues through Stage 6):
- Use Stage 5-6 analysis to identify which tasks in the batch caused issues
- Create investigation and delegation todos for non-trivial errors
- Proceed to Phase 6 for recovery with root cause insights

## Phase 6: Recovery and Resolution

This phase handles ALL failure recovery with a progressive escalation strategy.

### 6.1: Analyze Failure

If not already done in Phase 5, the `<validation-discovery-pipeline>` should have provided Stage 5 analysis results. If additional analysis is needed:
- Execute `<failure-analysis-procedure>` for deeper investigation
- Use Stage 5 insights from the pipeline to inform recovery strategy

### 6.2: Progressive Recovery Strategy

Track attempt number for current task (starts at 1):

**Attempts 1-3: Standard Recovery**
1. Document learnings in log.md
2. Update todo with discoveries and root cause:
   ```xml
   <invoke name="TodoWrite">
   <parameter name="todos">
   [
     {
       "content": "Original task [ATTEMPT [N+1] - Root cause: [summary]]",
       "status": "in_progress",
       "activeForm": "Retrying task with root cause insights"
     }
   ]
   </parameter>
   </invoke>
   ```
3. Revert to checkpoint:
   ```bash
   git reset --hard $TASK_CHECKPOINT
   git clean -fd
   ```
4. Return to Phase 5 with enhanced context from pipeline analysis:
   ```
   ## Retry Attempt [N+1] of 4
   ### Root Cause from Analysis
   [Key findings from failure analysis]

   ### AVOID
   [Anti-patterns discovered]

   ### USE INSTEAD
   [Recommended patterns from analysis]
   ```

**Attempt 4: Mark as BLOCKED**
1. Update todo status:
   ```xml
   <invoke name="TodoWrite">
   <parameter name="todos">
   [
     {
       "content": "Original task [BLOCKED after 4 attempts]",
       "status": "in_progress",
       "activeForm": "Blocked - requires external intervention"
     }
   ]
   </parameter>
   </invoke>
   ```
2. Document blocking reasons in log.md
3. Preserve checkpoint for manual intervention
4. Proceed to Phase 7 (Refactor) or next todo if others exist

### 6.3: Update Project State

After each recovery attempt (regardless of outcome):
1. Append failure analysis to log.md
2. Update todo descriptions with attempt history
3. Document patterns that worked vs failed

### 6.4: Determine Next Action

Based on recovery outcome:
- **Success after retry** → Return to Phase 5 for next todo
- **Still failing (attempts < 4)** → Loop back to 6.2 for next attempt
- **Blocked (attempt 4)** → Proceed to Phase 7 for refactoring, then Phase 8 for evaluation

## Phase 7: Refactor

After all todos complete (or are blocked), perform plan-aware refactoring to improve code quality before final evaluation.

### 7.1: Pre-Refactoring Validation

Ensure the codebase is in a stable state before refactoring:

```bash
git add -A
git commit -m "$(cat <<'EOF'
checkpoint: before refactoring

Project: [PROJECT_NAME]
State: All [TOTAL_COUNT] implementation tasks complete and validated
Next phase: Code cleanup and quality improvements

Implementation is functionally complete. This checkpoint preserves the
working state before refactoring, allowing safe code improvements without
risk of losing validated functionality.
EOF
)"
# Store REFACTOR_CHECKPOINT SHA
```

### 7.2: Execute Refactoring

Invoke the refactoring specialist to perform plan-aware cleanup:

```xml
<invoke name="Task">
<parameter name="description">Refactor implementation</parameter>
<parameter name="subagent_type">project:refactor</parameter>
<parameter name="prompt">
Name: [PROJECT_NAME]
Path: [PROJECT_PATH]
Plan: @[PROJECT_PATH]/plan.md
Log: @[PROJECT_PATH]/log.md

Perform plan-aware refactoring on recently implemented code at [PROJECT_PATH].

## Refactoring Focus Areas

Apply expert-level refactoring techniques from the refactoring methodology:

1. **Eliminate Dead Code**: Remove unused variables, functions, parameters, and commented-out code
2. **Simplify Logic**: Reduce complexity through guard clauses, smaller functions, and clearer control flow
3. **Remove Over-Engineering (YAGNI)**: Collapse unnecessary abstractions and remove speculative generality
4. **Improve Naming**: Align names with intent from plan document
5. **Harmonize Patterns**: Ensure new code follows existing codebase conventions
6. **Refine Tests**: Remove redundant tests, focus on behavior over implementation

## Constraints

- Preserve all observable behavior
- Maintain test coverage
- Stay within plan scope
- Validate after each significant change

## Context

Review the plan.md Goals & Objectives and log.md Implementation Summaries to understand:
- What was intended to be built
- What was actually implemented
- Any struggles or decisions documented

Use this context to guide refactoring decisions—ensure "central" code (plan requirements) is preserved while "peripheral" code (opportunistic additions, remnants of abandoned approaches) is cleaned up.
</parameter>
</invoke>
```

### 7.3: Process Refactoring Results

**Based on the refactoring status:**

**COMPLETED** (refactoring successful):
1. Commit refactored state using heredoc:
   ```bash
   git commit -m "$(cat <<'EOF'
refactor: [PROJECT_NAME] code cleanup

Project: [PROJECT_NAME]
State: Implementation complete, now improved for maintainability

Changes made:
[LIST_SPECIFIC_REFACTORING_CHANGES]

The implementation was functional but had opportunities for improvement.
This refactoring reduces complexity and aligns with codebase conventions
without changing any observable behavior. All tests continue to pass.
EOF
)"
   ```
2. Proceed to Phase 8 for evaluation

**NEEDS_REVIEW** (some opportunities require human judgment):
1. Note recommendations in log
2. Proceed to Phase 8 for evaluation
3. Include refactoring recommendations in final summary

**BLOCKED** (cannot refactor safely):
1. Document blocking reasons in log
2. Skip refactoring, proceed to Phase 8 for evaluation

## Phase 8: Validate and Finalize

### 8.1: Create Final Checkpoint

Before evaluation, ensure we have a stable checkpoint:

```bash
git commit -m "$(cat <<'EOF'
checkpoint: before evaluation

Project: [PROJECT_NAME]
State: Implementation and refactoring complete
Completed tasks: [COMPLETED_COUNT] of [TOTAL_COUNT]
Next phase: Quality evaluation for production readiness

All planned work is complete. This checkpoint preserves the final
implementation state before evaluation determines if the project
meets production quality standards.
EOF
)"
# Store EVAL_CHECKPOINT SHA
```

### 8.2: Evaluate Quality

After all todos complete or are blocked:

```xml
<invoke name="Task">
<parameter name="description">Evaluation</parameter>
<parameter name="subagent_type">project:implementation-evaluator</parameter>
<parameter name="prompt">
Name: [PROJECT_NAME]
Path: [PROJECT_PATH]
Plan: @[PROJECT_PATH]/plan.md
Log: @[PROJECT_PATH]/log.md

Evaluate project at [PROJECT_PATH]
</parameter>
</invoke>
```

The evaluator returns: Status (PRODUCTION_READY, CONTINUE, or BLOCKED), Issues, and Recommendations.

### 8.3: Complete Iteration

**Based on the evaluation status:**

If this was an early evaluation (session recovery), return to Phase 3 to incorporate findings.

**BLOCKED** (system-level failure):
1. Log blocking decision using the Bash tool with heredoc
2. Provide summary to user
3. HALT execution

**PRODUCTION_READY:**
1. Commit final state using heredoc:
   ```bash
   git commit -m "$(cat <<'EOF'
production-ready: [PROJECT_NAME]

Project: [PROJECT_NAME]
Status: All quality gates passed

Implemented features:
[LIST_KEY_FEATURES_FROM_PLAN]

Validation results:
- Type checking: zero errors
- Test suite: all tests passing
- Linting: no violations

This project is ready for review and deployment. All requirements from
plan.md have been implemented and validated.
EOF
)"
   ```
2. Log success using the Bash tool with heredoc
3. Move to ready-for-review: `mv [PROJECT_PATH] projects/ready-for-review/`
4. Provide summary to user
5. HALT execution

**CONTINUE** (quality issues):
1. Log decision using the Bash tool with heredoc
2. Document specific issues for next iteration
3. Run complete-iteration command below

For CONTINUE status only, complete the iteration:

```!
# Wait for project path
PROJECT_PATH=$("${CLAUDE_PLUGIN_ROOT}"/bin/wait-for-project-name 2)
BACKTICK='`'

if [ -n "$PROJECT_PATH" ]; then
    PROJECT_NAME=$(basename "$PROJECT_PATH")
    echo "Use the Bash tool to run:"
    echo ""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}bash"
    echo "${CLAUDE_PLUGIN_ROOT}/bin/complete-iteration \"$PROJECT_NAME\""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}"
else
    echo "Use the Bash tool to run:"
    echo ""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}bash"
    echo "${CLAUDE_PLUGIN_ROOT}/bin/complete-iteration \"[PROJECT_NAME]\""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}"
fi
```
</instructions>
