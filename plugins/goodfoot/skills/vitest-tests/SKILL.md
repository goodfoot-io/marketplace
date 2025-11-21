---
name: vitest-tests
description: Write and debug Vitest tests with database testing, custom matchers, and teardown management. Use when writing new tests, debugging test failures, setting up test infrastructure, or when questions arise about test patterns, database testing with isolated PostgreSQL instances, teardown queue management, async testing patterns, TypeScript configuration, or Jest migration.
---

# Writing Vitest Tests

Comprehensive guide for writing Vitest tests in the Coaxial monorepo using `@goodfoot/test-utilities` patterns, isolated database testing, and automatic resource cleanup.

## Quick Start

<example>
**Basic Test Structure**

```typescript
import { teardownQueue } from '@goodfoot/test-utilities/vitest-teardown';
import { getTestSql } from '@goodfoot/test-utilities/sql';
// Note: describe, it, expect are globally available via globals: true

describe('Feature Name', () => {
  describe('specific function', () => {
    it('should describe the expected behavior', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);

      // Test implementation
      const result = await yourFunction(sql);

      expect(result).toMatchObject({ status: 'success' });
    });
  });
});
```
</example>

<instructions>
**Essential Imports**

```typescript
import { teardownQueue } from '@goodfoot/test-utilities/vitest-teardown';
import { getTestSql } from '@goodfoot/test-utilities/sql';
```

Custom matchers (`toEmit`, `toEqualSorted`, `tsStringIsEqual`) are automatically available—no imports needed.

**Test File Organization Convention**

Tests live in `tests/` directory at package root, NOT in `src/__tests__/`:

```
packages/your-package/
├── src/
│   └── handlers.ts
├── tests/                    # ✅ Test directory (separate from source)
│   ├── handlers.test.ts      # ✅ Corresponds to src/handlers.ts
│   └── integration.test.ts   # ✅ Integration tests
├── vitest.config.ts
└── package.json
```

**Why this structure:**
- Keeps test code separate from production source—prevents test files appearing in build output
- Clear distinction between source and tests
- Matches vitest.config.ts `include: ['tests/**/*.test.ts']` pattern

**Naming Pattern:** Name test files `[source-file-name].test.ts` for easy correlation.

**Examples:**
- `src/handlers.ts` → `tests/handlers.test.ts`
- `src/database.ts` → `tests/database.test.ts`
- Integration tests → `tests/integration/end-to-end.test.ts`
</instructions>

## Specialized Topics

<context>
The following instructions files provide detailed guidance for specific scenarios. Read them when you encounter the situations described.
</context>

**Setup and Configuration** (`instructions/setup-configuration.md`)
- **When to read:** Setting up tests for the first time, troubleshooting configuration, adding test scripts
- **Key situations:** Creating vitest.config.ts, configuring setupFiles, or encountering "No config file found" errors
- **Covers:** Installing Vitest, creating configuration files, TypeScript setup, validation steps

**Jest Migration** (`instructions/jest-migration.md`)
- **When to read:** Package currently uses Jest, removing `@jest/globals` imports, updating test runner
- **Key situations:** Test files import from `@jest/globals`, package.json includes Jest dependencies
- **Covers:** Migration steps, dependency updates, validation checklist, monorepo migration order

**TypeScript Configuration** (`instructions/typescript-configuration.md`)
- **When to read:** TypeScript reports errors in test files despite tests running correctly
- **Key indicators:** `error TS2304: Cannot find name 'describe'`, `error TS2582: Cannot find name 'expect'`
- **Key situations:** Vitest tests pass but `yarn typecheck` fails, IDE shows red squiggles on test globals
- **Covers:** Creating vitest.d.ts, tsconfig.json configuration, composite project setup

**Monorepo Patterns** (`instructions/monorepo-patterns.md`)
- **When to read:** Working in monorepo with shared test utilities or cross-package dependencies
- **Key situations:** Multiple packages failing typecheck with same Vitest error, shared test utilities package, build order issues
- **Key indicators:** "Cannot find name 'expect'" in non-test files, project reference errors, migrating shared utilities
- **Covers:** Project references, build order, framework-agnostic naming, workspace validation

**Database Testing** (`instructions/database-testing.md`)
- **When to read:** Testing PostgreSQL database operations with isolated test data
- **Key situations:** Testing queries, transactions, foreign key relationships, migrations, data aggregations
- **Key indicators:** Tests need database access, connection pooling issues, timestamp precision handling
- **Covers:** `getTestSql()` usage, isolation patterns, timestamp testing, connection pool management

