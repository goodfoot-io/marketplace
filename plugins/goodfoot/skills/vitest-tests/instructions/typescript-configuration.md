---
name: typescript-configuration
description: Comprehensive guide for configuring TypeScript to work with Vitest globals, fixing type errors, and handling monorepo project references.
---

# TypeScript Configuration for Vitest

## Quick Fix (Standard Setup)

**Three-step solution for most cases:**

**1. Create vitest.d.ts in package root:**
```typescript
/// <reference types="vitest/globals" />
```

**2. Update tsconfig.json include array:**
```json
{
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.d.ts"]
}
```

**3. Set types in tsconfig.json compilerOptions:**
```json
{
  "compilerOptions": {
    "types": ["node"]  // Excludes @types/jest
  }
}
```

**Validate:**
```bash
yarn typecheck  # Should pass with 0 errors
```

## Understanding the Configuration

### Why vitest.d.ts is Needed

**Problem:** Vitest with `globals: true` makes `describe`, `it`, `expect` available at runtime, but TypeScript doesn't know about them during compilation.

**Solution:** The triple-slash directive tells TypeScript to load Vitest's global type definitions:

```typescript
/// <reference types="vitest/globals" />
```

**What it does:**
- Loads type definitions from `node_modules/vitest/globals.d.ts`
- Provides types for `describe`, `it`, `expect`, `beforeEach`, `afterEach`, etc.
- Only affects type checking, not runtime behavior

### Why types: ["node"] is Important

**Problem:** Without this, TypeScript includes all `@types/*` packages, including leftover Jest types.

**Symptom:**
```
error TS2582: Cannot find name 'describe'. Do you need to install type definitions for a test runner? Try `npm i --save-dev @types/jest` or `npm i --save-dev @types/mocha`.
```

**Solution:**
```json
{
  "compilerOptions": {
    "types": ["node"]  // Only include @types/node
  }
}
```

**What it does:**
- Limits automatic `@types/*` inclusion to only `@types/node`
- Prevents Jest type pollution
- Allows vitest.d.ts reference to be the sole test framework type source

## Source Files Using Vitest Globals in Composite Projects

**Scenario:** Your test utilities package has source files (not test files) that use Vitest globals. Other packages reference it via TypeScript project references.

**Example Error:**
```
packages/trigger-listener/node_modules/@goodfoot/test-utilities/src/vitest-teardown.ts:37:14
error TS2304: Cannot find name 'expect'.
The command failed in workspace @coaxial/trigger-listener@workspace:packages/trigger-listener
```

**Root Cause:** When packages use project references (`"references": [{ "path": "../test-utilities" }]`), TypeScript compiles the referenced package's source. If test-utilities source uses `expect.getState()`, packages without Vitest can't compile it.

**Solution: Declare Globals in Source Files**

For source files (not test files) that use Vitest globals, add explicit type declarations at the top:

```typescript
// Location: packages/test-utilities/src/vitest-teardown.ts

// Add BEFORE imports
declare const expect: {
  getState?: () => { currentTestName?: string };
};

import PQueue from 'p-queue';

// Now this works for cross-package compilation
export function startTeardownQueue() {
  if (typeof expect.getState === 'function') {
    const testName = expect.getState().currentTestName;
    // ...
  }
}
```

**Why this works:**
- Provides minimal type information for TypeScript compilation
- Doesn't require consuming packages to have Vitest installed
- Allows test-utilities to use Vitest APIs while remaining consumable by non-Vitest packages

**Alternative (not recommended):** Add `skipLibCheck: true` to consuming packages - masks real type errors.

## Complete tsconfig.json Examples

### Standard Package Configuration

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
    "baseUrl": ".",
    "types": ["node"]
  }
}
```

### Package with Project References

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.d.ts"],
  "exclude": ["node_modules", "dist", "build"],
  "compilerOptions": {
    "composite": true,
    "declarationDir": "./build/types",
    "outDir": "./build/dist",
    "types": ["node"]
  },
  "references": [
    { "path": "../test-utilities" }
  ]
}
```

