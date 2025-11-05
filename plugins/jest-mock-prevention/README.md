# Jest Mock Prevention Plugin

A Claude Code plugin that enforces integration-first testing by preventing Jest mock usage and guiding developers toward real implementations.

## Overview

This plugin provides a PreToolUse hook that automatically detects and prevents Jest mocking patterns in test files. When mock usage is detected, the hook denies the operation and provides comprehensive guidance on using real implementations instead.

## Philosophy

Integration-first testing means:
- Using real database connections with `getTestSql()`
- Using real file systems with temp directories
- Using real WebSocket servers
- Using real service implementations with dependency injection
- **NO MOCKS ALLOWED** - even for external services

## Features

### Detected Patterns

The hook prevents the following Jest mocking patterns:

#### Import Patterns
- Import of Jest mock utilities from `@jest/globals` or `jest`
- Import from `jest-mock` package
- Import of Mock/Mocked types

#### Mock Functions
- `jest.fn()` - Mock function creation
- `jest.mock()` - Module mocking
- `jest.spyOn()` - Spy creation
- `jest.mocked()` - Type helper
- `jest.createMockFromModule()` - Mock module creation

#### Mock Types
- `jest.Mock<>` type annotations
- `jest.Mocked<>` type wrappers
- `jest.MockedFunction<>` type
- Type assertions with `as jest.Mock`

#### Mock Configuration
- `.mockReturnValue()`, `.mockResolvedValue()`, `.mockRejectedValue()`
- `.mockImplementation()`, `.mockImplementationOnce()`
- `.mockClear()`, `.mockReset()`, `.mockRestore()`

#### Mock Utilities
- `jest.clearAllMocks()`, `jest.resetAllMocks()`, `jest.restoreAllMocks()`
- `jest.requireActual()`, `jest.requireMock()`
- `jest.doMock()`, `jest.dontMock()`, `jest.unmock()`

#### Mock Matchers
- `.toHaveBeenCalled()`, `.toHaveBeenCalledWith()`
- `.toHaveBeenCalledTimes()`, `.toHaveBeenLastCalledWith()`
- `.toHaveBeenNthCalledWith()`

## Installation

### From Local Plugin Directory

Add the plugin to your `.claude/settings.json`:

```json
{
  "plugins": [
    {
      "source": "file:///workspace/plugins/jest-mock-prevention",
      "enabled": true
    }
  ]
}
```

Then reload Claude Code or restart the session.

### From Git Repository

```json
{
  "plugins": [
    {
      "source": "git::https://github.com/your-org/jest-mock-prevention.git",
      "enabled": true
    }
  ]
}
```

## Configuration

### Hook Timeout

The default timeout is 10 seconds. You can adjust this in `hooks/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "(Write|Edit|MultiEdit)",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/jest-mock-prevention",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Debug Mode

Enable debug output by setting the `DEBUG` environment variable:

```bash
DEBUG=1 claude
```

This will show detailed execution logs including:
- Tool names and file paths being checked
- Content detection results
- Pattern matching details

## How It Works

### File Detection

The hook automatically detects test files using these patterns:
- `*.test.ts`, `*.test.tsx`, `*.test.js`, `*.test.jsx`
- `*.spec.ts`, `*.spec.tsx`, `*.spec.js`, `*.spec.jsx`
- Files in `__tests__/` directories
- Files in `tests/` directories

Non-test files are not checked, allowing documentation to mention mock patterns without triggering the hook.

### Tool Support

The hook works with all file modification tools:
- **Write**: Checks the `content` parameter
- **Edit**: Checks the `new_string` parameter
- **MultiEdit**: Checks all `new_string` values in the edits array

### Hook Behavior

When mock patterns are detected:
1. Operation is **denied** (file is not written/edited)
2. Violations are logged to stderr with color-coded output
3. Comprehensive guidance is returned explaining how to use real implementations
4. JSON response includes full guidance in `permissionDecisionReason`

## Integration Patterns

### 1. Database Operations with getTestSql()

**Bad (Mocked)**:
```typescript
jest.mock('../database');
const mockSql = { query: jest.fn() };
```

**Good (Real)**:
```typescript
import { getTestSql } from '@productivity-bot/test-utilities/sql';
import { initializeDatabase } from '../src/database.js';

