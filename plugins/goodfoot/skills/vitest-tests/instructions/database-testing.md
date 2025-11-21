# Database Testing with getTestSql()

Complete guide for testing database operations using isolated PostgreSQL instances.

## Time-Sensitive Database Tests

⚠️ **Critical:** PostgreSQL timestamps have millisecond precision, which can cause flaky tests.

→ See main SKILL.md "Pattern 3: Time-Sensitive Tests" for comprehensive coverage of timestamp precision issues.

**Key principle:** Always delay BEFORE capturing comparison timestamps.

**Quick example:**
```typescript
// ✅ CORRECT - Ensures separation
await new Promise(resolve => setTimeout(resolve, 10));
const now = new Date().toISOString();

const nodes = await queryNodes({ type: 'person', createdBefore: now });
```

**Why it works:** 10ms delay guarantees database timestamps are separated by at least one millisecond from your comparison point.

## Overview

`getTestSql()` from `@goodfoot/test-utilities/sql` creates isolated PostgreSQL databases for each test with automatic cleanup. This ensures true test isolation and enables safe parallel execution.

## Core Concepts

### Isolated Test Databases

Each test gets its own PostgreSQL database:

```typescript
import { getTestSql } from '@goodfoot/test-utilities/sql';

it('should test with isolated database', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  // This database is unique to this test
  await sql`INSERT INTO users (name) VALUES ('Alice')`;

  // Other tests cannot see this data
  // Cleanup happens automatically
});
```

### Connection Pooling

**Limits:**
- Maximum 5 concurrent test database connections
- When limit reached, oldest connection cleaned up automatically
- Global teardown at test suite completion

**Why 5 connections:**
- Balances parallelization with PostgreSQL resource limits
- Prevents connection exhaustion
- Allows reasonable test concurrency

#### Connection Pool Exhaustion

**Symptom:** Tests fail with "too many clients already" error, or tests hang indefinitely waiting for connections

**Cause:** More than 5 concurrent tests requesting databases simultaneously. This can happen when:
- Running tests with high parallelism
- Tests not properly cleaning up connections
- Long-running tests blocking the pool
- PostgreSQL connection limits reached

**Quick Fix - Reduce Parallelism:**
```bash
# Run tests serially (no parallel execution)
vitest run --no-file-parallelism

# Or limit the number of concurrent test files
vitest run --pool-options.threads.maxThreads=3
```

**Long-term Fix - Increase Connection Limit:**

Only increase if you understand the implications for PostgreSQL resource usage:

```typescript
// packages/test-utilities/src/sql.ts
// Change MAX_CONCURRENT_CONNECTIONS from 5 to higher value
const MAX_CONCURRENT_CONNECTIONS = 10;  // Increase cautiously
```

**Why not increase by default:**
- Each connection consumes PostgreSQL resources (memory, file descriptors)
- Higher parallelism doesn't always mean faster test execution
- Can mask connection leak issues in test code
- Database server may have global connection limits

**Diagnosis:**
```bash
# Check PostgreSQL connection count
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check for connection leaks in tests
# Look for tests that don't use getTestSql() properly
grep -r "postgres(" tests/  # Should only appear in test-utilities
```

### Automatic Cleanup

Cleanup happens in priority order:
1. Per-test cleanup (priority -1): Drops test database
2. Global cleanup (priority -2): Closes shared SQL connection

No manual cleanup needed - registered automatically via `teardownQueue`.

## Returned Object

```typescript
const result = await getTestSql();

result = {
  username: string;    // Random: _abc123def456...
  password: string;    // Random: _789ghi012jkl...
  database: string;    // Random: _mno345pqr678...
  sql: PostgresConnection;  // postgres.js instance
  destroySql: () => Promise<void>;  // Manual cleanup (rarely needed)
}
```

**Column Name Transform:**
- Database columns: `snake_case`
- JavaScript results: `camelCase`
- Automatic via `postgres({ transform: { column: postgres.camel.column } })`

## Common Patterns

### Pattern 1: Basic CRUD Operations

