# Duplication Judgment

<purpose>
This document provides guidance for deciding whether to consolidate duplicated code or tolerate it. Use this framework when you encounter similar code in multiple locations and must determine the appropriate action.
</purpose>

<core-principle>
## The DRY Principle and Its Limits

"Don't Repeat Yourself" (DRY) is a valuable principle, but applying it without judgment can harm code quality. The goal is not to eliminate all textual similarity but to ensure that **knowledge is expressed in a single, authoritative location**.

**Key distinction:**
- **Harmful duplication**: The same business logic or algorithm copied to multiple places, requiring parallel updates when requirements change
- **Acceptable similarity**: Code that looks similar but represents genuinely different concepts or serves different purposes
</core-principle>

<consolidation-criteria>
## When to Consolidate Duplication

Consolidate duplicated code when ALL of the following apply:

### 1. The duplicates must change together

If a requirement change would necessitate updating all copies identically, the duplication is harmful.

**Example of harmful duplication:**
```typescript
// In userService.ts
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// In registrationController.ts (identical copy)
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
```

If the email validation rules change, both copies must be updated. Consolidate into a shared utility.

### 2. The abstraction is clear and well-named

The consolidated code should have an obvious, descriptive name that communicates its purpose.

**Good consolidation:**
```typescript
// shared/validation.ts
export const isValidEmailFormat = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
```

### 3. The abstraction does not couple unrelated code

Consolidation should not create dependencies between modules that should remain independent.

**Problematic consolidation:**
```typescript
// Shared utility that couples billing and notifications
export const formatCurrency = (amount: number, context: 'billing' | 'notification'): string => {
  if (context === 'billing') {
    return `$${amount.toFixed(2)} USD`;
  }
  return `$${amount}`;
};
```

This creates coupling between billing and notification modules. Separate implementations may be preferable.

### 4. Maintenance burden is significant

Consider the number of copies and frequency of changes. Two copies of stable code may be acceptable; five copies of frequently-changing code should be consolidated.
</consolidation-criteria>

<tolerance-criteria>
## When to Tolerate Duplication

Tolerate duplicated code when ANY of the following apply:

### 1. The duplicates serve different purposes

Code that looks similar but implements genuinely different business concepts should remain separate.

**Example of acceptable similarity:**
```typescript
// Order validation - business rules for orders
const validateOrder = (order: Order): ValidationResult => {
  const errors: string[] = [];
  if (!order.customerId) errors.push('Customer required');
  if (order.items.length === 0) errors.push('Items required');
  if (order.total < 0) errors.push('Invalid total');
  return { valid: errors.length === 0, errors };
};

// Invoice validation - different business rules
const validateInvoice = (invoice: Invoice): ValidationResult => {
  const errors: string[] = [];
  if (!invoice.customerId) errors.push('Customer required');
  if (invoice.lineItems.length === 0) errors.push('Line items required');
  if (invoice.amount < 0) errors.push('Invalid amount');
  return { valid: errors.length === 0, errors };
};
```

Although structurally similar, these validate different business entities with different rules. They may diverge as requirements evolve. Consolidating them would create a "wrong abstraction" that obscures intent.

### 2. Abstraction would obscure intent

When the extracted function would require complex parameters or conditionals to handle all cases, the abstraction harms readability.

**Poor abstraction:**
```typescript
// Overly generic - hard to understand what it does
const validateEntity = (
  entity: unknown,
  requiredFields: string[],
  numericFields: string[],
  constraints: Record<string, (value: unknown) => boolean>
): ValidationResult => {
  // Complex generic validation logic
};
```

The original explicit validations were clearer.

### 3. The duplicates may diverge

If business requirements suggest the similar code may evolve differently, keep copies separate to avoid coupling.

**Example:**
```typescript
// Free tier user limits - may change frequently
const FREE_USER_LIMITS = { storage: 1_000_000, requests: 100 };

// Enterprise trial limits - different change cadence
const TRIAL_LIMITS = { storage: 1_000_000, requests: 100 };
```

