#!/bin/bash

# Test suite for claude-pretooluse-hook-jest-mock-prevention utility

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOOK_SCRIPT="$SCRIPT_DIR/../hooks/jest-mock-prevention"

# Function to run a test
run_test() {
    local test_name="$1"
    local json_input="$2"
    local expected_decision="$3"
    local expected_reason_contains="$4"
    local should_not_contain="$5"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Run the hook script, capturing stdout and stderr separately
    local stdout_file=$(mktemp)
    local stderr_file=$(mktemp)
    echo "$json_input" | "$HOOK_SCRIPT" >"$stdout_file" 2>"$stderr_file"
    local exit_code=$?
    
    local output
    output=$(cat "$stdout_file")
    rm -f "$stdout_file" "$stderr_file"
    
    local test_passed=true
    local failure_reasons=()
    
    # Check exit code (should always be 0 for proper JSON output)
    if [ $exit_code -ne 0 ]; then
        test_passed=false
        failure_reasons+=("Exit code: expected 0, got $exit_code")
    fi
    
    # Parse JSON output
    local actual_decision
    actual_decision=$(echo "$output" | jq -r '.hookSpecificOutput.permissionDecision' 2>/dev/null)
    
    if [ "$actual_decision" = "null" ] || [ -z "$actual_decision" ]; then
        test_passed=false
        failure_reasons+=("Could not parse permissionDecision from JSON output")
    elif [ "$actual_decision" != "$expected_decision" ]; then
        test_passed=false
        failure_reasons+=("Decision: expected '$expected_decision', got '$actual_decision'")
    fi
    
    # Check if reason contains expected text
    if [ -n "$expected_reason_contains" ]; then
        local reason
        reason=$(echo "$output" | jq -r '.hookSpecificOutput.permissionDecisionReason' 2>/dev/null)
        if ! echo "$reason" | grep -q "$expected_reason_contains"; then
            test_passed=false
            failure_reasons+=("Reason should contain: '$expected_reason_contains'")
        fi
    fi
    
    # Check if reason doesn't contain unexpected text
    if [ -n "$should_not_contain" ]; then
        local reason
        reason=$(echo "$output" | jq -r '.hookSpecificOutput.permissionDecisionReason' 2>/dev/null)
        if echo "$reason" | grep -q "$should_not_contain"; then
            test_passed=false
            failure_reasons+=("Reason should not contain: '$should_not_contain'")
        fi
    fi
    
    if [ "$test_passed" = true ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        for reason in "${failure_reasons[@]}"; do
            echo "  - $reason"
        done
        if [ -n "$DEBUG" ]; then
            echo "  Output:"
            echo "$output" | sed 's/^/    /'
        fi
    fi
}

echo "Running claude-pretooluse-hook-jest-mock-prevention tests..."
echo "=============================================================="

# Test 1: Clean test file (should allow)
run_test "Allow clean test without mocks" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/user.test.ts", "content": "import { getTestSql } from \"@productivity-bot/test-utilities/sql\";\nimport { createUserHandlers } from \"./user\";\n\ndescribe(\"User\", () => {\n  it(\"creates user\", async () => {\n    const { sql } = await getTestSql();\n    const handlers = createUserHandlers({ sql });\n    const user = await handlers.addUser({ name: \"Test\" });\n    expect(user.name).toBe(\"Test\");\n  });\n});"}}' \
    "allow" \
    "No Jest mocking patterns detected" \
    ""

# Test 2: jest.fn() usage (should deny)
run_test "Deny jest.fn() mock function" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/service.test.ts", "content": "const mockCallback = jest.fn();\nmockCallback(\"test\");\nexpect(mockCallback).toHaveBeenCalled();"}}' \
    "deny" \
    "jest.fn() mock function found" \
    ""

