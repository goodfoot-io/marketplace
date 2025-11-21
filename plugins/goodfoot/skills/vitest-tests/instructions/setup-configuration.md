# Setup and Configuration

Complete guide for configuring Vitest with `@goodfoot/test-utilities` in a new package.

## Configuration Files Overview

Every package with tests needs these files:
1. `vitest.config.ts` - Vitest configuration
2. `vitest.d.ts` - TypeScript global type definitions
3. `tsconfig.json` - Updated to include vitest.d.ts
4. `package.json` - Test scripts and dependencies

## Step-by-Step Setup

## Prerequisites

- Node.js >=20.0.0 or >=22.0.0
- Package already has TypeScript configured
- Yarn workspace (for monorepo)

### 1. Install Vitest

```bash
cd packages/your-package
yarn add -D vitest@^3.2.4
```

**Verify:** Check `package.json` includes `"vitest": "^3.2.4"` in devDependencies

### 2. Create vitest.config.ts

In package root, create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['@goodfoot/test-utilities/vitest-setup'],
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    passWithNoTests: true,
  },
});
```

**Configuration Explained:**

| Option | Value | Purpose |
|--------|-------|---------|
| `globals` | `true` | Makes `describe`, `it`, `expect` available without imports |
| `environment` | `'node'` | Use Node.js environment (vs browser/jsdom) |
| `setupFiles` | `['@goodfoot/test-utilities/vitest-setup']` | Loads custom matchers and teardown utilities |
| `include` | `['tests/**/*.test.ts']` | Pattern for test file discovery |
| `exclude` | `['**/node_modules/**', ...]` | Patterns to ignore |
| `passWithNoTests` | `true` | Don't fail if no tests found (useful during development) |

**Verify:** File exists at `packages/your-package/vitest.config.ts`

### 3. Create vitest.d.ts

In package root, create `vitest.d.ts`:

```typescript
/// <reference types="vitest/globals" />
```

This single line provides TypeScript definitions for `describe`, `it`, `expect`, and other Vitest globals.

**Why needed:**
- `globals: true` makes functions available at **runtime**
- TypeScript needs explicit **type definitions** at compile time
- Without this, you'll see `error TS2304: Cannot find name 'describe'`

**Verify:** File exists at `packages/your-package/vitest.d.ts`

### 4. Update tsconfig.json

Add `vitest.d.ts` to the `include` array:

```json
{
  "extends": "../../tsconfig.json",
  "include": [
    "src/**/*.ts",
    "tests/**/*.ts",
    "vitest.d.ts"
  ],
  "exclude": ["node_modules", "dist", "build"],
  "compilerOptions": {
    "composite": true,
    "declarationDir": "./build/types",
    "outDir": "./build/dist",
    "baseUrl": ".",
    "types": ["node"]
  }
}
```

**Important:**
- Include `vitest.d.ts` in `include` array
- Set `types: ["node"]` to prevent Jest type conflicts
- Keep `composite: true` for monorepo project references

**Verify:** Run `cd packages/your-package && yarn typecheck` - should have 0 errors about 'describe' or 'expect'

### 5. Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui"
  }
}
```

**Script Variants:**
- `vitest run` - Run once and exit (CI mode)
- `vitest watch` - Watch mode with hot reload
- `vitest --ui` - Visual UI for debugging

If using `@goodfoot/test-utilities`, ensure it's in dependencies:

```json
{
  "devDependencies": {
    "@goodfoot/test-utilities": "workspace:*"
  }
}
```

**Verify:** Run `yarn` to install dependencies

### 6. Create Your First Test (Optional)

Create `packages/your-package/tests/example.test.ts`:

```typescript
import { getTestSql } from '@goodfoot/test-utilities/sql';

describe('Example Test', () => {
  it('should pass', async () => {
    const { sql } = await getTestSql();
    expect(sql).toBeDefined();
  });
});
```

**Verify:** Run `cd packages/your-package && yarn test` - test should pass

### 7. Final Validation

Run all validation commands:

```bash
cd packages/your-package
yarn typecheck  # Should pass with 0 errors
yarn test       # Should pass with tests
yarn lint       # Should pass
```