```typescript
describe('User CRUD', () => {
  it('should create and retrieve user', async () => {
    const { sql } = await getTestSql();
    await initializeDatabase(sql);

    // Create
    const [user] = await sql`
      INSERT INTO users (name, email)
      VALUES ('Alice', 'alice@example.com')
      RETURNING *
    `;

    expect(user).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com'
    });

    // Read
    const [retrieved] = await sql`
      SELECT * FROM users WHERE id = ${user.id}
    `;

    expect(retrieved).toEqual(user);
  });
});
```

### Pattern 2: Testing Relationships

```typescript
it('should handle foreign key relationships', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  // Create parent
  const [user] = await sql`
    INSERT INTO users (name) VALUES ('Alice')
    RETURNING id
  `;

  // Create children
  await sql`
    INSERT INTO posts (user_id, title)
    VALUES
      (${user.id}, 'Post 1'),
      (${user.id}, 'Post 2')
  `;

  // Query with join
  const posts = await sql`
    SELECT p.*, u.name as author_name
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE u.id = ${user.id}
  `;

  expect(posts).toHaveLength(2);
  expect(posts[0]).toMatchObject({
    authorName: 'Alice',  // Note: camelCase
    title: 'Post 1'
  });
});
```

### Pattern 3: Testing Aggregations

```typescript
it('should calculate aggregations', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  // Insert test data
  await sql`
    INSERT INTO orders (amount, status)
    VALUES
      (100, 'completed'),
      (200, 'completed'),
      (150, 'pending')
  `;

  // Test aggregation
  const [result] = await sql`
    SELECT
      status,
      COUNT(*) as order_count,
      SUM(amount) as total_amount
    FROM orders
    GROUP BY status
    HAVING status = 'completed'
  `;

  expect(result).toMatchObject({
    status: 'completed',
    orderCount: '2',  // PostgreSQL COUNT returns string
    totalAmount: '300'
  });
});
```

### Pattern 4: Testing Timestamps

**Critical:** Add delays before capturing comparison timestamps

```typescript
it('should filter by timestamp', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  // Create records
  await sql`INSERT INTO events (name) VALUES ('Event 1')`;
  await sql`INSERT INTO events (name) VALUES ('Event 2')`;

  // ✅ Wait before capturing timestamp
  await new Promise(resolve => setTimeout(resolve, 10));
  const cutoff = new Date().toISOString();

  // Create after cutoff
  await sql`INSERT INTO events (name) VALUES ('Event 3')`;

  // Query by timestamp
  const oldEvents = await sql`
    SELECT * FROM events
    WHERE created_at < ${cutoff}
  `;

  expect(oldEvents).toHaveLength(2);
});
```

**Why delays are needed:**
- PostgreSQL timestamps have millisecond precision
- Tests execute very quickly
- Without delay, cutoff might equal record creation time

### Pattern 5: Bulk Operations

```typescript
it('should handle bulk inserts efficiently', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  const records = Array.from({ length: 1000 }, (_, i) => ({
    name: `User ${i}`,
    email: `user${i}@example.com`
  }));

  // Bulk insert
  await sql`
    INSERT INTO users ${sql(records, 'name', 'email')}
  `;

  const [count] = await sql`SELECT COUNT(*) FROM users`;
  expect(parseInt(count.count)).toBe(1000);
});
```

### Pattern 6: Transaction Testing

```typescript
it('should rollback on transaction failure', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  try {
    await sql.begin(async (tx) => {
      await tx`INSERT INTO users (name) VALUES ('Alice')`;
      await tx`INSERT INTO users (name) VALUES ('Bob')`;

      // Simulate error
      throw new Error('Transaction failed');
    });
  } catch (error) {
    // Expected
  }

  // Verify rollback
  const users = await sql`SELECT * FROM users`;
  expect(users).toHaveLength(0);
});

it('should commit on transaction success', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  await sql.begin(async (tx) => {
    await tx`INSERT INTO users (name) VALUES ('Alice')`;
    await tx`INSERT INTO users (name) VALUES ('Bob')`;
  });

  // Verify commit
  const users = await sql`SELECT * FROM users`;
  expect(users).toHaveLength(2);
});
```

## Advanced Features

### Query Debugging

Enable query logging for troubleshooting:

```typescript
it('should log queries for debugging', async () => {
  const { sql } = await getTestSql({
    debug: (connection, query, parameters) => {
      console.log('Query:', query);
      console.log('Params:', parameters);
    }
  });

  await initializeDatabase(sql);
  await sql`SELECT * FROM users WHERE id = ${123}`;

  // Logs:
  // Query: SELECT * FROM users WHERE id = $1
  // Params: [123]
});
```

