---
description: Reproduce a bug with a minimal test, then resolve it with test-first verification
allowed-tools: *
---

<user-message>
$ARGUMENTS
</user-message>

<input-format>
`<user-message>` should describe the bug or issue to reproduce and resolve.

If `<user-message>` is empty or unclear, infer the bug from recent conversation history.

Extract the following:
- [BUG_DESCRIPTION] = Clear description of the issue (required)
- [EXPECTED_BEHAVIOR] = What should happen (inferred if not explicit)
- [ACTUAL_BEHAVIOR] = What currently happens (inferred if not explicit)
- [SCOPE_HINT] = Files, packages, or areas involved (optional)

Variables derived during execution:
- [TEST_FILE_PATH] = Path to created reproduction test (Phase 2)
- [TEST_FAILURE_OUTPUT] = Captured test failure details (Phase 4)
- [CHECKPOINT_BASELINE] = Git ref for baseline state (Phase 1)
- [CHECKPOINT_TEST_CREATED] = Git ref after test creation (Phase 3)
- [CHECKPOINT_TEST_VERIFIED] = Git ref after test verification (Phase 5)
- [REPRODUCTION_ATTEMPT] = Counter for test creation attempts (Phase 4, max 2)
- [TEST_PASS_ANALYSIS] = Analysis of why test passed when it should fail (Phase 4)
</input-format>

<instructions>
## Phase 0: Parse Input

### Step 0.1: Extract Bug Description

1. Check if `$ARGUMENTS` contains a bug description
2. If empty or unclear, infer from recent conversation history
3. Define:
   - `[BUG_DESCRIPTION]` - What the bug is
   - `[EXPECTED_BEHAVIOR]` - What should happen
   - `[ACTUAL_BEHAVIOR]` - What currently happens
   - `[SCOPE_HINT]` - Relevant files/components (if known)

**If bug cannot be determined:** Use AskUserQuestion to clarify before proceeding.

## Phase 1: Create Baseline Checkpoint

### Step 1.1: Check Git State

```bash
git status --porcelain
```

**If dirty working tree:** Ask user how to proceed:
- "Stash changes" → `git stash push -m "pre-reproduce-resolve"`
- "Commit changes first" → Exit for user to handle
- "Proceed without baseline" → Skip checkpoint (warn: limited rollback)

**If clean:** Proceed to create checkpoint.

### Step 1.2: Create Baseline Checkpoint

```bash
# Tag current HEAD as baseline
git tag -f reproduce-resolve/baseline HEAD
```

Record `[CHECKPOINT_BASELINE]` = `reproduce-resolve/baseline`

## Phase 2: Create Reproducing Test

### Step 2.1: Launch Test Creation Subagent

```xml
<invoke name="Task">
<parameter name="description">create-reproduction-test</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt"># Task: Create Minimal Reproduction Test

## Bug Description
[BUG_DESCRIPTION]

## Expected Behavior
[EXPECTED_BEHAVIOR]

## Actual Behavior
[ACTUAL_BEHAVIOR]

## Scope
[SCOPE_HINT]

[IF REPRODUCTION_ATTEMPT > 1, include:]
## Previous Attempt Analysis
The previous test attempt PASSED when it should have FAILED. Here is why:

[TEST_PASS_ANALYSIS]

### Previous Test Code (DO NOT repeat these mistakes)
```
[Previous test file content]
```

### Specific Guidance
[Derived guidance from analysis, e.g.:]
- Ensure the test does NOT mock [specific component]
- Test MUST call [function] with [specific parameters]
- Assert on [specific value] rather than [incorrect assertion]
[END IF]

## Requirements
- Create a NEW test file (do not modify existing tests)
- Test must be minimal - only what's needed to reproduce the bug
- Test MUST fail when run, demonstrating the bug
- Follow existing test patterns in the codebase
- Use descriptive test name that references the bug

## Response Format
Return your response in this exact format:

## Status
[SUCCESS | NEEDS_CLARIFICATION | BLOCKED | CANNOT_COMPLETE]

## Result
[Absolute file path created, or "None"]

## Issues
[Problems encountered, or "None"]

## Reasoning
[Explanation of your approach and how the test reproduces the bug]

## Recommendations
[Suggested next steps if status is not SUCCESS]</parameter>
</invoke>
```

