# Test Refinement

<purpose>
This document provides guidance for refactoring test code during pre-validation cleanup. Tests are first-class code that requires the same attention to clarity and maintainability as production code. Use this framework when evaluating and improving test quality.
</purpose>

<core-principle>
## Behaviour Over Implementation

Tests should verify WHAT code accomplishes, not HOW it accomplishes it internally.

**Behaviour-focused tests:**
- Assert on outputs, return values, and observable side effects
- Remain stable when implementation details change
- Serve as executable documentation of requirements
- Give confidence that the system works correctly

**Implementation-coupled tests:**
- Assert on internal method calls, private state, or intermediate values
- Break when code is refactored even if external behaviour is unchanged
- Create friction against improvement
- Provide false confidence (tests pass but requirements may not be met)
</core-principle>

<anti-patterns>
## Test Anti-Patterns to Refactor

### Anti-Pattern 1: Excessive Mocking of Internals

When tests mock internal dependencies extensively, they become coupled to implementation structure.

**Problematic:**
```typescript
test('processOrder calls internal methods correctly', async () => {
  const mockValidator = jest.fn().mockReturnValue(true);
  const mockEnricher = jest.fn().mockReturnValue({ enriched: true });
  const mockPersister = jest.fn().mockResolvedValue({ id: '123' });

  // Inject mocks into private implementation details
  const service = new OrderService({
    validator: mockValidator,
    enricher: mockEnricher,
    persister: mockPersister
  });

  await service.processOrder(orderData);

  // Assertions on internal call sequence
  expect(mockValidator).toHaveBeenCalledWith(orderData);
  expect(mockEnricher).toHaveBeenCalledWith(orderData);
  expect(mockPersister).toHaveBeenCalledWith({ ...orderData, enriched: true });
});
```

**Improved:**
```typescript
test('processOrder returns persisted order with ID', async () => {
  const service = new OrderService(realDependencies);

  const result = await service.processOrder(orderData);

  // Assertions on observable outcomes
  expect(result.id).toBeDefined();
  expect(result.status).toBe('processed');

  // Verify side effect through public interface
  const savedOrder = await service.getOrder(result.id);
  expect(savedOrder).toMatchObject(orderData);
});
```

### Anti-Pattern 2: Asserting Private State

Tests that access private fields or internal state are tightly coupled to implementation.

**Problematic:**
```typescript
test('cache stores items correctly', () => {
  const cache = new Cache();
  cache.set('key', 'value');

  // Accessing private implementation detail
  expect(cache['_storage'].get('key')).toBe('value');
  expect(cache['_accessCount']).toBe(1);
});
```

**Improved:**
```typescript
test('cache returns stored items', () => {
  const cache = new Cache();
  cache.set('key', 'value');

  // Assert through public interface
  expect(cache.get('key')).toBe('value');
  expect(cache.has('key')).toBe(true);
});
```

### Anti-Pattern 3: Testing Implementation Sequence

Tests that verify the order of internal operations break when implementation is optimised.

**Problematic:**
```typescript
test('initialisation sequence', async () => {
  const callOrder: string[] = [];

  // Spy on internal methods
  jest.spyOn(service, 'loadConfig').mockImplementation(() => {
    callOrder.push('config');
    return Promise.resolve();
  });
  jest.spyOn(service, 'connectDatabase').mockImplementation(() => {
    callOrder.push('database');
    return Promise.resolve();
  });

  await service.initialise();

  // Assert internal call order
  expect(callOrder).toEqual(['config', 'database']);
});
```

**Improved:**
```typescript
test('initialisation completes successfully', async () => {
  await service.initialise();

  // Assert observable outcomes
  expect(service.isReady()).toBe(true);
  expect(await service.healthCheck()).toEqual({ status: 'healthy' });
});
```

### Anti-Pattern 4: Mirror Tests

Tests that simply mirror the implementation provide no value beyond confirming the code runs.

**Problematic:**
```typescript
test('calculateTotal', () => {
  const items = [{ price: 10 }, { price: 20 }];
  const total = calculateTotal(items);

  // This is just reimplementing the function
  const expected = items.reduce((sum, item) => sum + item.price, 0);
  expect(total).toBe(expected);
});
```

**Improved:**
```typescript
test('calculateTotal sums item prices', () => {
  const items = [{ price: 10 }, { price: 20 }, { price: 5 }];

  // Assert against known expected value
  expect(calculateTotal(items)).toBe(35);
});

test('calculateTotal returns zero for empty array', () => {
  expect(calculateTotal([])).toBe(0);
});
```
</anti-patterns>

<redundancy-assessment>
## Assessing Test Redundancy

### Identifying Redundant Tests