### Connection Error Handling

```typescript
it('should handle connection errors gracefully', async () => {
  const { sql } = await getTestSql();

  // Don't initialize - tables don't exist

  await expect(
    sql`SELECT * FROM nonexistent_table`
  ).rejects.toThrow(/relation "nonexistent_table" does not exist/);
});
```

### Manual Cleanup

Rarely needed, but available:

```typescript
it('should cleanup manually if needed', async () => {
  const { sql, destroySql } = await getTestSql();
  await initializeDatabase(sql);

  // Do work
  await sql`INSERT INTO users (name) VALUES ('Alice')`;

  // Manual cleanup (normally automatic)
  await destroySql();

  // sql is now closed
});
```

### Testing with Multiple Databases

```typescript
it('should work with multiple databases', async () => {
  const db1 = await getTestSql();
  const db2 = await getTestSql();

  await initializeDatabase(db1.sql);
  await initializeDatabase(db2.sql);

  // Separate, isolated databases
  await db1.sql`INSERT INTO users (name) VALUES ('Alice')`;
  await db2.sql`INSERT INTO users (name) VALUES ('Bob')`;

  const users1 = await db1.sql`SELECT * FROM users`;
  const users2 = await db2.sql`SELECT * FROM users`;

  expect(users1).toHaveLength(1);
  expect(users2).toHaveLength(1);
  expect(users1[0].name).toBe('Alice');
  expect(users2[0].name).toBe('Bob');
});
```

## Best Practices

### 1. Always Initialize Database

```typescript
// ✅ DO
it('should initialize first', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);  // Creates schema
  await sql`INSERT INTO users (name) VALUES ('Alice')`;
});

// ❌ DON'T
it('will fail without init', async () => {
  const { sql } = await getTestSql();
  await sql`INSERT INTO users (name) VALUES ('Alice')`; // Error: table doesn't exist
});
```

### 2. Use Isolated Databases

```typescript
// ✅ DO - Each test gets own database
it('test 1', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);
  // Isolated
});

it('test 2', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);
  // Isolated
});

// ❌ DON'T - Shared database
const sharedSql = createConnection();

it('test 1', async () => {
  await sharedSql`INSERT INTO users (name) VALUES ('Alice')`;
});

it('test 2', async () => {
  // Will see Alice from test 1 - not isolated!
});
```

### 3. Add Delays for Timestamp Comparisons

```typescript
// ✅ DO
it('should filter by time', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  await sql`INSERT INTO events (name) VALUES ('Old')`;

  await new Promise(r => setTimeout(r, 10));  // Critical delay
  const cutoff = new Date().toISOString();

  await sql`INSERT INTO events (name) VALUES ('New')`;

  const old = await sql`SELECT * FROM events WHERE created_at < ${cutoff}`;
  expect(old).toHaveLength(1);
});

// ❌ DON'T - Race condition
it('may fail randomly', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  await sql`INSERT INTO events (name) VALUES ('Old')`;
  const cutoff = new Date().toISOString();  // No delay - may equal creation time

  const old = await sql`SELECT * FROM events WHERE created_at < ${cutoff}`;
  expect(old).toHaveLength(1);  // May fail
});
```

### 4. Test One Concept Per Test

```typescript
// ✅ DO
it('should create user', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  const [user] = await sql`INSERT INTO users (name) VALUES ('Alice') RETURNING *`;
  expect(user.name).toBe('Alice');
});

it('should update user', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  const [user] = await sql`INSERT INTO users (name) VALUES ('Alice') RETURNING *`;
  await sql`UPDATE users SET name = 'Bob' WHERE id = ${user.id}`;

  const [updated] = await sql`SELECT * FROM users WHERE id = ${user.id}`;
  expect(updated.name).toBe('Bob');
});

// ❌ DON'T - Too much in one test
it('should handle full user lifecycle', async () => {
  // Tests create, read, update, delete, relationships, permissions...
  // Hard to debug if it fails
});
```

### 5. Use Transactions for Atomic Operations