### Step 2.2: Parse Subagent Response

Handle response status:

| Status | Action |
|--------|--------|
| `SUCCESS` | Extract `[TEST_FILE_PATH]` from Result, proceed to Step 2.3 |
| `NEEDS_CLARIFICATION` | Ask user for clarification, retry Phase 2 |
| `BLOCKED: cannot_locate_code` | Ask user for file/component hints, retry |
| `BLOCKED: already_fixed` | Report bug may be fixed, ask user to verify or abort |
| `BLOCKED: unknown_test_patterns` | Ask user for test example/location, retry |
| `CANNOT_COMPLETE: multiple_interpretations` | Present interpretations, ask user to choose |
| `CANNOT_COMPLETE: insufficient_context` | Ask user for specifics, retry |

### Step 2.3: Verify Changes via Git

```bash
# Get new test files created since baseline
NEW_TEST_FILES=$(git diff reproduce-resolve/baseline --name-only --diff-filter=A | grep -E '\.(test|spec)\.(ts|js|tsx|jsx)$|__tests__/')

# Check for unexpected modifications to existing files
MODIFIED_FILES=$(git diff reproduce-resolve/baseline --name-only --diff-filter=M)
```

Cross-check:
- If subagent said SUCCESS but no new test files → Report discrepancy, retry
- If unexpected modifications exist → Report to user, ask if expected

## Phase 3: Checkpoint After Test Creation

### Step 3.1: Stage and Commit Test File

```bash
# Stage only the new test file
git add "$TEST_FILE_PATH"

# Create checkpoint
git commit -m "checkpoint: reproduce-resolve/test-created

Reproduction test for: [BUG_DESCRIPTION summary]"

# Tag for easy reference
git tag -f reproduce-resolve/test-created HEAD
```

Record `[CHECKPOINT_TEST_CREATED]` = `reproduce-resolve/test-created`

## Phase 4: Verify Test Fails

### Step 4.1: Run the Test

```bash
yarn test "$TEST_FILE_PATH" 2>&1
TEST_EXIT_CODE=$?
```

### Step 4.2: Analyze Result

**If test FAILS (exit code ≠ 0):**
- Capture `[TEST_FAILURE_OUTPUT]`
- Reset `[REPRODUCTION_ATTEMPT]` counter (if set)
- Log: "Test fails as expected, reproducing the bug"
- Proceed to Phase 5

**If test PASSES (exit code = 0):**

Initialize or increment: `[REPRODUCTION_ATTEMPT]` (max 2 attempts)

**Step 4.2.1: Study Why Test Passes**

Read and analyze the test file to understand why it passes when it should fail:

```bash
# Read the test file
cat "$TEST_FILE_PATH"
```

Consider:
- Does the test actually exercise the buggy code path?
- Are the assertions correct for detecting the bug?
- Is the test setup missing conditions that trigger the bug?
- Does the test use mocks/stubs that bypass the buggy behavior?
- Is the expected behavior in the test actually correct?

Capture analysis as `[TEST_PASS_ANALYSIS]`.

**Step 4.2.2: Revert Test File**

```bash
# Remove the test file and reset to baseline
git checkout reproduce-resolve/baseline -- .
git clean -fd  # Remove untracked files (the new test)

# Or if test was committed:
git reset --hard reproduce-resolve/baseline
```

**Step 4.2.3: Retry or Escalate**

**If REPRODUCTION_ATTEMPT < 2:**
- Return to Phase 2 with enhanced context:
  - Include `[TEST_PASS_ANALYSIS]` explaining why previous test passed
  - Include the previous test code as an example of what NOT to do
  - Add specific guidance based on analysis (e.g., "ensure test does not mock X", "test must call Y with Z parameters")

