# Coupling: Understanding and Reducing

## Why Coupling Causes Maintenance Pain

Highly coupled code changes together. When modifying one file requires changes to many others, coupling is too high. Research shows coupling metrics predict change ripple effects and maintenance effort.

**Fan-in (Ca)** — Files that depend on this one. High fan-in means many things break if you change it.

**Fan-out (Ce)** — Files this one depends on. High fan-out means this file has many reasons to change.

**Instability (I = Ce / (Ca + Ce))** — How likely a file is to change when its dependencies change.

## Expected Instability by File Type

| File Type | Expected I | Why |
|-----------|------------|-----|
| `types.ts`, `interfaces/` | 0.0-0.2 | Core contracts, many dependents |
| `utils/`, `helpers/` | 0.1-0.3 | Shared utilities |
| `services/` | 0.4-0.6 | Business logic |
| `components/` | 0.5-0.8 | UI depends on services |
| `index.ts`, `main.ts` | 0.8-1.0 | Entry points aggregate imports |

## When Hub Nodes Are Problems

A hub with high fan-in AND high fan-out indicates mixed responsibilities—changes ripple both directions.

| Total Connections | Assessment |
|-------------------|------------|
| <10 | Normal |
| 10-15 | Monitor for growth |
| 16-25 | Review for split opportunities |
| >25 | Likely needs decomposition |

**Exception:** Barrel files (`index.ts`) aggregating exports are expected to have high connections.

## Refactoring Patterns

### Dependency Inversion

Depend on abstractions, not implementations. This inverts the dependency direction.

**Before:** (High-level depends on low-level)
```typescript
// order-service.ts (should be stable but depends on concrete implementations)
import { PostgresDatabase } from './postgres-database';
import { StripePayment } from './stripe-payment';

class OrderService {
  constructor(
    private db = new PostgresDatabase(),
    private payment = new StripePayment()
  ) {}
}
```

**After:** (Both depend on interfaces)
```typescript
// interfaces.ts (stable, no dependencies)
interface Database { query(sql: string): Promise<Result>; }
interface PaymentGateway { charge(amount: number): Promise<void>; }

// order-service.ts (now stable, depends only on interfaces)
class OrderService {
  constructor(
    private db: Database,
    private payment: PaymentGateway
  ) {}
}
```

### Extract Interface for High Fan-In

When many files import a concrete class, extract its interface.

**Before:**
```typescript
// user-repository.ts (15 files import this directly)
export class UserRepository {
  async findById(id: string): Promise<User> { /* ... */ }
}
```

**After:**
```typescript
// types/repositories.ts (stable)
export interface UserRepository {
  findById(id: string): Promise<User>;
}

// user-repository.ts (1 file imports this)
export class PostgresUserRepository implements UserRepository { /* ... */ }

// Other 14 files import the interface
```

### Split Oversized Modules

When one file exports many unrelated things, split by cohesion.

**Before:**
```typescript
// utils.ts (25 importers, 20 exports)
export function formatDate() { /* ... */ }
export function formatCurrency() { /* ... */ }
export function validateEmail() { /* ... */ }
export function validatePhone() { /* ... */ }
```

**After:**
```typescript
// utils/formatting.ts
export function formatDate() { /* ... */ }
export function formatCurrency() { /* ... */ }

// utils/validation.ts
export function validateEmail() { /* ... */ }
export function validatePhone() { /* ... */ }
```

### Enforce Module Boundaries

Internal implementation details should not be imported from outside the module.

**Before:** External packages import internal files directly
```
packages/auth/src/internal/tokens.ts  ← imported by packages/api
```

**After:** Only export through public API
```typescript
// packages/auth/index.ts (public API)
export { AuthService } from './src/auth-service';
// Internal files not exported
```

## Graph Density

| Density | Assessment |
|---------|------------|
| <5% | Healthy modularization |
| 5-10% | Review for unnecessary coupling |
| >10% | Too interconnected |

## Reducing Density

1. **Check transitive dependencies** — Does A need to import C, or can B provide what A needs?
2. **Use dependency injection** — Reduces direct imports
3. **Enforce public APIs** — Don't expose internals
