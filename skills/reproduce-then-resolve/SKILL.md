---
name: reproduce-then-resolve
description: Reproduce a bug with a minimal failing test, then resolve it with
  test-first verification. Use when the user reports a bug, says "reproduce
  this", "fix this bug", or wants a failing test that guards the fix before any
  source changes.
---

<instructions>

The test-first invariant governs everything below: a reproduction test must FAIL before the fix and PASS after it. A test that passes on the unfixed code has proven nothing.

## 1. Establish the Bug

Take [REQUEST] from the user's message — the `<user-request>` block above on Claude Code, otherwise the message that invoked this skill — or from the conversation. Extract:

- [BUG_DESCRIPTION] — what the bug is, with expected versus actual behavior. Required.
- [SCOPE_HINT] — the files, packages, or areas involved. Optional.

Also resolve, once, how this repository runs a single test: [TEST_COMMAND]. Read it from the project's package manifest or its contributor conventions rather than assuming.

**STOP** — ask the user to clarify when no bug can be determined, or when no single-test command can be found. Do not continue without both.

## 2. Establish the Baseline

Run `git status --porcelain`.

- **Dirty tree**: ask the user how to proceed — stash (`git stash push -m "pre-reproduce-resolve"`), commit first and exit, or proceed anyway with limited rollback.
- **Clean tree**: continue.

Generate [CHECKPOINT_SLUG] from [BUG_DESCRIPTION]: 2-4 identifying words, lowercased, spaces to hyphens, only `[a-z0-9-]`, at most 30 characters. "User crashes when name is null" becomes `null-user-crash`.

Tag the baseline:

```
git tag -f rr/[CHECKPOINT_SLUG]/baseline HEAD
```

## 3. Create the Reproduction Test

Initialize [REPRODUCTION_ATTEMPT] = 0, then repeat until the test fails against the unfixed code.

Increment [REPRODUCTION_ATTEMPT], up to a maximum of 2.

Spawn `general-purpose` sub-agents (`spawn_agent` with `agent_type: general-purpose`)

Give it this prompt:

```
# Task: Create Minimal Reproduction Test

## Bug
[BUG_DESCRIPTION]

## Scope
[SCOPE_HINT]

## Previous Attempt Failed        <!-- include only when [REPRODUCTION_ATTEMPT] > 1 -->
The previous test PASSED when it should have FAILED:

[TEST_PASS_ANALYSIS]

Previous test code (DO NOT repeat):

[previous test content]

## Requirements
- Create a NEW test file; do not modify existing tests
- The test must be minimal and MUST FAIL, demonstrating the bug
- Follow the existing test patterns in this codebase

## Response Format
## Status
[SUCCESS | BLOCKED | CANNOT_COMPLETE]

## Result
[Absolute file path created, or "None"]

## Reasoning
[How the test reproduces the bug, or why blocked]
```

Handle the response:

- **SUCCESS**: extract [TEST_FILE_PATH] and continue below without prompting the user.
- **BLOCKED**: present the reasoning, ask the user for guidance, retry this step.
- **CANNOT_COMPLETE**: present the reasoning, ask the user to clarify or abort.

Verify through git rather than trusting the report. Confirm the file exists, and check for modifications to existing files:

```
MODIFIED=$(git diff rr/[CHECKPOINT_SLUG]/baseline --name-only --diff-filter=M)
```

**Unexpected modifications exist**: report them and ask the user to keep them, stash them (`git stash push -m "pre-reproduction-test" -- $MODIFIED`), or discard them (`git checkout rr/[CHECKPOINT_SLUG]/baseline -- $MODIFIED`). Never discard without explicit consent.

Then stage and run the test:

```
git add "[TEST_FILE_PATH]"
[TEST_COMMAND] "[TEST_FILE_PATH]"
```

- **The test FAILS**: capture [TEST_FAILURE_OUTPUT], commit it with a message recording the bug, the test file, and a brief failure summary, then tag `rr/[CHECKPOINT_SLUG]/reproduction` at HEAD. Continue to Step 4: Resolve the Bug.
- **The test PASSES**: read it, work out why it passes instead of failing, and record that as [TEST_PASS_ANALYSIS]. Revert to the baseline (`git checkout rr/[CHECKPOINT_SLUG]/baseline -- .` then `git clean -fd`). Below the attempt limit, retry this step with the analysis attached. At the limit, ask the user whether the bug is already fixed, whether they can supply guidance, or whether to abort.

## 4. Resolve the Bug

Initialize [RESOLVE_ATTEMPT] = 0 and [TEST_IS_MODIFIED] = false.