**If REPRODUCTION_ATTEMPT >= 2:**
- Report: "Unable to create failing test after 2 attempts"
- Present `[TEST_PASS_ANALYSIS]` from both attempts
- Ask user:
  - "Bug already fixed" → Run full test suite to verify, exit successfully
  - "Provide additional guidance" → User provides hints, retry Phase 2
  - "Abort" → Exit with findings

## Phase 5: Checkpoint After Verification

### Step 5.1: Create Verification Checkpoint

```bash
# Create checkpoint (may be empty commit if no changes since Phase 3)
git commit --allow-empty -m "checkpoint: reproduce-resolve/test-verified

Test confirmed failing, ready for resolution"

# Tag for easy reference
git tag -f reproduce-resolve/test-verified HEAD
```

Record `[CHECKPOINT_TEST_VERIFIED]` = `reproduce-resolve/test-verified`

### Step 5.2: Record Test File State

```bash
TEST_FILE_HASH=$(git hash-object "$TEST_FILE_PATH")
```

## Phase 6: Resolve the Issue

### Step 6.1: Initialize Resolution Attempt

Set `RESOLVE_ATTEMPT = 1`, `MAX_ATTEMPTS = 2`

### Step 6.2: Launch Resolution Subagent

```xml
<invoke name="Task">
<parameter name="description">resolve-bug</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt"># Task: Fix Bug to Make Test Pass

## Bug Description
[BUG_DESCRIPTION]

## Failing Test
File: [TEST_FILE_PATH]

## Test Failure Output
[TEST_FAILURE_OUTPUT]

## Requirements
- Fix the source code to make the test pass
- Do not break existing functionality
- Follow existing code patterns

## IMPORTANT: If You Need to Modify the Test
If the test needs modification (incorrect assertions, wrong setup, etc.):
1. Modify ONLY the test file - do NOT also fix the source code
2. Return status `TEST_MODIFIED` with explanation
3. The orchestrator will verify the modified test still fails, then launch a new resolver

This separation ensures we maintain the test-first invariant: test fails before fix, passes after.

## Response Format
Return your response in this exact format:

## Status
[SUCCESS | TEST_MODIFIED | BLOCKED | CANNOT_COMPLETE]

## Result
[File paths modified, or "None"]

## Issues
[Problems encountered, or "None"]

## Reasoning
[Explanation of fix approach]
[If TEST_MODIFIED: detailed justification for test changes and what was wrong with original test]

## Recommendations
[Next steps if status is not SUCCESS]</parameter>
</invoke>
```

### Step 6.3: Handle Subagent Response

| Status | Action |
|--------|--------|
| `SUCCESS` | Proceed to Phase 7 (Path A - validate fix) |
| `TEST_MODIFIED` | Proceed to Phase 7 (Path B - validate test, then re-resolve) |
| `BLOCKED: test_incorrect` | Present analysis, ask: restart reproduction / override / abort |
| `BLOCKED: test_assumptions_wrong` | Present analysis, ask: restart / override / abort |
| `BLOCKED: breaking_changes_required` | Present tradeoffs, ask: accept / find alternative / abort |
| `CANNOT_COMPLETE: multiple_approaches` | Present options, ask user to choose, retry |
| `CANNOT_COMPLETE: out_of_scope` | Report findings, suggest escalation |
| `CANNOT_COMPLETE: not_a_bug` | Present reasoning, ask: confirm not a bug / disagree and retry |

## Phase 7: Validate Resolution

### Step 7.1: Detect Actual Changes via Git

```bash
# All changes since test-verified checkpoint
ALL_CHANGES=$(git diff reproduce-resolve/test-verified --name-only)

# Check if test file was modified (exit code: 0=unchanged, 1=modified)
git diff --quiet reproduce-resolve/test-verified -- "$TEST_FILE_PATH"
TEST_MODIFIED=$?

# Source files changed (excluding test)
SOURCE_CHANGES=$(echo "$ALL_CHANGES" | grep -v "$TEST_FILE_PATH")
```

### Step 7.2: Determine Validation Path

Use git detection (not just subagent report) to determine path:

- **Path A**: Test NOT modified (TEST_MODIFIED = 0) → Validate source fix
- **Path B**: Test WAS modified (TEST_MODIFIED = 1) → Validate test change, then re-resolve

