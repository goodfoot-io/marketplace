# Jest to Vitest Migration Guide

Complete guide for migrating existing Jest tests to Vitest, including configuration changes, dependency updates, and validation strategies.

## Overview

### Core Migration Changes

1. Replace jest.config.cjs with vitest.config.ts
2. Update package.json (scripts + dependencies)
3. Update test files (remove @jest/globals imports)
4. Add vitest.d.ts for TypeScript support
5. Handle framework-specific utilities (if any)

## Migration Steps

### Step 1: Establish Baseline Metrics

Record baseline metrics to ensure migration doesn't introduce regressions:

```bash
# Record current state
cd packages/YOUR_PACKAGE

# 1. Current test count
yarn test | grep "Tests:"  # e.g., "Tests: 89 passed, 89 total"

# 2. Type check status
yarn typecheck  # Should pass or document existing errors

# 3. Lint status
yarn lint  # Should pass or document existing errors
```

Document your baseline:
- Number of passing tests
- Any pre-existing type errors
- Any pre-existing lint errors

Critical Rule: Fix ALL pre-existing issues before migrating. Migration should not mask existing problems.

### Step 2: Create Vitest Configuration

Replace jest.config.cjs (or jest.config.js) with vitest.config.ts.

#### Basic Template
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,              // Makes describe/it/expect global
    environment: 'node',         // or 'jsdom' for browser tests
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  },
});
```

#### With Test Utilities Setup
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['@goodfoot/test-utilities/vitest-setup'],  // If using shared utilities
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  },
});
```

#### Package-Specific Options

##### For Packages With No Tests Yet
```typescript
test: {
  globals: true,
  environment: 'node',
  passWithNoTests: true,  // Prevents failure when no tests found
}
```

##### For Packages Using Custom Environment
```typescript
// Jest used custom environment - migrate to Vitest setup file
// See "Migrating Custom Environment" section below
```

### Step 3: Update package.json

Three changes needed:

#### Update Test Script
```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

Script options:
- `vitest run` - Run once and exit (CI/CD)
- `vitest watch` - Watch mode for development
- `vitest run --passWithNoTests` - Don't fail if no tests (alternative to config)

#### Remove Jest Dependencies
```json
{
  "devDependencies": {
    // REMOVE these:
    "jest": "^30.2.0",
    "ts-jest": "^29.4.5",
    "@jest/globals": "^30.2.0",
    "@types/jest": "^30.0.0"
  }
}
```

#### Add Vitest Dependency
```json
{
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

After updating package.json:
```bash
yarn install  # Update lockfile and install vitest
```

### Step 4: Update Test Files

Remove @jest/globals imports:

```typescript
// ❌ BEFORE
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('My Tests', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});

// ✅ AFTER (globals: true makes these available)
describe('My Tests', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
```

Why this works: `globals: true` in vitest.config.ts makes `describe`, `it`, `expect`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll` globally available.

**Important:** Removing these imports is safe because globals: true provides them at runtime. TypeScript support is added in Step 5.

#### Bulk Find & Replace
```bash
# Find files with @jest/globals imports
grep -r "from '@jest/globals'" tests/

# Remove the import lines
# Use your editor's search & replace or:
find tests/ -name "*.test.ts" -exec sed -i "s/import.*from '@jest\/globals';//g" {} \;
```

### Step 5: Add TypeScript Support (Critical!)

⚠️ **DO NOT SKIP:** Even with `globals: true`, TypeScript needs explicit type definitions for compile-time checking.

**Common symptom if skipped:** Tests pass (✅) but `yarn typecheck` fails (❌) with `error TS2304: Cannot find name 'describe'`.

#### Create vitest.d.ts

In the package root (same level as package.json), create `vitest.d.ts`:

```typescript
/// <reference types="vitest/globals" />
```

This single line provides TypeScript with the type definitions for all Vitest globals.

**Location:** `packages/your-package/vitest.d.ts`

#### Update tsconfig.json

Add `vitest.d.ts` to the `include` array and set `types` to prevent Jest type pollution:

```json
{
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.d.ts"],
  "compilerOptions": {
    "types": ["node"]  // Prevents Jest type pollution from @types/jest
  }
}
```

**Why both changes are needed:**
- `globals: true` in vitest.config.ts → Makes functions available at **runtime**
- `vitest.d.ts` + tsconfig include → Provides **type definitions** at compile time
- `types: ["node"]` → Prevents conflicts between Jest and Vitest types

**Without this step:**
- ✅ Tests run successfully with `yarn test`
- ✅ Runtime works perfectly
- ❌ `yarn typecheck` fails with `error TS2304: Cannot find name 'describe'`
- ❌ `yarn lint` may fail due to type errors
- ❌ IDE shows red squiggles on test globals

### Step 6: Validate Migration

Run all validation commands:
```bash
yarn typecheck  # Should pass with 0 errors
yarn test       # Should pass with same test count as baseline
yarn lint       # Should pass with 0 errors
```

Success criteria:
- Test count matches baseline
- All tests passing
- Zero type errors
- Zero lint errors
- Tests exit cleanly (no hanging processes)

## Migrating Framework-Specific Files

### Renaming Framework-Specific Files

Pattern from test-utilities migration:

Files renamed:
1. `jest-environment.ts` → `vitest-setup.ts`
2. `jest-teardown.ts` → `vitest-teardown.ts`
3. `jest-matchers.ts` → `vitest-matchers.ts`

#### Rename Source Files
```bash
cd packages/test-utilities/src
mv jest-environment.ts vitest-setup.ts
mv jest-teardown.ts vitest-teardown.ts
mv jest-matchers.ts vitest-matchers.ts
```

#### Update package.json Exports
```json
{
  "exports": {
    "./vitest-teardown": "./build/dist/src/vitest-teardown.js",
    "./vitest-matchers": "./build/dist/src/vitest-matchers.js",
    "./vitest-setup": "./build/dist/src/vitest-setup.js"
  }
}
```

#### Update Imports in Dependent Packages
```bash
# Find all imports of old names
grep -r "jest-teardown\|jest-matchers\|jest-environment" packages/

# Update each import:
# Old: import { jestTeardownQueue } from '@goodfoot/test-utilities/jest-teardown';
# New: import { teardownQueue } from '@goodfoot/test-utilities/vitest-teardown';
```

#### Update vitest.config.ts References
```typescript
// Old
setupFiles: ['@goodfoot/test-utilities/jest-environment']

// New
setupFiles: ['@goodfoot/test-utilities/vitest-setup']
```

#### Rebuild and Validate
```bash
yarn build
yarn typecheck
```

### Framework-Agnostic Naming

Problem: Names like `jestTeardownQueue` expose framework choice.

Solution: Remove framework prefixes for future portability.

#### Export Names
```typescript
// Before
export const jestTeardownQueue: PQueue = new PQueue({ concurrency: 1 });
export function startJestTeardownQueue() { ... }
export const JEST_TEARDOWN = 'JEST_TEARDOWN';

// After
export const teardownQueue: PQueue = new PQueue({ concurrency: 1 });
export function startTeardownQueue() { ... }
export const TEARDOWN = 'TEARDOWN';
```

#### Constant String Values
```typescript
// Don't forget to update the constant's string value too!
// Before
export const JEST_TEARDOWN = 'JEST_TEARDOWN';

// After
export const TEARDOWN = 'TEARDOWN';
```

#### Internal Variable References
```typescript
// Before
const originalAdd = jestTeardownQueue.add.bind(jestTeardownQueue);

// After
const originalAdd = teardownQueue.add.bind(teardownQueue);
```

#### Global Function Declarations
```typescript
// Before
declare global {
  function startJestTeardownQueue(): void;
}

// After
declare global {
  function startTeardownQueue(): void;
}
```

#### Update Consuming Packages
```bash
# Find all usages
grep -r "jestTeardownQueue\|startJestTeardownQueue\|JEST_TEARDOWN" packages/

# Update each usage to new names
```

#### Update Comments
```typescript
// Before: Register with JEST_TEARDOWN queue
// After: Register with TEARDOWN queue
```

### Migrating Custom Jest Environment

#### Jest Pattern
```typescript
// packages/test-utilities/src/jest-environment.ts
import { TestEnvironment } from 'jest-environment-node';

export default class CustomTestEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    this.global.startJestTeardownQueue = () => { ... };
  }

  async teardown() {
    await super.teardown();
  }
}
```

#### Vitest Pattern
```typescript
// packages/test-utilities/src/vitest-setup.ts
import { afterEach } from 'vitest';

// Helper to build full test name from task hierarchy
function buildFullTestName(task: any): string {
  const parts: string[] = [];
  let current = task;
  while (current) {
    if (current.name) parts.unshift(current.name);
    current = current.suite;
  }
  return parts.join(' > ');
}