Map the data flow before proposing any fix:

1. Find [DATA_FLOW_SYMPTOM] — where the bug manifests, from [TEST_FAILURE_OUTPUT].
2. Find [DATA_FLOW_SOURCE] — trace backward to the data or state that causes it, and where it is set.
3. Map [DATA_FLOW_PATH] — the chain from source to symptom.

Any fix must alter [DATA_FLOW_PATH] so that correct data reaches the symptom. Verify the edges: a new read needs something that writes the data; a new write needs something that reads it; a new parameter needs callers that pass it; a new branch needs production code that triggers it. A fix that fails this check is dead code — a capability nothing exercises.

Increment [RESOLVE_ATTEMPT], up to a maximum of 2, then dispatch:

Spawn `general-purpose` sub-agents (`spawn_agent` with `agent_type: general-purpose`)

Give it this prompt:

```
# Task: Fix Bug to Make Test Pass

## Bug
[BUG_DESCRIPTION]

## Failing Test
File: [TEST_FILE_PATH]

## Test Output
[TEST_FAILURE_OUTPUT]

## IMPORTANT: Source Only         <!-- include only when [TEST_IS_MODIFIED] = true -->
The test has already been corrected. DO NOT modify the test file.
Fix only the source code.

## Data Flow
Source: [DATA_FLOW_SOURCE]
Symptom: [DATA_FLOW_SYMPTOM]
Path: [DATA_FLOW_PATH]

## Requirements
- Fix the source code to make the test pass
- The fix must modify the data flow path so correct data reaches the symptom
- If adding a parameter, confirm callers will pass it
- If adding a read, confirm something writes the data
- Do not break existing functionality

## If the Test Needs Correction
If the test itself is wrong (bad assertions, incorrect setup):
1. Modify ONLY the test; do not also fix source
2. Return status TEST_MODIFIED

The orchestrator will verify the modified test still fails, then re-run resolution.

## Response Format
## Status
[SUCCESS | TEST_MODIFIED | BLOCKED | CANNOT_COMPLETE]

## Result
[File paths modified, or "None"]

## Reasoning
[Fix explanation, or why the test was modified, or why blocked]
```

Capture [RESOLVER_REASONING], then verify the real changes through git:

```
CHANGES=$(git diff rr/[CHECKPOINT_SLUG]/reproduction --name-only)
git diff --quiet rr/[CHECKPOINT_SLUG]/reproduction -- "[TEST_FILE_PATH]"
TEST_WAS_MODIFIED=$?
SOURCE_CHANGES=$(echo "$CHANGES" | grep -v "[TEST_FILE_PATH]")
```

- **BLOCKED or CANNOT_COMPLETE**: present the reasoning and ask whether to restart with guidance, intervene manually, or abort.
- **SUCCESS with the test untouched**: validate the fix by running the test. If it passes, continue to Step 5: Validate the Full Suite. If it fails, retry the resolver with the failure output, or ask the user at the attempt limit.
- **TEST_MODIFIED, or git reports the test changed**: revert any source changes the resolver also made, keeping only the test (`git checkout rr/[CHECKPOINT_SLUG]/reproduction -- $SOURCE_CHANGES`), then run the corrected test.

Judge the corrected test:

- **It FAILS**: commit the correction with a message recording the bug, the file, and the reason for correcting it; re-tag `rr/[CHECKPOINT_SLUG]/reproduction`; capture the new [TEST_FAILURE_OUTPUT]; set [TEST_IS_MODIFIED] = true; return to this step so the resolver fixes source only.
- **It PASSES**: the correction made the test pass with no source fix, which is not valid. Revert the test (`git checkout rr/[CHECKPOINT_SLUG]/reproduction -- "[TEST_FILE_PATH]"`) and retry the resolver with a note about the invalid change, or ask the user at the attempt limit.

## 5. Validate the Full Suite

Run the project's full test command and check for regressions.

- **Everything passes**: continue to Step 6: Report.
- **Regressions**: report which tests fail and ask the user whether to investigate, to revert the source to the reproduction checkpoint and try Step 4 again, or to accept the regressions with a warning.

## 6. Report

Gather the changes:

```
git diff rr/[CHECKPOINT_SLUG]/baseline --stat
```

Report the bug, the test file with its before-and-after verification, the files and approach of the fix, the validation result, and the two checkpoint tags. Offer to delete them:

```
git tag -d rr/[CHECKPOINT_SLUG]/baseline rr/[CHECKPOINT_SLUG]/reproduction
```

</instructions>
