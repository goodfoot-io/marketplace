# Standardized Test Findings Format

## Overview

This document defines the standardized format for documenting test findings, particularly for assumption tests and other testing activities within the project workflow.

## Test Result Location

Test results must be stored in a standardized location within the project scratchpad:

```
projects/[status]/[project-name]/scratchpad/[test-name]/
├── yarn.lock           # Workspace isolation
├── package.json        # Test dependencies
├── [test-name].test.ts # Test implementation
└── findings.md         # REQUIRED: Test findings documentation
```

## Findings Format

All test findings must be documented in `findings.md` using the following format:

```markdown
## Assumption Test: [Test Name]

### Question
[Exact question being answered - be specific and clear]

### Test Implementation
Location: `projects/[status]/[project-name]/scratchpad/[test-name]/`

### Results
- **Answer**: [YES/NO or specific answer]
- **Confidence**: [High/Medium/Low]
- **Evidence**: 
  - [Specific test output or measurement]
  - [Relevant data point or observation]
  - [Additional supporting evidence]

### Reproducibility
Commands to reproduce:
```bash
# Exact commands used to run the test
cd projects/[status]/[project-name]/scratchpad/[test-name]/
yarn install
yarn test
```
```

## Field Descriptions

### Question
- Must be the exact question the test aims to answer
- Should be specific and unambiguous
- Examples:
  - "Can the authentication system handle 1000 concurrent login attempts?"
  - "Does the React component re-render when props.userId changes?"
  - "Is the database connection pool thread-safe?"

### Test Implementation
- Always include the full path to the test location
- Path format: `projects/[status]/[project-name]/scratchpad/[test-name]/`
- This helps future agents locate and run the test

### Results
- **Answer**: Direct answer to the question (YES/NO for boolean questions, specific value for measurement questions)
- **Confidence**: 
  - High: Test conclusively answers the question with no ambiguity
  - Medium: Test provides strong evidence but has some limitations
  - Low: Test provides indicative results but needs more investigation
- **Evidence**: Concrete data from test execution
  - Include actual output, not interpretations
  - Use bullet points for multiple pieces of evidence
  - Be specific with numbers, error messages, or behaviors observed

### Reproducibility
- Provide exact commands that another agent can run
- Include all necessary setup steps
- Start from the project root directory
- Include any environment variables or configuration needed

## Integration with Test Creation Utilities

When using test creation utilities:
- `create-scratchpad-jest-test` already creates the proper directory structure
- `create-scratchpad-playwright-test` already creates the proper directory structure
- The assumption-tester agent MUST ensure `findings.md` is created after test execution

## Examples

### Example 1: Performance Test

```markdown
## Assumption Test: API Response Time Under Load

### Question
Can the /api/users endpoint maintain response times under 200ms with 100 concurrent requests?

### Test Implementation
Location: `projects/active/user-api-optimization/scratchpad/api-load-test/`

### Results
- **Answer**: NO
- **Confidence**: High
- **Evidence**: 
  - Average response time: 347ms
  - 95th percentile: 512ms
  - 10% of requests exceeded 1000ms timeout
  - CPU usage peaked at 98% during test

### Reproducibility
Commands to reproduce:
```bash
cd projects/active/user-api-optimization/scratchpad/api-load-test/
yarn install
yarn test:load
```
```

### Example 2: Compatibility Test

```markdown
## Assumption Test: React 18 Compatibility

### Question
Is our component library compatible with React 18's Concurrent Features?

### Test Implementation
Location: `projects/pending/react-18-upgrade/scratchpad/concurrent-mode-test/`

### Results
- **Answer**: YES
- **Confidence**: Medium
- **Evidence**: 
  - All 47 component tests pass with React 18
  - No warnings about unsafe lifecycle methods
  - Suspense boundaries work correctly
  - Note: StrictMode shows one double-render issue in DatePicker

### Reproducibility
Commands to reproduce:
```bash
cd projects/pending/react-18-upgrade/scratchpad/concurrent-mode-test/
yarn install
REACT_VERSION=18 yarn test
```
```

## Best Practices

1. **Be Specific**: Questions should be answerable with concrete evidence
2. **Document Everything**: Include all relevant output, even if it seems minor
3. **Think of Future Agents**: Write findings as if briefing a colleague who will continue the work
4. **Update Promptly**: Create findings.md immediately after test execution while details are fresh
5. **Include Context**: If the test revealed unexpected insights, document them in the evidence section