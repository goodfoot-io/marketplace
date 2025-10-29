# Parser Tests

This directory contains comprehensive test suites for the organization protocol parser rules.

## Test Structure

```
tests/
├── lib/                      # Test utilities and helpers
│   ├── test-workspace.ts    # Functions for creating test workspaces
│   └── test-helpers.ts      # Common test helper functions
└── rules/                   # Individual rule test suites
    ├── DUPLICATE_TEMPLATES_DIR.test.ts
    ├── MISSING_BLACKBOARD.test.ts
    └── ... (one test file per rule)
```

## Running Tests

```bash
# Run all tests
yarn test

# Run tests for a specific rule
yarn test MISSING_BLACKBOARD

# Run tests with coverage
yarn test --coverage

# Run tests in watch mode
yarn test --watch
```

## Test Philosophy

Our tests follow functional testing principles:

- Each test is self-contained with its own test workspace
- No mocks or spies - we test actual file system operations
- Focus on structural validation, not string matching
- Clean up after each test to ensure isolation

## Test Utilities

### test-workspace.ts

Provides functions for:

- Creating temporary test workspaces
- Setting up story structures
- Managing file operations
- Cleanup after tests

Key functions:

- `createTestWorkspace()` - Creates a temporary directory
- `createStory()` - Sets up a complete story structure
- `createFile()` - Creates files with content
- `createDirectory()` - Creates directories
- `cleanupTestWorkspace()` - Removes temporary files

### test-helpers.ts

Provides:

- Violation assertion helpers
- Content generation functions
- Common test patterns

Key functions:

- `expectViolationLocations()` - Assert violation locations
- `createBlackboardContent()` - Generate valid blackboard content
- `createFeedbackFrontmatter()` - Generate feedback file frontmatter

## Writing New Tests

When adding tests for a new rule:

1. Create a test file: `tests/rules/RULE_NAME.test.ts`
2. Import test utilities and the rule
3. Structure tests to cover:
   - Happy path (no violations)
   - Various violation scenarios
   - Edge cases
   - Fix functionality (if applicable)
   - Error handling

Example structure:

```typescript
import { createTestWorkspace, cleanupTestWorkspace } from '../lib/test-workspace.js';
import rule from '../../src/rules/RULE_NAME.js';

describe('RULE_NAME Rule', () => {
  it('returns null when no violations exist', async () => {
    const workspace = await createTestWorkspace();
    // Set up valid structure
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });

  it('detects violations', async () => {
    const workspace = await createTestWorkspace();
    // Set up invalid structure
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    await cleanupTestWorkspace(workspace);
  });

  // Add more test cases...
});
```

## Test Coverage Goals

Each rule test should cover:

- ✅ Valid structures (no violations)
- ✅ Invalid structures (violations detected)
- ✅ All content directories (active, review, published, archive)
- ✅ Hidden directory handling
- ✅ Edge cases and error conditions
- ✅ Fix functionality (if rule is fixable)
- ✅ Violation properties and metadata

## Common Test Patterns

### Testing Directory Structure

```typescript
await createDirectory(workspace, 'active/story/.agents');
const violations = await rule.check(workspace);
```

### Testing File Content

```typescript
await createFile(workspace, 'active/story/agents/blackboard.yaml', 'project_metadata: ...');
const violations = await rule.check(workspace);
```

### Testing Fix Functionality

```typescript
const violations = await rule.check(workspace);
const result = await rule.fix!(workspace, violations![0]);
expect(result.fixed).toBe(true);
```

### Asserting Violations

```typescript
expect(violations).toMatchObject({
  code: 'RULE_CODE',
  location: 'expected/location',
  fixable: true
});
```
