/// <reference types="vitest/globals" />

import type { TestAPI } from 'vitest';
import 'vitest';

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
