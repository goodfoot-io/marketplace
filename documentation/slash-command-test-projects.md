# Test Projects for /goodfoot:plan-then-implement

These test projects are designed to exercise different aspects of the plan-then-implement slash command. Each creates artifacts in `/tmp/` directories for easy cleanup and evaluation.

---

## Test 1: Parallel Task Execution

**Goal**: Test parallel grouping, file boundary enforcement, and multi-agent coordination.

**Setup** (run before test):
```bash
mkdir -p /tmp/test-parallel/src
cat > /tmp/test-parallel/src/math.ts << 'EOF'
export function add(a: number, b: number): number {
  return a + b;
}
EOF

cat > /tmp/test-parallel/src/string.ts << 'EOF'
export function capitalize(s: string): string {
  return s.toUpperCase();
}
EOF

cat > /tmp/test-parallel/package.json << 'EOF'
{
  "name": "test-parallel",
  "version": "1.0.0",
  "scripts": {
    "typecheck": "echo 'Types OK'",
    "test": "echo 'Tests OK'",
    "lint": "echo 'Lint OK'"
  }
}
EOF
```

**Prompt**:
```
/goodfoot:plan-then-implement Add three utility functions to the test-parallel project in /tmp/test-parallel/src/: (1) a multiply function in math.ts, (2) a lowercase function in string.ts, and (3) a new array.ts file with a sum function that adds all numbers in an array. Each file should be independent with no shared dependencies. Write the implementation directly without tests since this is a simple utility project.
```

**What to Evaluate**:
- Did it create parallel groups correctly (3 independent tasks)?
- Did each agent stay within its file boundaries?
- Were all three files modified/created as expected?
- Did validation pass?

---

## Test 2: Sequential Dependencies

**Goal**: Test dependency tracking, sequential execution, and task rationale preservation.

**Setup** (run before test):
```bash
mkdir -p /tmp/test-sequential/src
cat > /tmp/test-sequential/src/types.ts << 'EOF'
// Empty types file - needs type definitions
EOF

cat > /tmp/test-sequential/src/validator.ts << 'EOF'
// Empty validator - needs implementation
EOF

cat > /tmp/test-sequential/src/processor.ts << 'EOF'
// Empty processor - needs implementation
EOF

cat > /tmp/test-sequential/package.json << 'EOF'
{
  "name": "test-sequential",
  "version": "1.0.0",
  "scripts": {
    "typecheck": "echo 'Types OK'",
    "test": "echo 'Tests OK'",
    "lint": "echo 'Lint OK'"
  }
}
EOF
```

**Prompt**:
```
/goodfoot:plan-then-implement Build a simple data pipeline in /tmp/test-sequential/src/ with clear dependencies: (1) First, define a User type in types.ts with fields id, name, and email. (2) Then, create a validateUser function in validator.ts that imports the User type and checks that all fields are non-empty strings. (3) Finally, create a processUsers function in processor.ts that imports both the User type and validateUser, filters an array to only valid users, and returns them. Each step depends on the previous.
```

**What to Evaluate**:
- Did it identify the sequential dependency chain (types → validator → processor)?
- Did tasks execute in correct order?
- Do imports work correctly across files?
- Is the rationale for each task's dependency documented in the plan?

---

## Test 3: Bug Fix with Test-First Approach

**Goal**: Test TDD workflow, exploration of existing code, and the validation agent's error handling.

**Setup** (run before test):
```bash
mkdir -p /tmp/test-bugfix/src
cat > /tmp/test-bugfix/src/calculator.ts << 'EOF'
/**
 * Calculates the average of an array of numbers.
 * BUG: Returns NaN for empty arrays instead of 0.
 * BUG: Doesn't handle non-numeric values in array.
 */
export function average(numbers: number[]): number {
  const sum = numbers.reduce((acc, n) => acc + n, 0);
  return sum / numbers.length;  // Bug: division by zero for empty array
}

/**
 * Calculates percentage of a value.
 * BUG: Returns incorrect value (multiplies by 10 instead of 100).
 */
export function percentage(value: number, total: number): number {
  return (value / total) * 10;  // Bug: should be * 100
}
EOF

cat > /tmp/test-bugfix/src/calculator.test.ts << 'EOF'
import { average, percentage } from './calculator';

describe('calculator', () => {
  describe('average', () => {
    it('calculates average of numbers', () => {
      expect(average([1, 2, 3])).toBe(2);
    });

    // Missing: test for empty array
    // Missing: test for single element
  });

  describe('percentage', () => {
    it('calculates percentage', () => {
      expect(percentage(25, 100)).toBe(25);  // This test would FAIL with current bug
    });
  });
});
EOF

cat > /tmp/test-bugfix/package.json << 'EOF'
{
  "name": "test-bugfix",
  "version": "1.0.0",
  "scripts": {
    "typecheck": "echo 'Types OK'",
    "test": "echo 'Running tests...' && echo 'FAIL: percentage test - expected 25, got 2.5' && exit 1",
    "lint": "echo 'Lint OK'"
  }
}
EOF
```

**Prompt**:
```
/goodfoot:plan-then-implement Fix the bugs in /tmp/test-bugfix/src/calculator.ts. The average function should return 0 for empty arrays (not NaN). The percentage function returns wrong values (the test is failing). First write tests that reproduce each bug, then fix the implementation to make the tests pass. Check the existing test file for context on what tests exist.
```

**What to Evaluate**:
- Did it explore the codebase to find existing patterns and tests?
- Did it follow test-first approach (write failing test, then fix)?
- Did the plan document "Out of Scope" items appropriately?
- How did the validation agent handle the initially failing test?
- Did the final validation show PRODUCTION_READY status?

---

## Running the Tests

1. Run the setup commands for each test
2. Execute the prompt in a fresh Claude Code session
3. Save/export the conversation transcript
4. Check the `projects/` directory for the plan artifacts
5. Verify the files in `/tmp/test-*/` contain expected changes

## Cleanup

```bash
rm -rf /tmp/test-parallel /tmp/test-sequential /tmp/test-bugfix
rm -rf projects/new/* projects/active/* projects/ready-for-review/*
```
