# Complexity Interpretation Guide

## Understanding Complexity Metrics

### Cyclomatic Complexity (CC)

Counts independent execution paths. Each control flow statement adds 1:
- `if`, `else if`, `else`
- `for`, `while`, `do-while`
- `case` in switch
- `&&`, `||`, `??`
- `?.` (optional chaining)
- `catch` blocks

**Thresholds:**
| CC | Risk | Action |
|----|------|--------|
| 1-10 | Low | Maintainable |
| 11-20 | Moderate | Consider simplification |
| 21-50 | High | Refactor soon |
| >50 | Critical | Refactor immediately |

### Cognitive Complexity

Measures mental effort to understand code. Penalizes:
- Nesting depth (exponential penalty)
- Breaks in linear flow (early returns, breaks)
- Recursion

**Why cognitive matters more than cyclomatic:**
- CC=10 with flat structure is readable
- CC=10 with 5 levels of nesting is not

## Refactoring Strategies

### 1. Extract Guard Clauses

**Before (CC=4, Cognitive=6):**
```typescript
function processOrder(order: Order) {
  if (order) {
    if (order.items.length > 0) {
      if (order.customer) {
        // 20 lines of processing
      }
    }
  }
}
```

**After (CC=4, Cognitive=3):**
```typescript
function processOrder(order: Order) {
  if (!order) return;
  if (order.items.length === 0) return;
  if (!order.customer) return;

  // 20 lines of processing (no nesting)
}
```

### 2. Extract Named Functions

**Before (CC=8):**
```typescript
function handleRequest(req: Request) {
  if (req.method === 'GET') {
    // 15 lines
  } else if (req.method === 'POST') {
    // 20 lines
  } else if (req.method === 'PUT') {
    // 18 lines
  } else {
    // 5 lines
  }
}
```

**After (CC=4 in main, 2-3 each handler):**
```typescript
function handleRequest(req: Request) {
  switch (req.method) {
    case 'GET': return handleGet(req);
    case 'POST': return handlePost(req);
    case 'PUT': return handlePut(req);
    default: return handleUnknown(req);
  }
}
```

### 3. Replace Conditionals with Lookup

**Before (CC=6):**
```typescript
function getDiscount(tier: string): number {
  if (tier === 'bronze') return 0.05;
  if (tier === 'silver') return 0.10;
  if (tier === 'gold') return 0.15;
  if (tier === 'platinum') return 0.20;
  if (tier === 'diamond') return 0.25;
  return 0;
}
```

**After (CC=1):**
```typescript
const DISCOUNTS: Record<string, number> = {
  bronze: 0.05,
  silver: 0.10,
  gold: 0.15,
  platinum: 0.20,
  diamond: 0.25,
};

function getDiscount(tier: string): number {
  return DISCOUNTS[tier] ?? 0;
}
```

### 4. Strategy Pattern for Complex Branching

**When to use:** Multiple if/else or switch cases that will grow over time.

```typescript
interface PaymentStrategy {
  process(amount: number): Promise<Result>;
}

const strategies: Record<string, PaymentStrategy> = {
  credit: new CreditCardStrategy(),
  paypal: new PayPalStrategy(),
  crypto: new CryptoStrategy(),
};

function processPayment(method: string, amount: number) {
  const strategy = strategies[method];
  if (!strategy) throw new Error(`Unknown method: ${method}`);
  return strategy.process(amount);
}
```

### 5. State Machine for Complex State Logic

**When to use:** CC>20 driven by state transitions.

```typescript
type State = 'draft' | 'pending' | 'approved' | 'rejected';
type Event = 'submit' | 'approve' | 'reject' | 'revise';

const transitions: Record<State, Partial<Record<Event, State>>> = {
  draft: { submit: 'pending' },
  pending: { approve: 'approved', reject: 'rejected' },
  approved: {},
  rejected: { revise: 'draft' },
};

function transition(current: State, event: Event): State {
  const next = transitions[current]?.[event];
  if (!next) throw new Error(`Invalid: ${event} from ${current}`);
  return next;
}
```

## When to Ignore High Complexity

1. **Parser/lexer functions**: Inherently complex due to grammar handling
2. **Generated code**: Auto-generated from schemas, protobuf, etc.
3. **Configuration builders**: Many options but simple logic
4. **Test setup functions**: Complex but isolated
5. **Legacy code with no bugs**: If stable and rarely modified

## Prioritization

Address complexity hotspots based on:

1. **Change frequency**: High-churn + high-complexity = high risk
2. **Bug history**: Complexity correlates with defect density
3. **Developer time**: Most-read code benefits most from simplification
4. **Test coverage**: Low coverage + high complexity = dangerous

## Red Flags

- **CC > 50**: Almost certainly needs decomposition
- **Cognitive > 100**: Unreadable; split into smaller units
- **Anonymous functions with high complexity**: Name them for stack traces
- **Deeply nested callbacks**: Refactor to async/await
- **Long parameter lists in complex functions**: Group into objects
