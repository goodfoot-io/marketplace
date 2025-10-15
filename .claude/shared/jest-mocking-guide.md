<jest-mocking-guide>
# Jest Mocking Guide

## 🚨 Most Common Issues & Fixes

### 1. Dynamic Imports Inside Functions Not Using Mocks
```typescript
// ❌ Problem: Function internally uses await import()
export async function handler() {
  const { someFunc } = await import('./module.js'); // Mock not applied!
}

// ✅ Solution: Mock with EXACT path including extension
jest.unstable_mockModule('./module.js', () => ({
  someFunc: mockSomeFunc
}));
// Path must match EXACTLY including .js extension
```

### 2. Mock Not Being Called (undefined mock.calls[0])
```typescript
// ❌ Problem: Accessing mock.calls[0] when mock wasn't called
const callback = mockFn.mock.calls[0][1]; // TypeError!

// ✅ Solution: Verify mock was called first
if (mockFn.mock.calls.length > 0) {
  const callback = mockFn.mock.calls[0][1];
}

// Better: Debug why mock wasn't called
console.log('Mock defined?', mockFn !== undefined);
console.log('Mock called?', mockFn.mock.calls.length);
```

### 3. Module State Persisting Between Tests
```typescript
// ❌ Problem: Static state causes conditional logic to skip mocks
if (!workspaceCleanups.has(id)) { // Skipped on second test!
  setupListener(); 
}

// ✅ Solution: Reset module cache
beforeEach(() => {
  jest.resetModules(); // Clear module cache
  jest.clearAllMocks(); // Clear mock state
});
```

### 4. TypeScript Not Recognizing Mock Methods
```typescript
// ❌ Problem: Property 'mockReturnValue' does not exist
someFunction.mockReturnValue('test');

// ✅ Solution: Use jest.mocked()
const mockedFn = jest.mocked(someFunction);
mockedFn.mockReturnValue('test');
```

### 5. ESM Module Import Order
```typescript
// ❌ Wrong: Import before mock
import { handler } from './handler';
jest.unstable_mockModule('./module', () => ({...}));

// ✅ Correct: Mock before import
jest.unstable_mockModule('./module', () => ({...}));
const { handler } = await import('./handler');
```

## 📋 Quick Debug Checklist

1. **Mock not called?** → Check if path matches EXACTLY (including .js extension)
2. **TypeError on mock.calls?** → Verify mock was called with `mock.calls.length > 0`
3. **State leaking between tests?** → Add `jest.resetModules()` to beforeEach
4. **TypeScript errors?** → Use `jest.mocked()` wrapper
5. **ESM not mocking?** → Ensure mock comes before import

## 🎯 Essential Patterns

### Type-Safe Mock Creation
```typescript
// Method 1: jest.mocked() (Recommended)
import { someFunction } from './module';
jest.mock('./module');
const mockedFn = jest.mocked(someFunction);

// Method 2: Typed mock with generics
type AsyncFunc = (id: string) => Promise<User>;
const mockAsync = jest.fn<AsyncFunc>();
mockAsync.mockResolvedValue({ id: '1', name: 'Test' });

// Method 3: Complex types with unknown
const mockFn = jest.fn() as unknown as ComplexFunctionType;
```

### Zustand Store Mocking
```typescript
// Common pattern in this codebase
const mockStore = {
  connectionState: 'connected' as const,
  reconnect: jest.fn(),
  setInitialGraphData: jest.fn()
};

jest.unstable_mockModule('../../stores/voice-agent-store', () => ({
  useVoiceAgentStore: jest.fn((selector?: unknown) => {
    if (selector && typeof selector === 'function') {
      return selector(mockStore);
    }
    return mockStore;
  })
}));
```

### Complex Object Mock Factories
```typescript
// For YJS and similar complex types
const createMockYMap = <T>(size: number) => {
  const observers = new Set<() => void>();
  return {
    size,
    observe: jest.fn((cb: () => void) => observers.add(cb)),
    unobserve: jest.fn((cb: () => void) => observers.delete(cb)),
    get: jest.fn<(key: string) => T | undefined>(),
    set: jest.fn<(key: string, value: T) => void>()
  };
};
```

### React Testing Library Integration
```typescript
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock hooks before importing component
jest.unstable_mockModule('../../hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({ user: mockUser }))
}));

const { useMyHook } = await import('../../hooks/useMyHook');

// Test with renderHook
const { result } = renderHook(() => useMyHook());

await waitFor(() => {
  expect(result.current.data).toBeDefined();
});
```