# Test 3: jest.mock() module mocking (should deny)
run_test "Deny jest.mock() module mocking" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/api.test.ts", "content": "jest.mock(\"./database\");\nimport { db } from \"./database\";\n\ntest(\"api\", () => {\n  db.query.mockReturnValue([]);\n});"}}' \
    "deny" \
    "jest.mock() module mocking found" \
    ""

# Test 4: jest.spyOn() usage (should deny)
run_test "Deny jest.spyOn() spy" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/spy.test.ts", "content": "const spy = jest.spyOn(console, \"log\");\nconsole.log(\"test\");\nexpect(spy).toHaveBeenCalled();"}}' \
    "deny" \
    "jest.spyOn() spy found" \
    ""

# Test 5: jest.Mock type annotation (should deny)
run_test "Deny jest.Mock type annotation" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/types.test.ts", "content": "type MockFunction = jest.Mock<void, [string]>;\nconst fn: MockFunction = jest.fn();"}}' \
    "deny" \
    "jest.Mock<> type annotation found" \
    ""

# Test 6: jest.Mocked type (should deny)
run_test "Deny jest.Mocked type" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/mocked.test.ts", "content": "let mockService: jest.Mocked<UserService>;\nmockService = { getUser: jest.fn() };"}}' \
    "deny" \
    "jest.Mocked<> type found" \
    ""

# Test 7: mockReturnValue and similar (should deny)
run_test "Deny mock configuration methods" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/config.test.ts", "content": "const mock = jest.fn();\nmock.mockReturnValue(42);\nmock.mockResolvedValue(\"test\");"}}' \
    "deny" \
    "Mock configuration methods found" \
    ""

# Test 8: jest.clearAllMocks (should deny)
run_test "Deny jest.clearAllMocks" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/cleanup.test.ts", "content": "beforeEach(() => {\n  jest.clearAllMocks();\n});"}}' \
    "deny" \
    "jest mock cleanup methods found" \
    ""

# Test 9: Edit tool with mock (should deny)
run_test "Deny Edit tool with jest.fn()" \
    '{"tool_name": "Edit", "tool_input": {"file_path": "/tmp/edit.test.ts", "old_string": "const callback = () => {};", "new_string": "const callback = jest.fn();"}}' \
    "deny" \
    "jest.fn() mock function found" \
    ""

# Test 10: MultiEdit tool with mocks (should deny)
run_test "Deny MultiEdit tool with mocks" \
    '{"tool_name": "MultiEdit", "tool_input": {"file_path": "/tmp/multi.test.ts", "edits": [{"old_string": "import { test }", "new_string": "import { test, jest }"}, {"old_string": "const fn = () => {}", "new_string": "const fn = jest.fn()"}]}}' \
    "deny" \
    "jest.fn() mock function found" \
    ""

# Test 11: Clean Edit tool usage (should allow)
run_test "Allow clean Edit tool usage" \
    '{"tool_name": "Edit", "tool_input": {"file_path": "/tmp/clean.test.ts", "old_string": "const user = null;", "new_string": "const user = await getUser();"}}' \
    "allow" \
    "No Jest mocking patterns detected" \
    ""

# Test 12: Clean MultiEdit tool usage (should allow)
run_test "Allow clean MultiEdit tool usage" \
    '{"tool_name": "MultiEdit", "tool_input": {"file_path": "/tmp/clean.test.ts", "edits": [{"old_string": "a", "new_string": "b"}, {"old_string": "x", "new_string": "y"}]}}' \
    "allow" \
    "No Jest mocking patterns detected" \
    ""

# Test 13: Non-test file (should allow even with mocks)
run_test "Allow non-test file with mock-like content" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/documentation.md", "content": "Use jest.fn() to create mock functions in tests."}}' \
    "allow" \
    "No test content to check" \
    ""

# Test 14: Non-test TypeScript file (should allow)
run_test "Allow non-test .ts file" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/service.ts", "content": "// This comment mentions jest.fn() but this is not a test\nexport class Service {}"}}' \
    "allow" \
    "No test content to check" \
    ""

