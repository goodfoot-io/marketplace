# Coupling & Instability Interpretation Guide

## Understanding Coupling Metrics

### Key Concepts

| Metric | Formula | Meaning |
|--------|---------|---------|
| Fan-in (Ca) | Count of importers | How many files depend on this |
| Fan-out (Ce) | Count of imports | How many files this depends on |
| Instability (I) | Ce / (Ca + Ce) | Likelihood of change propagation |
| Graph Density | edges / (nodes × (nodes-1)) | Overall coupling in codebase |

### Instability Interpretation

| Range | Classification | Characteristics |
|-------|----------------|-----------------|
| 0.0-0.3 | Stable | Many dependents, few dependencies. Hard to change. |
| 0.3-0.7 | Balanced | May indicate mixed responsibilities |
| 0.7-1.0 | Unstable | Few dependents, many dependencies. Easy to change. |

### Expected Instability by File Type

| File Type | Expected I | Why |
|-----------|------------|-----|
| `types.ts`, `interfaces/` | 0.0-0.2 | Core contracts, many dependents |
| `utils/`, `helpers/` | 0.1-0.3 | Shared utilities, widely imported |
| `lib/`, `core/` | 0.2-0.4 | Core logic, moderate dependents |
| `services/`, `handlers/` | 0.4-0.6 | Business logic, balanced |
| `components/`, `views/` | 0.5-0.8 | UI layer, depends on services |
| `index.ts`, `main.ts` | 0.8-1.0 | Entry points, aggregate imports |

## Interpreting Hub Nodes

### What Makes a Hub Problematic?

A hub with high Fan-in AND high Fan-out:
- Changes ripple in both directions
- Difficult to test in isolation
- Signs of "God object" antipattern

### Hub Analysis

| Total Degree | Fan-in | Fan-out | Assessment |
|--------------|--------|---------|------------|
| 15+ | High | Low | Stable core (OK if intentional) |
| 15+ | Low | High | Aggregator/barrel file (often OK) |
| 15+ | High | High | Mixed responsibility (investigate) |
| 10-15 | Any | Any | Monitor, may grow |
| <10 | Any | Any | Normal |

## Refactoring Strategies

### 1. Dependency Inversion

**Problem:** High-level module depends on low-level details.

**Before:**
```typescript
// order-service.ts (I=0.8 - should be more stable)
import { PostgresDatabase } from './postgres-database';
import { StripePayment } from './stripe-payment';
import { SendgridEmail } from './sendgrid-email';

class OrderService {
  constructor(
    private db = new PostgresDatabase(),
    private payment = new StripePayment(),
    private email = new SendgridEmail()
  ) {}
}
```

**After:**
```typescript
// interfaces.ts (I=0.0)
interface Database { query(sql: string): Promise<Result>; }
interface PaymentGateway { charge(amount: number): Promise<void>; }
interface EmailService { send(to: string, body: string): Promise<void>; }

// order-service.ts (I=0.3 - now stable)
class OrderService {
  constructor(
    private db: Database,
    private payment: PaymentGateway,
    private email: EmailService
  ) {}
}
```

### 2. Extract Interface

**Problem:** Many files depend on a concrete class.

**Before:**
```typescript
// user-repository.ts (Fan-in: 15)
export class UserRepository {
  async findById(id: string): Promise<User> { /* ... */ }
  async save(user: User): Promise<void> { /* ... */ }
  async delete(id: string): Promise<void> { /* ... */ }
}

// All 15 files import UserRepository directly
```

**After:**
```typescript
// types/repositories.ts (new, stable)
export interface UserRepository {
  findById(id: string): Promise<User>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

// user-repository.ts (Fan-in now: 1)
import type { UserRepository } from './types/repositories';
export class PostgresUserRepository implements UserRepository { /* ... */ }

// Other 14 files now import the interface
```

### 3. Facade Pattern for Hub Reduction

**Problem:** Single file has too many exports imported by many files.

**Before:**
```typescript
// utils.ts (Fan-in: 25, exports 20 functions)
export function formatDate() { /* ... */ }
export function formatCurrency() { /* ... */ }
export function validateEmail() { /* ... */ }
export function validatePhone() { /* ... */ }
// ... 16 more
```

**After:**
```typescript
// utils/formatting.ts
export function formatDate() { /* ... */ }
export function formatCurrency() { /* ... */ }

// utils/validation.ts
export function validateEmail() { /* ... */ }
export function validatePhone() { /* ... */ }

// utils/index.ts (optional barrel)
export * from './formatting';
export * from './validation';
```

### 4. Module Boundary Enforcement

**Problem:** Cross-module imports bypass public API.

**Before:**
```
packages/
└── auth/
    ├── src/
    │   ├── internal/hash.ts      # Imported directly by other packages
    │   ├── internal/tokens.ts    # Imported directly by other packages
    │   └── auth-service.ts
    └── index.ts                  # Public API ignored
```

**After:**
```
packages/
└── auth/
    ├── src/
    │   ├── internal/hash.ts      # Not exported
    │   ├── internal/tokens.ts    # Not exported
    │   └── auth-service.ts       # Uses internal modules
    └── index.ts                  # Only export: AuthService
```

## Graph Density Guidelines

| Density | Assessment | Action |
|---------|------------|--------|
| <5% | Sparse | Healthy modularization |
| 5-10% | Moderate | Review for unnecessary coupling |
| >10% | Dense | Investigate shared dependencies |

### Reducing Density

1. **Identify transitive dependencies**: A imports B imports C; does A need C?
2. **Use dependency injection**: Reduces direct imports
3. **Create clear module boundaries**: Enforce public APIs
4. **Extract shared dependencies**: To reduce cross-cutting imports

## Layered Architecture Validation

### Expected Dependency Flow

```
        ┌──────────────┐
        │   app/main   │  (top layer - highest instability)
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │  features/   │
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │  services/   │
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │    lib/      │
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │ types/utils  │  (bottom layer - lowest instability)
        └──────────────┘
```

### Detecting Layer Violations

The `--layers` option validates dependency direction. Violations appear in report.

**Fix violations:**
1. Move shared code to lower layer
2. Extract interface to lower layer
3. Use dependency injection
4. Restructure module boundaries

## Coupling Smells

| Smell | Indicator | Fix |
|-------|-----------|-----|
| God Object | High Fan-in AND Fan-out | Split by responsibility |
| Circular Dependency | Bidirectional imports | See `references/cycles.md` |
| Hidden Coupling | Transitive dependencies | Extract to explicit dependency |
| Leaky Abstraction | Internal imports from outside | Enforce module boundaries |
| Shotgun Surgery | Change requires many files | Extract to single module |

## Monitoring Strategy

Track over time:
- **Hub count**: Number of files with degree >10
- **Maximum degree**: Highest connected file
- **Density trend**: Should decrease with modularization
- **Layer violations**: Should be zero
