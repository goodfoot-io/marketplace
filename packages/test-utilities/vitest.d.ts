/// <reference types="vitest/globals" />

import 'vitest';

declare module 'vitest' {
  interface Assertion {
    toEmit<T>(eventName: string, expected?: T, timeoutInterval?: number): Promise<void>;
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
  const test: typeof import('vitest').test;
  const it: typeof import('vitest').it;
}
