---
description: Simplified orchestration focused on coordination over complex validation
---

<user-message>
```!
mkdir -p projects/new projects/pending projects/active projects/ready-for-review projects/complete projects/icebox
# Use write-arguments utility to synchronize user arguments
write-arguments "$ARGUMENTS"
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
- Import statement corrections
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

### Golden Rule
If the user asks you to implement something → Create todo → Delegate to project-implementer
Never use Read/Write/Edit/MultiEdit for feature implementation.
Only use TodoWrite and Task tools for coordination.

### Investigation Before Delegation

When errors need investigation before delegation:

1. Run validation to get specific errors
2. Use Task tool with "codebase-analysis" subagent and FULL paths for root cause
3. Include findings in the Task prompt to the subagent

### Examples

Fix Directly:
typescript
// Error: Missing import extension
import { foo } from './bar';  // ❌
import { foo } from './bar.js';  // ✅ Just fix it

// Error: Cannot find module 'jest-preset'
setupFiles: ['jest'] // ❌
setupFiles: ['jest-preset'] // ✅ Just fix it

Delegate:
typescript
// Test failing with "Expected 5 got undefined"
// → Needs investigation, delegate to project-implementer

// "Connection pool exhausted"
// → Complex issue, delegate to project-implementer

### Delegation Protocol

If investigation is needed, do it first:

Task({
  subagent_type: "vscode:Analysis",
  description: "Type mismatch root cause",
  prompt: "TypeScript error TS2322 at packages/api/src/auth.ts:45: 'Type X not assignable to Y'. Show BOTH type definitions and explain the mismatch."
})

// Then: Include findings in delegation

```!
# Get project path and name for delegation
PROJECT_PATH=$(wait-for-project-name 2)
if [ -n "$PROJECT_PATH" ]; then
    PROJECT_NAME=$(basename "$PROJECT_PATH")
else
    PROJECT_NAME="[PROJECT_NAME]"
    PROJECT_PATH="[PROJECT_PATH]"
fi

echo "Task("
echo '  description="Fix type mismatch",'
echo '  subagent_type="project-implementer",'
echo '  prompt=`'
echo "    Name: $PROJECT_NAME"
echo "    Directory: @$PROJECT_PATH"
echo "    Plan: @$PROJECT_PATH/plan.md"
echo "    Log: @$PROJECT_PATH/log.md"
echo ''
echo '    ## Issue'
echo '    [Error details]'
echo ''
echo '    ## Root Cause (from investigation)'
echo '    [Include codebase tool findings]'
echo ''
echo '    ## Checkpoint'
echo '    SHA: [CHECKPOINT_SHA]'
echo ''
echo '    ## Requirements'
echo '    Fix and validate with zero errors.`'
echo ")"
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

Analyze the failure to extract learnings:

```!
# Get project path and name for failure analysis
PROJECT_PATH=$(wait-for-project-name 2)
if [ -n "$PROJECT_PATH" ]; then
    PROJECT_NAME=$(basename "$PROJECT_PATH")
    # Determine affected packages from validation output
    AFFECTED_PACKAGES="[PACKAGES_WITH_ERRORS]"
else
    PROJECT_NAME="[PROJECT_NAME]"
    PROJECT_PATH="[PROJECT_PATH]"
    AFFECTED_PACKAGES="[AFFECTED_PACKAGES]"
fi

# Generate timestamp for report
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_PATH="$PROJECT_PATH/reports/implementation-failure-$TIMESTAMP.md"

echo "Task("
echo '  description="Analyze implementation failure",'
echo '  subagent_type="test-issue-reproducer",'
echo '  prompt=`'
echo "    Analyze test and type failures in: $AFFECTED_PACKAGES"
echo '    '
echo '    Run yarn typecheck, yarn test, and yarn lint in each affected package.'
echo '    Create comprehensive failure analysis report.'
echo '    '
echo "    Output the report to: $REPORT_PATH"
echo '    '
echo '    Focus on identifying:'
echo '    - Root causes of implementation failures'
echo '    - Pattern mistakes (wrong abstractions, missing null checks, etc.)'
echo '    - Type system violations and their origins'
echo '    - Test failures and what code changes triggered them'
echo '    - Environmental factors if infrastructure-related`'
echo ")"
```

### Post-Analysis Actions

1. Read the generated report
2. Extract key findings: root causes, pattern mistakes, type violations
3. Append implementation failure analysis to project log.md:
   ```markdown
   ## Implementation Failure Analysis - [timestamp]
   Task: [task-id]
   Affected Packages: [list]
   Attempt: [attempt-number]

   ### Key Findings
   [Summary from test-issue-reproducer report]

   ### Root Causes Identified
   [List of root causes]

   ### Pattern Mistakes to Avoid
   [Document anti-patterns discovered]

   ### Guidance for Future Implementations
   [Specific recommendations to prevent similar failures]

   ### Code Patterns That Work
   [Document successful patterns from the codebase]
   ```
4. Update todo description with failure insights
</failure-analysis-procedure>

<sledgehammer-recovery-procedure>
## Sledgehammer Recovery Procedure

When validation reveals errors have increased (regression) after 3 failed attempts:

### Sequential Task Recovery

```!
# Get project path and name for sledgehammer recovery
PROJECT_PATH=$(wait-for-project-name 2)
if [ -n "$PROJECT_PATH" ]; then
    PROJECT_NAME=$(basename "$PROJECT_PATH")
else
    PROJECT_NAME="[PROJECT_NAME]"
    PROJECT_PATH="[PROJECT_PATH]"
fi

echo "Task("
echo '  description="Delete and rebuild failing code",'
echo '  subagent_type="sledgehammer",'
echo '  prompt=`'
echo "    Name: $PROJECT_NAME"
echo "    Path: $PROJECT_PATH"
echo "    Plan: @$PROJECT_PATH/plan.md"
echo "    Log: @$PROJECT_PATH/log.md"
echo '    '
echo '    ## Regression Detected'
echo '    Errors have INCREASED after implementation attempt.'
echo '    Your job: DELETE the infected code and REBUILD differently.'
echo '    '
echo '    ## Project Structure'
echo '    This is a monorepo with packages in ./packages/'
echo '    Package directories: [List packages from plan.md]'
echo '    '
echo '    ## Task That Failed'
echo '    Task attempted: [Task description from todo]'
echo "    Checkpoint SHA: $TASK_CHECKPOINT"
echo '    Implementation approach taken: [Brief summary of what was attempted]'
echo '    '
echo '    ## Files Modified (Primary Infection Sites)'
echo '    [List all files created/modified during this task attempt]'
echo '    These are your primary deletion targets.'
echo '    '
echo '    ## Current Validation Failures'
echo '    [Full validation output showing the regression:]'
echo '    - TypeScript errors: [CURRENT_ERRORS] errors (was [BASELINE_ERRORS])'
echo '    - Test failures: [CURRENT_FAILURES] failures (was [BASELINE_FAILURES])'
echo '    - Lint errors: [CURRENT_LINT] errors (was [BASELINE_LINT])'
echo '    - Specific error details: [Include actual error messages with file:line]'
echo ")"
```

### Parallel Batch Recovery

Use same format but include:
- List all task-ids in the batch
- Files modified by each task
- Note batch checkpoint SHA

### After Sledgehammer

1. **If COMPLETED:** Code was successfully fixed, commit the changes
2. **If NEEDS_REVISION:** Revert to checkpoint
3. **Document** the attempt in log.md
4. **Update** todo status in TodoWrite based on outcome
</sledgehammer-recovery-procedure>

<task-prompt-template>
## Task Prompt Template

Use this template for all Task delegations to project-implementer:

```!
# Get project path and name
PROJECT_PATH=$(wait-for-project-name 2)
if [ -n "$PROJECT_PATH" ]; then
    PROJECT_NAME=$(basename "$PROJECT_PATH")
else
    PROJECT_NAME="[PROJECT_NAME]"
    PROJECT_PATH="[PROJECT_PATH]"