# Test 15: Test file in __tests__ directory (should check)
run_test "Check __tests__ directory files" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/__tests__/user.js", "content": "const mock = jest.fn();\nmock();"}}' \
    "deny" \
    "jest.fn() mock function found" \
    ""

# Test 16: Spec file (should check)
run_test "Check .spec.ts files" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/api.spec.ts", "content": "jest.mock(\"axios\");\nimport axios from \"axios\";"}}' \
    "deny" \
    "jest.mock() module mocking found" \
    ""

# Test 17: Tests directory file (should check)
run_test "Check files in tests/ directory" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/workspace/tests/integration/user.ts", "content": "const spy = jest.spyOn(Date, \"now\");"}}' \
    "deny" \
    "jest.spyOn() spy found" \
    ""

# Test 18: Invalid JSON input (should deny)
run_test "Handle invalid JSON input" \
    'not valid json' \
    "deny" \
    "Invalid JSON input provided" \
    ""

# Test 19: Missing tool_name (should allow - no content)
run_test "Handle missing tool_name" \
    '{"tool_input": {"content": "jest.fn()"}}' \
    "allow" \
    "No test content to check" \
    ""

# Test 20: Unsupported tool (should allow)
run_test "Allow unsupported tool" \
    '{"tool_name": "UnsupportedTool", "tool_input": {"content": "jest.fn()"}}' \
    "allow" \
    "No test content to check" \
    ""

# Test 21: Empty content (should allow)
run_test "Allow empty content" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/empty.test.ts", "content": ""}}' \
    "allow" \
    "No test content to check" \
    ""

# Test 22: Mixed violations (should deny and list all)
run_test "Deny mixed mock violations" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/mixed.test.ts", "content": "jest.mock(\"fs\");\nconst fn = jest.fn();\nconst spy = jest.spyOn(console, \"log\");\nfn.mockReturnValue(42);"}}' \
    "deny" \
    "jest.fn() mock function found" \
    ""

# Test 23: Check guidance includes getTestSql
run_test "Guidance includes getTestSql pattern" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/db.test.ts", "content": "const mockDb = jest.fn();"}}' \
    "deny" \
    "getTestSql" \
    ""

# Test 24: Check guidance includes dependency injection
run_test "Guidance includes dependency injection" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/service.test.ts", "content": "jest.mock(\"./service\");"}}' \
    "deny" \
    "dependency injection" \
    ""

# Test 25: Check guidance mentions NO MOCKS ALLOWED
run_test "Guidance mentions NO MOCKS ALLOWED" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/api.test.ts", "content": "const mock = jest.fn();"}}' \
    "deny" \
    "NO MOCKS ALLOWED" \
    ""

# Test 26: jest.createMockFromModule (should deny)
run_test "Deny jest.createMockFromModule" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/module.test.ts", "content": "const mockModule = jest.createMockFromModule(\"./module\");"}}' \
    "deny" \
    "jest.createMockFromModule() found" \
    ""

# Test 27: jest.requireActual (should deny)
run_test "Deny jest.requireActual" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/actual.test.ts", "content": "const actual = jest.requireActual(\"./module\");"}}' \
    "deny" \
    "jest.requireActual() or jest.requireMock() found" \
    ""

# Test 28: toHaveBeenCalled matcher (should deny)
run_test "Deny toHaveBeenCalled matcher" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/matcher.test.ts", "content": "expect(mockFunction).toHaveBeenCalled();\nexpect(mockFunction).toHaveBeenCalledWith(\"arg\");"}}' \
    "deny" \
    "Mock verification matchers found" \
    ""

# Test 29: .test.jsx file (should check)
run_test "Check .test.jsx files" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/component.test.jsx", "content": "const onClick = jest.fn();\nrender(<Button onClick={onClick} />);"}}' \
    "deny" \
    "jest.fn() mock function found" \
    ""

