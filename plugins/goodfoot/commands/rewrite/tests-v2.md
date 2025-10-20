---
description: Resolve test failures and type errors identified by review
allowed-tools: Bash, Task, Read, Write, Edit, MultiEdit, Grep, Glob, LS, WebFetch, WebSearch, TodoWrite
---

Invoke the review agent to analyze test failures and type errors, then resolve the issues found.

<user-message>
$ARGUMENTS
</user-message>



<input-format>
The `<user-message>` specifies a target directory and test commands to analyze and fix.

Extract the following from `<user-message>` using best effort parsing:
- [TARGET_DIRECTORY] = The directory to analyze (example: `packages/models`)
- [TYPE_CHECK_COMMAND] = The command to run for type checking (defaults to `yarn typecheck`)
- [TEST_COMMANDS] = The test commands to run (defaults to `yarn test` but might be multiple commands like `yarn test` and `yarn test:e2e`)
</input-format>

<todos>
- [ ] Invoke `general-purpose` agent to analyze test failures and type issues
- [ ] Fix type errors identified
- [ ] Fix test failures with reproduction tests
- [ ] Fix remaining test failures
- [ ] Run final verification of all fixes
- [ ] Generate summary report of fixes
</todos>

## Phase 1: Analyze Failures and Extract Issues

### Invoke a `general-purpose` Agent to Analyze Test Failures and Type Issues
```
Task(description="Analyze test failures and type issues in [TARGET_DIRECTORY]", 
      subagent_type="general-purpose",
      prompt=`Follow the instructions in \@.claude/commands/review/tests-v2.md replacing !`echo '$AR''GUMENTS'` with: "Analyze test failures and type issues in @[TARGET_DIRECTORY] using '[TYPE_CHECK_COMMAND]' and '[TEST_COMMANDS]' then output the report as a message"`)
```

### Extract Issues from Report
From the analysis report, identify:
- **Type errors**: Each specific TypeScript error with its root cause
- **Test failures**: Each failing test with its root cause (if reproduction succeeded)
- **Reproduction tests**: Location of each reproduction test created
- **Invalid tests**: Tests marked as questionable or invalid

## Phase 2: Apply and Verify Fixes

**Order of operations**:
1. Fix type errors first (they may resolve some test failures)
2. Fix reproduced test failures (we understand these root causes)
3. Address remaining test failures conservatively
 
**YOU MUST ATTEMPT TO RESOLVE ALL TYPE ERRORS AND TEST FAILURES.**

### For Type Errors
For each type error identified in the report:
1. Read the affected file
2. Understand the type mismatch from the report's root cause analysis
3. Apply the minimal fix to resolve the type error
4. Document what was fixed in comments if complex
5. **Verify immediately**:
   ```bash
   cd [TARGET_DIRECTORY]
   [TYPE_CHECK_COMMAND]
   ```
6. **If verification fails:**
   - Revert the change
   - Re-read the error details and affected code
   - Formulate a new hypothesis about the issue
   - Apply an alternative fix
   - Verify again (repeat up to 3 attempts)
   - If still failing after 3 attempts, document as unresolved
7. If verification passes, proceed to next type error

### For Test Failures with Successful Reproductions
For each test with a successful reproduction:
1. Read the reproduction test to understand the minimal failure case
2. Identify the source code causing the failure based on the root cause
3. Apply fixes to resolve the underlying issue
4. **Verify the specific fix**:
   ```bash
   cd [TARGET_DIRECTORY]
   # Run the reproduction test
   yarn test tests/reproductions/[test-name].repro.test.ts
   # Run the original test
   yarn test [original-test-file]
   ```
5. **If tests fail:**
   - Analyze the failure output
   - Re-examine the reproduction test for additional insights
   - Review the original test context
   - Formulate a new approach based on the failure
   - Apply an alternative fix
   - Verify again (repeat up to 3 attempts)
   - If still failing after 3 attempts, document what was tried and mark as unresolved