### Step 7.3: Path A - Validate Source Fix (Test Unchanged)

```bash
# Run test - should pass now
yarn test "$TEST_FILE_PATH" 2>&1
TEST_EXIT_CODE=$?
```

**If test passes:** Proceed to Step 7.5 (regression check)

**If test fails:**
- If `RESOLVE_ATTEMPT < MAX_ATTEMPTS`: Increment attempt, include failure in context, retry Phase 6
- Else: Report "Fix attempts exhausted", ask user: retry with guidance / manual intervention / abort

### Step 7.4: Path B - Validate Test Modification, Then Re-Resolve

The resolver modified the test but did NOT fix the source. We must:
1. Verify the modified test still fails (reproduces the bug)
2. Checkpoint the test modification
3. Launch a new resolver to fix the source

**Step 7.4.1: Verify Modified Test Still Fails**

```bash
# Run the modified test (no source changes should exist)
yarn test "$TEST_FILE_PATH" 2>&1
MODIFIED_TEST_EXIT_CODE=$?
```

**If MODIFIED_TEST_EXIT_CODE ≠ 0 (test fails - VALID):**
- Log: "Modified test still fails, reproducing the bug"
- Proceed to Step 7.4.2

**If MODIFIED_TEST_EXIT_CODE = 0 (test passes - INVALID):**
- The test modification made the test pass without any source fix
- Report: "Test modification makes test pass - this is not a valid test change"
- Revert test changes: `git checkout reproduce-resolve/test-verified -- "$TEST_FILE_PATH"`
- If `RESOLVE_ATTEMPT < MAX_ATTEMPTS`: Retry Phase 6 with note about invalid test change
- Else: Ask user for guidance

**Step 7.4.2: Checkpoint Test Modification**

```bash
# Stage and commit the test modification
git add "$TEST_FILE_PATH"
git commit -m "checkpoint: reproduce-resolve/test-modified

Test modified by resolver: [RESOLVER_REASONING summary]"

# Update tag
git tag -f reproduce-resolve/test-verified HEAD
```

Capture new `[TEST_FAILURE_OUTPUT]` from the modified test run.

**Step 7.4.3: Launch New Resolver for Source Fix**

```xml
<invoke name="Task">
<parameter name="description">resolve-bug-source-only</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt"># Task: Fix Bug to Make Test Pass (Source Only)

## Bug Description
[BUG_DESCRIPTION]

## Failing Test
File: [TEST_FILE_PATH]

Note: The test was recently modified to correctly reproduce the bug.

## Test Failure Output
[TEST_FAILURE_OUTPUT (from modified test)]

## Requirements
- Fix the SOURCE CODE to make the test pass
- DO NOT modify the test file - it has already been corrected
- Do not break existing functionality
- Follow existing code patterns

## Response Format
Return your response in this exact format:

## Status
[SUCCESS | BLOCKED | CANNOT_COMPLETE]

## Result
[File paths modified, or "None"]

## Issues
[Problems encountered, or "None"]

## Reasoning
[Explanation of fix approach]

## Recommendations
[Next steps if status is not SUCCESS]</parameter>
</invoke>
```

**Step 7.4.4: Validate Source Fix**

After new resolver completes:

```bash
# Verify test file was NOT modified
git diff --quiet reproduce-resolve/test-verified -- "$TEST_FILE_PATH"
if [ $? -eq 1 ]; then
  # Test was modified again - revert source changes, retry
  git checkout reproduce-resolve/test-verified -- .
  # Retry with stricter instructions or ask user
fi

# Run test - should pass now
yarn test "$TEST_FILE_PATH" 2>&1
TEST_EXIT_CODE=$?
```

**If test passes:** Proceed to Step 7.5 (regression check)

**If test fails:**
- If `RESOLVE_ATTEMPT < MAX_ATTEMPTS`: Increment attempt, retry Step 7.4.3
- Else: Report "Fix attempts exhausted", ask user for guidance

### Step 7.5: Run Full Test Suite (Regression Check)

```bash
yarn test 2>&1
FULL_TEST_EXIT_CODE=$?
```

