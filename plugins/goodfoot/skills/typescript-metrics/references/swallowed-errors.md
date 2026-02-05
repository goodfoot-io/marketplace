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

| Pattern | Description | Confidence |
|---------|-------------|------------|
| `empty-catch` | Catch block with no statements | High |
| `comment-only-catch` | Catch block with only comments | High |
| `catch-returns-success` | Catch returns success value | High |
| `catch-log-only` | Catch only logs, doesn't rethrow | Medium |
| `void-promise` | `void asyncOp()` discards rejection | Medium |
| `empty-promise-catch` | `.catch(() => {})` | High |
| `error-param-unused` | `catch (e)` but `e` never used | Medium |

## Fixing Swallowed Errors

### Empty Catch → Proper Handling

**Before:**
```typescript
try {
  await saveToDatabase(data);
} catch {
  // Silently swallowed
}
```

**Option 1: Propagate error**
```typescript
try {
  await saveToDatabase(data);
} catch (error) {
  throw new DatabaseError('Failed to save', { cause: error });
}
```

**Option 2: Log and handle**
```typescript
try {
  await saveToDatabase(data);
} catch (error) {
  logger.error('Database save failed', { error, data });
  return { success: false, error: 'Save failed' };
}
```

**Option 3: Document if intentional**
```typescript
try {
  await saveToDatabase(data);
} catch {
  // Intentional: best-effort save, failure is acceptable
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

Document these cases clearly:

**Best-effort operations:**
```typescript
try {
  await analytics.track('page_view');
} catch {
  // Intentional: analytics failure should not break user flow
}
```

**Graceful degradation:**
```typescript
let cachedValue: Value | undefined;
try {
  cachedValue = await cache.get(key);
} catch {
  // Intentional: cache miss falls through to database
}
```

**Cleanup in finally:**
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

**Optional features (naming convention):**
```typescript
function tryLoadPlugin(name: string): Plugin | undefined {
  try {
    return require(name);
  } catch {
    return undefined;  // Plugin not available
  }
}
```

## Error Handling Decision Tree

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

## Priority by Confidence

| Confidence | Action |
|------------|--------|
| High | Fix immediately—likely a bug |
| Medium | Review context—may need fix or documentation |
| Low | Informational—usually intentional |