describe('Feature', () => {
  it('performs database operation', async () => {
    const { sql } = await getTestSql(); // Real test database
    await initializeDatabase(sql);
    const handlers = createYourHandlers({ sql });

    const result = await handlers.operation(data);

    // Verify in real database
    const [dbRecord] = await sql`SELECT * FROM table WHERE id = ${result.id}`;
    expect(dbRecord).toMatchObject(expected);
  });
});
```

### 2. File Operations with Temp Directories

**Bad (Mocked)**:
```typescript
jest.mock('fs');
const mockFs = { writeFile: jest.fn() };
```

**Good (Real)**:
```typescript
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
const processor = createFileProcessor({ directory: tempDir });
await processor.writeFile('test.txt', 'content');
const result = await processor.readFile('test.txt');
expect(result).toBe('content');
```

### 3. WebSockets with Real Servers

**Bad (Mocked)**:
```typescript
jest.mock('ws');
const mockWs = { on: jest.fn(), send: jest.fn() };
```

**Good (Real)**:
```typescript
import { WebSocketServer } from 'ws';
import { AddressInfo } from 'net';

const wss = new WebSocketServer({ port: 0 }); // Random port
const address = wss.address() as AddressInfo;
const ws = new WebSocket(`ws://localhost:${address.port}`);

// Use real WebSocket connection in tests
```

### 4. React Hooks with Real Stores

**Bad (Mocked)**:
```typescript
jest.mock('./useStore');
const mockUseStore = jest.fn(() => ({ data: mockData }));
```

**Good (Real)**:
```typescript
import { renderHook } from '@testing-library/react';

// Use real store with test data
const store = createStore({ initialState: testData });
const { result } = renderHook(() => useStore(), {
  wrapper: ({ children }) => (
    <StoreProvider value={store}>{children}</StoreProvider>
  )
});
```

### 5. Internal Services with Dependency Injection

**Bad (Mocked)**:
```typescript
jest.mock('./userService');
const mockUserService = { getUser: jest.fn() };
```

**Good (Real - Handler Factory Pattern)**:
```typescript
// Handler factory pattern (preferred)
export function createUserHandlers({ sql }: { sql: PostgresConnection }) {
  return {
    async addUser(data: UserData) {
      const [user] = await sql`INSERT INTO users ${sql(data)} RETURNING *`;
      return user;
    },
    async getUser(id: number) {
      const [user] = await sql`SELECT * FROM users WHERE id = ${id}`;
      return user;
    }
  };
}

// In tests - inject real database
const { sql } = await getTestSql();
const handlers = createUserHandlers({ sql });
const user = await handlers.addUser({ name: 'Test' });
```

### 6. Background Processes with jestTeardownQueue

**Bad (Mocked)**:
```typescript
jest.spyOn(process, 'exit');
```

**Good (Real)**:
```typescript
import { jestTeardownQueue } from '@productivity-bot/test-utilities/jest-teardown';

const unlisten = await startListener();
void jestTeardownQueue.add(unlisten); // Auto cleanup after test
```

## External Services

Even external services should use real implementations:

- **Stripe/Payments**: Use test mode with test API keys
- **Twilio/SMS**: Use test credentials (won't send real messages)
- **OpenAI/LLMs**: Create simple echo service for tests
- **Email**: Use local SMTP server or service test mode
- **Rate-limited APIs**: Use test endpoints or implement retry logic

## Common Anti-Patterns to Avoid

- ❌ Don't mock internal hooks/services → Use real implementations
- ❌ Don't mock auth modules → Use real auth with test database
- ❌ Don't mock YJS/collaborative structures → Use real YJS Doc
- ❌ Don't mock database operations → Use `getTestSql()`
- ❌ Don't mock file systems → Use temp directories
- ❌ Don't mock WebSockets → Use real WebSocket servers

## Development

### Project Structure

```
jest-mock-prevention/
├── .claude-plugin/
│   └── plugin.json       # Plugin manifest
├── README.md            # This file
├── hooks/
│   ├── hooks.json       # Hook configuration
│   └── jest-mock-prevention    # PreToolUse hook script
└── tests/
    └── test-jest-mock-prevention.sh    # Test suite (39 tests)