```typescript
// ✅ DO
it('should transfer between accounts atomically', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  await sql`INSERT INTO accounts (id, balance) VALUES (1, 1000), (2, 500)`;

  await sql.begin(async (tx) => {
    await tx`UPDATE accounts SET balance = balance - 100 WHERE id = 1`;
    await tx`UPDATE accounts SET balance = balance + 100 WHERE id = 2`;
  });

  const accounts = await sql`SELECT * FROM accounts ORDER BY id`;
  expect(accounts[0].balance).toBe('900');
  expect(accounts[1].balance).toBe('600');
});
```

## Performance Considerations

### Database Creation Overhead

- Creating database per test adds ~50-100ms overhead
- Worth it for true isolation
- Much faster than shared database with transaction rollback at scale
- Enables safe parallel test execution

### Connection Pooling

- Max 5 concurrent connections prevents PostgreSQL resource exhaustion
- Tests queue when limit reached
- Oldest connections cleaned up automatically
- Balances speed with resource usage

### Optimization Tips

1. **Group related tests** in same describe block for better reporting
2. **Use beforeEach sparingly** - database already isolated per test
3. **Avoid unnecessary queries** - test only what needs testing
4. **Use bulk inserts** for large datasets
5. **Consider test database template** for faster initialization

## Troubleshooting

### Connection Limit Reached

**Symptom:** Tests hang waiting for database connections

**Solution:**
- Tests are running too slowly
- Increase timeout or reduce test count
- Check for tests not completing (hung background processes)

### Slow Test Execution

**Symptom:** Tests take very long to complete

**Causes:**
- Too many per-test database creations
- Complex initialization logic
- Missing indexes on test data
- Unnecessary queries

**Solutions:**
- Profile with `debug` option to see query times
- Optimize initialization function
- Add indexes to test schema
- Reduce test data volume

### Data Leakage Between Tests

**Symptom:** Tests pass individually but fail when run together

**Cause:** Sharing database connection or not calling `getTestSql()`

**Solution:**
```typescript
// ✅ Correct - Each test isolated
it('test 1', async () => {
  const { sql } = await getTestSql();
  // ...
});

it('test 2', async () => {
  const { sql } = await getTestSql();  // New database
  // ...
});
```

## Common Issues

### Timestamp Comparison Failures

**Problem:**
Tests fail intermittently when filtering by timestamp:

```typescript
// ❌ May fail randomly
const now = new Date().toISOString();
const records = await sql`SELECT * FROM items WHERE created_at < ${now}`;
expect(records).toHaveLength(2); // Sometimes fails
```

**Cause:** PostgreSQL timestamps have millisecond precision. Vitest executes tests very quickly, so the comparison timestamp might be captured at the exact same millisecond as test data creation.

**Solution:** Add 10ms delay before capturing comparison timestamp:

```typescript
// ✅ Reliable
await new Promise(resolve => setTimeout(resolve, 10));
const now = new Date().toISOString();
const records = await sql`SELECT * FROM items WHERE created_at < ${now}`;
expect(records).toHaveLength(2); // Consistent
```

**Why 10ms:** This ensures temporal separation between test data creation and the comparison point.

### Database Table Not Found

**Problem:**
```typescript
const { sql } = await getTestSql();
await sql`SELECT * FROM users`; // Error: relation "users" does not exist
```

**Cause:** Forgot to initialize database schema

**Solution:** Always call initialization function after `getTestSql()`:

```typescript
const { sql } = await getTestSql();
await initializeDatabase(sql); // Creates tables and schema
await sql`SELECT * FROM users`; // Now works
```

**Pattern:** Every test that uses database must initialize:
```typescript
it('should test database', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);  // Required!

  // Now can query tables
});
```

## Summary

**Key Points:**
- Each test gets isolated PostgreSQL database
- Automatic cleanup via teardownQueue
- Max 5 concurrent connections
- Column names transformed to camelCase
- Add 10ms delay before timestamp comparisons
- Use transactions for atomic operations
- Initialize database before queries

**Common Imports:**
```typescript
import { getTestSql } from '@goodfoot/test-utilities/sql';
import { initializeDatabase } from '../src/database.js';
```

**Basic Pattern:**
```typescript
it('should test database operation', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  // Test database operations

  // Automatic cleanup
});
```

For implementation reference, see `packages/queue/tests/handlers.test.ts`.
