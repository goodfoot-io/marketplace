# @goodfoot/example

A minimal example package demonstrating basic TypeScript package structure in the monorepo.

## Overview

This package provides a simple "hello world" example that shows how to structure a TypeScript package within this monorepo, including:

- TypeScript configuration and compilation
- Jest test setup
- ESLint configuration
- Build process

## Installation

From the workspace root:

```bash
yarn install
```

## Usage

```typescript
import { hello } from '@goodfoot/example';

// Basic greeting
console.log(hello()); // "Hello, World!"

// Personalized greeting
console.log(hello('Claude')); // "Hello, Claude!"
```

## API

### `hello(name?: string): string`

Returns a greeting message.

**Parameters:**

- `name` (optional): Name to include in the greeting

**Returns:**

- A greeting string

**Examples:**

```typescript
hello(); // "Hello, World!"
hello('Alice'); // "Hello, Alice!"
```

## Development

### Build

Compile TypeScript to JavaScript:

```bash
yarn build
```

The compiled output will be in the `build/` directory:

- `build/dist/` - JavaScript files
- `build/types/` - TypeScript declaration files

### Test

Run Jest tests:

```bash
yarn test
```

### Lint

Run ESLint and type checking:

```bash
yarn lint
```

This will:

1. Run TypeScript type checking
2. Run ESLint with auto-fix
3. Run Prettier for code formatting

### Type Check

Run TypeScript type checking only:

```bash
yarn typecheck
```

## Project Structure

```
packages/example/
├── src/
│   └── index.ts           # Main source file with hello function
├── tests/
│   └── hello.test.ts      # Jest tests
├── build/                 # Compiled output (generated)
│   ├── dist/              # JavaScript files
│   └── types/             # TypeScript declarations
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
├── jest.config.cjs        # Jest configuration
├── eslint.config.mjs      # ESLint configuration
└── README.md              # This file
```

## Using as a Template

This package can serve as a template for creating new packages in the monorepo:

1. Copy the `packages/example/` directory
2. Rename it to your package name
3. Update `package.json`:
   - Change the `name` field to `@goodfoot/your-package-name`
   - Update the `description`
4. Update this README with your package's documentation
5. Implement your functionality in `src/index.ts`
6. Write tests in `tests/`

The configuration files (tsconfig.json, jest.config.cjs, eslint.config.mjs) should work out of the box for most TypeScript packages.

## Configuration Files

### tsconfig.json

Extends the root TypeScript configuration with package-specific settings. The configuration:

- Outputs compiled files to `build/dist/`
- Generates declaration files in `build/types/`
- Uses ES modules
- Targets modern Node.js

### jest.config.cjs

Configures Jest for testing:

- Uses `ts-jest` for TypeScript support
- Runs tests in Node environment
- Includes coverage reporting

### eslint.config.mjs

ESLint configuration for code quality:

- TypeScript-aware linting
- Extends recommended rules
- Auto-fixes common issues

## License

Private package - not for distribution.
