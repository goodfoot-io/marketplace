---
description: Run tests and analyze failures with streamlined reproduction testing
allowed-tools: Bash, Task, Read, Write, MultiEdit, Grep, Glob, LS, WebFetch, WebSearch
---

Analyze test failures and type errors to create comprehensive failure reports with minimal reproduction tests.

**DO NOT ATTEMPT TO FIX ISSUES. REPRODUCE AND REPORT ONLY.**

<user-message>
$ARGUMENTS
</user-message>

<input-format>
The `<user-message>` specifies a target directory and test commands to analyze for failures and type errors.

Extract the following from `<user-message>` using best effort parsing:
- [TARGET_DIRECTORY] = The directory to analyze (example: `packages/models`)
- [TYPE_CHECK_COMMAND] = The command to run for type checking (defaults to `yarn typecheck`)
- [TEST_COMMANDS] = The test commands to run (defaults to `yarn test` but might be multiple commands like `yarn test` and `yarn test:e2e`)
- [DESTINATION] = The output method for the analysis report (defaults to writing a file to `$(pwd)/reports/tests/test-failure-analysis-[NAME_DERIVED_FROM_TARGET_DIRECTORY]-[TIMESTAMP].md` but may be a command like "output the report as a message" or "use the `echo` command to write the file to /path/to/log.md")
</input-format>

<valid-tests>
Valid tests should have:
- ✓ Tests actual functionality (not removed features)
- ✓ Tests behavior (not implementation details)
- ✓ Has clear purpose and assertions
</valid-tests>

<reproduction-templates>

Follow the examples below when reproducing test failures:

<standard-failure>
```typescript
// tests/reproductions/[test-name].repro.test.ts
// Reproduction of: [Original Test] from [file:line]
// Hypothesis [N]: [Root cause explanation - what is broken and why it causes the failure]
// Attempt [X] of hypothesis [N]

test('minimal reproduction', () => {
  // Only code needed to trigger error based on theory
});
```
</standard-failure>

<timeout-failure>
```typescript
// tests/reproductions/[test-name].repro.test.ts
// Reproduction of: [Original Test] from [file:line]
// Hypothesis [N]: [Root cause explanation - what causes the infinite loop/timeout]
// Attempt [X] of hypothesis [N]

test('detects infinite loop', () => {
  let iterations = 0;
  const handler = new Handler();
  
  expect(() => {
    handler.process(() => {
      if (++iterations > 100) throw new Error('Loop detected');
    });
  }).toThrow('Loop detected');
});
```
</timeout-failure>

<timing-dependent>
```typescript
// tests/reproductions/[test-name].repro.test.ts
// Reproduction of: [Original Test] from [file:line]
// Hypothesis [N]: [Root cause explanation - what timing/race condition causes the failure]
// Attempt [X] of hypothesis [N]

test('reproduces timing issue', async () => {
  // Simulate timing conditions that trigger failure
  // May need to adjust delays, concurrent operations, or resource contention
  // Document environment factors that affect reproduction
});
```
</timing-dependent>

</reproduction-templates>

## Phase 1: Static Analysis

Navigate to [TARGET_DIRECTORY]. Run [TYPE_CHECK_COMMAND] BEFORE any test execution to capture type errors. When TypeScript errors are detected (TS2322, TS2769, TS2345, TS2739, or other TS errors), treat each error as a failure requiring analysis.

For each TypeScript error:
1. Read the relevant source file for context
2. Execute `print-typescript-types` on relevant files and packages for type analysis
3. Search for information about the error code
4. Analyze the type error by identifying:
   - The type mismatch
   - Expected type vs actual type
   - Why the implementation violates the type system
   - Root cause and impact on codebase functionality
5. Store the analysis for the report

**Important**: Continue to test execution regardless of type errors. Tests may still run despite TypeScript errors, allowing analysis of both type and runtime failures. Only analyze and document errors - do not attempt fixes.

## Phase 2: Test Execution

In [TARGET_DIRECTORY], execute each command in [TEST_COMMANDS] sequentially. For each test command, capture the output and parse results to identify all failed tests, storing failure details including name, error message, and location.

## Phase 3: Failure Analysis & Reproduction

For each failing test, perform the following analysis:

### 3.1 Skip Conditions

Skip reproduction if test is in `tests/reproductions/` directory (already a reproduction test) or if the test is not valid according to the `<valid-tests>` section.

**Include all skipped tests in the "Invalid or Questionable Tests" section of the report.**

### 3.2 Hypothesis-Driven Reproduction

