# Protective Heuristics

<purpose>
This document provides safeguards against destructive refactoring. Use this framework when considering removal or significant modification of code whose purpose is not immediately clear. The goal is to avoid accidentally removing code that serves an important but non-obvious purpose.
</purpose>

<core-philosophy>
## The "Ask Why" Philosophy

Before labelling unfamiliar code as unnecessary, reconstruct the author's reasoning:

- **What problem were they facing?**
- **What constraints might have led to this approach?**
- **Is there a subtle requirement this addresses?**

Only after understanding intent should you determine whether code is truly unnecessary. Tools and inexperienced reviewers can identify surface-level improvements, but **only context reveals intent**. Without it, "improvements" can break valid use cases.

The expert mindset treats unclear code with curiosity rather than immediate judgment. Strange constructs often exist for reasons that become clear only with domain knowledge or historical context.
</core-philosophy>

<pause-signals>
## Red Flags: When to Pause Before Removing

Stop and investigate further if ANY of the following apply:

### 1. You do not fully understand the code

If you cannot explain what the code does and why it might be needed, do not remove it.

**Example:**
```typescript
// This looks unnecessary but you're not sure why it's here
const result = processData(input);
if (result === undefined) {
  return DEFAULT_VALUE; // Why not just return processData(input) ?? DEFAULT_VALUE?
}
return result;
```

Before simplifying, ask: Is there a reason `processData` returns `undefined` specifically (not `null`) in certain cases? Does the explicit check serve a purpose?

### 2. The plan mentions related behaviour

If the plan document references the behaviour this code might support, preserve the code.

**Example:**
Plan states: "System must handle null inputs gracefully"

```typescript
// Seems redundant - input is typed as string
const sanitize = (input: string | null): string => {
  if (input === null) {
    return '';
  }
  return input.trim();
};
```

Although TypeScript types suggest `null` is not expected, the plan explicitly requires null handling. Preserve this code.

### 3. The implementation log references it

If the log explains why this code exists, respect that context.

**Example log entry:**
> "Added retry logic for database connections because the PostgreSQL instance occasionally drops connections during high load"

```typescript
// Might look like over-engineering
const connectWithRetry = async (maxAttempts = 3): Promise<Connection> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await pool.connect();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await delay(1000 * attempt);
    }
  }
  throw new Error('Unreachable');
};
```

The log explains this is intentional. Do not simplify to a single connection attempt.

### 4. Tests depend on this behaviour

If tests exercise this code path, the behaviour is expected somewhere.

**Example:**
```typescript
// Seems like dead code - always returns early
const getValue = (key: string): string | undefined => {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  // This branch seems unreachable if cache always has the key
  const computed = expensiveComputation(key);
  cache.set(key, computed);
  return computed;
};
```

Check tests: if there is a test for the cache-miss scenario, this branch is intentional.

### 5. The code handles edge cases

Code that appears redundant may handle edge cases that are not obvious from the happy path.

**Example:**
```typescript
const divide = (a: number, b: number): number => {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('Invalid numeric input');
  }
  return a / b;
};
```

The `isFinite` check might seem unnecessary, but it handles `Infinity` and `NaN` inputs that could cause silent failures downstream.
</pause-signals>

<cross-reference-checklist>
## Cross-Reference Checklist Before Removal

Before removing any code, verify against these sources:

### Plan Document

- [ ] **Goals & Objectives**: Is this behaviour mentioned as a requirement?
- [ ] **Technical Approach**: Is this part of the specified implementation?
- [ ] **Constraints**: Does this address a stated constraint or limitation?
- [ ] **Non-Goals**: Is this explicitly out of scope (if so, removal may be appropriate)?

### Implementation Log

- [ ] **Decision Records**: Does the log explain why this approach was chosen?
- [ ] **Workarounds**: Is this documented as a workaround for a known issue?
- [ ] **Experiments**: Is this a remnant of an abandoned approach (if so, removal may be appropriate)?

### Test Coverage

- [ ] **Direct Tests**: Are there tests that specifically exercise this code?
- [ ] **Indirect Coverage**: Do integration tests rely on this behaviour?
- [ ] **Edge Case Tests**: Do tests cover scenarios this code might handle?

### Codebase Patterns

- [ ] **Similar Code**: Is similar code used elsewhere in the codebase?
- [ ] **Defensive Patterns**: Is this a project-wide defensive coding pattern?
</cross-reference-checklist>

<safe-removal-criteria>
## Safe Removal Criteria

Code is safe to remove when ALL of the following apply:

1. **Plan confirmation**: The plan document does not require this behaviour
2. **No test coverage**: No tests exercise or depend on this code path
3. **Log does not justify**: The implementation log does not explain its purpose
4. **Full understanding**: You understand what the code does and can articulate why it is not needed
5. **No downstream dependencies**: Removing this code does not break other parts of the system

### Examples of Safe Removal

**Dead code with clear evidence:**
```typescript
// Function has zero callers (verified via search)
// Not mentioned in plan
// No tests reference it
// Log shows it was from abandoned feature branch
const deprecatedHelper = () => {
  // ...
};
```

**Debugging artifacts:**
```typescript
// Obviously temporary debugging code
console.log('DEBUG: reached this point', { data });
```

**Commented-out code:**
```typescript
// Legacy implementation - replaced in PR #234
// const oldMethod = () => { ... };
```

**Unused imports:**
```typescript
import { unusedFunction } from './utils'; // No usages in file
```
</safe-removal-criteria>

<investigation-techniques>
## Investigation Techniques

When you encounter unclear code, use these techniques to understand its purpose:

### Search for References

```bash
# Find all usages of a function
grep -r "functionName" --include="*.ts"

# Find test coverage
grep -r "functionName" --include="*.test.ts"
```

### Review Git History

```bash
# See when and why the code was added
git log -p --follow -S "suspicious code snippet" -- path/to/file.ts

# See the full commit that introduced it
git blame path/to/file.ts
```

### Trace Call Paths

Follow the code from public entry points to understand how this code is reached:

1. Identify public API methods
2. Trace execution paths that could reach this code
3. Determine under what conditions this path executes

### Check Error Handling

Code that seems redundant often handles error cases:

```typescript
// Seems redundant - we already validated earlier
if (!user) {
  throw new Error('User not found');
}
```

Ask: Could the user become undefined between validation and this point? (Race conditions, async operations, cache invalidation)

### Consult Domain Experts

If available, the implementation log or comments may reference team members or decisions. The context they provide may explain non-obvious code.
</investigation-techniques>

<escalation-path>
## When Understanding Is Not Achievable

If after investigation you still cannot determine whether code is necessary:

1. **Do not remove it**
2. **Add a comment** documenting your uncertainty:
   ```typescript
   // TODO: Purpose unclear - may be removable if X is confirmed
   // See: [link to investigation notes or issue]
   ```
3. **Flag for human review** in your refactoring report under "NEEDS_REVIEW"
4. **Continue with other refactoring** that you can confidently perform

Preserving unclear code is preferable to accidentally breaking functionality. The cost of keeping potentially unnecessary code is lower than the cost of removing necessary code.
</escalation-path>

<summary>
## Summary Decision Tree

```
Is the code's purpose clear?
├── NO → Investigate further using techniques above
│   └── Still unclear? → Do NOT remove, flag for review
│
└── YES → Apply safe removal criteria
    ├── All criteria met → Safe to remove
    └── Any criterion not met → Do NOT remove
```
</summary>
