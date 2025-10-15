# Jest+Playwright Setup for @packages/website - Implementation Plan

## Plan Usage Instructions

This plan provides step-by-step instructions for implementing Jest+Playwright testing infrastructure for the @packages/website package. Follow the sections sequentially to establish a complete testing environment with proper ES module support, server management, and TypeScript integration.

## Success Criteria

- [ ] Install Jest+Playwright dependencies for website package
- [ ] Configure Jest with ES module support and TypeScript integration
- [ ] Set up Playwright configuration with server management
- [ ] Create test-specific TypeScript configuration
- [ ] Implement server lifecycle management with PID files
- [ ] Create example tests for home page and navigation functionality
- [ ] Add test scripts to package.json with proper Node options
- [ ] Validate complete setup with successful test execution

## Scope

### Inclusions
- Jest configuration with ES module support
- Playwright configuration with server management
- TypeScript configuration for tests
- Server lifecycle management (global setup/teardown)
- Example tests for home page and navigation
- Package.json script updates
- Complete directory structure setup

### Exclusions
- Advanced test coverage reporting
- CI/CD integration
- Performance testing
- Visual regression testing
- Mobile device testing
- Cross-browser testing beyond Chromium
- Custom test utilities beyond basic setup

## Proposed Technical Approach

### 1. Dependency Installation

Install required dependencies in `/workspace/packages/website`:
```bash
yarn add -D jest @types/jest playwright playwright-core jest-playwright-preset expect-playwright ts-jest cross-env
```

### 2. Configuration Files

#### Jest Configuration (jest.config.js)
- Use CommonJS format due to jest-playwright-preset limitations
- Configure ES module support with experimental VM modules
- Set up TypeScript transformation with ts-jest
- Configure path mapping for ~/* imports
- Set appropriate timeouts for Playwright operations

#### Playwright Configuration (jest-playwright.config.js)
- Configure Chromium browser only
- Set up server management with dev server
- Configure port from environment variables
- Implement server check functionality
- Set up global setup and teardown

#### TypeScript Configuration (tsconfig.test.json)
- Extend existing tsconfig.vite.json
- Add test-specific types (jest, jest-playwright-preset, expect-playwright)
- Configure ES module support
- Include test directories and source files

### 3. Server Management Implementation

#### Global Setup (tests/setup/global-setup.js)
- Check if dev server is already running
- Start dev server if not running
- Write PID file for cleanup
- Wait for server ready signal
- Handle server startup errors

#### Global Teardown (tests/setup/global-teardown.js)
- Read PID file to identify server process
- Stop server using PID
- Clean up PID file
- Handle cleanup errors gracefully

### 4. Example Test Implementation

#### Home Page Test (tests/home.test.ts)
- Test page loading and title verification
- Test Welcome component rendering with "Hello from Express" h1
- Test React Router logo presence
- Test navigation links existence
- Test responsive design classes

#### Navigation Test (tests/navigation.test.ts)
- Test external link attributes (target, rel)
- Test hover effects on links
- Test link accessibility features

### 5. Package.json Updates

Add test scripts with proper Node options:
- `test`: Run all tests with ESM support
- `test:watch`: Run tests in watch mode
- `test:coverage`: Run tests with coverage reporting
- `test:ui`: Run UI tests with verbose output

### 6. Directory Structure Creation

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

## Assumptions & Risks

### Assumptions
- Current website package has React Router 7.x with Express integration
- Welcome component renders "Hello from Express" in h1 element
- Dev server starts with `yarn dev` command
- Server uses PORT environment variable with default 3000
- TypeScript configuration follows existing tsconfig.vite.json pattern

### Risks
- **TECHNICAL**: jest-playwright-preset is in maintenance mode
- **TECHNICAL**: Jest ESM support is experimental and may be unstable
- **TECHNICAL**: Server management complexity with PID files
- **TECHNICAL**: TypeScript configuration conflicts with existing setup
- **TECHNICAL**: Port conflicts with existing dev server
- **SCOPE**: ES module compatibility issues may require additional debugging

## Testing Strategy

### Test Coverage Areas
1. **Basic Functionality**: Page loading, title verification, content display
2. **Component Rendering**: React Router components and Express context
3. **DOM Structure**: Actual DOM elements from Welcome component
4. **Navigation**: External links and their attributes
5. **Responsive Design**: CSS classes and layout behavior
6. **Accessibility**: Proper semantic HTML and ARIA attributes

### Testing Approach
- Use Playwright for end-to-end testing
- Test against actual running dev server
- Verify both client-side and server-side rendering
- Test realistic user interactions
- Validate accessibility features

### Success Criteria
- All tests pass with `yarn test` command
- Server management works properly (start/stop)
- TypeScript compilation succeeds for test files
- ES module imports work correctly
- Test coverage includes key functionality
- No port conflicts or server management issues

## Implementation Notes

### Technical Considerations
- Configuration files must be CommonJS due to jest-playwright-preset limitations
- Use experimental VM modules for Jest ESM support
- Implement proper server cleanup with PID file management
- Configure Jest with appropriate timeouts for Playwright operations
- Test for actual DOM structure from Welcome component
- Handle server port configuration through environment variables

### Key Implementation Details
- Server startup detection uses lsof command to check port usage
- PID file management ensures reliable server cleanup
- TypeScript configuration extends existing setup without conflicts
- Test timeouts are set to 30 seconds for Playwright operations
- Cross-env ensures Node options work across platforms

### Known Limitations
- jest-playwright-preset is in maintenance mode
- Jest ESM support is experimental
- Configuration files must be CommonJS
- Requires running dev server for integration tests
- Limited to Chromium browser for initial setup

### Alternative Recommendations
For future consideration if limitations become problematic:
- Consider migrating to Playwright's official test runner
- Use Vitest instead of Jest for better ESM support
- Implement custom test setup without jest-playwright-preset
- Add cross-browser testing support
- Implement visual regression testing

## Implementation Steps Summary

1. **Environment Setup**: Install dependencies in packages/website
2. **Configuration Creation**: Create Jest, Playwright, and TypeScript configs
3. **Server Management**: Implement global setup/teardown with PID management
4. **Test Development**: Create example tests for home page and navigation
5. **Script Integration**: Add test scripts to package.json
6. **Directory Structure**: Create complete test directory structure
7. **Validation**: Run tests to verify complete setup
8. **Documentation**: Ensure all configurations are properly documented

This plan provides a comprehensive foundation for Jest+Playwright testing with React Router 7.x while addressing all specified requirements and technical constraints.