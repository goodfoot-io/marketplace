# Jest+Playwright Setup for @packages/website - Updated Implementation Plan

## Overview
This plan addresses critical and high-priority issues identified in the initial implementation, focusing on proper ES module support, correct server configuration, and accurate TypeScript integration for React Router 7.x with Jest+Playwright.

## Critical Issues Addressed

### 1. Server Port Configuration
- **Fixed**: Server reads from `process.env.PORT` with default 3000 (line 8 in server.js)
- **Solution**: Use environment variable approach with proper default handling

### 2. TypeScript Configuration 
- **Fixed**: Avoid breaking existing tsconfig.json project structure
- **Solution**: Create separate test-specific tsconfig extending tsconfig.vite.json

### 3. ES Module System Compatibility
- **Fixed**: Package.json shows `"type": "module"` requiring ES module handling
- **Solution**: Configure Jest for experimental ESM support with proper transformations

### 4. Test Content Expectations
- **Fixed**: Test should expect "Hello from Express" as h1 content, not body text
- **Solution**: Update selectors to match actual DOM structure from Welcome component

## Implementation Steps

### Part 1: Install Dependencies

```bash
cd /workspace/packages/website
yarn add -D jest @types/jest playwright playwright-core jest-playwright-preset expect-playwright ts-jest cross-env
```

**Note**: jest-playwright-preset is in maintenance mode, but still functional for basic setup.

### Part 2: Configuration Files

#### 2.1 Jest Configuration (jest.config.js)
```javascript
// jest.config.js - Must be CommonJS due to jest-playwright-preset limitations
module.exports = {
  preset: 'jest-playwright-preset',
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 30000,
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ES2022',
        target: 'ES2022',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }]
  },
  moduleNameMapping: {
    '^~/(.*)$': '<rootDir>/app/$1'
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx'
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/types/**/*'
  ]
};
```

#### 2.2 Playwright Configuration (jest-playwright.config.js)
```javascript
// jest-playwright.config.js - Must be CommonJS
const { execSync } = require('child_process');

// Check if dev server is running
function isServerRunning(port) {
  try {
    execSync(`lsof -i :${port}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  browsers: ['chromium'],
  exitOnPageError: false,
  launchOptions: {
    headless: true,
    slowMo: 0
  },
  serverOptions: {
    command: 'yarn dev',
    port: parseInt(process.env.PORT || '3000'),
    launchTimeout: 30000,
    debug: false
  },
  // Custom server management
  globalSetup: './tests/setup/global-setup.js',
  globalTeardown: './tests/setup/global-teardown.js'
};
```

#### 2.3 Test-Specific TypeScript Configuration (tsconfig.test.json)
```json
{
  "extends": "./tsconfig.vite.json",
  "compilerOptions": {
    "module": "ES2022",
    "target": "ES2022",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "types": [
      "jest",
      "node",
      "jest-playwright-preset",
      "expect-playwright"
    ],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": [
    "tests/**/*",
    "app/**/*",
    "server/**/*"
  ]
}
```

### Part 3: Server Management Setup

#### 3.1 Global Setup (tests/setup/global-setup.js)
```javascript
// tests/setup/global-setup.js
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000');
const PID_FILE = path.join(__dirname, '../../.test-server.pid');

