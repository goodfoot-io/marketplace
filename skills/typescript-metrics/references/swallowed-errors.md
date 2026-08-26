# Swallowed Errors: Understanding and Fixing

## Why Swallowed Errors Are Dangerous

Errors exist to communicate problems. Swallowing them creates silent failures that surface far from their cause. You'll spend hours debugging why something "just doesn't work" when an error message was available but discarded.

## The Core Fix: Tighten the Catch

Most swallowed errors come from catching too broadly. The fix is to catch only the specific error types you expect and know how to handle. Unexpected errors should propagate.

```typescript
// BAD: Catches everything, hides unexpected failures
try {
  const data = await readFile(path);
} catch {
  return null;
}

// GOOD: Catch only expected errors, rethrow the rest
try {
  const data = await readFile(path);
} catch (error) {
  if (error.code === 'ENOENT') {
    return null;  // Expected: file doesn't exist
  }
  throw error;  // Unexpected: permissions, disk failure, etc.
}
```

**Default to throwing.** Only log (instead of throw) when the failure genuinely doesn't affect the user experience—like analytics or optional telemetry.

## Patterns Detected

| Pattern | Description | Confidence | Default Action |
|---------|-------------|------------|----------------|
| `empty-catch` | Catch block with no statements | High | Add error handling or rethrow |
| `comment-only-catch` | Catch block with only comments | High | Check comment text for intent, fix or document |
| `catch-returns-success` | Catch returns success value | High | Tighten to expected error types |
| `catch-log-only` | Catch only logs, doesn't rethrow | Medium | Rethrow if failure affects user |
| `void-promise` | `void asyncOp()` discards rejection | Medium | Add `.catch()` handler |
| `empty-promise-catch` | `.catch(() => {})` | High | Add error handling |
| `error-param-unused` | `catch (e)` but `e` never used | Medium | Use error or remove parameter |

## Fixing Swallowed Errors

### Empty Catch → Tighten or Propagate

**Before:**
```typescript
try {
  await saveToDatabase(data);
} catch {
  // Silently swallowed
}
```

**Option 1: Tighten to expected errors, rethrow the rest**
```typescript
try {
  await saveToDatabase(data);
} catch (error) {
  if (error.code === 'DUPLICATE_KEY') {
    return { success: false, error: 'Already exists' };  // Expected
  }
  throw error;  // Unexpected: connection failure, etc.
}
```

**Option 2: Always propagate (if caller needs to know)**
```typescript
try {
  await saveToDatabase(data);
} catch (error) {
  throw new DatabaseError('Failed to save', { cause: error });
}
```

**Option 3: Log only (if failure doesn't affect user)**
```typescript
try {
  await logAuditEvent(data);  // Non-critical
} catch (error) {
  console.warn('Audit logging failed:', error);
  // OK: audit failure doesn't affect user experience
}
```

### Catch Returns Success → Tighten to Expected Errors

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

The key change: only `NotFoundError` returns null. Network failures, auth errors, and other unexpected problems propagate to the caller.

### Log-Only → Rethrow (Default) or Log-Only (Non-Critical)

**Before:**
```typescript
try {
  processPayment(order);
} catch (error) {
  console.error('Payment failed:', error);
  // Caller thinks it succeeded!
}
```

**After (critical path—affects user):**
```typescript
try {
  processPayment(order);
} catch (error) {
  console.error('Payment failed:', error);
  throw error;  // Caller must know this failed
}
```

**After (non-critical—doesn't affect user experience):**
```typescript
try {
  await analytics.trackPurchase(order);
} catch (error) {
  console.error('Analytics failed:', error);
  // OK to swallow: analytics failure doesn't affect the user
}
```

### Void Promise → Explicit Handling

**Before:**
```typescript
function handleClick() {
  void fetchData();  // Rejection disappears
}
```

**After:**
```typescript
function handleClick() {
  fetchData().catch(error => {
    showErrorToast('Failed to fetch data');
    logger.error('Fetch failed', { error });
  });
}
```

## When Swallowing Is Intentional

Swallowing is acceptable when failure **doesn't affect the user experience**. Even then, prefer logging the error for debugging.

**Non-critical telemetry:**
```typescript
try {
  await analytics.track('page_view');
} catch (error) {
  console.warn('Analytics failed:', error);
  // OK: analytics failure doesn't affect user
}
```

**Graceful degradation with fallback:**
```typescript
let cachedValue: Value | undefined;
try {
  cachedValue = await cache.get(key);
} catch (error) {
  console.warn('Cache read failed, falling back to database:', error);
  // OK: we have a fallback, user experience unaffected
}
```

**Best-effort cleanup:**
```typescript
try {
  await processFile(path);
} finally {
  try {
    await fs.unlink(tempFile);
  } catch (error) {
    console.warn('Failed to clean up temp file:', error);
    // OK: orphaned temp file doesn't affect user
  }
}
```

**Optional features (tighten to expected errors):**
```typescript
function tryLoadPlugin(name: string): Plugin | undefined {
  try {
    return require(name);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      return undefined;  // Expected: plugin not installed
    }
    throw error;  // Unexpected: syntax error, etc.
  }
}
```

## Error Handling Decision Tree

```
Should I catch this error?
│
├─ Is this a specific, expected error type?
│  ├─ Yes → Catch that specific type, handle it
│  └─ No → Let it propagate (don't catch unknown errors)
│
├─ Does failure affect user experience?
│  ├─ Yes → Must propagate (throw) so caller can handle
│  └─ No → Can log and swallow (analytics, telemetry, cleanup)
│
├─ Can this layer handle it meaningfully?
│  ├─ Yes → Handle and potentially wrap with context
│  └─ No → Let it propagate to a layer that can
```

## Priority by Confidence

| Confidence | Action |
|------------|--------|
| High | Fix immediately—likely a bug |
| Medium | Review context—may need fix or documentation |
| Low | Informational—usually intentional |
