---
name: failure-analysis
description: Comprehensive failure analysis methodology for extracting learnings from implementation failures, test failures, and validation errors.
---

Use this skill when you need to analyze implementation failures, test failures, or validation errors to extract root causes, pattern mistakes, and actionable guidance.

## Analysis Procedure

When you determine failure analysis is needed, invoke a general-purpose agent to perform systematic failure investigation.

**Derive these values from your context:**
- `[PROJECT_PATH]`: Full path to the project (e.g., `projects/active/add-user-auth`)
- `[PROJECT_NAME]`: Project name from path (e.g., `add-user-auth`)
- `[AFFECTED_PACKAGES]`: Packages with errors from validation output (e.g., `packages/api, packages/shared`)
- `[TIMESTAMP]`: Current timestamp in format YYYYMMDD_HHMMSS
- `[REPORT_PATH]`: `[PROJECT_PATH]/reports/implementation-failure-[TIMESTAMP].md`

**Invocation Template:**

```xml
<invoke name="Agent">
<parameter name="description">Analyze implementation failure</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt">
Perform comprehensive failure analysis for packages: [AFFECTED_PACKAGES]

    ## Step 1: Run Validation Commands

    Read Validation Commands from @[PROJECT_PATH]/plan.md.
    If no Validation Commands section exists, use defaults:
    - yarn typecheck
    - yarn test
    - yarn lint

    For each affected package, run ALL validation commands and capture:
    - Complete error output
    - Error codes (TS2322, TS2554, etc.)
    - File paths with line:column numbers
    - Test names and failure messages
    - Stack traces for runtime errors

    ## Step 2: Categorize Failures

    Group errors by type:

    **Type Errors:**
    - Error code and location (file:line:column)
    - Both types involved in mismatch
    - Property differences or signature mismatches

    **Test Failures:**
    - Test suite and test case name
    - Expected vs actual values
    - Whether test is timing out or throwing
    - Any "open handles" warnings

    **Lint Errors:**
    - Rule violated and location
    - Whether fixable automatically
    - Whether requires logic change

    ## Step 3: Identify Root Causes

    For each category, investigate:

    **For Type Errors:**
    - Read both type definitions completely
    - Identify which property/signature doesn't match
    - Trace where the incompatible value originates
    - Check if recent changes introduced the mismatch

    **For Test Failures:**
    - Read complete test code
    - Trace all async operations
    - Check for missing awaits or unresolved promises
    - Identify what code change triggered the failure
    - Look for resource leaks (connections, timers)

    **For Lint Errors:**
    - Determine if it's a style issue or logic problem
    - Check if error indicates deeper architectural issue

    ## Step 4: Identify Patterns and Anti-Patterns

    Look for recurring mistakes:
    - Wrong abstractions (overengineering or underspecification)
    - Missing null/undefined checks
    - Incorrect async/await usage
    - Type assertions masking real issues
    - Mocks causing test failures
    - Resource cleanup issues

    ## Step 5: Find Working Patterns

    Search codebase for successful implementations:
    - How similar features handle the same problem
    - What patterns exist for this type of operation
    - What testing approaches work reliably

    ## Step 6: Generate Report

    Create comprehensive report at: [REPORT_PATH]

    Use this structure:

    \`\`\`markdown
    # Implementation Failure Analysis
    Date: [TIMESTAMP]
    Affected Packages: [AFFECTED_PACKAGES]

    ## Validation Results Summary

    - TypeScript errors: [COUNT] errors
    - Test failures: [COUNT] failures
    - Lint errors: [COUNT] errors

    ## Root Causes Identified

    ### [Category 1: e.g., Type System Violations]

    **Issue:** [Description]
    **Location:** [file:line]
    **Root Cause:** [Fundamental problem]
    **Evidence:** [Code snippets, error messages]

    ### [Category 2: e.g., Test Infrastructure Issues]

    **Issue:** [Description]
    **Root Cause:** [Fundamental problem]
    **Evidence:** [Stack traces, async operations]

    ## Pattern Mistakes to Avoid

    1. **[Anti-pattern name]:** [Description]
       - Why it's problematic: [Explanation]
       - Example: [Code showing the mistake]

    2. **[Anti-pattern name]:** [Description]
       - Why it's problematic: [Explanation]
       - Example: [Code showing the mistake]

    ## Code Patterns That Work

    1. **[Pattern name]:** [Description]
       - Where it's used successfully: [file:line references]
       - Example: [Working code snippet]

    2. **[Pattern name]:** [Description]
       - Where it's used successfully: [file:line references]
       - Example: [Working code snippet]

    ## Guidance for Future Implementations

    ### Immediate Fixes Required

    1. [Specific fix with file:line]
    2. [Specific fix with file:line]

    ### Approach Recommendations

    - **Instead of:** [What was attempted]
    - **Use:** [Recommended approach based on working patterns]
    - **Rationale:** [Why this will succeed]

    ### Testing Recommendations

    - [Specific testing guidance based on failures]
    - [Resource cleanup requirements]
    - [Async handling best practices]
    \`\`\`

    Create the report file with these findings.
</parameter>
</invoke>
```

---

## Post-Analysis Actions

After the general-purpose agent completes and generates the report:

### 1. Read the Generated Report
Read the report at: `[PROJECT_PATH]/reports/implementation-failure-[TIMESTAMP].md`

### 2. Extract Key Findings
From the report, identify:
- Root causes of failures
- Pattern mistakes to avoid
- Type system violations
- Code changes that triggered failures
- Environmental factors

### 3. Append to Project Log

Add implementation failure analysis entry to `[PROJECT_PATH]/log.md`:

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

### 4. Update Todo with Insights

Update the todo description with failure insights:
```xml
<invoke name="TodoWrite">
<parameter name="todos">
[
  {
    "content": "Original task [ATTEMPT N+1 - Root cause: summary from analysis]",
    "status": "in_progress",
    "activeForm": "Retrying with failure insights"
  }
]
</parameter>
</invoke>
```

---

## Analysis Focus Areas

The analysis focuses on:
- **Root Causes**: What fundamentally went wrong
- **Pattern Mistakes**: Architectural or design anti-patterns
- **Type Violations**: Type system mismatches and their sources
- **Test Triggers**: What code changes caused test failures
- **Environmental Issues**: Infrastructure or configuration problems
