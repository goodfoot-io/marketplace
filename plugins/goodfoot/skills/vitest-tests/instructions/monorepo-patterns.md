# Monorepo Patterns for Vitest

Patterns and solutions for using Vitest in monorepos with shared test utilities, composite TypeScript projects, and cross-package dependencies.

## Core Challenges in Monorepos

### Challenge 1: Shared Test Utilities with Vitest Globals

**Problem:** Test utilities package uses Vitest globals (`expect`, `describe`, `it`) in source code. Other packages that reference it fail typecheck even if they don't use Vitest themselves.

**Example Error:**
```
packages/trigger-listener/node_modules/@goodfoot/test-utilities/src/vitest-teardown.ts:37:14
error TS2304: Cannot find name 'expect'.
```

**Root Cause:** TypeScript project references compile referenced projects' source code. When test-utilities source uses `expect.getState()`, packages without Vitest types can't compile it.

**Solution: Declare Globals in Source Files**

For source files (not test files) that use Vitest globals, add explicit type declarations:

```typescript
// Location: packages/test-utilities/src/vitest-teardown.ts

// Add at top of file before imports
declare const expect: {
  getState?: () => { currentTestName?: string };
};

// Now the rest of your code works
export function startTeardownQueue() {
  if (typeof expect.getState === 'function') {
    const testName = expect.getState().currentTestName;
    // ...
  }
}
```

**Why this works:** The `declare const` provides type information for other packages to compile against, without requiring them to have Vitest installed.

**Alternative:** Use `skipLibCheck: true` in consuming packages (not recommended - masks real type errors).

### Challenge 2: Migration Order with Dependencies

**Problem:** Multiple packages depend on test-utilities. Migrating packages in wrong order causes cascading failures.

**Critical Rule:** Migrate shared test utilities FIRST, then dependent packages.

**Correct Migration Sequence:**

1. **Identify Dependency Tree**
   ```bash
   # Find which packages depend on test-utilities
   grep -r "@goodfoot/test-utilities" packages/*/package.json
   ```

2. **Migrate in Order**
   ```
   1. test-utilities (0 dependencies)
      └─ Rebuild after migration: cd packages/test-utilities && yarn build

   2. memory, queue, example (all depend on test-utilities)
      └─ Can migrate in parallel or any order

   3. Validate workspace: yarn typecheck && yarn test
   ```

### Challenge 3: Package Export Updates

**Problem:** Renaming files in test-utilities breaks imports in dependent packages.

**Pattern from Migration:**

**Step 1: Update test-utilities package.json exports**
```json
{
  "exports": {
    "./vitest-teardown": "./build/dist/src/vitest-teardown.js",
    "./vitest-matchers": "./build/dist/src/vitest-matchers.js",
    "./vitest-setup": "./build/dist/src/vitest-setup.js",
    "./sql": "./build/dist/src/sql.js"
  }
}
```

**Step 2: Update imports in dependent packages**
```typescript
// Before
import { jestTeardownQueue } from '@goodfoot/test-utilities/jest-teardown';

// After
import { teardownQueue } from '@goodfoot/test-utilities/vitest-teardown';
```

**Step 3: Update vitest.config.ts setupFiles**
```typescript
// Before
setupFiles: ['@goodfoot/test-utilities/jest-environment']

// After
setupFiles: ['@goodfoot/test-utilities/vitest-setup']
```

**Step 4: Rebuild and validate**
```bash
cd packages/test-utilities && yarn build
yarn typecheck  # Validate all packages
```

### Challenge 4: TypeScript Project References

**Problem:** Composite projects require careful tsconfig.json setup to work with Vitest.

**Solution: Three-Part Configuration**

**1. Shared test-utilities tsconfig.json:**
```json
{
  "extends": "../../tsconfig.json",
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.d.ts"],
  "exclude": ["node_modules", "dist", "build"],
  "compilerOptions": {
    "composite": true,
    "incremental": true,
    "tsBuildInfoFile": "./build/.tsbuildinfo",
    "declarationDir": "./build/types",
    "outDir": "./build/dist",
    "types": ["node"]  // Exclude @types/jest
  }
}
```

