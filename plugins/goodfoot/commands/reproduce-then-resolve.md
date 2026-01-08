---
description: Reproduce a bug with a minimal test, then resolve it with test-first verification
allowed-tools: *
disable-model-invocation: true
---

<user-message>
$ARGUMENTS
</user-message>

<input-format>
Extract from `<user-message>` or recent conversation:
- [BUG_DESCRIPTION] = What the bug is, including expected vs actual behavior (required)
- [SCOPE_HINT] = Files, packages, or areas involved (optional)

Variables set during execution:
- [TEST_FILE_PATH] = Path to reproduction test
- [TEST_FAILURE_OUTPUT] = Captured test failure
- [TEST_PASS_ANALYSIS] = Why test passed when it should fail (retry context)
- [RESOLVER_REASONING] = Explanation of fix approach
</input-format>

<instructions>
## Phase 1: Parse Bug Description

1. Extract [BUG_DESCRIPTION] from `<user-message>`
2. If empty, infer from recent conversation history
3. Extract [SCOPE_HINT] if mentioned

**If bug cannot be determined:** Ask user to clarify before proceeding. Do not continue without a clear bug description.

## Phase 2: Establish Baseline

1. Check git state:
   ```bash
   git status --porcelain
   ```

2. **If dirty:** Ask user how to proceed:
   - "Stash changes" → `git stash push -m "pre-reproduce-resolve"`
   - "Commit first" → Exit for user to handle
   - "Proceed anyway" → Continue (warn: limited rollback)

   **If clean:** Continue.

3. Create baseline tag:
   ```bash
   git tag -f reproduce-resolve/baseline HEAD
   ```

## Phase 3: Create Reproduction Test

**Goal:** Create a minimal test that FAILS, demonstrating the bug. The test must fail before the fix and pass after—this is the test-first invariant.

Initialize: [REPRODUCTION_ATTEMPT] = 0

### Step 3.1: Launch Test Creation Subagent

Increment [REPRODUCTION_ATTEMPT] (max 2)

```xml
<invoke name="Task">
<parameter name="description">create-reproduction-test</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt"># Task: Create Minimal Reproduction Test

## Bug
[BUG_DESCRIPTION]

## Scope
[SCOPE_HINT]

[If [REPRODUCTION_ATTEMPT] > 1:]
## Previous Attempt Failed
The previous test PASSED when it should have FAILED:

[TEST_PASS_ANALYSIS]

Previous test code (DO NOT repeat):
```
[previous test content]
```
[End if]

## Requirements
- Create a NEW test file (do not modify existing tests)
- Test must be minimal and MUST FAIL, demonstrating the bug
- Follow existing test patterns in the codebase

## Response Format
## Status
[SUCCESS | BLOCKED | CANNOT_COMPLETE]

## Result
[Absolute file path created, or "None"]

## Reasoning
[How test reproduces the bug, or why blocked]</parameter>
</invoke>
```

### Step 3.2: Handle Subagent Response

| Status | Action |
|--------|--------|
| SUCCESS | Extract [TEST_FILE_PATH], continue to Step 3.3 |
| BLOCKED | Present reasoning, ask user for guidance, retry Step 3.1 |
| CANNOT_COMPLETE | Present reasoning, ask user to clarify or abort |

Only prompt user on BLOCKED or CANNOT_COMPLETE—SUCCESS proceeds autonomously.

### Step 3.3: Verify and Execute Test

Verify changes via git (trust git over subagent reports):

```bash
# Verify file was created
if [ ! -f "[TEST_FILE_PATH]" ]; then
  # Subagent claimed success but file missing - retry Step 3.1
fi

# Check for unexpected modifications to existing files
MODIFIED=$(git diff reproduce-resolve/baseline --name-only --diff-filter=M)
if [ -n "$MODIFIED" ]; then
  # Report unexpected changes to user, ask if expected
fi

# Stage and run test
git add "[TEST_FILE_PATH]"
yarn test "[TEST_FILE_PATH]" 2>&1
TEST_EXIT_CODE=$?
```

### Step 3.4: Process Test Result

**If test FAILS (exit code ≠ 0):**
- Capture [TEST_FAILURE_OUTPUT]
- Commit and tag:
  ```bash
  git commit -m "$(cat <<EOF
test: add reproduction test for bug

Bug: [BUG_DESCRIPTION]
Test file: [TEST_FILE_PATH]

This test demonstrates the reported bug by failing with the current code.
Once the underlying issue is fixed, this test will pass and serve as a
regression guard against reintroduction of the bug.

Test output: [BRIEF_FAILURE_SUMMARY]
EOF
)"
  git tag -f reproduce-resolve/test-ready HEAD
  ```
- Proceed to Phase 4

**If test PASSES (unexpected):**
- Read test file, analyze why it passes instead of failing
- Capture analysis as [TEST_PASS_ANALYSIS]
- Revert to baseline:
  ```bash
  git checkout reproduce-resolve/baseline -- .
  git clean -fd
  ```
- **If [REPRODUCTION_ATTEMPT] < 2:** Return to Step 3.1 with [TEST_PASS_ANALYSIS] as context
- **If [REPRODUCTION_ATTEMPT] >= 2:** Ask user:
  - "Bug already fixed?" → Verify with full test suite, exit
  - "Provide guidance" → User provides hints, retry Step 3.1
  - "Abort" → Exit with findings

## Phase 4: Resolve Bug

**Goal:** Fix the source code so the test passes. If the test needs correction, modify only the test, then loop back to fix source.

Initialize: [RESOLVE_ATTEMPT] = 0, [TEST_IS_MODIFIED] = false