## Core Testing Utilities

### Teardown Management: `teardownQueue`

**Location:** `@goodfoot/test-utilities/vitest-teardown`

**Purpose:** Manages cleanup operations with proper sequencing and error handling—ensures background processes, connections, and listeners are properly closed after each test.

<context>
**Key Features:**
- Per-test teardown queues (isolated cleanup)
- Priority-based execution
- Automatic invocation via `afterEach` hook
- Stack trace preservation for debugging
- Serial execution to prevent race conditions
</context>

<example>
```typescript
import { teardownQueue } from '@goodfoot/test-utilities/vitest-teardown';

it('should cleanup resources', async () => {
  const { sql } = await getTestSql();

  const close = await runTasks({ queueName: 'test', handleTask: () => {} });

  // Add cleanup to teardown queue
  void teardownQueue.add(close);

  // Teardown happens automatically after test completes
});
```
</example>

<instructions>
**Priority Levels:**
- Default: 0 (normal cleanup)
- `-1`: Database cleanups (before global)
- `-2`: Global teardown (SQL connection end)

**Critical Pattern:** Always register cleanup functions with `teardownQueue.add()` for background processes, connections, or listeners. This ensures proper cleanup even if tests fail.
</instructions>

### Custom Matchers

**Location:** `@goodfoot/test-utilities/vitest-matchers`

**Note:** Custom matchers are automatically available via setup file—no imports needed.

#### `toEmit(eventName, expected?, timeout?)`

Tests EventEmitter emissions with optional value matching.

<example>
```typescript
import type EventEmitter from 'events';

it('should emit events', async () => {
  const emitter: EventEmitter = getEventEmitter();

  // Wait for any emission
  await expect(emitter).toEmit('data');

  // Wait for specific value
  await expect(emitter).toEmit('data', { id: 123 });

  // Custom timeout (default 30000ms)
  await expect(emitter).toEmit('data', { id: 123 }, 5000);
});
```
</example>

#### `toEqualSorted(expected)`

Deep equality check ignoring array order.

<example>
```typescript
it('should match arrays ignoring order', () => {
  const received = [3, 1, 2];
  const expected = [1, 2, 3];

  expect(received).toEqualSorted(expected); // passes
});

// Works with nested structures
it('should handle nested structures', () => {
  const received = {
    items: [{ id: 2 }, { id: 1 }],
    tags: ['b', 'a']
  };
  const expected = {
    items: [{ id: 1 }, { id: 2 }],
    tags: ['a', 'b']
  };

  expect(received).toEqualSorted(expected); // passes
});
```
</example>

#### `tsStringIsEqual(expected)`

Semantic TypeScript type comparison using the TypeScript compiler.

<example>
```typescript
it('should match TypeScript types semantically', () => {
  const received = '{ a: string; b: number }';
  const expected = '{ b: number; a: string }'; // different order

  expect(received).tsStringIsEqual(expected); // passes
});
```
</example>

<instructions>
**Use Cases:**
- Testing type generation/inference
- Validating schema types
- Comparing API type definitions

**Migrating Custom Matchers from Jest:**

Migration requires only 2 changes per matcher file:

1. **Update import:** `import { expect } from '@jest/globals'` → `import { expect } from 'vitest'`
2. **Update TypeScript declaration:** Change `jest` namespace to `vitest` module (see instructions/jest-migration.md for details)

Both `jest-matcher-utils` and `@jest/expect-utils` are **fully compatible** with Vitest—keep these dependencies.
</instructions>

### Database Testing: `getTestSql()`

**Location:** `@goodfoot/test-utilities/sql`

**Purpose:** Creates isolated PostgreSQL databases for each test with automatic cleanup.

<context>
**Key Features:**
- Creates unique database with random credentials per test
- Automatic teardown after test completes
- Connection pooling (max 5 concurrent connections)
- Transforms column names to camelCase automatically
</context>

<example>
**Basic Usage:**

```typescript
import { getTestSql } from '@goodfoot/test-utilities/sql';

it('should test database operations', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  // sql is a postgres.Sql instance ready to use
  await sql`INSERT INTO users (name) VALUES ('test')`;
  const users = await sql`SELECT * FROM users`;

  expect(users).toHaveLength(1);
  // Database cleanup happens automatically
});
```
</example>

