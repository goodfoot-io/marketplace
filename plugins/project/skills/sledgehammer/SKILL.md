---
name: sledgehammer
description: Test failure recovery procedure that deletes infected code and rebuilds differently when validation reveals regression (errors increased) after multiple failed attempts.
---

This skill provides the complete procedure for **Attempt 4** sledgehammer recovery when errors have INCREASED after 3 failed implementation attempts.

## Sledgehammer Invocation Template

### For Sequential Task Recovery

**Derive these values from your context:**
- `[PROJECT_PATH]`: Full path to the project (e.g., `projects/active/add-user-auth`)
- `[PROJECT_NAME]`: Project name from path (e.g., `add-user-auth`)
- `[TASK_CHECKPOINT]`: Git SHA from before the failing task started
- `[TASK_DESCRIPTION]`: Description from the todo that failed
- `[APPROACH_SUMMARY]`: Brief summary of what implementation approach was attempted
- `[PACKAGES_LIST]`: List of packages from plan.md
- `[FILES_MODIFIED]`: List from `git diff --name-only [TASK_CHECKPOINT]`
- `[CURRENT_ERRORS]`, `[BASELINE_ERRORS]`: Actual error counts from validation
- `[CURRENT_FAILURES]`, `[BASELINE_FAILURES]`: Test failure counts
- `[CURRENT_LINT]`, `[BASELINE_LINT]`: Lint error counts
- `[ERROR_DETAILS]`: Specific error messages with file:line

**Template:**

```xml
<invoke name="Task">
<parameter name="description">Delete and rebuild failing code</parameter>
<parameter name="subagent_type">project:sledgehammer</parameter>
<parameter name="prompt">
Name: [PROJECT_NAME]
    Path: [PROJECT_PATH]
    Plan: @[PROJECT_PATH]/plan.md
    Log: @[PROJECT_PATH]/log.md

    ## Regression Detected
    Errors have INCREASED after implementation attempt.
    Your job: DELETE the infected code and REBUILD differently.

    ## Project Structure
    This is a monorepo with packages in ./packages/
    Package directories: [PACKAGES_LIST]

    ## Task That Failed
    Task attempted: [TASK_DESCRIPTION]
    Checkpoint SHA: [TASK_CHECKPOINT]
    Implementation approach taken: [APPROACH_SUMMARY]

    ## Files Modified (Primary Infection Sites)
    [FILES_MODIFIED]
    These are your primary deletion targets.

    ## Current Validation Failures
    [Full validation output showing the regression:]
    - TypeScript errors: [CURRENT_ERRORS] errors (was [BASELINE_ERRORS])
    - Test failures: [CURRENT_FAILURES] failures (was [BASELINE_FAILURES])
    - Lint errors: [CURRENT_LINT] errors (was [BASELINE_LINT])
    - Specific error details: [ERROR_DETAILS]
</parameter>
</invoke>
```

### For Parallel Batch Recovery

Use same template but include:
- List all task-ids in the batch
- Files modified by each task (group by task)
- Note batch checkpoint SHA
- Show which tasks in the batch caused regressions

## Post-Sledgehammer Actions

After the project:sledgehammer agent completes:

### 1. Check Sledgehammer Status

**If Status: COMPLETED**
- Code was successfully deleted and rebuilt
- Validation passed with zero errors
- Proceed to commit and continue

**If Status: NEEDS_REVISION**
- Sledgehammer attempt failed
- Do NOT retry sledgehammer
- Proceed to Attempt 5 (mark as BLOCKED)

### 2. Process COMPLETED Status

**Actions:**

1. Commit the successful sledgehammer fix:
   ```bash
   git commit -m "completed: [TASK_ID] - sledgehammer recovery"
   ```

2. Update todo:
   ```xml
   <invoke name="TodoWrite">
   <parameter name="todos">
   [
     {
       "content": "[ORIGINAL_TASK_CONTENT]",
       "status": "completed",
       "activeForm": "Task completed via sledgehammer recovery"
     }
   ]
   </parameter>
   </invoke>
   ```

3. Document in `[PROJECT_PATH]/log.md`:
   ```markdown
   ## Sledgehammer Recovery - [TIMESTAMP]
   Task: [TASK_ID]
   Attempt: 4
   Status: COMPLETED

   ### Approach Taken
   [What sledgehammer did differently]

   ### Validation Results
   All validation commands passed with zero errors.
   ```

4. Continue to next todo.

### 3. Process NEEDS_REVISION Status

Do NOT retry. Proceed to Attempt 5.

**Actions:**

1. Do NOT commit - revert to checkpoint:
   ```bash
   git reset --hard [TASK_CHECKPOINT]
   git clean -fd
   ```

2. Mark as BLOCKED:
   ```xml
   <invoke name="TodoWrite">
   <parameter name="todos">
   [
     {
       "content": "[ORIGINAL_TASK_CONTENT] [BLOCKED after 5 attempts including sledgehammer]",
       "status": "in_progress",
       "activeForm": "Blocked - requires external intervention"
     }
   ]
   </parameter>
   </invoke>
   ```

3. Document in `[PROJECT_PATH]/log.md`:
   ```markdown
   ## Task Blocked - [TIMESTAMP]
   Task: [TASK_ID]
   Attempts: 5 (including sledgehammer)
   Status: BLOCKED

   ### Blocking Reasons
   - Standard recovery failed (3 attempts)
   - Sledgehammer recovery failed (1 attempt)
   - [SPECIFIC_TECHNICAL_BLOCKERS]

   ### Requires
   [EXTERNAL_INTERVENTION_NEEDED]
   ```

4. Preserve checkpoint for manual intervention. Proceed to Phase 7 evaluation or next todo.

## Sledgehammer Philosophy

The sledgehammer approach:
- **Deletes** infected code completely (nuclear option)
- **Analyzes** what went wrong in previous attempts
- **Rebuilds** using DIFFERENT approach
- **Validates** with zero-tolerance policy

This is not a retry - it's a complete reset and rebuild with new strategy.

## Success Criteria

Sledgehammer succeeds when:
- All infected files identified and deleted
- Code rebuilt with fundamentally different approach
- All validation commands pass with zero errors
- No regression vs baseline metrics

Sledgehammer fails when:
- Cannot identify different viable approach
- New approach also fails validation
- Fundamental blocker exists (external dependency, etc.)
