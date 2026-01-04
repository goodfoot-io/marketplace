/**
 * PreToolUse hook: Jest mock prevention for integration-first testing.
 *
 * Prevents Jest mocking patterns in test files and guides developers
 * toward real implementations using integration testing patterns.
 *
 * @see https://code.claude.com/docs/en/hooks#pretooluse
 */

import {
  type PatternCheckResult,
  checkContentForPattern,
  getFilePath,
  preToolUseHook,
  preToolUseOutput,
} from "@goodfoot/claude-code-hooks";

/**
 * Pattern definitions with descriptions for error messages.
 * Organized by category for clarity.
 */
const JEST_MOCK_PATTERNS: ReadonlyArray<{ pattern: RegExp; description: string }> = [
  // Import patterns for mock utilities from jest or @jest/globals
  {
    pattern: /import.*\{.*\b(mocked|fn|spyOn|Mock|Mocked|MockedFunction)\b.*\}.*from.*['"](@jest\/globals|jest)['"]/g,
    description: "Import of Jest mock utilities",
  },
  // Import of jest-mock package
  {
    pattern: /from ['"]jest-mock['"]/g,
    description: "Import from jest-mock package",
  },
  // Import of Mock/Mocked types
  {
    pattern: /import.*type.*\{.*\b(Mock|Mocked|MockedFunction)\b.*\}/g,
    description: "Import of Jest mock types",
  },
  // jest.fn() pattern
  {
    pattern: /jest\.fn\(\)/g,
    description: "jest.fn() mock function",
  },
  // jest.mock() module mocking
  {
    pattern: /jest\.mock\(['"]/g,
    description: "jest.mock() module mocking",
  },
  // jest.spyOn() spying
  {
    pattern: /jest\.spyOn\(/g,
    description: "jest.spyOn() spy",
  },
  // jest.mocked() type helper
  {
    pattern: /jest\.mocked\(/g,
    description: "jest.mocked() type helper",
  },
  // jest.Mock type annotation
  {
    pattern: /jest\.Mock</g,
    description: "jest.Mock<> type annotation",
  },
  // jest.Mocked type
  {
    pattern: /jest\.Mocked</g,
    description: "jest.Mocked<> type",
  },
  // jest.createMockFromModule
  {
    pattern: /jest\.createMockFromModule\(/g,
    description: "jest.createMockFromModule()",
  },
  // jest.clearAllMocks/resetAllMocks/restoreAllMocks
  {
    pattern: /jest\.(clearAllMocks|resetAllMocks|restoreAllMocks)\(\)/g,
    description: "jest mock cleanup methods (clearAllMocks, resetAllMocks, restoreAllMocks)",
  },
  // jest.requireActual/requireMock
  {
    pattern: /jest\.(requireActual|requireMock)\(/g,
    description: "jest.requireActual() or jest.requireMock()",
  },
  // jest.doMock/dontMock/unmock
  {
    pattern: /jest\.(doMock|dontMock|unmock)\(/g,
    description: "jest mock control methods (doMock, dontMock, unmock)",
  },
  // toHaveBeenCalled and related matchers
  {
    pattern: /\.toHaveBeenCalled(With|Times|LastCalledWith|NthCalledWith)?\(/g,
    description: "Mock verification matchers (toHaveBeenCalled, toHaveBeenCalledWith, etc.)",
  },
  // Type assertions with as jest.Mock
  {
    pattern: /as jest\.(Mock|MockedFunction)/g,
    description: "Type assertion with jest.Mock or jest.MockedFunction",
  },
  // jest.MockedFunction type
  {
    pattern: /jest\.MockedFunction</g,
    description: "jest.MockedFunction<> type",
  },
  // Common mock patterns like mockReturnValue, mockResolvedValue, mockClear, mockReset
  {
    pattern: /\.mock(Return|Resolved|Rejected|Implementation|Clear|Reset)/g,
    description: "Mock configuration methods (mockReturnValue, mockResolvedValue, mockClear, etc.)",
  },
];

/**
 * Test file patterns for detection.
 */
const TEST_FILE_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /__tests__\//,
  /\/tests\/.*\.(ts|tsx|js|jsx)$/,
];

/**
 * Checks if a file path is a test file.
 */
function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Builds the guidance message for integration testing alternatives.
 */
function buildGuidanceMessage(violations: string[]): string {
  const violationList = violations.map((v) => `  - ${v}`).join("\n");

  return `Jest mocking detected. This codebase uses integration-first testing with real implementations.

**Violations found:**
${violationList}

**Use Real Implementations Instead:**

**1. Database Operations - Use getTestSql():**
\`\`\`typescript
import { getTestSql } from '@productivity-bot/test-utilities/sql';
const { sql } = await getTestSql(); // Real test database
const handlers = createYourHandlers({ sql });
\`\`\`

**2. File Operations - Use temp directories:**
\`\`\`typescript
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
const processor = createFileProcessor({ directory: tempDir });
\`\`\`

**3. WebSockets - Use real ws server:**
\`\`\`typescript
const wss = new WebSocketServer({ port: 0 }); // Random port
const address = wss.address() as AddressInfo;
\`\`\`

**4. React Hooks/Stores - Use real implementations:**
\`\`\`typescript
const store = createStore({ initialState: testData });
const { result } = renderHook(() => useStore(), { wrapper: StoreProvider });
\`\`\`

**5. Internal Services - Use dependency injection:**
\`\`\`typescript
export function createUserHandlers({ sql }: { sql: PostgresConnection }) {
  return { async addUser(data) { /* real implementation */ } };
}
const handlers = createUserHandlers({ sql });
\`\`\`

**6. Background Processes - Use jestTeardownQueue:**
\`\`\`typescript
import { jestTeardownQueue } from '@productivity-bot/test-utilities/jest-teardown';
const unlisten = await startListener();
void jestTeardownQueue.add(unlisten);
\`\`\`

**Handle External Services:**
- Stripe/Payments: Use test mode with test API keys
- Twilio/SMS: Use test credentials
- OpenAI/LLMs: Create simple echo service for tests
- Email: Use local SMTP server or service test mode

**Common Anti-Patterns to Avoid:**
- Don't mock internal hooks/services - Use real implementations
- Don't mock auth modules - Use real auth with test database
- Don't mock database operations - Use getTestSql()

**Mocking is NEVER allowed - use real implementations exclusively.**`;
}

export default preToolUseHook({ matcher: "Write|Edit|MultiEdit", timeout: 10000 }, (input, { logger }) => {
  const filePath = getFilePath(input);

  // Skip if no file path
  if (!filePath) {
    logger.debug("No file path found, skipping");
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: "allow",
        permissionDecisionReason: "No file path to check",
      },
    });
  }

  // Only check test files
  if (!isTestFile(filePath)) {
    logger.debug("Not a test file, skipping", { filePath });
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: "allow",
        permissionDecisionReason: "Not a test file",
      },
    });
  }

  logger.debug("Checking test file for Jest mock patterns", { filePath });

  // Check each pattern and collect violations
  const violations: string[] = [];

  for (const { pattern, description } of JEST_MOCK_PATTERNS) {
    const result: PatternCheckResult | null = checkContentForPattern(input, pattern);

    // Only report if the pattern is being ADDED (not already present)
    if (result?.isAddition) {
      violations.push(description);
      logger.warn("Jest mock pattern being added", { pattern: description, matches: result.matches });
    }
  }

  // If no violations, allow the operation
  if (violations.length === 0) {
    logger.debug("No Jest mock patterns found");
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: "allow",
        permissionDecisionReason: "No Jest mocking patterns detected",
      },
    });
  }

  // Build denial message with guidance
  const guidance = buildGuidanceMessage(violations);

  logger.info("Denying operation due to Jest mock patterns", { violations });

  return preToolUseOutput({
    systemMessage:
      "Integration testing enforced: Use real implementations (getTestSql, temp directories, real servers) instead of Jest mocks.",
    hookSpecificOutput: {
      permissionDecision: "deny",
      permissionDecisionReason: guidance,
    },
  });
});