```

### Testing

Run the comprehensive test suite:

```bash
bash /workspace/plugins/jest-mock-prevention/tests/test-jest-mock-prevention.sh
```

The test suite includes:
- **Pattern Detection**: Tests for all 17+ mock pattern categories
- **Tool Format Handling**: Write, Edit, and MultiEdit tools
- **File Detection**: Test file pattern matching
- **Error Handling**: Invalid JSON, missing fields
- **Guidance Validation**: Checks that guidance includes key integration patterns
- **Performance Testing**: Ensures hook performs well with large files
- **Stderr Output**: Verifies violation details are logged

Expected output: All 39 tests should pass.

### Debug Mode Testing

Test with debug output enabled:

```bash
DEBUG=1 bash /workspace/plugins/jest-mock-prevention/tests/test-jest-mock-prevention.sh
```

### Manual Testing

Test the hook directly with JSON input:

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"test.test.ts","content":"const mock = jest.fn();"}}' | \
  /workspace/plugins/jest-mock-prevention/hooks/jest-mock-prevention
```

Expected output:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "❌ Jest mocking detected. This codebase uses integration-first testing with real implementations.\n\n**Violations found:**\n  • jest.fn() mock function found\n\n..."
  }
}
```

## Hook Details

### Input Format

The hook receives JSON on stdin:

```json
{
  "tool_name": "Write|Edit|MultiEdit",
  "tool_input": {
    "file_path": "/path/to/file.test.ts",
    "content": "...",        // For Write
    "new_string": "...",     // For Edit
    "edits": [...]           // For MultiEdit
  }
}
```

### Output Format

The hook outputs JSON to stdout:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny",
    "permissionDecisionReason": "Explanation or guidance"
  }
}
```

### Exit Codes

- `0`: Success (decision made, JSON output provided)
- Non-zero: Internal error (should not occur in normal operation)

### Dependencies

The hook requires:
- `bash` (shell interpreter)
- `jq` (JSON processing)
- Standard Unix utilities (`grep`, `sed`)

## Troubleshooting

### Hook Not Running

1. Verify plugin is enabled in `.claude/settings.json`
2. Check that hook script is executable:
   ```bash
   ls -la /workspace/plugins/jest-mock-prevention/hooks/
   ```
3. Enable debug mode to see execution logs:
   ```bash
   DEBUG=1 claude
   ```

### False Positives

If the hook incorrectly blocks valid code:

1. Check if the file is detected as a test file (pattern matching)
2. Review the pattern detection logic in the hook script
3. Consider if the pattern genuinely represents mocking (it probably does)
4. Remember: This hook enforces a strict no-mocks policy

### Non-Test Files Being Checked

The hook only checks files matching test patterns. If a non-test file is being checked:

1. Verify the file name doesn't match test patterns (`*.test.*`, `*.spec.*`, `__tests__/`, `tests/`)
2. Rename the file if it's not actually a test file

### Hook Timeout

If the hook times out (>10 seconds):

1. Check for extremely large file content
2. Increase timeout in `hooks/hooks.json`
3. Enable debug mode to see where time is spent

## Resources

- [Integration Testing Best Practices](https://martinfowler.com/bliki/IntegrationTest.html)
- [Why I Don't Mock](https://remarkablemark.org/blog/2022/06/19/why-i-dont-mock/)
- [Claude Code Hooks Documentation](https://docs.claude.com/en/docs/claude-code/hooks.md)
- [Claude Code Hooks Guide](https://docs.claude.com/en/docs/claude-code/hooks-guide.md)

## License

MIT

## Contributing

Contributions are welcome! Please:

1. Test your changes thoroughly using the test suite
2. Update documentation as needed
3. Follow the existing code style
4. Add test cases for new patterns
5. Ensure all 39 tests pass before submitting

## Author

Created by Goodfoot (contact@goodfoot.io)