**2. Dependent package tsconfig.json:**
```json
{
  "extends": "../../tsconfig.json",
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.d.ts"],
  "compilerOptions": {
    "composite": true,
    "types": ["node"]  // Exclude @types/jest
  },
  "references": [
    { "path": "../test-utilities" }
  ]
}
```

**3. Each package needs vitest.d.ts:**
```typescript
/// <reference types="vitest/globals" />
```

**Why all three are needed:**
- `vitest.d.ts` provides global types for test files
- `types: ["node"]` prevents Jest type pollution
- `composite: true` enables project references
- References array links dependent packages

### Challenge 5: Build Order in CI/CD

**Problem:** Dependent packages fail to build if test-utilities isn't built first.

**Solution: Explicit Build Order**

**Option 1: Yarn workspaces topological sort**
```bash
# Yarn automatically builds in dependency order
yarn workspaces foreach -Apt run build
```

**Option 2: Manual build order in CI**
```bash
# Build shared utilities first
yarn workspace @goodfoot/test-utilities build

# Then build dependent packages (parallel safe)
yarn workspaces foreach -A --exclude @goodfoot/test-utilities run build
```

**Option 3: Package.json dependencies**
```json
{
  "name": "@coaxial/memory",
  "scripts": {
    "prebuild": "yarn workspace @goodfoot/test-utilities build",
    "build": "tsc -b"
  }
}
```

### Challenge 5: Build Order After Renaming Files

**Problem:** After migrating test-utilities and renaming files (jest-*.ts → vitest-*.ts), dependent packages fail to build or typecheck with "Output file has not been built from source file" errors.

**Root Cause:** TypeScript composite projects expect build artifacts to match source files. After renaming:
1. Old build artifacts (`build/dist/src/jest-teardown.js`) still exist
2. Source file (`src/jest-teardown.ts`) no longer exists
3. TypeScript sees mismatch between build output and sources

**Symptom:**
```
error TS6305: Output file '/packages/test-utilities/build/types/src/jest-teardown.d.ts'
has not been built from source file '/packages/test-utilities/src/jest-teardown.ts'
```

**Solution: Clean and Rebuild**

```bash
# Step 1: Clean ALL build artifacts after renaming files
cd packages/test-utilities
rm -rf build/
rm -rf dist/

# Step 2: Rebuild from scratch
yarn build

# Step 3: Rebuild dependent packages if needed
cd ../memory && yarn build
cd ../queue && yarn build
```

**Prevention Strategy:**

Always clean build artifacts when renaming source files in composite projects:

```bash
# After any file renames in test-utilities
cd packages/test-utilities
rm -rf build/ && yarn build

# Or use package.json script if available
yarn clean && yarn build
```

**When this happens:**
- After renaming `jest-*.ts` files to `vitest-*.ts`
- After changing package.json exports
- After restructuring source directories
- Anytime source file paths change

**Why cleaning is necessary:**
- TypeScript incremental compilation keeps stale references
- tsBuildInfo file tracks old file mappings
- Build system doesn't automatically detect renames
- Stale artifacts cause project reference errors

## Framework-Agnostic Naming Pattern

**Problem:** Names like `jestTeardownQueue` are framework-specific.

**Solution: Remove framework prefixes during migration**

```typescript
// ❌ BEFORE (Framework-specific)
export const jestTeardownQueue: PQueue = ...
export function startJestTeardownQueue() { ... }
export const JEST_TEARDOWN = 'JEST_TEARDOWN';

// ✅ AFTER (Framework-agnostic)
export const teardownQueue: PQueue = ...
export function startTeardownQueue() { ... }
export const TEARDOWN = 'TEARDOWN';
```

**Rename Checklist:**
- [ ] Export names in source file
- [ ] Constant values (e.g., `'JEST_TEARDOWN'` → `'TEARDOWN'`)
- [ ] Internal variable references
- [ ] Type declarations
- [ ] Package.json exports
- [ ] Import statements in dependent packages
- [ ] Comments and documentation

## Connection Pool Management

**Challenge:** `getTestSql()` has max 5 concurrent connections per database.

