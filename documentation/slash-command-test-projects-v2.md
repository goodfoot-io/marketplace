# Test Projects for /goodfoot:plan-then-implement-v2

More complex test projects designed to exercise the v2 slash command's exploration, operational guidelines, and error recovery. Each creates artifacts in `/tmp/` directories.

---

## Test 1: Multi-Package Monorepo Feature

**Goal**: Test exploration across packages, parallel + sequential mixed execution, and self-contained task prompts.

**Setup** (run before test):
```bash
mkdir -p /tmp/test-monorepo/packages/shared/src
mkdir -p /tmp/test-monorepo/packages/api/src
mkdir -p /tmp/test-monorepo/packages/client/src

# Shared package - types and utilities
cat > /tmp/test-monorepo/packages/shared/src/types.ts << 'EOF'
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}
EOF

cat > /tmp/test-monorepo/packages/shared/src/utils.ts << 'EOF'
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
EOF

cat > /tmp/test-monorepo/packages/shared/src/index.ts << 'EOF'
export * from './types';
export * from './utils';
EOF

cat > /tmp/test-monorepo/packages/shared/package.json << 'EOF'
{
  "name": "@test/shared",
  "version": "1.0.0",
  "main": "src/index.ts",
  "scripts": {
    "typecheck": "echo 'Types OK'",
    "test": "echo 'Tests OK'",
    "lint": "echo 'Lint OK'"
  }
}
EOF

# API package - uses shared types
cat > /tmp/test-monorepo/packages/api/src/userService.ts << 'EOF'
import { User, ApiResponse } from '@test/shared';

const users: User[] = [];

export function createUser(name: string, email: string): ApiResponse<User> {
  const user: User = {
    id: Math.random().toString(36).substring(2, 15),
    name,
    email,
    createdAt: new Date()
  };
  users.push(user);
  return { data: user, success: true };
}

export function getUser(id: string): ApiResponse<User | null> {
  const user = users.find(u => u.id === id) || null;
  return { data: user, success: !!user };
}
EOF

cat > /tmp/test-monorepo/packages/api/package.json << 'EOF'
{
  "name": "@test/api",
  "version": "1.0.0",
  "dependencies": {
    "@test/shared": "workspace:*"
  },
  "scripts": {
    "typecheck": "echo 'Types OK'",
    "test": "echo 'Tests OK'",
    "lint": "echo 'Lint OK'"
  }
}
EOF

# Client package - uses shared types
cat > /tmp/test-monorepo/packages/client/src/userDisplay.ts << 'EOF'
import { User, formatDate } from '@test/shared';

export function renderUser(user: User): string {
  return `${user.name} (${user.email}) - Joined: ${formatDate(user.createdAt)}`;
}

export function renderUserList(users: User[]): string {
  return users.map(renderUser).join('\n');
}
EOF

cat > /tmp/test-monorepo/packages/client/package.json << 'EOF'
{
  "name": "@test/client",
  "version": "1.0.0",
  "dependencies": {
    "@test/shared": "workspace:*"
  },
  "scripts": {
    "typecheck": "echo 'Types OK'",
    "test": "echo 'Tests OK'",
    "lint": "echo 'Lint OK'"
  }
}
EOF

# Root package.json
cat > /tmp/test-monorepo/package.json << 'EOF'
{
  "name": "test-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "typecheck": "echo 'All types OK'",
    "test": "echo 'All tests OK'",
    "lint": "echo 'All lint OK'"
  }
}
EOF
```

**Prompt**:
```
/goodfoot:plan-then-implement-v2 Add a "role" field to the User type in the test monorepo at /tmp/test-monorepo. The role should be a string enum with values "admin", "user", or "guest". Update all packages that use the User type: (1) Add the role field to the shared types, (2) Update createUser in the API to accept and set a default role of "user", (3) Update renderUser in the client to display the role. Explore the codebase to understand the existing patterns before making changes.
```

**What to Evaluate**:
- Did it explore all three packages to understand structure?
- Did it identify shared → api/client dependency chain?
- Did it correctly sequence: shared first, then api and client in parallel?
- Are task prompts self-contained with code snippets from exploration?
- Did it follow "read before modifying" guideline?

---

## Test 2: Refactoring with Preserved Tests

**Goal**: Test the "verify test coverage, add tests if gaps, then refactor" workflow.

