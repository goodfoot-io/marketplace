# Data Flow Issues: Understanding and Fixing

## Why Data Flow Problems Matter

Data flow issues indicate API rot—parameters that were added for flexibility that nobody uses, return values that nobody checks. They signal either unfinished work or over-engineering. Either way, dead code paths make the code harder to understand.

## Patterns Detected

| Pattern | Meaning |
|---------|---------|
| Unused Parameters | Optional/default params never provided by callers |
| Ignored Returns | Non-void return values discarded |

## Unused Parameters

### What the Report Shows

```
| File | Function | Parameter | Type | Call Sites |
|------|----------|-----------|------|------------|
| src/utils.ts:69 | getContextLines | contextSize | default | 2 |
```

This means `contextSize` has a default value, but neither of the 2 call sites provides it.

### Decision Framework

| Scenario | Action |
|----------|--------|
| Parameter never used in function body | Remove entirely |
| Parameter used, but callers don't customize | Keep if flexibility is planned, otherwise remove |
| Old API, callers migrated | Remove deprecated parameter |

### Fixing Unused Parameters

**Option 1: Remove if default is always correct**
```typescript
// Before
function getContextLines(file: string, line: number, contextSize = 3): string[] {
  // Uses contextSize
}
// All callers: getContextLines('file.ts', 10);

// After
function getContextLines(file: string, line: number): string[] {
  const contextSize = 3;
  // ...
}
```

**Option 2: Keep but document if intentional**
```typescript
/**
 * @param contextSize - Reserved for future customization
 */
function getContextLines(file: string, line: number, contextSize = 3): string[] { }
```

## Ignored Returns

### What the Report Shows

```
| File | Function | Return Type |
|------|----------|-------------|
| src/server.ts:84 | resume | ReadStream |
```

This means `resume()` returns a value that the caller discards.

### Decision Framework

| Return Type | Typical Cause | Action |
|-------------|---------------|--------|
| `Promise<T>` | Fire-and-forget async | Add `void` operator or await |
| `Disposable` | Missed cleanup | Store and call dispose |
| `boolean` | Unchecked success | Handle failure case |

### Fixing Ignored Returns

**Fire-and-forget async:**
```typescript
// Before (rejection disappears)
doAsyncThing();

// After - Option 1: Explicitly ignore
void doAsyncThing();

// After - Option 2: Handle errors
doAsyncThing().catch(console.error);

// After - Option 3: Await
await doAsyncThing();
```

**Missed cleanup:**
```typescript
// Before (leaked resource)
createServer();

// After
const server = createServer();
process.on('SIGTERM', () => server.close());
```

**Unchecked result:**
```typescript
// Before
cache.set('key', value);  // Returns boolean

// After
if (!cache.set('key', value)) {
  console.warn('Cache full');
}
```

## Low-Confidence Findings

The analyzer also detects unread writes and orphan reads, but these have high false positive rates due to:
- Dynamic property access (`obj[key]`)
- Serialization (`JSON.stringify`)
- Framework magic (ORMs, reactive bindings)

Only act on low-confidence findings after verifying the code path manually.