<instructions>
**Returned Object:**

```typescript
{
  username: string;    // Random username for this test DB
  password: string;    // Random password
  database: string;    // Random database name
  sql: PostgresConnection;  // postgres.js connection
  destroySql: () => Promise<void>;  // Manual cleanup (rarely needed)
}
```

For detailed database testing patterns including CRUD, transactions, aggregations, and timestamp handling, see `instructions/database-testing.md`.
</instructions>

## Common Test Patterns

### Database CRUD Operations

<example>
```typescript
describe('User Management', () => {
  it('should create and retrieve users', async () => {
    const { sql } = await getTestSql();
    await initializeDatabase(sql);

    const { createUser, getUser } = createHandlers(sql);

    const userId = await createUser({ name: 'Alice' });
    const user = await getUser({ userId });

    expect(user).toMatchObject({ name: 'Alice' });
  });
});
```
</example>

### Background Resources with Cleanup

<example>
```typescript
it('should cleanup background processes', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  const { runTasks } = createHandlers(sql);

  const close = await runTasks({
    queueName: 'test',
    handleTask: (data) => { /* Process task */ }
  });

  // Register cleanup
  void teardownQueue.add(close);

  // close() will be called automatically
});
```
</example>

### Time-Sensitive Tests

<context>
**Critical: PostgreSQL Timestamp Precision**

PostgreSQL timestamps have **millisecond precision**. Tests executing quickly may capture timestamps at the same millisecond as data creation, causing false failures.

**The Rule:** Always delay **BEFORE** capturing comparison timestamp.
</context>

<example>
```typescript
// ❌ WRONG - Flaky due to millisecond timing
it('should filter by createdBefore', async () => {
  const { queryNodes } = createNodeHandlers({ sql });

  const now = new Date().toISOString();  // May be same millisecond as test data
  const nodes = await queryNodes({ type: 'person', createdBefore: now });

  expect(nodes).toHaveLength(2); // Randomly fails
});

// ✅ CORRECT - Ensures separation
it('should filter by createdBefore', async () => {
  const { queryNodes } = createNodeHandlers({ sql });

  // Wait to ensure nodes from beforeEach are in the past
  await new Promise(resolve => setTimeout(resolve, 10));
  const now = new Date().toISOString();

  const nodes = await queryNodes({ type: 'person', createdBefore: now });
  expect(nodes).toHaveLength(2); // Stable
});
```
</example>

<instructions>
**Why it works:** 10ms delay guarantees database timestamps are separated by at least one millisecond from your comparison point, eliminating timing-based flakiness.

For updatedAfter tests requiring two delays, backdating strategies, and more patterns, see `instructions/database-testing.md`.
</instructions>

### Error Condition Testing

<example>
```typescript
it('should throw specific error types', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  const { complete } = createHandlers(sql);

  await expect(
    complete({ taskId: 'invalid', workerId: 'test', version: 0 })
  ).rejects.toThrow(TaskNotActiveError);
});
```
</example>

### Async Generators

<example>
```typescript
it('should yield values from generator', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  const { getTaskPayloadGenerator, enqueue } = createHandlers(sql);

  const generator = await getTaskPayloadGenerator<{ msg: string }>({
    queueName: 'test'
  });

  await enqueue({ queueName: 'test', taskData: { msg: 'first' } });

  const { value } = await generator.next();
  expect(value).toEqual({ msg: 'first' });

  await generator.return(); // Cleanup
});
```
</example>

## Best Practices

### 1. Always Use getTestSql() for Database Tests

<example>
**✅ DO:**

```typescript
it('should test with isolated database', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);
  // Test implementation
});
```

**❌ DON'T:**

```typescript
// Sharing database across tests
const sql = createSharedConnection();

it('should test', async () => {
  // Tests will interfere with each other
});
```
</example>

### 2. Register Background Processes for Cleanup

<example>
**✅ DO:**

```typescript
it('should cleanup properly', async () => {
  const { sql } = await getTestSql();

  const close = await startBackgroundProcess();
  void teardownQueue.add(close);
});
```

**❌ DON'T:**

```typescript
it('may leak resources', async () => {
  const close = await startBackgroundProcess();
  // Forgot to register cleanup
});
```
</example>

### 3. Use Descriptive Test Names

<example>
**✅ DO:**