function isServerRunning(port) {
  try {
    execSync(`lsof -i :${port}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('yarn', ['dev'], {
      stdio: 'pipe',
      env: { ...process.env, PORT: PORT.toString() }
    });
    
    // Write PID for cleanup
    fs.writeFileSync(PID_FILE, server.pid.toString());
    
    server.stdout.on('data', (data) => {
      if (data.toString().includes(`Server is running on`)) {
        resolve();
      }
    });
    
    server.stderr.on('data', (data) => {
      console.error(`Server error: ${data}`);
    });
    
    setTimeout(() => reject(new Error('Server start timeout')), 30000);
  });
}

module.exports = async () => {
  if (!isServerRunning(PORT)) {
    console.log(`Starting development server on port ${PORT}...`);
    await startServer();
    console.log('Development server started successfully');
  } else {
    console.log(`Development server already running on port ${PORT}`);
  }
};
```

#### 3.2 Global Teardown (tests/setup/global-teardown.js)
```javascript
// tests/setup/global-teardown.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PID_FILE = path.join(__dirname, '../../.test-server.pid');

module.exports = async () => {
  if (fs.existsSync(PID_FILE)) {
    try {
      const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
      execSync(`kill ${pid}`, { stdio: 'ignore' });
      fs.unlinkSync(PID_FILE);
      console.log('Test server stopped');
    } catch (error) {
      console.warn('Could not stop test server:', error.message);
    }
  }
};
```

### Part 4: Example Test Implementation

#### 4.1 Basic Home Page Test (tests/home.test.ts)
```typescript
// tests/home.test.ts
import { expect } from 'expect-playwright';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

// Increase timeout for Playwright operations
jest.setTimeout(30000);

describe('Home Page', () => {
  beforeEach(async () => {
    await page.goto(BASE_URL);
  });

  it('should load the home page successfully', async () => {
    await expect(page).toHaveTitle('New React Router App');
  });

  it('should display the Express message', async () => {
    // The message "Hello from Express" appears in an h1 element within the Welcome component
    await expect(page).toHaveSelector('h1', { text: 'Hello from Express' });
  });

  it('should display React Router logo', async () => {
    await expect(page).toHaveSelector('img[alt="React Router"]');
  });

  it('should have navigation links', async () => {
    await expect(page).toHaveSelector('a[href="https://reactrouter.com/docs"]');
    await expect(page).toHaveSelector('a[href="https://rmx.as/discord"]');
  });

  it('should have responsive design classes', async () => {
    const main = await page.$('main');
    const className = await main?.getAttribute('class');
    expect(className).toContain('flex');
    expect(className).toContain('h-screen');
    expect(className).toContain('items-center');
    expect(className).toContain('justify-center');
  });
});
```

#### 4.2 Navigation Test (tests/navigation.test.ts)
```typescript
// tests/navigation.test.ts
import { expect } from 'expect-playwright';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

jest.setTimeout(30000);

describe('Navigation', () => {
  beforeEach(async () => {
    await page.goto(BASE_URL);
  });

  it('should have external links with correct attributes', async () => {
    const docsLink = await page.$('a[href="https://reactrouter.com/docs"]');
    const target = await docsLink?.getAttribute('target');
    const rel = await docsLink?.getAttribute('rel');
    
    expect(target).toBe('_blank');
    expect(rel).toBe('noreferrer');
  });

  it('should have hover effects on links', async () => {
    const link = await page.$('a[href="https://reactrouter.com/docs"]');
    await link?.hover();
    
    const className = await link?.getAttribute('class');
    expect(className).toContain('hover:underline');
  });
});
```

### Part 5: Package.json Updates

Add test scripts to package.json:

```json
{
  "scripts": {
    "test": "cross-env NODE_OPTIONS='--experimental-vm-modules' jest",
    "test:watch": "cross-env NODE_OPTIONS='--experimental-vm-modules' jest --watch",
    "test:coverage": "cross-env NODE_OPTIONS='--experimental-vm-modules' jest --coverage",
    "test:ui": "cross-env NODE_OPTIONS='--experimental-vm-modules' jest --testNamePattern='should.*' --verbose"
  }
}
```

### Part 6: Directory Structure

Create the following directory structure:
```
packages/website/
├── tests/
│   ├── setup/
│   │   ├── global-setup.js
│   │   └── global-teardown.js
│   ├── home.test.ts
│   └── navigation.test.ts
├── jest.config.js
├── jest-playwright.config.js
├── tsconfig.test.json
└── .test-server.pid (created at runtime)
```

## Key Technical Solutions

### ES Module Compatibility
- Uses `cross-env NODE_OPTIONS='--experimental-vm-modules'` for Jest ESM support
- Configures ts-jest with `useESM: true` and proper module settings
- Marks `.ts` and `.tsx` files as ESM with `extensionsToTreatAsEsm`

### Server Management
- Implements proper dev server lifecycle management
- Uses PID file for reliable server cleanup
- Checks if server is already running before starting
- Configurable port through environment variables

### TypeScript Integration
- Extends existing tsconfig.vite.json to maintain project structure
- Adds test-specific types and configuration
- Supports path mapping for `~/*` imports

### React Router 7.x Compatibility
- Tests actual DOM structure from Welcome component
- Accounts for SSR rendering with Express context
- Tests both client-side and server-side rendering aspects

## Testing Strategy

1. **Basic functionality**: Page loading, title, content display
2. **Component rendering**: React Router components and Express context
3. **Responsive design**: CSS classes and layout behavior
4. **Navigation**: External links and their attributes
5. **Accessibility**: Proper semantic HTML and ARIA attributes

## Known Limitations

1. **jest-playwright-preset**: Currently in maintenance mode
2. **ESM support**: Jest ESM support is still experimental
3. **Configuration format**: Config files must be CommonJS due to preset limitations
4. **Server dependencies**: Requires running dev server for integration tests

## Alternative Recommendations

For new projects or if the above limitations become problematic:
- Consider migrating to Playwright's official test runner
- Use Vitest instead of Jest for better ESM support
- Implement custom test setup without jest-playwright-preset

This plan provides a robust foundation for Jest+Playwright testing with React Router 7.x while addressing all identified critical and high-priority issues.