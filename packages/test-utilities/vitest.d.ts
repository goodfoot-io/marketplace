/// <reference types="vitest/globals" />

import type { TestAPI } from 'vitest';
import 'vitest';

declare module 'vitest' {
  interface Assertion<T> {
    toEmit<U>(eventName: string, expected?: U, timeoutInterval?: number): Promise<void>;
    toEqualSorted(expected: unknown): void;
    tsStringIsEqual(expected: string): void;
  }
  interface AsymmetricMatchersContaining {
    toEmit<T>(eventName: string, expected?: T, timeoutInterval?: number): Promise<void>;
    toEqualSorted(expected: unknown): void;
    tsStringIsEqual(expected: string): void;
  }
}

declare global {
  const expect: typeof import('vitest').expect;
  const describe: typeof import('vitest').describe;
  const test: TestAPI;
  const it: TestAPI;
  const beforeEach: typeof import('vitest').beforeEach;
  const beforeAll: typeof import('vitest').beforeAll;
  const afterEach: typeof import('vitest').afterEach;
  const afterAll: typeof import('vitest').afterAll;
}
