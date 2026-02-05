# Swallowed Error Detection Interpretation Guide

## Understanding Swallowed Errors

Swallowed errors hide failures from callers, developers, or operators. They make debugging difficult and can mask critical issues.

### Detected Patterns

| Pattern | Description | Default Confidence |
|---------|-------------|-------------------|
| `empty-catch` | Catch block with no statements | High |
| `comment-only-catch` | Catch block with only comments | High |
| `catch-returns-success` | Catch returns success value (true, 200, "ok") | High |
| `catch-log-only` | Catch only logs, doesn't rethrow | Medium |
| `void-promise` | `void asyncOp()` discards rejection | Medium |
| `empty-promise-catch` | `.catch(() => {})` or `.catch(() => undefined)` | High |
| `error-param-unused` | `catch (e)` but `e` never used | Medium |

### Context Factors

The analyzer adjusts confidence based on:

| Factor | Effect |
|--------|--------|
| Test file | Lower priority (test isolation is OK) |
| Logging nearby | Reduces severity (at least observable) |
| Function name (`try*`, `maybe*`, `attempt*`) | Intentionally optional |
| Comment keywords (`intentional`, `expected`, `ignore`) | Documented decision |
| Finally block | May be cleanup code |

## Interpreting Results

### Report Format

```
| File | Line | Pattern | Confidence | Suggestion |
|------|------|---------|------------|------------|
| src/api.ts | 45 | empty-catch | high | Add error handling or logging |
```

### Priority by Confidence

| Confidence | Action |
|------------|--------|
| High | Fix immediately—likely a bug |
| Medium | Review context—may need fix or documentation |
| Low | Informational—usually intentional |

## Refactoring Patterns

### 1. Empty Catch → Proper Handling

**Before:**
```typescript
try {
  await saveToDatabase(data);
} catch {
  // Silently swallowed
}
```

**After - Option 1: Propagate error**
```typescript
try {
  await saveToDatabase(data);
} catch (error) {
  throw new DatabaseError('Failed to save', { cause: error });
}
```

**After - Option 2: Log and handle**
```typescript
try {
  await saveToDatabase(data);
} catch (error) {
  logger.error('Database save failed', { error, data });
  return { success: false, error: 'Save failed' };
}
```

**After - Option 3: Document intentional**
```typescript
try {
  await saveToDatabase(data);
} catch {
  // Intentional: best-effort save, failure is acceptable
}
```

### 2. Catch Returns Success → Accurate Result

**Before:**
```typescript
async function fetchUser(id: string): Promise<User | null> {
  try {
    return await api.getUser(id);
  } catch {
    return null;  // Hides network errors, auth failures, etc.
  }
}
```

**After:**
```typescript
async function fetchUser(id: string): Promise<User | null> {
  try {
    return await api.getUser(id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;  // Expected: user doesn't exist
    }
    throw error;  // Unexpected: network/auth/server error
  }
}
```

### 3. Log-Only → Log and Rethrow

**Before:**
```typescript
try {
  processPayment(order);
} catch (error) {
  console.error('Payment failed:', error);
  // Caller thinks it succeeded!
}
```

**After:**
```typescript
try {
  processPayment(order);
} catch (error) {
  console.error('Payment failed:', error);
  throw error;  // Caller can handle appropriately
}
```

### 4. Void Promise → Explicit Handling

**Before:**
```typescript
function handleClick() {
  void fetchData();  // Rejection disappears
}
```

**After - Option 1: Catch locally**
```typescript
function handleClick() {
  fetchData().catch(error => {
    showErrorToast('Failed to fetch data');
    logger.error('Fetch failed', { error });
  });
}
```

**After - Option 2: Let framework handle**
```typescript
// In React with error boundary
async function handleClick() {
  await fetchData();  // Error propagates to boundary
}
```

### 5. Empty Promise Catch → Meaningful Handler

**Before:**
```typescript
promise.catch(() => {});
```