// Register afterEach hook to start teardown
afterEach((context) => {
  if (context?.task?.type === 'test') {
    const testName = buildFullTestName(context.task);
    globalThis.startTeardownQueue(testName);
  }
});
```

Why simpler: Vitest's task context API provides test names directly, no custom environment class needed.

### Migrating Custom Matchers

Only 2 changes needed per matcher file:

#### Update Import
```typescript
// Before
import { expect } from '@jest/globals';

// After
import { expect } from 'vitest';
```

#### Update TypeScript Declaration
```typescript
// Before
declare global {
  namespace jest {
    interface Matchers<R> {
      toEmit(eventName: string): Promise<R>;
    }
  }
}

// After
declare module 'vitest' {
  interface Assertion {
    toEmit(eventName: string): Promise<void>;
  }
  interface AsymmetricMatchersContaining {
    toEmit(eventName: string): void;
  }
}
```

#### Keep jest-matcher-utils

```typescript
// These packages work identically with Vitest
import {
  matcherHint,
  printDiffOrStringify,
  printExpected,
  printReceived,
} from 'jest-matcher-utils';

import { equals, iterableEquality} from '@jest/expect-utils';
```

Don't remove these dependencies - they're fully compatible with Vitest.

## Migration Order for Monorepos

Critical: Migrate in dependency order to avoid cascading failures.

### Strategy

#### Identify Dependency Tree
```bash
# Find packages that depend on test-utilities
grep -r "@goodfoot/test-utilities" packages/*/package.json

# Result shows: memory, queue, example all depend on test-utilities
```

#### Migration Sequence
```
Priority 1: test-utilities (shared utilities, no dependencies)
  ├─ Migrate completely (all steps 1-6)
  ├─ ⚠️  CRITICAL: Rebuild before continuing
  │   └─ cd packages/test-utilities && yarn build
  └─ Validate: yarn typecheck && yarn test

Priority 2: Dependent packages (can migrate in parallel)
  ├─ memory
  ├─ queue
  └─ example

Priority 3: Workspace validation
  └─ yarn typecheck && yarn test && yarn lint
```

**⚠️ CRITICAL: Rebuild After Migrating Shared Packages**

After completing the test-utilities migration (or any shared package), you **MUST** rebuild before migrating dependent packages:

```bash
cd packages/test-utilities
yarn build  # REQUIRED - Do not skip this step
```

**Why this is critical:**

1. **Dependent packages import from build output:** Other packages import from `@goodfoot/test-utilities/vitest-teardown`, which points to `build/dist/src/vitest-teardown.js`
2. **File renames break imports:** After renaming `jest-teardown.ts` → `vitest-teardown.ts`, the old build artifacts reference files that no longer exist
3. **TypeScript project references:** Composite projects expect build artifacts to match source files

**Without rebuilding, you'll see:**
- ❌ `error TS6305: Output file has not been built from source file`
- ❌ `Cannot find module '@goodfoot/test-utilities/vitest-teardown'`
- ❌ Import errors in all dependent packages
- ❌ Cascading failures that block migration

**Correct workflow:**
```bash
# 1. Migrate test-utilities completely (Steps 1-6)
cd packages/test-utilities
# ... perform migration steps ...

# 2. Rebuild immediately (CRITICAL)
yarn build

# 3. Now safe to migrate dependent packages
cd ../memory
# ... perform migration steps ...
```

Why this order:
- test-utilities changes exports and APIs
- Dependent packages need updated test-utilities to compile
- Rebuilding test-utilities before migrating dependents prevents import errors

## Migration Validation Checklist

Verify each package migration with this checklist:

```bash
cd packages/YOUR_PACKAGE

# 1. Configuration
[ ] vitest.config.ts created
[ ] jest.config.cjs deleted
[ ] package.json test script updated to "vitest run"

# 2. Dependencies
[ ] jest removed from devDependencies
[ ] ts-jest removed from devDependencies
[ ] @jest/globals removed from devDependencies
[ ] @types/jest removed from devDependencies
[ ] vitest@3.2.4 added to devDependencies
[ ] yarn install completed successfully

# 3. TypeScript
[ ] vitest.d.ts created with /// <reference types="vitest/globals" />
[ ] vitest.d.ts added to tsconfig.json include array
[ ] types: ["node"] in tsconfig.json compilerOptions

# 4. Test Files
[ ] Removed all @jest/globals imports
[ ] Updated imports from test-utilities (if renamed)
[ ] No jest-specific syntax remaining

# 5. Validation Commands
[ ] yarn typecheck passes with 0 errors
[ ] yarn test passes with same test count as baseline
[ ] yarn lint passes with 0 errors
[ ] yarn build succeeds (if applicable)

# 6. Behavioral
[ ] Tests exit cleanly (no hanging processes)
[ ] No "open handles" warnings
[ ] Test execution time similar to baseline
```

### Workspace Validation

```bash
# After migrating all packages

# 1. Workspace-level validation
yarn typecheck  # All packages pass
yarn test       # All packages pass
yarn lint       # All packages pass
yarn build      # All packages build

# 2. Verify test counts
# Should match baseline totals across all packages

# 3. Check for regressions
git diff package.json  # No unintended changes
git status            # All changes tracked
```

## Common Migration Issues

### Issue: Tests pass but typecheck fails

**Symptom:**
```bash
yarn test    # ✅ Passes
yarn typecheck  # ❌ Fails with "Cannot find name 'describe'"
```

**Fix:** Missing vitest.d.ts or not included in tsconfig.json
```bash
# Create vitest.d.ts
echo '/// <reference types="vitest/globals" />' > vitest.d.ts

# Update tsconfig.json to include it
# "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.d.ts"]
```

### Issue: Import errors after renaming files

**Symptom:**
```
Error: Cannot find module '@goodfoot/test-utilities/jest-teardown'
```

**Fix:** Update imports in consuming packages
```typescript
// Old
import { jestTeardownQueue } from '@goodfoot/test-utilities/jest-teardown';

// New
import { teardownQueue } from '@goodfoot/test-utilities/vitest-teardown';
```

### Issue: Workspace:* dependencies removed

**Symptom:** Migration accidentally removes workspace dependencies

**Prevention:**
```bash
# Before migration - document workspace deps
grep "workspace:" packages/YOUR_PACKAGE/package.json

# After migration - verify still present
grep "workspace:" packages/YOUR_PACKAGE/package.json
```

**Example:**
```json
{
  "dependencies": {
    "@coaxial/logger": "workspace:*"  // Must preserve
  },
  "devDependencies": {
    "vitest": "^3.2.4"  // Newly added
  }
}
```

### Issue: Lint errors after migration

**Symptom:** `@typescript-eslint/no-misused-promises` errors

**Example:**
```typescript
// ❌ ERROR: Promise in void context
const { unlisten } = await sql.listen('channel', () =>
  processingQueue.add(nextTask)  // Returns Promise<void>
);
```

**Fix:** Use `void` operator
```typescript
// ✅ CORRECT
const { unlisten } = await sql.listen('channel', () =>
  void processingQueue.add(nextTask)
);
```

See SKILL.md "Lint Errors: Promise in Void Context" section for details.

## Pre-Existing Issues Must Be Fixed

**Critical Rule:** Migration must not mask pre-existing issues.

**If you discover pre-existing errors during baseline validation:**
1. Document the errors
2. Fix them BEFORE migrating
3. Validate fixes pass
4. Then proceed with migration

**Common Pre-Existing Issues:**
- TypeScript errors (Symbol.asyncDispose, type mismatches)
- ESLint errors (unused vars, promise handling)
- Failing tests (timing issues, assertions)
- Missing dependencies

**Why fix first:**
- Separates migration issues from existing issues
- Ensures clean baseline for validation
- Prevents confusion about root cause
- Maintains code quality standards

## Summary

**Migration Steps:**
1. ✅ Establish baseline (test count, typecheck, lint)
2. ✅ Fix any pre-existing issues
3. ✅ Create vitest.config.ts
4. ✅ Update package.json (scripts + dependencies)
5. ✅ Create vitest.d.ts and update tsconfig.json
6. ✅ Remove @jest/globals imports from test files
7. ✅ Rename framework-specific files (if any)
8. ✅ Apply framework-agnostic naming
9. ✅ Validate: typecheck + test + lint + build

**Monorepo Strategy:**
1. ✅ Migrate shared utilities first
2. ✅ Rebuild utilities
3. ✅ Migrate dependent packages
4. ✅ Validate entire workspace

**Success Metrics:**
- Same test count as baseline
- Zero type errors
- Zero lint errors
- Zero test failures
- Clean test exit (no hanging processes)