**Setup** (run before test):
```bash
mkdir -p /tmp/test-refactor/src

cat > /tmp/test-refactor/src/stringUtils.ts << 'EOF'
/**
 * String utility functions - legacy code with some duplication
 */

export function toUpperCase(str: string): string {
  return str.toUpperCase();
}

export function toLowerCase(str: string): string {
  return str.toLowerCase();
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.split(' ').map(word => {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

// Legacy function - duplicates capitalize logic
export function titleCase(str: string): string {
  if (!str) return str;
  return str.split(' ').map(word => {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function padLeft(str: string, length: number, char: string = ' '): string {
  while (str.length < length) {
    str = char + str;
  }
  return str;
}

export function padRight(str: string, length: number, char: string = ' '): string {
  while (str.length < length) {
    str = str + char;
  }
  return str;
}
EOF

cat > /tmp/test-refactor/src/stringUtils.test.ts << 'EOF'
import {
  toUpperCase,
  toLowerCase,
  capitalize,
  capitalizeWords,
  titleCase,
  truncate,
  padLeft,
  padRight
} from './stringUtils';

describe('stringUtils', () => {
  describe('toUpperCase', () => {
    it('converts string to uppercase', () => {
      expect(toUpperCase('hello')).toBe('HELLO');
    });
  });

  describe('toLowerCase', () => {
    it('converts string to lowercase', () => {
      expect(toLowerCase('HELLO')).toBe('hello');
    });
  });

  describe('capitalize', () => {
    it('capitalizes first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('handles empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('lowercases rest of string', () => {
      expect(capitalize('hELLO')).toBe('Hello');
    });
  });

  describe('capitalizeWords', () => {
    it('capitalizes each word', () => {
      expect(capitalizeWords('hello world')).toBe('Hello World');
    });

    it('handles single word', () => {
      expect(capitalizeWords('hello')).toBe('Hello');
    });
  });

  describe('titleCase', () => {
    it('converts to title case', () => {
      expect(titleCase('hello world')).toBe('Hello World');
    });
  });

  describe('truncate', () => {
    it('truncates long strings', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('keeps short strings unchanged', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });
  });

  describe('padLeft', () => {
    it('pads string on left', () => {
      expect(padLeft('5', 3, '0')).toBe('005');
    });
  });

  describe('padRight', () => {
    it('pads string on right', () => {
      expect(padRight('5', 3, '0')).toBe('500');
    });
  });
});
EOF

cat > /tmp/test-refactor/package.json << 'EOF'
{
  "name": "test-refactor",
  "version": "1.0.0",
  "scripts": {
    "typecheck": "echo 'Types OK'",
    "test": "echo 'Running 10 tests...' && echo 'All 10 tests passed'",
    "lint": "echo 'Lint OK'"
  }
}
EOF
```

**Prompt**:
```
/goodfoot:plan-then-implement-v2 Refactor the string utilities in /tmp/test-refactor/src/stringUtils.ts to remove duplication. The titleCase function is identical to capitalizeWords - deprecate titleCase and make it call capitalizeWords internally (add a @deprecated JSDoc tag). Also, the padLeft and padRight functions use inefficient while loops - refactor them to use String.prototype.padStart and padEnd. Verify all existing tests still pass after refactoring.
```

**What to Evaluate**:
- Did it read the test file to understand coverage?
- Did it verify tests pass before refactoring?
- Did it follow the "verify coverage, add tests if gaps, refactor" workflow?
- Did it avoid over-engineering (just the requested changes)?
- Are the refactored functions equivalent in behavior?

---

## Test 3: Interface Preservation with Consumer Updates

**Goal**: Test constraint handling when interfaces must be preserved for backward compatibility.