Although currently identical, these represent different business concepts with independent change drivers. Consolidating them creates false coupling.

### 4. Duplication is in test code

Test code often benefits from explicit, readable duplication rather than abstractions that obscure what each test validates.

**Acceptable test duplication:**
```typescript
test('creates user with valid email', async () => {
  const user = await createUser({ name: 'Alice', email: 'alice@example.com' });
  expect(user.id).toBeDefined();
  expect(user.email).toBe('alice@example.com');
});

test('creates user with valid name', async () => {
  const user = await createUser({ name: 'Bob', email: 'bob@example.com' });
  expect(user.id).toBeDefined();
  expect(user.name).toBe('Bob');
});
```

Each test is self-contained and clearly shows its purpose. Abstracting the common setup may reduce clarity.
</tolerance-criteria>

<decision-process>
## Decision Process

When you encounter duplicated code, follow this process:

### Step 1: Identify the duplication type

- **Textual duplication**: Code looks similar character-by-character
- **Structural duplication**: Code follows the same pattern but with different details
- **Semantic duplication**: Code does the same thing in different ways

### Step 2: Ask the consolidation questions

1. Must these copies change together when requirements change?
2. Can I name the abstraction clearly and specifically?
3. Will consolidation avoid coupling unrelated modules?
4. Is the maintenance burden significant (>2 copies, frequent changes)?

### Step 3: Ask the tolerance questions

1. Do these copies serve genuinely different business purposes?
2. Would abstraction require complex parameters or conditionals?
3. Might these copies diverge as requirements evolve?
4. Is this test code where explicitness aids readability?

### Step 4: Apply the decision rule

- If all consolidation criteria are met AND no tolerance criteria apply: **Consolidate**
- If any tolerance criterion applies: **Tolerate** (but add a comment if the similarity is striking)
- If uncertain: **Tolerate** - premature abstraction is harder to undo than delayed consolidation
</decision-process>

<consolidation-techniques>
## Consolidation Techniques

When consolidation is appropriate, apply these techniques:

### Extract Function

Move duplicated logic to a well-named function:

```typescript
// Before: Duplicated in multiple files
const result = items
  .filter(item => item.status === 'active')
  .map(item => ({ id: item.id, name: item.name }));

// After: Extracted to shared utility
import { getActiveItemSummaries } from './itemUtils';
const result = getActiveItemSummaries(items);
```

### Parameterise Differences

When duplicates differ only in specific values, parameterise:

```typescript
// Before: Two similar functions
const formatUSD = (amount: number): string => `$${amount.toFixed(2)}`;
const formatEUR = (amount: number): string => `€${amount.toFixed(2)}`;

// After: Parameterised
const formatCurrency = (amount: number, symbol: string): string =>
  `${symbol}${amount.toFixed(2)}`;
```

### Extract Base Class or Mixin

For structural duplication in classes, extract common behaviour:

```typescript
// Before: Duplicated lifecycle methods
class UserService {
  private initialized = false;
  async init() { /* ... */ this.initialized = true; }
  async shutdown() { this.initialized = false; /* ... */ }
}

class OrderService {
  private initialized = false;
  async init() { /* ... */ this.initialized = true; }
  async shutdown() { this.initialized = false; /* ... */ }
}

// After: Extracted base
abstract class ManagedService {
  protected initialized = false;
  async init() { await this.onInit(); this.initialized = true; }
  async shutdown() { this.initialized = false; await this.onShutdown(); }
  protected abstract onInit(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
}
```
</consolidation-techniques>

<warning>
## The Wrong Abstraction

Be alert to the "wrong abstraction" anti-pattern. When you consolidate code that should not be consolidated:

1. The abstraction accumulates conditionals and parameters
2. Changes to one use case break others
3. Developers copy-paste and modify rather than use the abstraction
4. The abstraction name becomes vague ("handleStuff", "processData")

If you observe these signs, consider reverting to explicit duplication and waiting for the correct abstraction to emerge.
</warning>
