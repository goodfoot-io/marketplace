---
description: Run linting and analyze issues with grouped categorization
---

<task>
$ARGUMENTS
</task>

<instructions>
Analyze linting issues for the specified package. Run `yarn lint` (or `yarn lint src/example.ts` for specific files) from the target package directory, examine linting errors, categorize issues into groups, and output comprehensive analysis to a markdown document in the workspace `documentation` directory.

<context>
Process handles three TypeScript linting tools:
- TypeScript compiler errors (yarn typecheck)
- ESLint violations (yarn eslint) 
- Prettier formatting issues (yarn prettier)
</context>

## Phase 1: Lint Execution & Initial Analysis

Execute these steps sequentially:

### Step 1: Context Resolution
Parse the user's task from: [INCLUDE FULL REQUEST]

Identify:
- Target package location directory
- Specific files to lint (defaults to all files if unspecified)
- Output document name preference

When package location is not explicitly specified, check previous conversation context to determine if a package was recently discussed. If context lacks clarity, ask the user.

Provide:
- Resolved package path
- File patterns to execute
- Output document path

### Step 2: Lint Execution
Navigate to the resolved package directory and execute yarn lint with appropriate arguments.

For specific files: `yarn lint [FILE PATHS]`
For all files: `yarn lint`

Capture:
- Complete linting output including all errors and warnings
- Exit code and summary statistics
- TypeScript compilation errors
- ESLint rule violations
- Prettier formatting issues

### Step 3: Issue Collection
Parse the linting output to identify all issues across the three linting tools:
- TypeScript compiler errors (from yarn typecheck)
- ESLint violations (from yarn eslint)
- Prettier formatting issues (from yarn prettier)

For each issue, extract:
- File path and line/column number
- Rule name or error type
- Issue severity (error vs warning)
- Issue description/message
- Code context if available

Create a structured list of all issues for deeper analysis.

## Phase 2: Deep Issue Analysis

Determine parallel agents needed based on linting issue count:
- 1-5 issues: 2 agents
- 6-10 issues: 3 agents  
- 11-20 issues: 4 agents
- 21+ issues: 5 agents

Distribute issues ensuring each linting issue is analyzed by exactly two different agents for cross-validation. Launch all agents using a single message with multiple Task invocations.

### Parallel Analysis Agents
Analyze assigned linting issues: [ASSIGNED ISSUE SUBSET WITH OVERLAP]

Perform comprehensive examination including:

**Code Analysis:**
- Read each file with linting issues
- Examine the specific code causing violations
- Review surrounding code context
- Analyze code patterns and structures
- Inspect import statements and dependencies

**Configuration Analysis:**
- Review ESLint configuration files (.eslintrc, eslint.config.js)
- Examine TypeScript configuration (tsconfig.json)
- Check Prettier configuration (.prettierrc, prettier.config.js)
- Analyze package.json linting scripts

**Type System Analysis:**
- Examine TypeScript type definitions
- Review interface and type declarations
- Analyze generic constraints and type parameters
- Check module declarations and ambient types

Provide for each linting issue:
- Code snippets showing the problematic code with line numbers
- Explanation of why the rule was violated
- Impact assessment (breaking vs non-breaking)
- Suggested fixes with code examples
- Alternative approaches if applicable
- Configuration changes needed
- Dependencies that might need updating
- Type definition improvements

Each agent must independently analyze their assigned issues to enable cross-validation of findings.

## Phase 3: Categorization & Synthesis

After Phase 2 completes, synthesize findings into high-level categories.

### Issue Categorization
Group linting issues into categories such as:
- **TypeScript Errors**: Type mismatches, missing declarations, compilation failures
- **Code Quality**: ESLint violations for best practices, complexity, maintainability
- **Style & Formatting**: Prettier formatting inconsistencies, code style violations
- **Import/Export Issues**: Module resolution errors, circular dependencies, unused imports
- **Type Safety**: Any type usage, unsafe assertions, missing type annotations
- **Performance**: Inefficient patterns, unnecessary re-renders, memory leaks
- **Accessibility**: Missing ARIA attributes, semantic HTML violations
- **Security**: Potential security vulnerabilities, unsafe operations
- **Configuration Issues**: Linting rule conflicts, outdated configurations

Assign each issue to exactly one primary category while noting any secondary factors.

### Root Cause Analysis
Identify patterns across issues to determine:
- Common root causes affecting multiple files
- Systemic configuration problems vs isolated violations
- Priority ordering based on severity and fix complexity
- Dependencies between different types of issues

## Phase 4: Report Generation

Create a comprehensive markdown report with this structure:

```markdown
# Lint Analysis Report

**Package**: [Package Name]
**Date**: [Current Date]
**Total Files Checked**: [X]
**Issues Found**: [Y]
**Errors**: [Z] **Warnings**: [W]

## Executive Summary
[Brief overview of code quality and main issues found]

## Issue Categories

### Category 1: [Category Name] ([X] issues)
[Description of this category of issues]

#### Affected Files:
- `src/example.ts:45:12` - **Error**: [Rule Name] 
  - **Issue**: [Specific violation description]
  - **Fix**: [Suggested remediation with code example]

[Additional issues in this category...]

### Category 2: [Category Name] ([Y] issues)
[Continue for each category...]

## Root Cause Analysis
[Analysis of common patterns and systemic issues]

## Recommended Actions
1. [Prioritized list of fixes]
2. [Configuration updates needed]
3. [Dependencies to update]

## Configuration Recommendations
[Suggested ESLint, TypeScript, or Prettier config changes]

## Detailed Lint Output
[Appendix with full linting output for reference]
```

Write the report to: `[WORKSPACE ROOT]/documentation/lint-analysis-[package-name]-[timestamp].md`

<constraints>
Must execute lint commands from the correct package directory.
Must read actual source files to understand context beyond just lint output.
Must group issues meaningfully with clear categorization criteria.
Must provide actionable recommendations for each issue category.
Must include specific file paths and line numbers for easy navigation.
Must distinguish between TypeScript errors, ESLint warnings, and Prettier formatting.
Must create the documentation directory if it does not exist.
Must consider the impact of fixing issues on existing functionality.
</constraints>
</instructions>