**Setup** (run before test):
```bash
mkdir -p /tmp/test-interface/src

cat > /tmp/test-interface/src/config.ts << 'EOF'
/**
 * Configuration interface - MUST maintain backward compatibility.
 * External consumers depend on this interface shape.
 */
export interface AppConfig {
  apiUrl: string;
  timeout: number;
  debug: boolean;
}

export const defaultConfig: AppConfig = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  debug: false
};

export function createConfig(overrides: Partial<AppConfig>): AppConfig {
  return { ...defaultConfig, ...overrides };
}
EOF

cat > /tmp/test-interface/src/httpClient.ts << 'EOF'
import { AppConfig } from './config';

export class HttpClient {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async get(path: string): Promise<unknown> {
    const url = `${this.config.apiUrl}${path}`;
    if (this.config.debug) {
      console.log(`GET ${url}`);
    }
    // Simulated fetch
    return { url, timeout: this.config.timeout };
  }

  async post(path: string, data: unknown): Promise<unknown> {
    const url = `${this.config.apiUrl}${path}`;
    if (this.config.debug) {
      console.log(`POST ${url}`, data);
    }
    return { url, data, timeout: this.config.timeout };
  }
}
EOF

cat > /tmp/test-interface/src/logger.ts << 'EOF'
import { AppConfig } from './config';

export class Logger {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  log(message: string): void {
    if (this.config.debug) {
      console.log(`[LOG] ${message}`);
    }
  }

  error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }
}
EOF

cat > /tmp/test-interface/src/app.ts << 'EOF'
import { createConfig, AppConfig } from './config';
import { HttpClient } from './httpClient';
import { Logger } from './logger';

export class App {
  private client: HttpClient;
  private logger: Logger;

  constructor(configOverrides?: Partial<AppConfig>) {
    const config = createConfig(configOverrides || {});
    this.client = new HttpClient(config);
    this.logger = new Logger(config);
  }

  async fetchData(path: string): Promise<unknown> {
    this.logger.log(`Fetching ${path}`);
    return this.client.get(path);
  }
}
EOF

cat > /tmp/test-interface/package.json << 'EOF'
{
  "name": "test-interface",
  "version": "1.0.0",
  "scripts": {
    "typecheck": "echo 'Types OK'",
    "test": "echo 'Tests OK'",
    "lint": "echo 'Lint OK'"
  }
}
EOF
```

**Prompt**:
```
/goodfoot:plan-then-implement-v2 Add a "retryCount" feature to the HTTP client in /tmp/test-interface. The AppConfig interface must maintain backward compatibility (existing code without retryCount should still work). Add an optional retryCount field to AppConfig with a default of 3. Update HttpClient to accept retries and update the App class to pass the config correctly. The Logger should log retry attempts when debug is enabled. Explore the codebase to understand all consumers of AppConfig before making changes.
```

**What to Evaluate**:
- Did it explore to find all AppConfig consumers (httpClient, logger, app)?
- Did it preserve backward compatibility (optional field with default)?
- Did the plan document interface constraints?
- Were all consumers updated consistently?
- Did task prompts include the interface contract to preserve?

---

## Test 4: Error Recovery with CONTINUE Loop

**Goal**: Test the validation failure → fix → re-run loop.

**Setup** (run before test):
```bash
mkdir -p /tmp/test-recovery/src

cat > /tmp/test-recovery/src/math.ts << 'EOF'
export function divide(a: number, b: number): number {
  return a / b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
EOF

cat > /tmp/test-recovery/src/math.test.ts << 'EOF'
import { divide, multiply } from './math';

describe('math', () => {
  describe('divide', () => {
    it('divides two numbers', () => {
      expect(divide(10, 2)).toBe(5);
    });
  });

  describe('multiply', () => {
    it('multiplies two numbers', () => {
      expect(multiply(3, 4)).toBe(12);
    });
  });
});
EOF

# This package.json has a test that will FAIL initially
cat > /tmp/test-recovery/package.json << 'EOF'
{
  "name": "test-recovery",
  "version": "1.0.0",
  "scripts": {
    "typecheck": "echo 'Types OK'",
    "test": "echo 'Running tests...' && if [ ! -f src/math.ts ] || ! grep -q 'safeDiv' src/math.ts; then echo 'FAIL: safeDivide test - function not found' && exit 1; else echo 'All tests passed'; fi",
    "lint": "echo 'Lint OK'"
  }
}
EOF
```

**Prompt**:
```
/goodfoot:plan-then-implement-v2 Add a safeDivide function to /tmp/test-recovery/src/math.ts that returns 0 when dividing by zero instead of Infinity. The function should be named exactly "safeDivide" (the tests check for this). Also add a test for the new function in math.test.ts.
```

**What to Evaluate**:
- Did initial validation return CONTINUE status (test fails if function missing/misnamed)?
- Did it correctly identify the issue from test output?
- Did it fix the issue and re-run validation?
- Did final status become PRODUCTION_READY?
- Was the CONTINUE → fix → validate loop handled correctly?

---

## Running the Tests

1. Run the setup commands for each test
2. Execute the prompt in a fresh Claude Code session
3. Save/export the conversation transcript
4. Check the `projects/` directory for the plan artifacts
5. Verify the files in `/tmp/test-*/` contain expected changes

## Cleanup

```bash
rm -rf /tmp/test-monorepo /tmp/test-refactor /tmp/test-interface /tmp/test-recovery
rm -rf projects/new/* projects/active/* projects/ready-for-review/*
```
