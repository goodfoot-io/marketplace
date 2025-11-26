# Complexity Assessment Framework

<purpose>
This document provides a systematic approach to distinguishing essential complexity from accidental complexity. Use this framework when you encounter sophisticated code and must determine whether to simplify or preserve it.
</purpose>

<core-distinction>
## Essential vs. Accidental Complexity

**Essential complexity** originates from the problem domain. It cannot be removed without losing functionality or violating requirements.

Examples of essential complexity:
- Financial calculations that must comply with regulatory rules
- Distributed systems handling network partitions and eventual consistency
- Authentication flows that must satisfy security requirements
- Domain logic that mirrors real-world business processes

**Accidental complexity** originates from the solution. It was introduced during implementation and can be removed or simplified without affecting requirements.

Examples of accidental complexity:
- Over-engineered architecture for straightforward problems
- Design patterns applied without demonstrated need
- Abstractions serving only a single implementation
- Configurable options that never vary in practice
- "Future-proof" extension points with no current consumers
</core-distinction>

<assessment-questions>
## Questions to Determine Complexity Type

Apply these questions systematically when evaluating complex code:

### Question 1: Does the plan require this sophistication?

Review the plan document. If the plan does not mention the need for this level of abstraction, configuration, or generality, the complexity is likely accidental.

**Example:**
```typescript
// Plan says: "Create a user validation function"
// Implementation provides:
interface ValidationStrategy<T> {
  validate(input: T): ValidationResult;
  configure(options: ValidationOptions): void;
}

class UserValidationStrategy implements ValidationStrategy<User> {
  // ... 150 lines of configurable validation
}
```

If the plan requires only user validation and does not mention extensibility to other entity types, the strategy pattern is accidental complexity.

### Question 2: Would simpler code pass the same tests?

If a straightforward implementation would satisfy all test cases, the additional sophistication is not earning its place.

**Example:**
```typescript
// Complex version
const getUserStatus = async (userId: string): Promise<Status> => {
  const pipeline = new ProcessingPipeline()
    .addStage(new ValidationStage())
    .addStage(new EnrichmentStage())
    .addStage(new TransformationStage());
  return pipeline.execute({ userId });
};

// Simple version that passes the same tests
const getUserStatus = async (userId: string): Promise<Status> => {
  const user = await db.users.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  return user.status;
};
```

If both versions pass all tests, prefer the simple version.

### Question 3: Does the complexity map to domain requirements?

Essential complexity has a direct correspondence to requirements. Each complex element should trace to a specific need.

**Essential complexity example:**
```typescript
// Plan requires: "Handle partial failures in batch operations"
const processBatch = async (items: Item[]): Promise<BatchResult> => {
  const results = await Promise.allSettled(items.map(processItem));
  return {
    succeeded: results.filter(r => r.status === 'fulfilled'),
    failed: results.filter(r => r.status === 'rejected'),
    partialSuccess: results.some(r => r.status === 'fulfilled')
                 && results.some(r => r.status === 'rejected')
  };
};
```

This complexity is essential because partial failure handling is an explicit requirement.

### Question 4: Is there a well-known solution that is simpler?

Before preserving complex code, verify that no standard library, well-known algorithm, or common pattern solves the problem more directly.

**Example:**
```typescript
// Custom implementation
const uniqueItems = (arr: Item[]): Item[] => {
  const seen = new Map<string, boolean>();
  const result: Item[] = [];
  for (const item of arr) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.set(key, true);
      result.push(item);
    }
  }
  return result;
};

// Standard solution
const uniqueItems = (arr: Item[]): Item[] =>
  [...new Map(arr.map(item => [item.id, item])).values()];
```

If a standard solution exists, the custom implementation is accidental complexity.
</assessment-questions>

<decision-matrix>
## Decision Matrix

| Condition | Complexity Type | Action |
|-----------|-----------------|--------|
| Plan explicitly requires this behaviour | Essential | Preserve, ensure documentation |
| Plan does not mention this sophistication | Likely accidental | Simplify if tests still pass |
| Tests would pass with simpler code | Accidental | Replace with simpler version |
| Complexity handles explicit edge cases from plan | Essential | Preserve |
| Abstraction serves single implementation | Accidental | Inline the abstraction |
| Configuration options never vary | Accidental | Remove configuration, use constants |
| Pattern prepares for unplanned future needs | Accidental | Remove, rebuild when needed |
</decision-matrix>

<refactoring-actions>
## Refactoring Actions for Accidental Complexity

### Collapse Unnecessary Abstractions

When an interface has only one implementation and no plan for others:

```typescript
// Before: Unnecessary abstraction
interface DataProcessor {
  process(data: Data): Result;
}

class ConcreteDataProcessor implements DataProcessor {
  process(data: Data): Result {
    return transform(data);
  }
}

// After: Direct implementation
const processData = (data: Data): Result => transform(data);
```

### Remove Speculative Generality

When code handles cases that do not exist:

```typescript
// Before: Handles hypothetical multi-tenant scenario
const getConfig = (tenantId?: string): Config => {
  if (tenantId) {
    return loadTenantConfig(tenantId);
  }
  return loadDefaultConfig();
};

// After: System is single-tenant per plan
const getConfig = (): Config => loadDefaultConfig();
```

### Simplify Over-Parameterised Functions

When parameters never vary:

```typescript
// Before: Configurable but always called the same way
const fetchUser = (
  id: string,
  includeDeleted: boolean = false,
  maxRetries: number = 3,
  timeout: number = 5000
): Promise<User> => { /* ... */ };

// All call sites use: fetchUser(id, false, 3, 5000)

// After: Remove unused flexibility
const fetchUser = (id: string): Promise<User> => { /* ... */ };
```
</refactoring-actions>

<preservation-criteria>
## When to Preserve Complexity

Preserve complexity when ALL of the following apply:

1. **Plan justification exists** - The plan document mentions the requirement this complexity addresses
2. **Tests exercise the complexity** - Test cases specifically validate the sophisticated behaviour
3. **Simpler alternatives fail requirements** - A straightforward approach would not satisfy the plan
4. **Domain experts confirm necessity** - The implementation log or comments explain why this approach was chosen

If any criterion is not met, investigate whether simplification is possible.
</preservation-criteria>