If any fail, see troubleshooting section below.

## Configuration Options

### Environment Options

**Node Environment (default for backend):**
```typescript
export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

**JSDOM Environment (for DOM testing):**
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

**Happy-DOM Environment (faster alternative):**
```typescript
export default defineConfig({
  test: {
    environment: 'happy-dom',
  },
});
```

### Test Pattern Options

**Custom Test Patterns:**
```typescript
export default defineConfig({
  test: {
    include: [
      'tests/**/*.test.ts',
      'src/**/*.spec.ts',  // Include specs in src
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',  // Exclude type definitions
    ],
  },
});
```

### Reporter Options

**Verbose Output:**
```typescript
export default defineConfig({
  test: {
    reporters: 'verbose',  // Show all test names
  },
});
```

**Multiple Reporters:**
```typescript
export default defineConfig({
  test: {
    reporters: ['default', 'json'],  // Console + JSON file
  },
});
```

### Coverage Options

**Enable Coverage:**
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
    },
  },
});
```

Run with: `vitest run --coverage`

### Timeout Options

**Custom Timeouts:**
```typescript
export default defineConfig({
  test: {
    testTimeout: 10000,  // 10 seconds per test (default: 5000)
    hookTimeout: 10000,  // 10 seconds for hooks (default: 10000)
  },
});
```

## Advanced Configuration

### Multiple Test Suites

For packages with different test types:

```typescript
import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      // Unit tests
      defineProject({
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          setupFiles: ['@goodfoot/test-utilities/vitest-setup'],
          include: ['tests/**/*.test.ts'],
        },
      }),

      // Integration tests
      defineProject({
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          setupFiles: ['@goodfoot/test-utilities/vitest-setup'],
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: 30000,  // Longer timeout
        },
      }),
    ],
  },
});
```

Run specific project: `vitest run --project=unit`

### Workspace Configuration

For monorepo root configuration:

```typescript
// vitest.workspace.ts at monorepo root
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',  // Auto-discover configs
]);
```

## Setup File Details

### What `@goodfoot/test-utilities/vitest-setup` Does

When referenced in `setupFiles`, this module:

1. **Registers custom matchers globally:**
   - `toEmit(eventName, expected?, timeout?)`
   - `toEqualSorted(expected)`
   - `tsStringIsEqual(expected)`

2. **Configures teardown system:**
   - Imports teardown queue
   - Registers `afterEach` hook
   - Builds full test names from Vitest task hierarchy
   - Invokes cleanup after each test

3. **Ensures test isolation:**
   - Per-test teardown queues
   - Priority-based cleanup execution
   - Stack trace preservation for debugging

**No manual imports needed** - matchers available on `expect` automatically.

### Custom Setup Files

For package-specific setup, create `tests/setup.ts`:

```typescript
import '@goodfoot/test-utilities/vitest-setup';  // Load base setup
import { beforeAll, afterAll } from 'vitest';

// Package-specific setup
beforeAll(async () => {
  // Initialize global resources
});

afterAll(async () => {
  // Cleanup global resources
});
```

Reference in config:
```typescript
export default defineConfig({
  test: {
    setupFiles: [
      '@goodfoot/test-utilities/vitest-setup',
      './tests/setup.ts',  // Additional setup
    ],
  },
});
```

## Common Issues

### Config Not Found

**Error:** `No config file found`

**Solutions:**
1. Verify `vitest.config.ts` in package root (not in subdirectory)
2. Check filename spelling (must be exact)
3. Ensure file exports default config with `export default defineConfig(...)`

### Setup File Not Loading

**Error:** Custom matchers not available

**Solutions:**
1. Verify `setupFiles: ['@goodfoot/test-utilities/vitest-setup']` in config
2. Ensure test-utilities package is built: `cd packages/test-utilities && yarn build`
3. Check that test-utilities is in package dependencies

### TypeScript Errors Persist

**Error:** Still seeing "Cannot find name 'describe'"