```typescript
describe('enqueue', () => {
  it('should enqueue a task with default priority and max attempts', async () => {
    // Clear what's being tested
  });
});
```

**❌ DON'T:**

```typescript
describe('test', () => {
  it('works', async () => {
    // Unclear what's being tested
  });
});
```
</example>

### 4. Test One Concept Per Test

<instructions>
Focus each test on a single behavior or assertion. This makes failures easier to diagnose and tests more maintainable.
</instructions>

### 5. Use Appropriate Matchers

<instructions>
```typescript
// For exact matches
expect(task).toMatchObject({ status: 'active' });

// For array order independence
expect(results).toEqualSorted(expected);

// For TypeScript types
expect(typeString).tsStringIsEqual(expectedType);

// For events
await expect(emitter).toEmit('data', { id: 123 });
```
</instructions>

### 6. Handle Async Operations Properly

<instructions>
Always await async operations. Missing `await` is a common source of race conditions and flaky tests.
</instructions>

### 7. Organize Tests by Feature

<example>
```typescript
describe('Queue Handlers', () => {
  describe('enqueue and dequeue', () => {
    it('successfully enqueues and dequeues a task', async () => {});
    it('should return null when no pending tasks', async () => {});
  });

  describe('complete', () => {
    it('should complete an active task successfully', async () => {});
    it('should throw TaskVersionMismatchError for wrong version', async () => {});
  });
});
```
</example>

## Common Troubleshooting

### ESLint Errors: Vitest Imports Not Found

<context>
**Error: `import/named` rule errors like "expect not found in 'vitest'" or "afterEach not found in 'vitest'"**

**Root cause:** When `globals: true` is set in vitest.config.ts, test globals are available without imports. Importing them is unnecessary and can cause ESLint resolution issues.
</context>

<instructions>
**Remove unnecessary imports** from test files and setup files:

```typescript
// ❌ DON'T - Unnecessary when globals: true
import { expect, describe, it, test, beforeEach, afterEach } from 'vitest';

// ✅ DO - These are available globally
describe('My tests', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
```

**Exception:** Type imports are still needed:
```typescript
// ✅ Type imports are fine
import type { Task } from 'vitest';
```

**When this applies:** Any package with `globals: true` in vitest.config.ts should not import test globals.
</instructions>

### TypeScript Errors in Test Files

<context>
**Error: `Cannot find name 'describe'` / `'it'` / `'expect'`**
</context>

<instructions>
See `instructions/typescript-configuration.md` for complete setup guide.

**Quick fix:**
1. Create `vitest.d.ts` in package root with `/// <reference types="vitest/globals" />`
2. Add `vitest.d.ts` to `tsconfig.json` include array
3. Set `"types": ["node"]` in tsconfig.json compilerOptions
</instructions>

### Tests Hanging or Timing Out

<context>
**Common causes:**
- Generator not closed: Call `await generator.return()` after use
- Background process not stopped: Register with `teardownQueue.add(close)`
- Missing await on async operation
- Infinite loop in test logic
</context>

<instructions>
Always close generators and register cleanup:

```typescript
// ✅ Proper generator cleanup
const generator = await getTaskPayloadGenerator({ queueName: 'test' });
try {
  const { value } = await generator.next();
  // Use value
} finally {
  await generator.return();  // Critical
}

// ✅ Proper background process cleanup
const close = await runTasks({ queueName: 'test', handleTask: () => {} });
void teardownQueue.add(close);  // Critical
```
</instructions>

### Lint Errors: Promise in Void Context

<context>
**Error: `@typescript-eslint/no-misused-promises`**

**Symptom:** "Promise returned in function argument where a void return was expected"

**Common in:** Database listeners, event handlers, callback functions
</context>

<example>
```typescript
// ❌ ERROR: callback returns Promise<void> but expects void
const { unlisten } = await sql.listen('channel', () =>
  processingQueue.add(nextTask)
);

// ✅ CORRECT: void operator discards promise
const { unlisten } = await sql.listen('channel', () =>
  void processingQueue.add(nextTask)
);
```
</example>

<instructions>
Use `void` operator to explicitly discard the promise. Common with postgres.js `listen()`, event emitters, and setTimeout/setInterval callbacks.
</instructions>

### TypeScript Error: Missing Symbol.asyncDispose

<context>
**Error: `error TS2741: Property '[Symbol.asyncDispose]' is missing in type`**