fi

echo "Task("
echo '  description="[Task description from todo]",'
echo '  subagent_type="project-implementer",'
echo '  prompt=`'
echo "    Name: $PROJECT_NAME"
echo "    Path: $PROJECT_PATH"
echo "    Plan: @$PROJECT_PATH/plan.md"
echo "    Log: @$PROJECT_PATH/log.md"
echo '    '
echo '    '
echo '    ## Implementation Objective'
echo '    [Specific feature or component to implement with behavioral tests]'
echo '    '
echo '    ## Checkpoint Reference'
echo "    Task checkpoint SHA: $TASK_CHECKPOINT"
echo '    '
echo '    ## Validation Requirement (ZERO-TOLERANCE)'
echo '    ⚠️ ANY test failure = task fails. No exceptions.'
echo '    Run ALL commands from plan.md Package Commands section'
echo '    If no Package Commands in plan: run typecheck, test, AND lint'
echo '    Required: ZERO errors from ALL validation commands'
echo "    Current baseline: [BASELINE_ERRORS] errors, [BASELINE_FAILURES] test failures"
echo '    '
echo '    ## Investigation-to-Action Protocol'
echo '    When codebase analysis identifies issues:'
echo '    1. Create fix task immediately using TodoWrite'
echo '    2. Document root cause and fix attempts in log'
echo '    3. Only mark BLOCKED after 2 fix iterations fail'
echo '    '
echo '    This completes todo: [todo-id]`'
echo ")"
```
</task-prompt-template>

<validation-discovery-pipeline>
## Validation-Discovery Pipeline

A unified pattern that combines validation execution with automatic discovery when failures occur.

### Stage 1: Read Package Commands
First: Read @!`PROJECT_PATH=$(wait-for-project-name 2); if [ -n "$PROJECT_PATH" ]; then echo "$PROJECT_PATH/plan.md"; else echo "[PROJECT_PATH]/plan.md"; fi` to get Package Commands section

### Stage 2: Execute Validation
Execute EVERY command listed under Package Commands section.

If no Package Commands section exists, use defaults:
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

⚠️ **CRITICAL**: The Task tool with "codebase-analysis" subagent requires FULL paths in EVERY question.

Execute parallel analysis for discovered errors:

Task({
  subagent_type: "vscode:Analysis",
  description: "Type assignment error analysis",
  prompt: "TypeScript error TS2322 at packages/api/src/auth/handler.ts:45:8: 'Type User not assignable to AuthUser'. Show BOTH complete type definitions from their source files, highlight EVERY property difference, and provide 3 different ways to fix this with code examples."
})

Task({
  subagent_type: "vscode:Analysis",
  description: "Missing argument analysis",
  prompt: "TypeScript error TS2554 at packages/api/src/services/user.ts:89:15: 'Expected 2 arguments but got 1'. Show the complete function signature, the exact call site with surrounding context, identify what the missing argument should be, and show the corrected code."
})

Task({
  subagent_type: "vscode:Analysis",
  description: "Test timeout analysis",
  prompt: "Test 'Authentication › should validate token' timing out in packages/api/tests/auth.test.ts. Show the COMPLETE test code, trace ALL async operations, check for missing awaits or unresolved promises, and identify why it's not completing."
})

Task({
  subagent_type: "vscode:Analysis",
  description: "Requirements implementation check",
  prompt: "Does packages/api/src/services/user.ts implement ALL requirements from plan.md section 2.1? Show the actual implementation code and compare with each requirement."
})

### Success Criteria

✅ **Pipeline succeeds when:**
- Executed ALL commands from plan.md Package Commands section
- Zero errors from every validation command
- No skipped commands (typecheck, test, lint all required)
- No command timeouts

❌ **Pipeline fails and continues to discovery when:**
- ANY Package Commands report errors
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
- Unrelated business domains (e.g., "Add logging" vs "Style footer")
- No sequential numbering or ordering in plan.md

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
ARGS=$(wait-for-arguments)

# Select project based on arguments or find the oldest eligible one
SELECTED_PROJECT=$(get-next-project)

# Wait for project selection to complete
PROJECT_PATH=$(wait-for-project-name 2)

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
    ACTIVE_PROJECT=$(activate-project "$PROJECT_PATH")
    if [ -z "$ACTIVE_PROJECT" ]; then
        echo "Error: Failed to activate project $PROJECT_PATH" >&2
        exit 0
    fi

    # Update PROJECT_PATH to the active location
    PROJECT_PATH="$ACTIVE_PROJECT"

    # Update IPC state so subsequent wait-for-project-name calls get the correct path
    update-project-path "$PROJECT_PATH" >/dev/null 2>&1

    echo "## Phase 1: Initialize Project"
    echo ""
    echo "Name: $PROJECT_NAME"
    echo "Path: $PROJECT_PATH"
    echo "Plan: @$PROJECT_PATH/plan.md"
    echo "Log: @$PROJECT_PATH/log.md"
    echo ""
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
    echo '`activate-project-with-args "[FULL USER RESPONSE]"`'
fi
```