**Solutions:**
1. Verify `vitest.d.ts` exists in package root
2. Check `tsconfig.json` includes `vitest.d.ts` in `include` array
3. Restart TypeScript server in IDE
4. Run `yarn typecheck` to see actual errors

### Tests Not Discovered

**Error:** `No test files found`

**Solutions:**
1. Check `include` pattern matches test files
2. Verify test files end in `.test.ts` (or configured pattern)
3. Ensure test files are not in `exclude` patterns
4. Check test files are in `tests/` directory (or configured path)

## Best Practices

### 1. Use Consistent Patterns

```typescript
// ✅ DO - Standard pattern used across monorepo
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['@goodfoot/test-utilities/vitest-setup'],
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    passWithNoTests: true,
  },
});

// ❌ DON'T - Non-standard configuration
export default defineConfig({
  test: {
    globals: false,  // Requires imports in every file
    include: ['src/**/*.spec.ts'],  // Different pattern than other packages
  },
});
```

### 2. Keep Setup Minimal

```typescript
// ✅ DO - Minimal, focused configuration
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['@goodfoot/test-utilities/vitest-setup'],
  },
});

// ❌ DON'T - Over-configured
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['@goodfoot/test-utilities/vitest-setup'],
    threads: true,
    isolate: true,
    pool: 'threads',
    // ... 20 more options that use defaults anyway
  },
});
```

### 3. Use passWithNoTests During Development

```typescript
export default defineConfig({
  test: {
    passWithNoTests: true,  // Don't fail when adding package
  },
});
```

Remove or set to `false` once tests are written.

### 4. Match Test Patterns to Project Structure

```typescript
// For packages with tests/ directory
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});

// For packages with co-located tests
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

## Common Setup Issues

### Issue: "Cannot find name 'describe'"

**Cause:** vitest.d.ts not created or not in tsconfig include

**Fix:**
1. Create `vitest.d.ts` with `/// <reference types="vitest/globals" />`
2. Add `"vitest.d.ts"` to tsconfig.json `include` array
3. Run `yarn typecheck` to verify

→ See `instructions/typescript-configuration.md` for detailed TypeScript troubleshooting

### Issue: "Cannot find module '@goodfoot/test-utilities'"

**Cause:** test-utilities not installed or not built

**Fix:**
```bash
cd packages/test-utilities && yarn build
cd packages/your-package && yarn install
```

### Issue: Tests hang indefinitely

**Cause:** No tests found or configuration error

**Fix:**
1. Check `vitest.config.ts` include patterns match your test files
2. Verify tests exist in `tests/**/*.test.ts`
3. Try running `yarn test --reporter=verbose` for more details

### Issue: Module resolution errors

**Cause:** Import paths not resolving correctly

**Fix:**
1. Ensure `baseUrl` is set in tsconfig.json
2. Check that test-utilities is built: `cd packages/test-utilities && yarn build`
3. Verify workspace dependencies are installed: `yarn install`

## Monorepo-Specific Setup

### If Your Package is a Shared Test Utility

Add exports to `package.json`:

```json
{
  "exports": {
    "./vitest-setup": "./build/dist/src/vitest-setup.js",
    "./vitest-teardown": "./build/dist/src/vitest-teardown.js",
    "./vitest-matchers": "./build/dist/src/vitest-matchers.js",
    "./sql": "./build/dist/src/sql.js"
  }
}
```

### If Your Package Uses Shared Test Utilities

Already covered in Step 2 (setupFiles) and Step 5 (devDependencies).

**Important:** After updating test-utilities, rebuild it:
```bash
cd packages/test-utilities && yarn build
```

## Summary

**Required Files:**
1. `vitest.config.ts` with globals, environment, setupFiles
2. `vitest.d.ts` with triple-slash directive
3. Updated `tsconfig.json` including vitest.d.ts
4. Test scripts in `package.json`

**Key Configuration:**
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['@goodfoot/test-utilities/vitest-setup'],
  },
});
```

**Verification Steps:**
```bash
yarn typecheck  # Should pass
yarn test       # Should run
yarn build      # Should succeed
```

**Common Scripts:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch"
  }
}
```

For implementation reference, see `packages/queue/vitest.config.ts`.

