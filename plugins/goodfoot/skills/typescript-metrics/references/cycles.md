# Circular Dependencies: Understanding and Breaking

## Why Cycles Are Harmful

Circular dependencies mean neither module can be understood, tested, or changed in isolation. They cause:

1. **Build issues** — Bundlers may produce undefined values
2. **Test isolation problems** — Can't mock one without the other
3. **Initialization bugs** — Race conditions at module load time
4. **Tangled responsibilities** — Modules that should be separate are entangled

## What the Report Shows

**Test fixtures** — Cycles in `test/fixtures/` are intentional for testing cycle detection. Ignore them.

**Type-only cycles** — Cycles using only `import type` have no runtime impact—TypeScript erases these at compile time. Usually safe to ignore.

**Real cycles** — Non-test, non-type-only cycles need investigation.

## Breaking Cycles

### Extract Shared Interface (Most Common)

When two modules need each other, extract what they share into a third.

**Before:** (Cycle)
```typescript
// user-service.ts
import { AuthService } from './auth-service';
export class UserService {
  constructor(private auth: AuthService) {}
}

// auth-service.ts
import { UserService } from './user-service';
export class AuthService {
  constructor(private users: UserService) {}
}
```

**After:** (No cycle)
```typescript
// types.ts (no dependencies)
export interface IUserService { getUser(id: string): Promise<User>; }
export interface IAuthService { isAuthenticated(): boolean; }

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
```

### Dependency Injection

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

// main.ts (wires them together)
const a = new A();
const b = new B();
a.setB(b);
b.setA(a);
```

### Merge Tightly Coupled Modules

If two modules always change together and can't be understood separately, they may belong together.

**Before:** Two files with circular imports
```typescript
// validation.ts imports transform.ts
// transform.ts imports validation.ts
```

**After:** Single file with clear internal structure
```typescript
// data-processing.ts
function internalValidate(data: Data) { /* ... */ }
function internalTransform(data: Data) { /* ... */ }

export function validate(data: Data) { /* uses both internal functions */ }
export function transform(data: Data) { /* uses both internal functions */ }
```

### Event-Based Decoupling

Replace direct calls with event emission when modules notify each other.

```typescript
// events.ts
export const orderEvents = new EventEmitter();

// order-service.ts
import { orderEvents } from './events';
export class OrderService {
  constructor() {
    orderEvents.on('stock-updated', this.handleStockUpdate);
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

## SCC Size Severity

| SCC Size | Severity | Approach |
|----------|----------|----------|
| 2 | Low | Simple interface extraction |
| 3-5 | Medium | May need architecture review |
| >5 | High | Indicates deeper design issues |

For large SCCs, identify the most connected nodes first—breaking those edges usually untangles the rest.

## When Cycles Are Acceptable

Rare, but document clearly:

1. **Test fixtures** — Intentional for testing
2. **Tightly coupled domain concepts** — Consider merging instead