**Symptom:** Manually constructed AsyncGenerator fails typecheck in TypeScript 5.9+ with ES2022 target.
</context>

<instructions>
Add `[Symbol.asyncDispose]()` method to match AsyncGenerator interface:

```typescript
const generator = {
  next,
  async return(): Promise<IteratorResult<T, void>> {
    await close();
    return { done: true, value: undefined };
  },
  [Symbol.asyncIterator](): AsyncGenerator<T, void, void> {
    return generator;
  },
  async [Symbol.asyncDispose](): Promise<void> {
    await close();
  }
};
```

**Why this is required:** TypeScript 5.9+ with ES2022 target includes the Explicit Resource Management proposal.

**When to apply:** When manually constructing objects that return `AsyncGenerator<T>` type. Not needed for native `async function*` generators.
</instructions>

### Skipping Tests Based on External Dependencies

<context>
**Use case:** Integration tests that require external services (databases, APIs) should skip gracefully when those services aren't available

**Pattern:** Use `test.skipIf()` with environment variable checks
</context>

<example>
```typescript
// Check if PostgreSQL connection is available
const hasPostgresConfig =
  process.env.PGHOST ||
  process.env.PGPORT ||
  process.env.PGDATABASE ||
  process.env.PGUSERNAME ||
  process.env.PGUSER ||
  process.env.PGPASSWORD;

const skipIfNoPostgres = !hasPostgresConfig;

describe('Database Integration Tests', () => {
  test.skipIf(skipIfNoPostgres)('should connect to test database', async () => {
    const { sql } = await getTestSql();
    await expect(sql`SELECT 1 as foo`).resolves.toEqual([{ foo: 1 }]);
  });

  test.skipIf(skipIfNoPostgres)('should cleanup test database', async () => {
    const { sql, destroySql } = await getTestSql();
    await sql`SELECT 1`;
    await destroySql();
    // Verify cleanup
  });
});
```
</example>

<instructions>
**Common environment variable patterns:**

PostgreSQL (postgres package):
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSERNAME`/`PGUSER`, `PGPASSWORD`

Redis:
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

Generic API:
- `API_URL`, `API_KEY`, `API_TOKEN`

**Best practices:**
- Define the skip condition once at the top of the test file
- Use descriptive variable names like `skipIfNoPostgres`, `skipIfNoRedis`
- Document why tests are skipped (comment explaining required environment)
- Consider grouping all conditional tests in a single describe block
</instructions>

## When to Use Each Utility

<context>
**Use `getTestSql()` when:**
- Testing database operations
- Need isolated test environment
- Testing data persistence

**Use `teardownQueue` when:**
- Starting background processes (workers, listeners)
- Opening connections that need closing
- Creating temporary resources
- Need guaranteed cleanup order

**Use `toEmit()` when:**
- Testing EventEmitter patterns
- Waiting for async events
- Verifying event payloads

**Use `toEqualSorted()` when:**
- Array order is not significant
- Testing set-like data structures
- Comparing query results with no ORDER BY

**Use `tsStringIsEqual()` when:**
- Testing type generation
- Validating schema types
- Order of type properties doesn't matter
</context>

## Summary

<instructions>
**Key Principles:**
1. Each test gets isolated database via `getTestSql()`
2. Background resources registered with `teardownQueue`
3. Teardown happens automatically per-test
4. Use appropriate matchers for clearer assertions
5. One concept per test
6. Descriptive names
7. Handle async properly

**Test Structure:**
```
describe('Feature')
  describe('specific function')
    it('should describe expected behavior')
```

**Essential Utilities:**
- `getTestSql()` - Isolated database per test
- `teardownQueue` - Resource cleanup management
- `toEmit()` - Event testing
- `toEqualSorted()` - Order-independent arrays
- `tsStringIsEqual()` - TypeScript type comparison

For implementation reference, see `packages/queue/tests/handlers.test.ts`.
</instructions>

## References

### Official Documentation

- **Homepage**: https://vitest.dev/
- **Getting Started Guide**: https://vitest.dev/guide/
- **API Reference**: https://vitest.dev/api/
- **Configuration Guide**: https://vitest.dev/config/
- **Migration Guide (Jest to Vitest)**: https://vitest.dev/guide/migration.html

### Package & Repository

- **NPM Package**: https://www.npmjs.com/package/vitest
- **GitHub Repository**: https://github.com/vitest-dev/vitest