## Troubleshooting Configuration

### Tests Pass But Typecheck Fails

**Symptom:** `yarn test` passes ✅ but `yarn typecheck` shows `error TS2304: Cannot find name 'describe'`

**Cause:** Missing or incorrectly configured vitest.d.ts file

**Fix checklist:**
1. Verify `vitest.d.ts` exists in package root with exactly: `/// <reference types="vitest/globals" />`
2. Verify `tsconfig.json` includes array contains `"vitest.d.ts"`
3. Verify `tsconfig.json` compilerOptions.types is `["node"]` (not `["jest"]` or empty array)
4. Run `yarn typecheck` again

**Example of correct tsconfig.json:**
```json
{
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.d.ts"],
  "compilerOptions": {
    "types": ["node"]
  }
}
```

### Tests Fail But Typecheck Passes

**Symptom:** `yarn typecheck` passes ✅ but `yarn test` fails with module errors or "Cannot find name" errors at runtime

**Common causes:**
1. setupFiles path incorrect in vitest.config.ts
2. Missing `await initializeDatabase(sql)` in tests using database
3. Test-utilities not built (in monorepos)
4. globals: true missing from vitest.config.ts

**Fix steps:**
```bash
# 1. Check vitest.config.ts
# Verify setupFiles: ['@goodfoot/test-utilities/vitest-setup']

# 2. Verify test-utilities is built (monorepo only)
cd packages/test-utilities && yarn build

# 3. Verify globals: true is set
# Check vitest.config.ts has: test: { globals: true }

# 4. Re-run tests
yarn test
```

### Tests Hang or Timeout

**Symptom:** Tests start but never complete, eventually timeout

**Common causes:**
1. Database connections not properly cleaned up
2. Background processes not registered with teardownQueue
3. Generators not closed after use
4. Missing `await` on async operations

**Quick diagnosis:**
```bash
# Run with verbose logging to see where it hangs
vitest run --reporter=verbose

# Check for open handles (similar to Jest's detectOpenHandles)
# Vitest doesn't have this built-in, so check test code for:
# - Unclosed database connections
# - Background workers not stopped
# - Event listeners not removed
```

**Fix pattern:**
```typescript
// ✅ Always register cleanup
const close = await runBackgroundProcess();
void teardownQueue.add(close);

// ✅ Always close generators
const generator = await getGenerator();
try {
  // use generator
} finally {
  await generator.return();
}
```

### "Cannot find module '@goodfoot/test-utilities/vitest-setup'"

**Symptom:** Tests fail with module not found error for test-utilities imports

**Cause:** Test-utilities package not built or not in dependencies

**Fix:**
```bash
# 1. Verify test-utilities is in package.json devDependencies
# Should have: "@goodfoot/test-utilities": "workspace:*"

# 2. Rebuild test-utilities
cd packages/test-utilities
yarn build

# 3. Re-install if needed
cd ../..
yarn install

# 4. Try tests again
cd packages/your-package
yarn test
```

### IDE Shows Red Squiggles on Test Globals

**Symptom:** VSCode/IDE shows errors on `describe`, `it`, `expect` but tests pass

**Cause:** IDE TypeScript not recognizing vitest.d.ts

**Fix:**
1. Restart TypeScript server in IDE (VSCode: Cmd+Shift+P → "TypeScript: Restart TS Server")
2. Verify vitest.d.ts is in tsconfig.json include array
3. Close and reopen the project
4. Check IDE is using workspace TypeScript version (not global)

### Validation Succeeds Locally But Fails in CI

**Symptom:** All validations pass locally but fail in continuous integration

**Common causes:**
1. Missing vitest dependency in package.json
2. Node version mismatch (requires >=20.0.0 or >=22.0.0)
3. Build artifacts committed to git (stale builds)

**Fix:**
```bash
# 1. Verify vitest in package.json devDependencies
# Should have: "vitest": "^3.2.4"

# 2. Clean build artifacts before CI
git clean -fdx build/ dist/
yarn build

# 3. Check Node version matches CI
node --version  # Should be >=20.0.0 or >=22.0.0
```