### Async Function Mock Chaining
```typescript
const mockAsync = jest.fn<() => Promise<Data>>();

// Chain different responses
mockAsync
  .mockResolvedValueOnce(firstResponse)
  .mockResolvedValueOnce(secondResponse)
  .mockRejectedValueOnce(new Error('Failed'))
  .mockResolvedValue(defaultResponse);
```

### Manual Mocks with Module Mapper
```typescript
// __mocks__/server/lib/auth.ts
export const auth = {
  api: {
    getSession: jest.fn()
  }
};

// jest.config.js - Map server paths for client tests
moduleNameMapper: {
  '^~/(.*)$': '<rootDir>/app/$1',
  '^@/(.*)$': '<rootDir>/src/$1',
  // Map server modules to mocks in client tests
  '^../../server/(.*)$': '<rootDir>/tests/__mocks__/server/$1'
}
```

## 🔧 Project Configuration

### Jest Config for TypeScript + ESM
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom', // or 'node'
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup-after-env.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^~/(.*)$': '<rootDir>/app/$1'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      isolatedModules: true, // Critical for performance
      tsconfig: { strict: true }
    }]
  },
  testPathIgnorePatterns: ['/node_modules/', '/build/', '/dist/']
};
```

### Setup File Pattern
```typescript
// tests/setup.ts - Global mocks and polyfills
import { TextEncoder, TextDecoder } from 'util';
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

// Mock browser APIs
Object.defineProperty(navigator, 'mediaDevices', {
  value: { getUserMedia: jest.fn() },
  configurable: true
});
```

## 🐛 Debugging Techniques

### Debug Why Mock Isn't Called
```typescript
// 1. Check if mock is defined
console.log('Mock exists?', mockFn !== undefined);

// 2. Check if module path matches
console.log('Import paths:', Object.keys(require.cache || {}));

// 3. Check mock call count
console.log('Times called:', mockFn.mock.calls.length);

// 4. Check mock implementation
console.log('Has impl?', mockFn.getMockImplementation() !== undefined);
```

### Common Error Solutions

#### "Cannot read properties of undefined (reading '1')"
```typescript
// Always check array length before accessing
const callback = mockFn.mock.calls.length > 0 
  ? mockFn.mock.calls[0][1] 
  : undefined;
```

#### TypeScript Strict Mode Issues
```typescript
// Use type guards for mock calls
if (mockFn.mock.calls.length > 0) {
  const [arg1, arg2] = mockFn.mock.calls[0] as [string, number];
}
```

#### Module Not Found with Dynamic Imports
```typescript
// Ensure path matches exactly including extension
await import('./module'); // ❌ Missing .js
await import('./module.js'); // ✅ Matches compiled output
```

## 💡 Test Setup Pattern

```typescript
describe('Feature', () => {
  // Declare mocks
  const mockService = jest.fn();
  
  // Reset before each test
  beforeEach(() => {
    jest.resetModules(); // Clear module cache
    jest.clearAllMocks(); // Clear mock state
    
    // Re-mock if using dynamic imports
    jest.unstable_mockModule('./service', () => ({
      service: mockService
    }));
  });
  
  // Clean up after tests
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('should work', async () => {
    // Import after mocking
    const { handler } = await import('./handler');
    
    // Test implementation
    await handler();
    expect(mockService).toHaveBeenCalled();
  });
});
```

## 🚧 Critical Gotchas

1. **Dynamic imports bypass mocks** unless path matches EXACTLY (including .js extension)
2. **Module state persists** between tests - use `jest.resetModules()`
3. **Mock before import** for ESM - no hoisting
4. **Check mock was called** before accessing mock.calls[0]
5. **TypeScript strict mode** requires explicit type annotations

## 📊 Decision Flow

```
Test failing?
├── Is mock.calls[0] undefined?
│   ├── Check if mock was called: mock.calls.length > 0
│   └── Debug why not called (path mismatch, module cache)
├── Dynamic import not mocked?
│   ├── Add .js extension to mock path
│   └── Ensure mock before import
├── State leaking between tests?
│   ├── Add jest.resetModules() to beforeEach
│   └── Re-mock after reset
└── TypeScript errors?
    └── Use jest.mocked() wrapper
```

## Quick Commands

```bash
# Run with ESM support
NODE_OPTIONS='--experimental-vm-modules' yarn test

# Debug specific test
NODE_OPTIONS='--experimental-vm-modules' yarn test --no-coverage path/to/test.ts
```

Remember: **Match paths exactly, reset modules between tests, mock before import.**
</jest-mocking-guide>