---
description: Find and fix swallowed errors in a file or codebase section
argument-hint: [file-or-directory]
---

## Philosophy: The Cost of Silent Failures

Swallowed errors are technical debt that compounds with interest. When code catches an exception and continues silently, it creates a gap between what the system *appears* to do and what it *actually* does. This gap is where bugs hide, sometimes for years.

**The principle**: Errors should propagate by default. Catching should be exceptional, specific, and almost always logged. If you find yourself writing `catch {}` or `catch { return defaultValue }`, stop and ask: "What failure am I hiding, and from whom?"

---

## Finding Swallowed Errors

Search "$ARGUMENTS" for patterns that swallow errors. Look for:

### Catch Block Patterns
1. Empty catch blocks: `catch {}` or `catch (e) {}`
2. Catch blocks that return success values: `catch { return []; }` or `catch { resolve(0); }`
3. Catch blocks with only comments: `catch { // ignore }`
4. Catch blocks that log but don't rethrow in critical paths

### Fire-and-Forget Async Patterns
5. `void` on promises: `void asyncOperation()` - rejections are silently discarded
6. Unawaited promises in callbacks: `callback(() => { asyncOp(); resolve(); })` - async errors lost

### Silent Early Return Patterns
7. Early returns on missing preconditions: `if (!required) { return; }` - caller doesn't know operation was skipped
8. Optional chaining that hides failures: `obj?.criticalMethod()` - undefined result indistinguishable from success

For each found, note:
- File path and line number
- What operation is being tried
- What error types could occur
- Whether silent failure could mask real problems

For each swallowed error, answer the question: **"What failure am I hiding, and from whom?"**

Structure the analysis as:

1. **What failure is hidden?**
   - The specific error condition (e.g., permission denied, network timeout, corrupted data)
   - The observable symptom when this fails silently (e.g., stale data used, operation skipped, default returned)

2. **From whom is it hidden?**
   - **Developers**: Will they see this in logs? Can they debug it?
   - **Users**: Will they notice something is wrong? Will they get incorrect results?
   - **Operators**: Will monitoring/alerting catch this? Will it appear in telemetry?
   - **Calling code**: Does the caller know the operation failed? Can it recover appropriately?

3. **What's the blast radius?**
   - Does this cause data loss or corruption?
   - Does this affect only this operation or downstream operations?
   - Is the failure transient (retry might help) or permanent (will never succeed)?

---

## Resolution Pattern

For each swallowed error, apply this decision tree:

1. **Can this operation legitimately fail in normal use?**
   - No: Remove the catch entirely, let errors propagate
   - Yes: Continue to step 2

2. **Who benefits from suppressing error?**
   - Identify the specific parties.
   - Describe why the suppressed state improves the operation of the program. (But only if it does!)

3. **What specific error types are expected?**
   - Identify them precisely (e.g., `ENOENT`, `ECONNREFUSED`)
   - Only catch those specific cases

4. **Apply the pattern:**

```typescript
} catch (error) {
  // Expected case: file may not exist yet
  if (isExpectedError(error)) {
    console.warn(`[Context] Expected condition: ${description}`);
    return fallbackValue; // or continue
  }
  // Unexpected: propagate
  throw error;
}
```

5. **For Promise executors**: Remember that synchronous throws automatically become rejections. Often you can simply remove the try/catch entirely:

```typescript
// Before (swallows errors):
return new Promise((resolve) => {
  try {
    riskyOperation();
    resolve(result);
  } catch {
    resolve(defaultValue); // WRONG: hides failures
  }
});

// After (propagates errors):
return new Promise((resolve) => {
  riskyOperation(); // Throws become rejections automatically
  resolve(result);
});
```

6. **For fire-and-forget async calls**: If the operation is critical, await it and handle failure. If truly optional, at minimum log errors:

```typescript
// Before (swallows rejections):
void this.writeDiscoveryFile();
resolve(true);

// After (critical operation - await and fail on error):
this.writeDiscoveryFile()
  .then(() => {
    resolve(true);
  })
  .catch((error) => {
    this.handleError(error);
    resolve(false);
  });

// After (optional operation - at least log):
this.writeDiscoveryFile().catch((error) => {
  logger.error('Discovery file write failed', error);
});
```

7. **For silent early returns**: If the precondition is required for correct operation, throw instead of returning:

```typescript
// Before (silent skip):
async function writeConfig(): Promise<void> {
  const path = getConfigPath();
  if (!path) {
    return; // Caller has no idea config wasn't written
  }
  await fs.writeFile(path, data);
}

// After (explicit failure):
async function writeConfig(): Promise<void> {
  const path = getConfigPath();
  if (!path) {
    throw new Error('Cannot write config: no path available');
  }
  await fs.writeFile(path, data);
}
```

---

## Avoiding Test Noise with EventEmitter Warnings

When fixing swallowed errors by adding logging, tests may produce noisy console output for expected conditions. Use the EventEmitter pattern to make warnings testable and suppressible:

### Implementation Pattern

Extend `EventEmitter` and emit warnings instead of logging directly:

```typescript
import { EventEmitter } from 'node:events';

export class MyService extends EventEmitter {
  async riskyOperation(): Promise<Result | null> {
    try {
      return await doSomething();
    } catch (error) {
      // Expected case: resource may not exist
      if (isExpectedError(error)) {
        this.emitWarning(`Resource not found, using fallback`);
        return null;
      }
      // Unexpected: propagate
      throw error;
    }
  }

  /**
   * Emit a warning event, or log to console if no listeners are attached.
   */
  private emitWarning(message: string): void {
    if (this.listenerCount('warning') > 0) {
      this.emit('warning', message);
    } else {
      console.warn(message);
    }
  }
}
```

### Test Pattern: Capture and Assert

Tests can capture warnings to verify they occur without polluting output:

```typescript
it('should warn about corrupted file and return null', async () => {
  // Capture warnings
  const warnings: string[] = [];
  service.on('warning', (msg: string) => {
    warnings.push(msg);
  });

  const result = await service.get(corruptedId);

  assert.strictEqual(result, null, 'Should return null for corrupted file');
  assert.strictEqual(warnings.length, 1, 'Should emit one warning');
  assert.ok(warnings[0]?.includes('corrupted'), 'Warning should describe the issue');
});
```

### Always Assert on Captured Warnings

Never suppress warnings without asserting on them. If a warning is emitted, the test should verify:

1. **The warning occurred** - confirms the code path was taken
2. **The warning content is correct** - confirms the right condition was detected
3. **The warning count is expected** - catches regressions that add spurious warnings

Suppressing without assertion reintroduces the same problem as swallowed errors: silent failures that hide real issues.

### Why This Pattern Works

- **Production behavior**: No listeners → falls back to `console.warn()`
- **Test behavior**: Attach listener → capture warnings for assertion
- **Assertions required**: Tests verify the right warnings are emitted
- **No test noise**: Expected warnings don't pollute test output
- **Intentional**: The pattern documents that silent handling is deliberate
- **Regressions caught**: New unexpected warnings cause test failures

---

## Finding Tests That Protect Swallowed Errors

Tests can codify bad behavior. Search test files related to "$ARGUMENTS" for tests that expect errors to be silently handled:

1. **Tests expecting success on corruption**: `should skip corrupted`, `should ignore invalid`, `should handle malformed gracefully`
2. **Tests expecting null/empty on error**: `should return null for corrupted`, `should return empty array on error`
3. **Tests asserting no throw on error conditions**: `should not throw if`, `should gracefully handle`
4. **Tests with assertions like**: `assert.doesNotThrow`, `expect(...).not.toThrow`

**Why these tests are problematic:**

- They protect and codify error-swallowing behavior
- They make refactoring to proper error handling appear as a "regression"
- They give false confidence that the code handles edge cases correctly
- The "graceful handling" they test is often just silent failure

**Resolution:**

1. If the swallowed error is fixed to propagate, **delete the test** that expected silent handling
2. If silent handling is genuinely correct (rare), update the test to verify:
   - The specific error type being handled (not all errors)
   - That logging occurs when the condition is hit
   - That the behavior is intentional, not accidental

---

## Summary

- **Default**: Let errors propagate
- **Exception**: Catch only specific, expected error types
- **Always**: Log when bypassing, even for expected errors
- **Never**: `catch {}` or `catch { return success }`
- **Never**: `void asyncOperation()` on critical operations
- **Never**: Silent early returns when the operation is required
- **Tests**: Delete tests that protect error-swallowing behavior
- **Test noise**: Use EventEmitter pattern to make warnings capturable and suppressible