Tests are redundant when they:
- Exercise the same code path with trivially different inputs
- Assert the same behaviour as another test
- Exist only because someone followed a "test everything" mandate without judgment

### Questions to Assess Redundancy

1. **Does this test fail for a different reason than other tests?**
   If two tests always fail together for the same root cause, one may be redundant.

2. **Does this test document a distinct requirement or edge case?**
   Each test should correspond to a specific behaviour or requirement from the plan.

3. **Would removing this test reduce confidence in the system?**
   If no confidence is lost, the test is redundant.

### Consolidation Techniques

**Parameterised tests** for multiple inputs with same logic:

```typescript
// Before: Redundant tests
test('validates email with .com domain', () => {
  expect(isValidEmail('user@example.com')).toBe(true);
});
test('validates email with .org domain', () => {
  expect(isValidEmail('user@example.org')).toBe(true);
});
test('validates email with .io domain', () => {
  expect(isValidEmail('user@example.io')).toBe(true);
});

// After: Parameterised
test.each([
  'user@example.com',
  'user@example.org',
  'user@example.io'
])('validates email: %s', (email) => {
  expect(isValidEmail(email)).toBe(true);
});
```

**Test grouping** for related scenarios:

```typescript
describe('UserService.createUser', () => {
  test('returns user with generated ID', async () => {
    const user = await service.createUser({ name: 'Alice' });
    expect(user.id).toBeDefined();
  });

  test('persists user to database', async () => {
    const user = await service.createUser({ name: 'Bob' });
    const found = await service.getUser(user.id);
    expect(found.name).toBe('Bob');
  });

  test('rejects duplicate email', async () => {
    await service.createUser({ name: 'Alice', email: 'alice@example.com' });
    await expect(
      service.createUser({ name: 'Bob', email: 'alice@example.com' })
    ).rejects.toThrow('Email already exists');
  });
});
```
</redundancy-assessment>

<simplification-techniques>
## Simplifying Test Code

### Reduce Setup Complexity

**Before:** Extensive setup obscures test intent
```typescript
test('processes payment', async () => {
  const user = await createUser({ name: 'Alice', email: 'alice@example.com' });
  const address = await createAddress({ userId: user.id, street: '123 Main' });
  const paymentMethod = await createPaymentMethod({ userId: user.id, type: 'card' });
  const cart = await createCart({ userId: user.id });
  await addToCart(cart.id, { productId: 'prod-1', quantity: 2 });
  await addToCart(cart.id, { productId: 'prod-2', quantity: 1 });
  const order = await createOrder({ cartId: cart.id, addressId: address.id });

  const result = await processPayment(order.id, paymentMethod.id);

  expect(result.status).toBe('completed');
});
```

**After:** Focused setup with factory helpers
```typescript
test('processes payment for valid order', async () => {
  const { order, paymentMethod } = await setupOrderWithPayment();

  const result = await processPayment(order.id, paymentMethod.id);

  expect(result.status).toBe('completed');
});
```

### Follow Arrange-Act-Assert

Structure tests with clear phases:

```typescript
test('applies discount to order total', () => {
  // Arrange
  const order = createOrder({ subtotal: 100 });
  const discount = createDiscount({ percentage: 10 });

  // Act
  const result = applyDiscount(order, discount);

  // Assert
  expect(result.total).toBe(90);
  expect(result.discountApplied).toBe(10);
});
```

### Use Descriptive Test Names

Test names should describe the behaviour, not the implementation:

**Poor names:**
- `test('createUser')`
- `test('handles error')`
- `test('works correctly')`

**Good names:**
- `test('createUser returns user with generated UUID')`
- `test('createUser rejects invalid email format')`
- `test('createUser sends welcome email on success')`
</simplification-techniques>

<alignment-checklist>
## Test-Code Alignment Checklist

After refactoring production code, verify test alignment:

- [ ] **Renamed elements**: If functions or classes were renamed, are test descriptions updated?
- [ ] **Split responsibilities**: If a function was split, are tests reorganised to cover each part?
- [ ] **Removed branches**: If code branches were removed, are corresponding tests removed or updated?
- [ ] **Changed signatures**: If function signatures changed, are test calls updated?
- [ ] **New edge cases**: If refactoring revealed edge cases, are tests added?
- [ ] **Obsolete assertions**: Are there assertions that no longer make sense after refactoring?
</alignment-checklist>

<decision-rule>
## When in Doubt

If uncertain whether to consolidate, simplify, or preserve a test:

1. **Ask**: "Does this test document a distinct requirement from the plan?"
2. **If yes**: Preserve, but consider simplifying the implementation
3. **If no**: Consider removing or consolidating with a related test
4. **Always**: Ensure at least one test covers each explicit plan requirement
</decision-rule>