### Step 4.1: Launch Bug Resolution Subagent

Increment [RESOLVE_ATTEMPT] (max 2)

```xml
<invoke name="Task">
<parameter name="description">resolve-bug</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt"># Task: Fix Bug to Make Test Pass

## Bug
[BUG_DESCRIPTION]

## Failing Test
File: [TEST_FILE_PATH]

## Test Output
[TEST_FAILURE_OUTPUT]

[If [TEST_IS_MODIFIED] = true:]
## IMPORTANT: Source Only
The test has already been corrected. DO NOT modify the test file.
Fix only the source code.
[End if]

## Requirements
- Fix the source code to make the test pass
- Do not break existing functionality

## If Test Needs Correction
If the test itself is wrong (bad assertions, incorrect setup):
1. Modify ONLY the test - do NOT also fix source
2. Return status TEST_MODIFIED
The orchestrator will verify the modified test still fails, then re-run resolution.

## Response Format
## Status
[SUCCESS | TEST_MODIFIED | BLOCKED | CANNOT_COMPLETE]

## Result
[File paths modified, or "None"]

## Reasoning
[Fix explanation, or why test was modified, or why blocked]</parameter>
</invoke>
```

Capture [RESOLVER_REASONING] from response.

### Step 4.2: Detect File Changes

Verify actual changes via git (trust git over subagent reports):

```bash
# What changed since test-ready checkpoint?
CHANGES=$(git diff reproduce-resolve/test-ready --name-only)

# Was test file modified? (0=unchanged, 1=modified)
git diff --quiet reproduce-resolve/test-ready -- "[TEST_FILE_PATH]"
TEST_WAS_MODIFIED=$?

# Source files changed (excluding test)
SOURCE_CHANGES=$(echo "$CHANGES" | grep -v "[TEST_FILE_PATH]")
```

### Step 4.3: Handle Resolver Response

**If BLOCKED or CANNOT_COMPLETE:**
- Present reasoning to user
- Ask: "Restart with guidance" / "Manual intervention" / "Abort"

**If SUCCESS (and TEST_WAS_MODIFIED = 0):**
- Proceed to Step 4.4

**If TEST_MODIFIED (or TEST_WAS_MODIFIED = 1 detected by git):**
- If resolver also changed source files, revert source changes (keep only test):
  ```bash
  if [ -n "$SOURCE_CHANGES" ]; then
    git checkout reproduce-resolve/test-ready -- $SOURCE_CHANGES
  fi
  ```
- Proceed to Step 4.5

### Step 4.4: Validate Fix

```bash
yarn test "[TEST_FILE_PATH]" 2>&1
TEST_EXIT_CODE=$?
```

**If test passes:** Proceed to Phase 5

**If test fails:**
- **If [RESOLVE_ATTEMPT] < 2:** Include failure output in context, return to Step 4.1
- **If [RESOLVE_ATTEMPT] >= 2:** Ask user: "Retry with guidance" / "Manual intervention" / "Abort"

### Step 4.5: Validate Test Correction

The resolver modified the test. Verify the modified test still fails (still reproduces the bug):

```bash
yarn test "[TEST_FILE_PATH]" 2>&1
MODIFIED_TEST_EXIT_CODE=$?
```

**If test FAILS (valid modification):**
- Commit test change and update checkpoint:
  ```bash
  git add "[TEST_FILE_PATH]"
  git commit -m "$(cat <<EOF
test: correct reproduction test

Bug: [BUG_DESCRIPTION]
Test file: [TEST_FILE_PATH]

The original test had issues that prevented accurate reproduction.
This correction ensures the test properly demonstrates the bug while
still failing against the current code.

Reason for correction: [RESOLVER_REASONING]
EOF
)"
  git tag -f reproduce-resolve/test-ready HEAD
  ```
- Capture new [TEST_FAILURE_OUTPUT] from the run
- Set [TEST_IS_MODIFIED] = true
- Return to Step 4.1 (resolver will now fix source only)

**If test PASSES (invalid modification):**
- The test change made it pass without any source fix—this is not valid
- Revert test changes:
  ```bash
  git checkout reproduce-resolve/test-ready -- "[TEST_FILE_PATH]"
  ```
- **If [RESOLVE_ATTEMPT] < 2:** Return to Step 4.1 with note about invalid test change
- **If [RESOLVE_ATTEMPT] >= 2:** Ask user for guidance

## Phase 5: Validate Full Suite

Run full test suite to check for regressions:

```bash
yarn test 2>&1
FULL_EXIT_CODE=$?
```

**If all pass:** Proceed to Phase 6

**If failures (regressions):**
- Report which tests fail
- Ask user:
  - "Investigate" → Launch subagent to analyze regressions
  - "Revert, try again" → Reset source to test-ready, return to Phase 4
  - "Accept regressions" → Continue to Phase 6 with warning

## Phase 6: Generate Report

Gather changes:
```bash
git diff reproduce-resolve/baseline --stat
```

Generate report:
```
## Bug Resolution Complete

### Bug
[BUG_DESCRIPTION]

### Test
- File: [TEST_FILE_PATH]
- Verified: failed before fix, passes after

### Fix
- Files: [from git diff]
- Approach: [RESOLVER_REASONING]

### Validation
- Reproduction test: ✅ Passes
- Full test suite: [✅ All pass | ⚠️ Regressions accepted]

### Checkpoints
- reproduce-resolve/baseline - before changes
- reproduce-resolve/test-ready - test verified failing
```

**Optional cleanup:**
```bash
git tag -d reproduce-resolve/baseline reproduce-resolve/test-ready
```
</instructions>
