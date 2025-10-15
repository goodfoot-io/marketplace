# Test Utilities Architecture Report

## Executive Summary
The test-utilities package provides a sophisticated testing infrastructure for the monorepo, featuring custom Jest environments with automatic resource cleanup, isolated PostgreSQL database provisioning per test, and enhanced assertion matchers. The architecture ensures complete test isolation while preventing resource leaks through priority-based teardown orchestration.

## Core Architecture

### Component Map

#### **Test Environment Layer** 
Provides isolated execution contexts with cleanup integration:

- **`jest-environment.ts`** (lines 25-62): Node.js test environment extending Jest's default with teardown queue injection into VM context via script injection (lines 5-11)
- **`jest-environment-jsdom.ts`** (lines 23-67): Browser/DOM test environment with same teardown integration, accessing internal VM context via `dom.getInternalVMContext()` (line 38)

#### **Resource Management Layer**
Orchestrates lifecycle and cleanup operations:

- **`jest-teardown.ts`** (lines 1-85): Central teardown queue using p-queue with:
  - Per-test queue isolation via `queueMap` (line 6)  
  - Stack trace preservation for debugging (lines 8, 31-32)
  - Global teardown function `startJestTeardownQueue` (lines 69-85)
  - Priority-based execution ordering

- **`sql.ts`** (lines 1-83): PostgreSQL test database provisioning with:
  - Isolated database per test with unique credentials (lines 36-38)
  - Connection pooling limited to 5 concurrent connections (line 22)
  - Automatic cleanup of databases and roles (lines 60-62)

#### **Test Enhancement Layer**
Provides custom matchers and utilities:

- **`jest-matchers.ts`** (lines 1-177): Custom Jest matchers:
  - `toEmit` (lines 44-100): Async event assertion with 30s timeout
  - `toEqualSorted` (lines 101-132): Deep equality ignoring array order
  - `tsStringIsEqual` (lines 133-164): TypeScript type string comparison

- **`lib/typescript.ts`** (lines 1-66): TypeScript AST utilities for type comparison

### Data Flow Patterns

#### Test Execution Flow
```
Test starts → Environment injects teardown capability → Test runs
    ↓                                                      ↓
Test registers cleanup tasks ← Test requests resources
    ↓
Test completes → handleTestEvent('test_done') triggered
    ↓
startJestTeardownQueue(testName) → Process test queue
    ↓
All test queues complete → Process global queue → Cleanup complete
```

#### Resource Allocation Pattern
```typescript
// Database request (sql.ts:24-43)
getTestSql() → Create unique DB/role → Register cleanup (priority: -1)
              ↓                        ↓
        Return connection       Add to teardownCallbacks array
              ↓                        ↓
        Test uses resource      Monitor connection count
              ↓                        ↓
        Test completes → Execute teardown → Drop DB/role
```

### Integration Mechanisms

#### Queue Isolation Mechanism
Each test maintains an isolated queue to prevent cross-test interference:
```typescript
// jest-teardown.ts:12-24
addToTestQueue(testName, func, options) {
  - Gets or creates PQueue for specific test
  - Auto-deletes queue when idle (lines 20-22)
  - Ensures test-scoped cleanup
}
```

#### Priority-Based Cleanup
Cleanup tasks execute in priority order to ensure correct dependency teardown:
```typescript
// Priority levels:
-2: Global SQL connection (sql.ts:33)
-1: Test-specific database (sql.ts:72)
 0: Default test cleanup tasks
```

#### Stack Trace Preservation
Maintains original call sites for debugging cleanup failures:
```typescript
// jest-teardown.ts:30-32
const stack = new Error().stack.split('\n').slice(2).join('\n');
stackMap.set(task, stack);
// Attached to errors at lines 42, 57-58
```

## Technical Implementation

### Design Patterns

#### **Dependency Injection Pattern**
Test environments inject cleanup capabilities into test VM context:
```typescript
// jest-environment.ts:5-11
new VMScript(
  `globalThis.startJestTeardownQueue = ${startJestTeardownQueue.toString()}`,
  { filename: 'jest-teardown.js' }
)
```

#### **Resource Pool Pattern**
Database connections managed as pooled resources:
```typescript
// sql.ts:69-71
while (teardownCallbacks.length > MAX_CONCURRENT_CONNECTIONS) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}
```

#### **Decorator Pattern**
Custom matchers extend Jest's expect functionality:
```typescript
// jest-matchers.ts:43
expect.extend({ toEmit, toEqualSorted, tsStringIsEqual })
// Global type augmentation at lines 167-176
```

