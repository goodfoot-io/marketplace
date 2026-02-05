# Data Flow Analysis Interpretation Guide

## Understanding Data Flow Metrics

Data flow analysis detects broken patterns where data flows nowhere or from nowhere:

| Pattern | Description | Confidence |
|---------|-------------|------------|
| Unused Parameters | Optional/default params never provided by callers | High |
| Ignored Returns | Non-void return values discarded | High/Medium |
| Unread Writes | Properties written but never read | Low |
| Orphan Reads | Properties read but never written | Low |

## Interpreting Unused Parameters

### Report Format

```
| File | Function | Parameter | Type | Call Sites |
|------|----------|-----------|------|------------|
| src/utils.ts:69 | getContextLines | contextSize | default | 2 |
```

**Meaning:** `contextSize` has a default value, but neither of the 2 call sites provides it.

### Decision Framework

| Scenario | Action |
|----------|--------|
| Parameter never used in function body | Remove parameter entirely |
| Parameter used, but callers don't customize | Consider if flexibility is needed |
| Old API, callers migrated | Remove deprecated parameter |
| New API, callers not updated | Update callers or remove |

### Refactoring Unused Parameters

**Before:**
```typescript
function getContextLines(
  file: string,
  line: number,
  contextSize = 3  // Never provided by callers
): string[] {
  // Uses contextSize
}

// All call sites
getContextLines('file.ts', 10);
getContextLines('other.ts', 20);
```

**Option 1: Remove parameter (if default is always correct)**
```typescript
function getContextLines(file: string, line: number): string[] {
  const contextSize = 3;
  // ...
}
```

**Option 2: Keep but document intent**
```typescript
/**
 * @param contextSize - Lines before/after. Reserved for future customization.
 */
function getContextLines(
  file: string,
  line: number,
  contextSize = 3
): string[] { /* ... */ }
```

**Option 3: Update callers**
```typescript
// If some callers should provide different values
getContextLines('file.ts', 10, 5);  // More context
getContextLines('other.ts', 20, 1); // Less context
```

## Interpreting Ignored Returns

### Report Format

```
| File | Function | Return Type |
|------|----------|-------------|
| src/server.ts:84 | resume | ReadStream & { fd: 0; } |
```

**Meaning:** `resume()` returns a value, but caller discards it.

### Decision Framework

| Return Type | Typical Cause | Action |
|-------------|---------------|--------|
| `Promise<T>` | Fire-and-forget async | Add `void` or await |
| `Disposable` | Missed cleanup | Store and call dispose |
| `boolean` | Unchecked success | Handle failure case |
| Builder | Missed chain | Use returned value |

### Refactoring Ignored Returns

**Fire-and-forget async:**
```typescript
// Before (ignored Promise)
doAsyncThing();

// After - Option 1: Explicitly ignore
void doAsyncThing();

// After - Option 2: Handle result
await doAsyncThing();

// After - Option 3: Handle errors
doAsyncThing().catch(console.error);
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
  console.warn('Cache full, evicting...');
}
```

## Interpreting Unread Writes (Low Confidence)

### Why Low Confidence?

Static analysis may miss:
- Dynamic property access (`obj[key]`)
- Serialization (`JSON.stringify`)
- Framework magic (ORMs, reactive bindings)

### When to Act

Act on unread writes when:
1. Property is clearly unused after review
2. No framework magic could read it
3. Code is not serialized/logged

### Common False Positives

| Pattern | Why It's False Positive |
|---------|------------------------|
| `entity.updatedAt = new Date()` | ORM persists it |
| `state.count = 0` | React/Vue reads reactively |
| `config.debug = true` | May be serialized to JSON |
| `this.metrics.total++` | May be read externally |

## Interpreting Orphan Reads (Low Confidence)

### Why Low Confidence?

Properties may be set by:
- Constructor
- External assignment
- Spread operators
- Framework initialization

### When to Act

Act on orphan reads when:
1. Property clearly has no write path
2. Code would throw at runtime
3. Tests don't cover the path

### Common False Positives

| Pattern | Why It's False Positive |
|---------|------------------------|
| `process.env.NODE_ENV` | Set externally |
| `req.body.field` | Set by framework |
| `this.props.value` | Set by parent component |
| `config.setting` | Loaded from file |

## Confidence Level Actions

| Confidence | Analysis Approach |
|------------|-------------------|
| High | Likely real issue, investigate promptly |
| Medium | Verify with grep/trace before acting |
| Low | Check runtime behavior, may be false positive |

## API Cleanup Strategy

When data flow issues indicate API problems:

### 1. Audit Parameter Usage

```bash
# Find all call sites
print-call-sites.mjs functionName src/path/to/file.ts
```

### 2. Document Decisions

```typescript
/**
 * @param unusedParam - Kept for API compatibility. Will be removed in v2.
 * @deprecated The unusedParam parameter is unused
 */
function legacy(used: string, unusedParam?: string) {
  // unusedParam intentionally unused
}
```

### 3. Plan Deprecation

```typescript
// Version 1.x - Mark deprecated
/** @deprecated Use simpleVersion instead */
function complexVersion(a: string, b?: string, c?: number) { /* ... */ }

// Add simple alternative
function simpleVersion(a: string) { /* ... */ }

// Version 2.x - Remove deprecated
// complexVersion removed
```

## Integration with Complexity

Data flow issues often correlate with complexity:
- Unused parameters → Over-engineered function signature
- Ignored returns → Insufficient error handling
- Orphan reads → Incomplete refactoring

When both metrics flag the same file, prioritize refactoring.

## Automated Detection Limits

The analyzer cannot detect:
- Runtime-only data flow (eval, dynamic imports)
- Cross-process communication (IPC, HTTP)
- Database round-trips
- Framework-specific patterns

Always verify with runtime analysis for low-confidence findings.