### Shared Test Utilities Package

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
    "baseUrl": ".",
    "types": ["node"]
  }
}
```

## Monorepo Cross-Package Type Checking

**Challenge:** Multiple packages failing typecheck with same Vitest-related error after migrating test-utilities.

**Diagnosis:**
```bash
# Check which packages reference test-utilities
grep -r '"references"' packages/*/tsconfig.json

# Check which packages import from test-utilities
grep -r "@goodfoot/test-utilities" packages/*/src/**/*.ts
```

**Solutions:**

**Option 1: Declare Globals in Source (Recommended)**
- See "Source Files Using Vitest Globals" section above
- Adds minimal type declarations to source files
- Maintains type safety across packages

**Option 2: Remove Project References (Not Recommended)**
- Remove `"references"` from consuming packages
- Loses TypeScript composite project benefits
- Slower incremental builds

**Option 3: skipLibCheck (Last Resort)**
```json
{
  "compilerOptions": {
    "skipLibCheck": true  // Skips type checking in node_modules
  }
}
```
- Masks real type errors
- Only use if other options fail

## Troubleshooting

### Error: Cannot find name 'describe' in test files

**Location:** Test files (tests/**/*.test.ts)

**Checklist:**
1. [ ] vitest.d.ts exists in package root
2. [ ] vitest.d.ts has `/// <reference types="vitest/globals" />`
3. [ ] tsconfig.json includes vitest.d.ts in include array
4. [ ] tsconfig.json has `"types": ["node"]` in compilerOptions
5. [ ] Vitest installed (`yarn add -D vitest`)

**Debug:**
```bash
# Verify vitest.d.ts exists
ls -la vitest.d.ts

# Verify tsconfig includes it
grep "vitest.d.ts" tsconfig.json

# Verify types config
grep '"types"' tsconfig.json
```

### Error: Cannot find name 'expect' in source files (not tests)

**Location:** Source files using Vitest APIs (src/**/*.ts)

**Solution:** Add explicit declaration at top of file:
```typescript
declare const expect: {
  getState?: () => { currentTestName?: string };
};
```

**Why needed:** Source files consumed by other packages need explicit types for cross-package compilation.

### Error: TypeScript suggests installing @types/jest

**Full error:**
```
error TS2582: Cannot find name 'describe'. Do you need to install type definitions for a test runner? Try `npm i --save-dev @types/jest`
```

**Root cause:** TypeScript is including @types/jest automatically.

**Solution:** Set `"types": ["node"]` to limit automatic type inclusion:
```json
{
  "compilerOptions": {
    "types": ["node"]
  }
}
```

### Error: Module not found after adding vitest.d.ts

**Symptom:** Adding vitest.d.ts breaks imports

**Cause:** tsconfig.json misconfiguration

**Fix:** Ensure include array has proper patterns:
```json
{
  "include": [
    "src/**/*.ts",    // Source files
    "tests/**/*.ts",  // Test files
    "vitest.d.ts"     // Type definitions
  ]
}
```

### Tests pass but IDE shows errors

**Symptom:** Tests run successfully but VS Code shows red squiggles

**Solutions:**

**1. Reload VS Code TypeScript:**
- Open Command Palette (Cmd/Ctrl + Shift + P)
- Type "TypeScript: Restart TS Server"
- Select and run

**2. Verify VS Code is using workspace TypeScript:**
- Check bottom right of VS Code status bar
- Should show TypeScript version
- Click to select "Use Workspace Version"

**3. Clean and rebuild:**
```bash
yarn clean  # Remove build artifacts
yarn build  # Rebuild project references
```

## Migration Validation

**After configuring TypeScript, validate with:**

```bash
# 1. Type check passes
yarn typecheck

# 2. No IDE errors
# Open test files in editor - should have no red squiggles

# 3. Tests still pass
yarn test

# 4. Verify configuration
cat vitest.d.ts  # Should contain reference directive
grep -A3 '"types"' tsconfig.json  # Should include ["node"]
grep "vitest.d.ts" tsconfig.json  # Should be in include array
```

## Summary

**Standard Configuration:**
1. ✅ Create vitest.d.ts with `/// <reference types="vitest/globals" />`
2. ✅ Add vitest.d.ts to tsconfig.json include array
3. ✅ Set `"types": ["node"]` in compilerOptions

**For Source Files Using Vitest:**
4. ✅ Add `declare const expect` at top of file

**Validation:**
5. ✅ `yarn typecheck` passes with 0 errors
6. ✅ IDE shows no type errors
7. ✅ Tests run successfully