# Test 30: .spec.jsx file (should check)
run_test "Check .spec.jsx files" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/component.spec.jsx", "content": "jest.spyOn(React, \"useEffect\");"}}' \
    "deny" \
    "jest.spyOn() spy found" \
    ""

# Test 31: mockImplementation (should deny)
run_test "Deny mockImplementation" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/impl.test.ts", "content": "const fn = jest.fn();\nfn.mockImplementation(() => 42);"}}' \
    "deny" \
    "Mock configuration methods found" \
    ""

# Test 32: mockRejectedValue (should deny)
run_test "Deny mockRejectedValue" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/reject.test.ts", "content": "const fn = jest.fn();\nfn.mockRejectedValue(new Error(\"fail\"));"}}' \
    "deny" \
    "Mock configuration methods found" \
    ""

# Test 33: No file path but has mocks (should check)
run_test "Check content when no file path provided" \
    '{"tool_name": "Write", "tool_input": {"content": "const mock = jest.fn();"}}' \
    "deny" \
    "jest.fn() mock function found" \
    ""

# Test 34: Import mocked from jest-mock (should deny)
run_test "Deny import from jest-mock" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/import.test.ts", "content": "import { mocked } from \"jest-mock\";"}}' \
    "deny" \
    "Import from jest-mock package detected" \
    ""

# Test 35: Import mock utilities from @jest/globals (should deny)
run_test "Deny import mock utilities from @jest/globals" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/import.test.ts", "content": "import { fn, spyOn, mocked } from \"@jest/globals\";"}}' \
    "deny" \
    "Import of Jest mock utilities detected" \
    ""

# Test 36: Import Mock type (should deny)
run_test "Deny import Mock type" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/import.test.ts", "content": "import type { Mock, Mocked } from \"jest\";"}}' \
    "deny" \
    "Import of Jest mock types detected" \
    ""

# Test 37: Clean imports from @jest/globals (should allow)
run_test "Allow clean imports from @jest/globals" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/clean.test.ts", "content": "import { describe, it, expect } from \"@jest/globals\";"}}' \
    "allow" \
    "No Jest mocking patterns detected" \
    ""

# Test 38: Performance test with large content
echo -e "\n${YELLOW}Testing performance with large content...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
large_content=""
for i in {1..1000}; do
    large_content="${large_content}const test$i = 'value$i';\n"
done
large_content="${large_content}const mock = jest.fn();"

start_time=$(date +%s%N)
output=$(echo "{\"tool_name\": \"Write\", \"tool_input\": {\"file_path\": \"/tmp/large.test.ts\", \"content\": \"$large_content\"}}" | "$HOOK_SCRIPT" 2>/dev/null)
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

decision=$(echo "$output" | jq -r '.hookSpecificOutput.permissionDecision' 2>/dev/null)
if [ "$decision" = "deny" ] && [ $duration -lt 5000 ]; then # Less than 5 seconds
    echo -e "${GREEN}✓${NC} Performance test passed (${duration}ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Performance test failed (${duration}ms, decision: $decision)"
fi

# Test 39: Verify stderr output for violations
echo -e "\n${YELLOW}Testing stderr output...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
stderr_output=$(echo '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.test.ts", "content": "jest.fn()"}}' | "$HOOK_SCRIPT" 2>&1 >/dev/null)
if echo "$stderr_output" | grep -q "Jest mocking detected:" && echo "$stderr_output" | grep -q "jest.fn() mock function found"; then
    echo -e "${GREEN}✓${NC} Stderr output contains violation details"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Stderr output missing violation details"
    if [ -n "$DEBUG" ]; then
        echo "  Stderr output:"
        echo "$stderr_output" | sed 's/^/    /'
    fi
fi

# Summary
echo
echo "=============================================================="
echo "Tests run: $TESTS_RUN"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $((TESTS_RUN - TESTS_PASSED))"

if [ "$TESTS_PASSED" -eq "$TESTS_RUN" ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    echo "Run with DEBUG=1 to see detailed output"
    exit 1
fi