**If all tests pass:** Proceed to Phase 8

**If tests fail (regressions):**
- Report which tests now fail
- Ask user:
  - "Investigate regressions" → Launch subagent to analyze
  - "Revert, try different approach" → Reset to test-verified, retry Phase 6
  - "Accept regressions" → Proceed to Phase 8 with warning

## Phase 8: Final Report

### Step 8.1: Gather Changes

```bash
# All files changed since baseline
git diff reproduce-resolve/baseline --stat
```

### Step 8.2: Generate Report

```
## Bug Resolution Complete

### Bug
[BUG_DESCRIPTION]

### Reproduction Test
- File: [TEST_FILE_PATH]
- Created and verified failing before fix

### Resolution
- Files Modified: [list from git diff]
- Approach: [RESOLVER_REASONING summary]

### Validation
- Reproduction test: ✅ Passes after fix
- Test-first invariant: ✅ Verified (failed before, passes after)
- Full test suite: [✅ All pass | ⚠️ Regressions accepted: N tests]

### Git Checkpoints
- reproduce-resolve/baseline - State before changes
- reproduce-resolve/test-created - After test added
- reproduce-resolve/test-verified - After confirming test fails

### Files Changed
[git diff --stat output]
```

### Step 8.3: Cleanup (Optional)

User may choose to:
- Keep checkpoints for reference
- Remove checkpoint tags: `git tag -d reproduce-resolve/baseline reproduce-resolve/test-created reproduce-resolve/test-verified`
- Squash commits if desired
</instructions>

<things-to-remember>
**Autonomous by Default**: Only prompt user when there's an actual problem:
- Bug description cannot be determined
- Dirty working tree needs user decision
- Subagent signals BLOCKED or CANNOT_COMPLETE
- Max retry attempts exhausted (reproduction or resolution)
- Regressions detected

**Test-First Invariant**: The same test must:
1. FAIL before source changes are applied
2. PASS after source changes are applied

**Test Modification Flow**: If resolver needs to modify the test:
1. Resolver modifies ONLY the test (not source) and returns `TEST_MODIFIED`
2. Orchestrator verifies modified test still fails (reproduces bug)
3. Orchestrator checkpoints the test modification
4. Orchestrator launches NEW resolver to fix source only
5. This maintains the invariant: test fails before, passes after

**Checkpoint Strategy**:
- `reproduce-resolve/baseline` - Revert point if everything fails
- `reproduce-resolve/test-created` - After new test file added
- `reproduce-resolve/test-verified` - After confirming test fails (compare resolver changes against this)

**Git-Based Verification**: Always verify actual changes via git diff, not just subagent reports:
```bash
git diff reproduce-resolve/test-verified --name-only  # What actually changed
git diff --quiet reproduce-resolve/test-verified -- "$TEST_FILE"  # Was test modified?
```

**Subagent Context**: Subagents have no conversation history. Include in every prompt:
- Full bug description
- Absolute file paths
- Test failure output (for resolver)
- Clear requirements and response format

**Retry Logic**: Maximum 2 attempts for both reproduction and resolution phases. After exhausting retries, present findings and ask user for guidance rather than looping indefinitely.

**Reproduction Retry (Phase 4)**: If test passes unexpectedly:
1. Study the test file to understand why it passes
2. Revert changes (remove test file, reset to baseline)
3. Return to Phase 2 with analysis as additional context
4. Only prompt user after 2 failed attempts

**Subagent Response Protocol**: Subagents return structured responses with:
- Status: SUCCESS | TEST_MODIFIED | BLOCKED | CANNOT_COMPLETE
- Result: File paths or "None"
- Issues: Problems encountered
- Reasoning: Explanation of approach
- Recommendations: Next steps if not successful

**Resolution Subagent Statuses**:
- `SUCCESS` - Source fixed, test should now pass
- `TEST_MODIFIED` - Test corrected, source NOT fixed (orchestrator will re-resolve)
- `BLOCKED` - Cannot proceed without user input
- `CANNOT_COMPLETE` - Task cannot be accomplished
</things-to-remember>