**After:**
```typescript
promise.catch(error => {
  // Fire-and-forget telemetry—failure is acceptable
  // Intentional: best-effort, non-critical operation
});
```

### 6. Unused Error Parameter → Use or Remove

**Before:**
```typescript
try {
  riskyOperation();
} catch (error) {
  return defaultValue;  // 'error' unused
}
```

**After - Option 1: Use the error**
```typescript
try {
  riskyOperation();
} catch (error) {
  logger.warn('Operation failed, using default', { error });
  return defaultValue;
}
```

**After - Option 2: Remove if intentional**
```typescript
try {
  riskyOperation();
} catch {
  // Intentional: any error means use default
  return defaultValue;
}
```

## When Swallowing Is Intentional

Document these cases clearly:

### 1. Best-Effort Operations

```typescript
try {
  await analytics.track('page_view');
} catch {
  // Intentional: analytics failure should not break user flow
}
```

### 2. Graceful Degradation

```typescript
let cachedValue: Value | undefined;
try {
  cachedValue = await cache.get(key);
} catch {
  // Intentional: cache miss falls through to database
}
```

### 3. Cleanup in Finally

```typescript
try {
  await processFile(path);
} finally {
  try {
    await fs.unlink(tempFile);
  } catch {
    // Intentional: temp file cleanup is best-effort
  }
}
```

### 4. Optional Features

```typescript
// Function name signals optional behavior
function tryLoadPlugin(name: string): Plugin | undefined {
  try {
    return require(name);
  } catch {
    return undefined;  // Plugin not available
  }
}
```

## Configuration Options

The analyzer supports customization:

```typescript
interface SwallowedErrorOptions {
  // Skip test files entirely
  excludeTestFiles?: boolean;

  // Function patterns treated as intentionally optional
  optionalFunctionPatterns?: RegExp[];
  // Default: /^try[A-Z]/, /^maybe[A-Z]/, /^attempt[A-Z]/

  // Comments that indicate intentional swallowing
  intentionalKeywords?: string[];
  // Default: intentional, expected, ignore, optional, fallback, graceful

  // Functions allowed to fire-and-forget
  fireAndForgetAllowlist?: RegExp[];
  // Default: track*, log*, telemetry*, analytics*, metrics*, etc.
}
```

## Integration with Other Metrics

### Swallowed Errors + Complexity

High complexity + swallowed errors = high risk:
- Complex error paths are hard to reason about
- Silent failures in complex code cause subtle bugs

### Swallowed Errors + Data Flow

Unused error parameters often indicate:
- Copy-paste from template
- Incomplete error handling
- Rushed implementation

## Error Handling Best Practices

### Error Propagation Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Entry                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Global Error Handler                     │   │
│  │  • Log all uncaught errors                           │   │
│  │  • Report to monitoring                              │   │
│  │  • Show user-friendly message                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                            ▲                                 │
│                            │ rethrow                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Domain Layer                             │   │
│  │  • Catch known error types                           │   │
│  │  • Wrap with domain context                          │   │
│  │  • Rethrow unknown errors                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                            ▲                                 │
│                            │ rethrow                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Infrastructure Layer                     │   │
│  │  • Let errors propagate                              │   │
│  │  • Only catch for retry logic                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Decision Tree

```
Should I catch this error?
│
├─ Can this layer handle it meaningfully?
│  ├─ Yes → Catch, handle, potentially rethrow wrapped
│  └─ No → Let it propagate
│
├─ Is this a known/expected error type?
│  ├─ Yes → Catch and handle specifically
│  └─ No → Let it propagate (unknown = bug)
│
├─ Is silent failure acceptable?
│  ├─ Yes → Catch, document why, optionally log
│  └─ No → Must propagate or return error result
```

## Monitoring Swallowed Errors

Track over time:
- **High-confidence count**: Should be zero
- **Pattern distribution**: Identifies systematic issues
- **Test vs. production ratio**: Test files should have more