Create hypothesis-driven reproductions following this process:

#### Step 1: Read test file and relevant source files
Always read source files before analyzing failures or creating reproductions. Store file contents for reference throughout the analysis. Note dependencies, setup requirements, and analyze error messages for root cause clues.

#### Step 2: Formulate hypotheses
State a clear theory about WHY the test is failing (what is broken and why it causes the failure).

#### Step 3: Create reproduction test
Create reproduction test at tests/reproductions/[test-name].repro.test.ts following the examples in `<reproduction-templates>` and including:
   - Original test reference in comments
   - Hypothesis number (1-5) and attempt number
   - Minimal code to trigger the error based on your theory

#### Step 4: Verify reproduction
Execute the reproduction test and compare error type and message with original failure:
   - If successful: Document root cause, key triggering factors, and implications
   - If failed (mismatch): Delete the reproduction file immediately if it fails to reproduce the original error pattern, document the mismatch details
   - Continue refining the same hypothesis until success or definitive disproval

#### Step 5: Iterate through hypotheses
Manage hypotheses with the following rules:
   - Maximum 5 hypotheses per failing test
   - Unlimited attempts within each hypothesis
   - Track hypothesis number (1-5) and attempts separately
   - Document conclusive evidence when disproving hypotheses

**After all 5 hypotheses have been attempted without success, document all attempts and mark test as unreproducible.**

## Phase 4: Report Generation

<report-structure>
# Test & Type Error Analysis Report

**Directory**: [TARGET_DIRECTORY]
**Type Errors Found**: [count]
**Failed Tests**: [X] of [Y] tests
**Reproductions**: [count]

## Executive Summary
[Overview paragraph describing type errors found, test results, and reproduction success rate]

## Type Error Details
[Only include if type errors were encountered]

### [Error Code] ([count] occurrences)

#### [file:line] - [specific error message]
- **Context**: [Brief description of where this occurs in the code]
- **Expected Type**: [What TypeScript expects]
- **Actual Type**: [What was provided]
- **Root Cause**: [Why this type mismatch exists]
- **Impact**: [How this affects the codebase functionality]

## Failed Tests
- [test]: [error message]
  - Original: [file:line]
  - Reproduction: tests/reproductions/[test].repro.test.ts
- [test]: [error message]
  - Original: [file:line]
  - Reproduction: Failed after 5 hypotheses

## Test Validity Assessment

### Invalid/Questionable Tests
Tests that were not attempted for reproduction due to validity concerns:

#### [test-name]
- **Original**: [file:line]
- **Reasoning**: [Brief explanation of why the test is invalid/questionable]

## Reproduction Results

### Successful Reproductions

#### [test-name] (tests/reproductions/[test].repro.test.ts)
- **Original**: [file:line]
- **Root Cause**: [What the minimal reproduction reveals about why the test fails]
- **Key Factors**: [Essential conditions/setup that trigger the failure]
- **Implications**: [What this tells us about the underlying issue]

### Failed Reproductions

#### [test-name]
- **Original**: [file:line]
- **Hypotheses Tested**: [N]/5
- **Hypothesis Details**:
  1. **Hypothesis 1**: [Root cause explanation]
     - Final status: Definitively disproved
     - Evidence against: [What ruled out this hypothesis]
  2. **Hypothesis 2**: [Root cause explanation]
     - Final status: Definitively disproved
     - Evidence against: [What ruled out this hypothesis]
  3. **Hypothesis 3**: [Root cause explanation]
     - Final status: Abandoned - inconclusive
     - Key findings: [What we discovered while testing]
- **What We Learned**: [Key insights gained from testing all hypotheses]
- **Remaining Unknowns**: [What aspects of the failure remain unclear]
- **Possible Factors**: [Environmental, timing, or other factors that might be involved]

## File Inventory

### Created Files
- `tests/reproductions/[test].repro.test.ts` - [Brief description]

### Skipped Files
- [test]: Failed after 5 hypotheses - could not isolate root cause
- [test2]: Skipped - invalid test

## Execution Instructions

From package root directory:
```bash
# Single reproduction
yarn test tests/reproductions/[test].repro.test.ts

# All reproductions
yarn test tests/reproductions/
```
</report-structure>

Create a comprehensive report following the `<report-structure>` at [DESTINATION] with these content rules:

- Keep content factual and descriptive
- Do not include fix recommendations or solution suggestions
- Do not include reproduction test code in the report
- Document root causes for successful reproductions
- Document learnings from all hypotheses tested