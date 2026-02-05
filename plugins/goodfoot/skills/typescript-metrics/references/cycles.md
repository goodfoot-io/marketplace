# Circular Dependencies Interpretation Guide

## Understanding Cycle Metrics

### What the Report Shows

| Metric | Meaning |
|--------|---------|
| Count | Number of strongly connected components (SCCs) |
| SCC Distribution | Size distribution of cycles (2-file, 3-file, etc.) |
| Edges in Cycles | Total import relationships participating in cycles |

### Impact of Cycles

Circular dependencies cause:
1. **Build issues**: Bundlers may produce undefined values
2. **Test isolation problems**: Can't test modules independently
3. **Cognitive load**: Hard to understand dependency flow
4. **Initialization order bugs**: Race conditions at module load

## Interpreting Results

### Test Fixtures

Cycles in `test/fixtures/` directories are typically intentional:
```
packages/typescript-metrics/test/fixtures/monorepo-fixture/packages/pkg-b/src/cycle-a.ts
  → cycle-b.ts (test fixture — likely intentional)
```

**Action:** Ignore these; they exist to test cycle detection.

### Type-Only Cycles

Cycles using only `import type` syntax have no runtime impact:
```
src/types/user.ts → src/types/order.ts (type-only — no runtime impact)
```

**Why they're harmless:**
- `import type` is erased at compile time
- No actual JavaScript dependency exists
- Common pattern for mutually referencing interfaces

**Action:** Generally safe to ignore. Consider refactoring for clarity if confusing.

### Real Cycles

Non-test, non-type-only cycles require investigation:
```
src/services/user-service.ts → src/services/auth-service.ts
src/services/auth-service.ts → src/services/user-service.ts
```

**Action:** Break the cycle using strategies below.

## Breaking Cycles

### 1. Extract Shared Interface

**Most common solution.** Both modules depend on a third, shared interface.

**Before (Cycle):**
```typescript
// user-service.ts
import { AuthService } from './auth-service';
export class UserService {
  constructor(private auth: AuthService) {}
  async getUser(id: string) {
    if (!this.auth.isAuthenticated()) throw new Error('Not auth');
    // ...
  }
}

// auth-service.ts
import { UserService } from './user-service';
export class AuthService {
  constructor(private users: UserService) {}
  async authenticate(token: string) {
    const user = await this.users.getUser(token.userId);
    // ...
  }
}
```

**After (No Cycle):**
```typescript
// types.ts (new file - no dependencies)
export interface IUserService {
  getUser(id: string): Promise<User>;
}
export interface IAuthService {
  isAuthenticated(): boolean;
}

// user-service.ts
import type { IAuthService } from './types';
export class UserService implements IUserService {
  constructor(private auth: IAuthService) {}
}

// auth-service.ts
import type { IUserService } from './types';
export class AuthService implements IAuthService {
  constructor(private users: IUserService) {}
}

// composition-root.ts (wires them together)
const userService = new UserService(authService);
const authService = new AuthService(userService);
```

### 2. Dependency Injection

Pass dependencies at runtime instead of import-time.

**Before:**
```typescript
// a.ts
import { B } from './b';
export class A {
  private b = new B();
}

// b.ts
import { A } from './a';
export class B {
  private a = new A();
}
```

**After:**
```typescript
// a.ts
export class A {
  setB(b: B) { this.b = b; }
}

// b.ts
export class B {
  setA(a: A) { this.a = a; }
}

// main.ts
const a = new A();
const b = new B();
a.setB(b);
b.setA(a);
```

### 3. Merge Modules

If two modules are tightly coupled, they may belong together.

**Before:**
```typescript
// validation.ts
import { transform } from './transform';
export function validate(data: Data) {
  const transformed = transform(data);
  // validate transformed
}

// transform.ts
import { validate } from './validation';
export function transform(data: Data) {
  validate(data); // pre-validation
  // transform
}
```

**After:**
```typescript
// data-processing.ts
function internalValidate(data: Data) { /* ... */ }
function internalTransform(data: Data) { /* ... */ }

export function validate(data: Data) {
  const transformed = internalTransform(data);
  // validate transformed
}

export function transform(data: Data) {
  internalValidate(data);
  // transform
}
```

### 4. Event-Based Decoupling

Replace direct calls with event emission.

**Before:**
```typescript
// order-service.ts
import { InventoryService } from './inventory-service';
export class OrderService {
  constructor(private inventory: InventoryService) {}
  async createOrder(items: Item[]) {
    await this.inventory.reserve(items);
  }
}

// inventory-service.ts
import { OrderService } from './order-service';
export class InventoryService {
  constructor(private orders: OrderService) {}
  async onStockUpdate(item: Item) {
    await this.orders.notifyStockChange(item);
  }
}
```

**After:**
```typescript
// events.ts
export const orderEvents = new EventEmitter();

// order-service.ts
import { orderEvents } from './events';
export class OrderService {
  constructor() {
    orderEvents.on('stock-updated', this.handleStockUpdate.bind(this));
  }
}

// inventory-service.ts
import { orderEvents } from './events';
export class InventoryService {
  async onStockUpdate(item: Item) {
    orderEvents.emit('stock-updated', item);
  }
}
```

### 5. Lazy Import

Use dynamic import to defer resolution (last resort).

```typescript
// a.ts
export class A {
  async getB() {
    const { B } = await import('./b');
    return new B();
  }
}
```

**Caution:** This hides the dependency and may cause runtime errors.

## SCC Size Analysis

| SCC Size | Severity | Approach |
|----------|----------|----------|
| 2 | Low | Usually simple interface extraction |
| 3-5 | Medium | May need architectural review |
| >5 | High | Indicates deeper design issues |

### Large SCC Investigation

For SCCs with >5 nodes:
1. Visualize the subgraph
2. Identify the "core" coupling (most edges)
3. Apply strategies incrementally
4. Re-run metrics after each change

## Prevention

### Code Review Checklist

Before merging, verify:
- [ ] New imports don't create cycles
- [ ] Shared types are in dedicated files
- [ ] Dependency direction follows layer architecture
- [ ] No circular interface dependencies

### Architecture Patterns

**Onion Architecture:**
```
Domain (no deps) → Application → Infrastructure → UI
```

**Clean Architecture:**
```
Entities → Use Cases → Controllers → Frameworks
```

**Modular Monolith:**
```
Shared Kernel ← Module A
             ← Module B
             ← Module C
```

## Tooling Integration

### Pre-commit Check

```bash
# Run cycle detection before commit
typescript-metrics.mjs --metrics cycles --json | jq '.metrics.cycles.count'
```

### CI Pipeline

```yaml
- name: Check Cycles
  run: |
    CYCLES=$(typescript-metrics.mjs --metrics cycles --json | jq '.metrics.cycles.count')
    if [ "$CYCLES" -gt 0 ]; then
      echo "Error: $CYCLES circular dependencies detected"
      exit 1
    fi
```

## When Cycles Are Acceptable

Rare cases where cycles may be tolerated:
1. **Test fixtures**: Intentional for testing cycle detection
2. **Co-recursive algorithms**: Mutual recursion at function level (file-level is still problematic)
3. **Tightly coupled domains**: Consider merging into single module

Even in these cases, document why the cycle exists.
