---
name: tdd-implementation
description: |
  Test-driven development workflow for implementing new functionality.
  Use when: (1) implementing new functions or methods, (2) adding new features,
  (3) writing code that requires tests. Guides through: creating types/stubs,
  writing skipped tests, then implementing to make tests pass.
---

# TDD Implementation Workflow

Follow this workflow when implementing new functionality.

## Workflow

### Phase 1: Types and Stubs

Create the type definitions and function/method stubs first.

```typescript
// Define types
interface UserInput {
  name: string;
  email: string;
}

interface UserOutput {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// Create stub that throws
export function createUser(input: UserInput): Promise<UserOutput> {
  throw new Error('Not Implemented');
}
```

**Guidelines:**
- Define all input/output types
- Export functions/methods with correct signatures
- Throw `Error('Not Implemented')` in function bodies
- This establishes the API contract before implementation

### Phase 2: Write Skipped Tests

Write tests using `it.skip` for the functionality.

```typescript
describe('createUser', () => {
  it.skip('should create a user with valid input', async () => {
    const input = { name: 'Alice', email: 'alice@example.com' };
    const result = await createUser(input);

    expect(result).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it.skip('should throw on invalid email', async () => {
    const input = { name: 'Bob', email: 'invalid' };
    await expect(createUser(input)).rejects.toThrow('Invalid email');
  });
});
```

**Guidelines:**
- Use `it.skip` for all new tests (they would fail against stubs)
- Cover the expected behavior thoroughly
- Include error cases and edge cases
- Tests document the expected contract

### Phase 3: Implement and Unskip

Implement the function, then unskip and run tests.

```typescript
export async function createUser(input: UserInput): Promise<UserOutput> {
  if (!isValidEmail(input.email)) {
    throw new Error('Invalid email');
  }

  const id = generateId();
  return {
    id,
    name: input.name,
    email: input.email,
    createdAt: new Date(),
  };
}
```

**Process:**
1. Implement the function
2. Change `it.skip` to `it` for related tests
3. Run tests to verify
4. Fix any failures
5. Repeat for remaining skipped tests

## Summary

| Phase | Action | Test State |
|-------|--------|------------|
| 1. Types & Stubs | Define types, create throwing stubs | No tests yet |
| 2. Write Tests | Write comprehensive tests | `it.skip` |
| 3. Implement | Fill in implementation | `it` (unskipped) |
