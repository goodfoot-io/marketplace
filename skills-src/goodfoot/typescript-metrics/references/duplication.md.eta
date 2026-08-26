# Duplication: Extraction Guide

## Density Thresholds

| Density | Assessment |
|---------|------------|
| ≤5% | Healthy |
| 5-10% | Acceptable, review largest blocks |
| 10-20% | Concerning, prioritize extraction |
| >20% | Systematic refactoring needed |

## Prioritizing What to Extract

1. **Higher token count** = More impactful extraction
2. **Same package** = Easier to extract
3. **Cross-package** = May indicate missing shared module

## Extraction Patterns

### Extract to Shared Function

When the same logic appears in multiple files.

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

// handlers/admin.ts (same normalization)
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

### Higher-Order Function for Similar Patterns

When logic is similar but differs in one operation.

**Before:** (Two functions with 50 lines of similar retry logic)
```typescript
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
  // Same retry logic, different operation
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

### Configuration-Driven Approach

When duplicates differ only in constants.

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

### Create Shared Package (Monorepo)

When duplication crosses package boundaries.

```
packages/
├── package-a/src/utils.ts  # Duplicate
├── package-b/src/utils.ts  # Duplicate
└── shared-utils/           # NEW: Extract here
    └── src/index.ts
```

## The Rule of Three

Extract when:
- Code appears **3+ times**, OR
- Code appears **2 times AND is complex** (>50 tokens), OR
- Code will **definitely be needed again**

## Acceptable Duplication

Not all duplication should be eliminated:

1. **Test fixtures** — Similar setup across tests is fine
2. **Framework boilerplate** — Required structure (React components, etc.)
3. **Independent evolution** — Code that looks similar now but serves different domains may diverge
4. **Clarity over DRY** — Sometimes explicit is better than an abstraction that's hard to understand