6. If tests pass, proceed to next test failure

### For Test Failures without Reproductions
For tests that couldn't be reproduced after 5 hypotheses:
1. Read the original test carefully
2. Review the hypotheses that were tested from the report
3. Consider environmental or setup issues that might not have been caught
4. If the test appears invalid or outdated, mark it for review and skip
5. Otherwise, attempt a conservative fix based on the error message
6. **Verify the specific test**:
   ```bash
   cd [TARGET_DIRECTORY]
   yarn test [specific-test-file]
   ```
7. **If test still fails:**
   - Analyze the new failure output
   - Compare with the original error from the report
   - Try a different approach based on new information
   - Verify again (repeat up to 2 attempts for unreproduced tests)
   - If still failing, document attempts and mark as unresolved
8. If test passes, proceed to next failure

### For Invalid/Questionable Tests
For tests marked as invalid in the report:
1. Comment them out with explanation
2. Document why they were marked as invalid
3. **Verify tests still run** after commenting out:
   ```bash
   cd [TARGET_DIRECTORY]
   yarn test [affected-test-file]
   ```

## Phase 3: Final Verification and Clean Up

### Final Comprehensive Verification
After all individual fixes have been applied and verified:

**Full type check**:
```bash
cd [TARGET_DIRECTORY]
[TYPE_CHECK_COMMAND]
```

**Run all original tests**:
```bash
cd [TARGET_DIRECTORY]
[TEST_COMMANDS]
```

**Run all reproduction tests** (if any were created):
```bash
cd [TARGET_DIRECTORY]
# Check if reproductions directory exists first
if [ -d "tests/reproductions" ]; then
  yarn test tests/reproductions/
fi
```

**If regressions were introduced or you did not attempt to resolve each issue, return to Phase 1.**

### Clean Up Reproduction Tests
After fixes are verified:
1. For each reproduction test in `tests/reproductions/`:
   - If the original test now passes, check if the reproduction still demonstrates a unique issue
   - If the reproduction no longer serves a purpose (original is fixed), remove it
   - Keep reproductions that test valid edge cases not covered by original tests

**Remove obsolete reproductions**:
```bash
# After confirming the reproduction is no longer needed
rm -f tests/reproductions/[test-name].repro.test.ts
```

## Phase 4: Report Generation

Create a summary of all changes made:

```markdown
# Test Failure Resolution Summary

## Target Directory
- [TARGET_DIRECTORY]

## Type Errors Resolved
- [file:line]: [Brief description of fix]
- [file:line]: [Brief description of fix]

## Test Failures Resolved
- [test-name]: [Root cause and fix applied]
- [test-name]: [Root cause and fix applied]

## Invalid Tests Handled
- [test-name]: [Action taken based on strategy]

## Reproduction Tests
- Created: [count] reproduction tests
- Removed: [count] obsolete reproductions
- Kept: [count] reproductions for edge cases

## Remaining Issues
- [Any unresolved issues with explanation]

## Fix-by-Fix Verification Results
- Type error 1: [file:line] - ✓ Fixed and verified (1 attempt)
- Type error 2: [file:line] - ✗ Could not fix after 3 attempts
  - Attempt 1: [approach] - [failure reason]
  - Attempt 2: [approach] - [failure reason]
  - Attempt 3: [approach] - [failure reason]
- Test failure 1: [test-name] - ✓ Fixed and verified (2 attempts)
- Test failure 2: [test-name] - ✓ Fixed and verified (1 attempt)
- Test failure 3: [test-name] - ✗ Unresolved after 3 attempts
  - Attempt 1: [approach] - [failure reason]
  - Attempt 2: [approach] - [failure reason]
  - Attempt 3: [approach] - [failure reason]

## Final Verification Results
- Type check: [Status]
- Tests: [X]/[Y] passing
- Reproductions: [Status if applicable]
```