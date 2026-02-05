# Complexity: Understanding and Fixing

## Why Complexity Causes Defects

Code with high complexity has more execution paths than humans can hold in working memory. Each branch doubles the mental model required to understand behavior. Research shows functions exceeding CC=10 have significantly higher defect rates.

**Cyclomatic Complexity (CC)** counts independent paths. Each `if`, `for`, `case`, `&&`, `||`, `?.`, and `catch` adds one.

**Cognitive Complexity** measures mental effort. It penalizes nesting exponentially—a CC=10 function with flat structure is readable; CC=10 with 5 levels of nesting is not.

## Thresholds

| CC | Risk | Action |
|----|------|--------|
| 1-10 | Low | Maintainable as-is |
| 11-20 | Moderate | Simplify when modifying |
| 21-50 | High | Refactor before extending |
| >50 | Critical | Decompose immediately |

## Refactoring Patterns

### Extract Guard Clauses

Deep nesting forces readers to track multiple conditions. Invert and return early.

**Before:** (CC=4, Cognitive=6)
```typescript
function processOrder(order: Order) {
  if (order) {
    if (order.items.length > 0) {
      if (order.customer) {
        // processing logic
      }
    }
  }
}
```

**After:** (CC=4, Cognitive=3)
```typescript
function processOrder(order: Order) {
  if (!order) return;
  if (order.items.length === 0) return;
  if (!order.customer) return;

  // processing logic (no nesting)
}
```

### Replace Conditionals with Lookup

Chains of `if` statements checking the same variable against different values are better as data.

**Before:** (CC=6)
```typescript
function getDiscount(tier: string): number {
  if (tier === 'bronze') return 0.05;
  if (tier === 'silver') return 0.10;
  if (tier === 'gold') return 0.15;
  if (tier === 'platinum') return 0.20;
  return 0;
}
```

**After:** (CC=1)
```typescript
const DISCOUNTS: Record<string, number> = {
  bronze: 0.05, silver: 0.10, gold: 0.15, platinum: 0.20,
};

function getDiscount(tier: string): number {
  return DISCOUNTS[tier] ?? 0;
}
```

### Extract Named Functions

Long branches in switch/if-else hide the structure. Extract each branch to a named function.

**Before:** (CC=8, hard to navigate)
```typescript
function handleRequest(req: Request) {
  if (req.method === 'GET') {
    // 15 lines
  } else if (req.method === 'POST') {
    // 20 lines
  } else {
    // 5 lines
  }
}
```

**After:** (CC=4 in main, each handler has CC=2-3)
```typescript
function handleRequest(req: Request) {
  switch (req.method) {
    case 'GET': return handleGet(req);
    case 'POST': return handlePost(req);
    default: return handleUnknown(req);
  }
}
```

### State Machine for State-Driven Logic

When complexity comes from state transitions, make the states and transitions explicit.

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

1. **Parser/lexer functions** — Grammar handling is inherently complex
2. **Generated code** — Don't refactor auto-generated code
3. **Configuration builders** — Many options but simple logic
4. **Stable, low-churn code** — If it works and rarely changes, leave it

## Prioritization

Not all complex code needs immediate attention. Prioritize by:

1. **Change frequency** — Complex code you modify often causes the most bugs
2. **Bug history** — Past bugs indicate likely future bugs
3. **Test coverage** — Low coverage + high complexity = danger
