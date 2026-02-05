# Duplication Interpretation Guide

## Understanding Duplication Metrics

### How Detection Works

Token-based detection using Rabin-Karp rolling hash with identifier normalization:
- Variable names are normalized (`myVar` → `identifier`)
- String literals are normalized
- Minimum threshold: 100 tokens (configurable via `--min-tokens`)

### Key Metrics

| Metric | Meaning |
|--------|---------|
| Duplication Density | `duplicatedLines / totalLines` |
| Block Count | Number of duplicate code sequences |
| Token Count | Size of duplicate block (larger = higher priority) |

### Density Thresholds

| Density | Assessment | Action |
|---------|------------|--------|
| ≤5% | Healthy | Monitor only |
| 5-10% | Acceptable | Review largest blocks |
| 10-20% | Concerning | Prioritize extraction |
| >20% | Critical | Systematic refactoring needed |

## Interpreting Duplicate Blocks

### Report Format

```
| Location A | Location B | Tokens |
|------------|------------|--------|
| src/handlers/user.ts:45 | src/handlers/admin.ts:72 | 640 |
```

**Prioritization:**
1. Higher token count = more impactful extraction
2. Same package duplication = easier to extract
3. Cross-package duplication = may indicate missing shared module

## Refactoring Strategies

### 1. Extract to Shared Module

**When:** Same logic in multiple files within a package.

**Before:**
```typescript
// handlers/user.ts
async function createUser(data: UserInput) {
  const validated = {
    email: data.email.toLowerCase().trim(),
    name: data.name.trim(),
    createdAt: new Date(),
  };
  // ... insert logic
}

// handlers/admin.ts
async function createAdmin(data: AdminInput) {
  const validated = {
    email: data.email.toLowerCase().trim(),
    name: data.name.trim(),
    createdAt: new Date(),
  };
  // ... insert logic
}
```

**After:**
```typescript
// shared/normalize.ts
export function normalizeUserInput<T extends { email: string; name: string }>(
  data: T
): T & { createdAt: Date } {
  return {
    ...data,
    email: data.email.toLowerCase().trim(),
    name: data.name.trim(),
    createdAt: new Date(),
  };
}
```

### 2. Create Shared Workspace Package

**When:** Duplicate code across multiple packages in monorepo.

```
packages/
├── package-a/src/utils.ts  # Duplicate
├── package-b/src/utils.ts  # Duplicate
└── shared-utils/           # NEW: Extract here
    └── src/index.ts
```

### 3. Higher-Order Function Extraction

**When:** Similar logic with different operations.

**Before:**
```typescript
// Both files have 50 lines of similar retry logic
async function fetchWithRetry(url: string) {
  let attempts = 0;
  while (attempts < 3) {
    try {
      return await fetch(url);
    } catch (e) {
      attempts++;
      if (attempts >= 3) throw e;
      await sleep(1000 * attempts);
    }
  }
}

async function queryWithRetry(query: string) {
  let attempts = 0;
  while (attempts < 3) {
    try {
      return await db.query(query);
    } catch (e) {
      attempts++;
      if (attempts >= 3) throw e;
      await sleep(1000 * attempts);
    }
  }
}
```

**After:**
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let attempts = 0;
  while (true) {
    try {
      return await operation();
    } catch (e) {
      attempts++;
      if (attempts >= maxAttempts) throw e;
      await sleep(1000 * attempts);
    }
  }
}

// Usage
const data = await withRetry(() => fetch(url));
const results = await withRetry(() => db.query(query));
```

### 4. Template Method Pattern

**When:** Similar algorithms with variation points.

```typescript
abstract class DataProcessor<T, R> {
  async process(input: T): Promise<R> {
    const validated = this.validate(input);
    const transformed = this.transform(validated);
    const result = await this.save(transformed);
    await this.notify(result);
    return result;
  }

  protected abstract validate(input: T): T;
  protected abstract transform(input: T): R;
  protected abstract save(data: R): Promise<R>;
  protected notify(result: R): Promise<void> {
    // Default implementation, override if needed
    return Promise.resolve();
  }
}
```

### 5. Configuration-Driven Approach

**When:** Duplicate code differs only in constants/config.

**Before:**
```typescript
// user-validator.ts
const MIN_AGE = 18;
const MAX_NAME_LENGTH = 100;
function validateUser(user: User) { /* uses constants */ }

// admin-validator.ts
const MIN_AGE = 21;
const MAX_NAME_LENGTH = 50;
function validateAdmin(admin: Admin) { /* same logic */ }
```

**After:**
```typescript
interface ValidationConfig {
  minAge: number;
  maxNameLength: number;
}

function createValidator(config: ValidationConfig) {
  return function validate(entity: { age: number; name: string }) {
    if (entity.age < config.minAge) throw new Error('Too young');
    if (entity.name.length > config.maxNameLength) throw new Error('Name too long');
  };
}

const validateUser = createValidator({ minAge: 18, maxNameLength: 100 });
const validateAdmin = createValidator({ minAge: 21, maxNameLength: 50 });
```

## Acceptable Duplication

Not all duplication should be eliminated:

1. **Test fixtures**: Similar setup across tests is fine
2. **Boilerplate required by frameworks**: e.g., React component structure
3. **Independent evolution**: Code that looks similar now but serves different domains
4. **Clarity over DRY**: Sometimes explicit is better than abstracted

### Rule of Three

Extract when:
- Code appears 3+ times, OR
- Code appears 2 times AND is complex (>50 tokens), OR
- Code will definitely be needed again

## Cross-Package Duplication Patterns

### Common Scenarios

| Pattern | Example | Solution |
|---------|---------|----------|
| Test utilities | Matchers, fixtures | Shared test-utilities package |
| Type definitions | Same interfaces | Shared types package |
| API clients | Same fetch patterns | Shared HTTP client |
| Validation | Same schema logic | Shared validation package |

### Migration Strategy

1. Identify largest duplicate blocks in report
2. Group by package pairs
3. Create shared package for highest-value extractions
4. Update imports incrementally
5. Re-run metrics to verify improvement

## Monitoring Duplication

Track over time:
- **Density trend**: Should decrease or stay stable
- **New block count**: Alert on large new duplicates
- **Cross-package growth**: May indicate missing abstractions