## Phase 2: Verify Session State

Check for partially completed work without recent evaluation.

If the project has been activated and contains implementation work:

2.1. Read log.md to check for recent evaluation reports
2.2. Look for Implementation Summaries but no corresponding Evaluation Report in the latest iteration
2.3. If implementation work exists without recent evaluation (indicating possible session disruption), proceed directly to Phase 7 for evaluation
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

**From quality issues:**
- TypeScript error → Todo: "Fix TS2322 error in auth.ts:45"
- Test failure → Todo: "Fix failing user service test"
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
- Import path corrections
- Config typos
Everything else → Todo → Phase 4 pipeline

<example>
```
TodoWrite({
  "todos": [
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
})
```
</example>

All todos flow through the same Phase 4-6 execution pipeline with:
- Checkpointing before execution
- Delegation to project-implementer
- Validation with zero-tolerance policy
- Unified recovery mechanisms in Phase 6
- Up to 5 total attempts (3 normal, 1 sledgehammer, then blocked)

## Phase 4: Prepare Implementation

### 4.1: Initialize Checkpointing

Create a base checkpoint before any implementation work:

```bash
git add -A
git commit -m "checkpoint: iteration-$(date +%s)-start"
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
git commit -m "checkpoint: before-[task-id]"
# Store TASK_CHECKPOINT SHA
```

Capture baseline metrics from all plan packages (typecheck errors, test failures, E2E failures).

Launch task using `<task-prompt-template>`.

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
- Commit: `git commit -m "completed: [task-id]"`
- Mark todo as completed in TodoWrite
- Continue to next todo

❌ **FAILURE PATH** - Any validation failure:
- Use Stage 5 analysis results to understand root causes
- Proceed to Phase 6 for recovery with these insights

### 5.2: Execute Parallel Tasks (EXCEPTION - rare cases only)

Verify independence using `<execution-strategy-rules>`.

Create single checkpoint for batch:

```bash
git commit -m "checkpoint: parallel-batch-$(date +%s)"
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
- If errors found in any package, continue to discovery and analysis (Stages 4-5)
- Provide deep insights for recovery if validation fails

**5.2.3. Process batch validation results:**

✅ **SUCCESS PATH** - All COMPLETED + ALL validations pass (pipeline stops at Stage 3):
- Commit batch: `git commit -m "completed: parallel-batch"`
- Mark all todos as completed in TodoWrite
- Continue to next batch/todo

❌ **FAILURE PATH** - Any validation regression (pipeline continues through Stage 5):
- Use Stage 5 analysis to identify which tasks in the batch caused issues
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
   ```
   TodoWrite({
     "todos": [
       {
         "content": "Original task [ATTEMPT [N+1] - Root cause: [summary]]",
         "status": "in_progress",
         "activeForm": "Retrying task with root cause insights"
       }
     ]
   })
   ```
3. Revert to checkpoint:
   ```bash
   git reset --hard $TASK_CHECKPOINT
   git clean -fd
   ```
4. Return to Phase 5 with enhanced context from pipeline analysis:
   ```
   ## Retry Attempt [N+1] of 5
   ### Root Cause from Analysis
   [Key findings from failure analysis]

   ### AVOID
   [Anti-patterns discovered]

   ### USE INSTEAD
   [Recommended patterns from analysis]
   ```

**Attempt 4: Sledgehammer Recovery**
1. Execute `<sledgehammer-recovery-procedure>`
2. If successful → Mark todo complete, continue
3. If fails → Proceed to Attempt 5

**Attempt 5: Mark as BLOCKED**
1. Update todo status:
   ```
   TodoWrite({
     "todos": [
       {
         "content": "Original task [BLOCKED after 5 attempts]",
         "status": "in_progress",
         "activeForm": "Blocked - requires external intervention"
       }
     ]
   })
   ```
2. Document blocking reasons in log.md
3. Preserve checkpoint for manual intervention
4. Proceed to Phase 7 or next todo if others exist

### 6.3: Update Project State

After each recovery attempt (regardless of outcome):
1. Append failure analysis to log.md
2. Update todo descriptions with attempt history
3. Document patterns that worked vs failed

### 6.4: Determine Next Action

Based on recovery outcome:
- **Success after retry** → Return to Phase 5 for next todo
- **Still failing (attempts < 5)** → Loop back to 6.2 for next attempt
- **Blocked (attempt 5)** → Proceed to Phase 7 for evaluation

## Phase 7: Validate and Finalize

### 7.1: Create Final Checkpoint

Before evaluation, ensure we have a stable checkpoint:

```bash
git commit -m "checkpoint: pre-evaluation-$(date +%s)"
# Store EVAL_CHECKPOINT SHA
```

### 7.2: Evaluate Quality

After all todos complete or are blocked:

```!
# Get project path and name for evaluation
PROJECT_PATH=$(wait-for-project-name 2)
if [ -n "$PROJECT_PATH" ]; then
    PROJECT_NAME=$(basename "$PROJECT_PATH")
else
    PROJECT_NAME="[PROJECT_NAME]"
    PROJECT_PATH="[PROJECT_PATH]"
fi

echo "Task("
echo '  description="Evaluation",'
echo '  subagent_type="implementation-evaluator",'
echo '  prompt=`'
echo "    Name: $PROJECT_NAME"
echo "    Path: $PROJECT_PATH"
echo "    Plan: @$PROJECT_PATH/plan.md"
echo "    Log: @$PROJECT_PATH/log.md"
echo '    '
echo ''
echo "    Evaluate project at $PROJECT_PATH\`"
echo ")"
```

The evaluator returns: Status (PRODUCTION_READY, CONTINUE, or BLOCKED), Issues, and Recommendations.

### 7.3: Complete Iteration

**Based on the evaluation status:**

If this was an early evaluation (session recovery), return to Phase 3 to incorporate findings.

**BLOCKED** (system-level failure):
1. Log blocking decision using `mcp__file__append`
2. Provide summary to user
3. HALT execution

**PRODUCTION_READY:**
1. Commit final state: `git commit -m "production-ready: $PROJECT_NAME"`
2. Log success using `mcp__file__append`
3. Move to ready-for-review: `mv [PROJECT_PATH] projects/ready-for-review/`
4. Provide summary to user
5. HALT execution

**CONTINUE** (quality issues):
1. Log decision using `mcp__file__append`
2. Document specific issues for next iteration
3. Run complete-iteration command below

For CONTINUE status only, complete the iteration:

```!
# Wait for project path
PROJECT_PATH=$(wait-for-project-name 2)
BACKTICK='`'

if [ -n "$PROJECT_PATH" ]; then
    PROJECT_NAME=$(basename "$PROJECT_PATH")
    echo "Use the Bash tool to run:"
    echo ""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}bash"
    echo "complete-iteration \"$PROJECT_NAME\""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}"
else
    echo "Use the Bash tool to run:"
    echo ""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}bash"
    echo "complete-iteration \"[PROJECT_NAME]\""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}"
fi
```
</instructions>