**Pattern: One Database Per Test**

```typescript
// ✅ SAFE - Each test gets isolated database
describe('User Operations', () => {
  it('should create user', async () => {
    const { sql } = await getTestSql();  // Database 1
    await initializeDatabase(sql);
    // Test...
  });

  it('should update user', async () => {
    const { sql } = await getTestSql();  // Database 2
    await initializeDatabase(sql);
    // Test...
  });
});
```

**Avoid: Exceeding Pool Limit**

```typescript
// ⚠️ RISKY - May exceed pool limit
it('concurrent stress test', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  // 10 concurrent queries on 5-connection pool
  await Promise.all(
    Array.from({ length: 10 }, () => sql`SELECT 1`)
  );  // May deadlock
});
```

**Solution for high concurrency:**
```typescript
it('concurrent operations', async () => {
  const { sql } = await getTestSql();
  await initializeDatabase(sql);

  // Batch into groups of 5 or less
  const batches = chunk(operations, 5);
  for (const batch of batches) {
    await Promise.all(batch.map(op => processOperation(sql, op)));
  }
});
```

## Workspace Protocol Dependencies

**Challenge:** Preserving `workspace:*` dependencies during migration.

**Critical:** Don't accidentally remove workspace dependencies when updating package.json.

**Verification Checklist:**

```bash
# Before migration - document workspace deps
grep -A5 "dependencies\|devDependencies" packages/*/package.json | grep "workspace:"

# After migration - verify still present
grep -A5 "dependencies\|devDependencies" packages/*/package.json | grep "workspace:"
```

**Example from migration:**
```json
{
  "name": "@coaxial/memory",
  "dependencies": {
    "@coaxial/logger": "workspace:*"  // ✅ Preserved during migration
  },
  "devDependencies": {
    "vitest": "^3.2.4"  // ✅ Added during migration
  }
}
```

## Validation Strategy

**Comprehensive validation after monorepo migration:**

```bash
# 1. Type check all packages
yarn typecheck

# 2. Build all packages (validates project references)
yarn build

# 3. Test all packages
yarn test

# 4. Lint all packages
yarn lint

# 5. Verify no hanging processes
# Tests should exit cleanly without manual intervention
```

**Expected Results:**
- ✅ 0 type errors
- ✅ 0 test failures
- ✅ 0 lint errors
- ✅ All packages build successfully
- ✅ No processes hanging after test completion

## Troubleshooting

### Error: Cannot find name 'expect' in non-test file

**Location:** Shared utilities source file using Vitest globals

**Fix:** Add `declare const expect` at top of file (see Challenge 1)

### Error: Project references not resolving

**Symptoms:** "Cannot find module '@goodfoot/test-utilities'" or "Build info file missing"

**Fix:**
```bash
# Rebuild project references
yarn workspaces foreach -pt run build

# Clean and rebuild if still broken
yarn workspaces foreach run clean
yarn workspaces foreach -pt run build
```

### Error: Tests pass but typecheck fails

**Symptom:** `yarn test` succeeds, `yarn typecheck` fails with Vitest errors

**Fix:** Ensure every package with tests has:
1. `vitest.d.ts` file with `/// <reference types="vitest/globals" />`
2. `vitest.d.ts` listed in tsconfig.json `include` array
3. `"types": ["node"]` in tsconfig.json compilerOptions

### Error: Cascading failures after test-utilities change

**Symptom:** Changing test-utilities breaks multiple dependent packages

**Fix:**
```bash
# Always rebuild test-utilities after changes
cd packages/test-utilities
yarn build

# Then validate all dependent packages
yarn workspaces foreach run typecheck
```

## Summary

**Key Principles for Monorepo Vitest:**

1. **Migration Order:** Shared utilities first, then dependents
2. **Type Declarations:** Use `declare const` for globals in source files
3. **Build Order:** Always rebuild utilities before dependent packages
4. **Framework-Agnostic:** Remove framework-specific naming
5. **Project References:** Configure composite TypeScript correctly
6. **Workspace Deps:** Preserve `workspace:*` dependencies
7. **Comprehensive Validation:** Type check + build + test + lint