#### **Observer Pattern**
Event-driven test lifecycle management:
```typescript
// jest-environment.ts:42-55
async handleTestEvent(event, state) {
  if (event.name === 'test_done') {
    await startJestTeardownQueue(state.testPath);
  }
}
```

### Performance Characteristics

#### Connection Throttling
Prevents database connection exhaustion:
- Maximum 5 concurrent test database connections (sql.ts:22)
- Automatic backpressure via polling wait (sql.ts:69-71)
- Connection reuse for global SQL instance (sql.ts:7-17)

#### Queue Concurrency Control
Single-threaded queue processing prevents race conditions:
- Concurrency: 1 for all queues (jest-teardown.ts:2, 17)
- AutoStart: false for manual control (jest-teardown.ts:2)
- Sequential processing ensures deterministic cleanup

### State Management

#### Test-Scoped State
Per-test state isolation via queue map:
```typescript
// jest-teardown.ts:6
const queueMap = new Map<string, PQueue>();
// Test name extraction via expect.getState() (lines 33-37)
```

#### Global State Coordination
Singleton patterns for shared resources:
```typescript
// sql.ts:19
let didAddGlobalTeardown = false;
// Ensures single global teardown registration (lines 27-34)
```

## Architectural Insights

### Design Decisions

#### **VM Context Injection**
The decision to inject teardown functions directly into VM context (jest-environment.ts:5-11) ensures cleanup capabilities are available in isolated test environments without requiring imports.

#### **Priority-Based Cleanup**
Using numeric priorities (sql.ts:33, 72) ensures databases are dropped before closing the global connection, preventing orphaned resources.

#### **Stack Trace Preservation**
Capturing stack traces at registration time (jest-teardown.ts:31-32) provides crucial debugging information when cleanup fails, as async boundaries would otherwise obscure the origin.

### Constraints and Limitations

#### **Connection Limits**
Hard limit of 5 concurrent database connections (sql.ts:22) may create bottlenecks in highly parallel test scenarios.

#### **Memory Usage**
Stack trace storage (jest-teardown.ts:8) and queue maps persist throughout test runs, potentially accumulating memory in long-running test suites.

#### **Event-Based Coupling**
Reliance on Jest's `test_done` event (jest-environment.ts:43) creates tight coupling with Jest's internal lifecycle.

### Extension Points

#### **Custom Cleanup Strategies**
The queue system accepts any async function (jest-teardown.ts:30), allowing custom cleanup logic for new resource types.

#### **Additional Matchers**
Matcher extension mechanism (jest-matchers.ts:43) allows adding new assertion types following the established pattern.

#### **Alternative Databases**
The SQL provisioning pattern (sql.ts:24-80) could be adapted for other database systems while maintaining the same cleanup guarantees.

## File Reference Map

| File | Architectural Role | Key Features |
|------|-------------------|--------------|
| `jest-environment.ts` | Node test environment | VM script injection, test lifecycle handling |
| `jest-environment-jsdom.ts` | DOM test environment | Browser simulation with cleanup integration |
| `jest-teardown.ts` | Cleanup orchestration | Queue management, stack preservation, priority execution |
| `sql.ts` | Database provisioning | Isolated databases, connection pooling, automatic cleanup |
| `jest-matchers.ts` | Custom assertions | Event emission, unordered equality, TypeScript comparison |
| `lib/typescript.ts` | Type utilities | AST-based type comparison |
| `package.json` | Package configuration | Export paths, dependencies, test scripts |

## Usage Patterns

### Basic Test Setup
```typescript
// Tests automatically get cleanup capabilities via testEnvironment config
// No explicit import needed in test files
```

### Database Testing
```typescript
import { getTestSql } from '@productivity-bot/test-utilities/sql';

test('database operations', async () => {
  const { sql } = await getTestSql();
  // Use sql connection - cleanup is automatic
});
```

### Custom Cleanup Registration
```typescript
import { jestTeardownQueue } from '@productivity-bot/test-utilities/jest-teardown';

jestTeardownQueue.add(async () => {
  // Custom cleanup logic
}, { priority: 0 });
```

### Event Assertion
```typescript
await expect(emitter).toEmit('event-name', expectedData, 5000);
```

This architecture provides robust test isolation with automatic resource management, ensuring tests can safely use external resources without manual cleanup code or resource leaks.