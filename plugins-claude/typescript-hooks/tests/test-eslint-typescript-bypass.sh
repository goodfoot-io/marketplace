#!/bin/bash

# Test suite for claude-pretooluse-hook-eslint-typescript-bypass utility

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
HOOK_SCRIPT="$SCRIPT_DIR/../hooks/eslint-typescript-bypass"

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

echo "Running claude-pretooluse-hook-eslint-typescript-bypass tests..."
echo "=============================================================="

# Test 1: Clean Write tool usage (should allow)
run_test "Allow clean Write tool usage" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "export function add(a: number, b: number): number {\\n  return a + b;\\n}"}}' \
    "allow" \
    "No ESLint/TypeScript rule bypasses detected" \
    ""

# Test 2: ESLint disable-next-line (should deny)
run_test "Deny eslint-disable-next-line" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "// eslint-disable-next-line no-console\\nconsole.log(\"debug\");"}}' \
    "deny" \
    "ESLint disable comment found" \
    ""

# Test 3: ESLint disable-line (should deny)
run_test "Deny eslint-disable-line" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "console.log(\"debug\"); // eslint-disable-line no-console"}}' \
    "deny" \
    "ESLint disable comment found" \
    ""

# Test 4: ESLint disable block (should deny)
run_test "Deny eslint-disable block" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "/* eslint-disable no-console */\\nconsole.log(\"debug\");\\n/* eslint-enable no-console */"}}' \
    "deny" \
    "ESLint block disable comment found" \
    ""

# Test 5: @ts-ignore (should deny)
run_test "Deny @ts-ignore" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "// @ts-ignore\\nconst x: string = 42;"}}' \
    "deny" \
    "TypeScript @ts-ignore comment found" \
    ""

# Test 6: @ts-expect-error (should deny)
run_test "Deny @ts-expect-error" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "// @ts-expect-error\\nconst x: string = 42;"}}' \
    "deny" \
    "TypeScript @ts-expect-error comment found" \
    ""

# Test 7: @ts-nocheck (should deny)
run_test "Deny @ts-nocheck" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "// @ts-nocheck\\nexport const test = true;"}}' \
    "deny" \
    "TypeScript @ts-nocheck comment found" \
    ""

# Test 8: as any casting (should deny)
run_test "Deny 'as any' casting" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "const data = response as any;"}}' \
    "deny" \
    "TypeScript 'as any' type casting found" \
    ""

# Test 9: Edit tool with violations (should deny)
run_test "Deny Edit tool with @ts-ignore" \
    '{"tool_name": "Edit", "tool_input": {"file_path": "/tmp/test.ts", "old_string": "const x = 42;", "new_string": "// @ts-ignore\\nconst x: string = 42;"}}' \
    "deny" \
    "TypeScript @ts-ignore comment found" \
    ""

# Test 10: MultiEdit tool with violations (should deny)
run_test "Deny MultiEdit tool with violations" \
    '{"tool_name": "MultiEdit", "tool_input": {"file_path": "/tmp/test.ts", "edits": [{"old_string": "x", "new_string": "// eslint-disable-next-line\\nx"}]}}' \
    "deny" \
    "ESLint disable comment found" \
    ""

# Test 11: MultiEdit tool with multiple violations (should deny)
run_test "Deny MultiEdit with multiple violations" \
    '{"tool_name": "MultiEdit", "tool_input": {"file_path": "/tmp/test.ts", "edits": [{"old_string": "a", "new_string": "// @ts-ignore\\na"}, {"old_string": "b", "new_string": "b as any"}]}}' \
    "deny" \
    "TypeScript @ts-ignore comment found" \
    ""

# Test 12: Clean Edit tool usage (should allow)
run_test "Allow clean Edit tool usage" \
    '{"tool_name": "Edit", "tool_input": {"file_path": "/tmp/test.ts", "old_string": "const x = 42;", "new_string": "const x: number = 42;"}}' \
    "allow" \
    "No ESLint/TypeScript rule bypasses detected" \
    ""

# Test 13: Clean MultiEdit tool usage (should allow)
run_test "Allow clean MultiEdit tool usage" \
    '{"tool_name": "MultiEdit", "tool_input": {"file_path": "/tmp/test.ts", "edits": [{"old_string": "x", "new_string": "y"}, {"old_string": "a", "new_string": "b"}]}}' \
    "allow" \
    "No ESLint/TypeScript rule bypasses detected" \
    ""

# Test 14: Invalid JSON input (should deny)
run_test "Handle invalid JSON input" \
    'not valid json' \
    "deny" \
    "Invalid JSON input provided" \
    ""

# Test 15: Missing tool_name (should allow - no content to check)
run_test "Handle missing tool_name" \
    '{"tool_input": {"content": "test"}}' \
    "allow" \
    "No content to check" \
    ""

# Test 16: Unsupported tool (should allow)
run_test "Allow unsupported tool" \
    '{"tool_name": "UnsupportedTool", "tool_input": {"content": "// @ts-ignore\ntest"}}' \
    "allow" \
    "No content to check" \
    ""

# Test 17: Empty content (should allow)
run_test "Allow empty content" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": ""}}' \
    "allow" \
    "No content to check" \
    ""

# Test 18: Content with false positives (should allow)
run_test "Allow content with false positives" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "// This is a comment about ts-ignore but not actually using it\nconst message = \"eslint-disable-next-line is mentioned here\";"}}' \
    "allow" \
    "No ESLint/TypeScript rule bypasses detected" \
    ""

# Test 19: Mixed violations (should deny and list all)
run_test "Deny mixed violations" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "// @ts-ignore\nconst x = data as any;\n// eslint-disable-next-line\nconsole.log(x);"}}' \
    "deny" \
    "TypeScript @ts-ignore comment found" \
    ""

# Test 20: ESLint disable with whitespace variations (should deny)
run_test "Deny eslint-disable with whitespace" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "//  eslint-disable-next-line   no-console\nconsole.log(\"test\");"}}' \
    "deny" \
    "ESLint disable comment found" \
    ""

# Test 21: TypeScript comments with whitespace variations (should deny)
run_test "Deny @ts-ignore with whitespace" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "//  @ts-ignore  \nconst x: string = 42;"}}' \
    "deny" \
    "TypeScript @ts-ignore comment found" \
    ""

# Test 22: as any with whitespace variations (should deny)
run_test "Deny 'as any' with whitespace" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "const data = response as  any ;"}}' \
    "deny" \
    "TypeScript 'as any' type casting found" \
    ""

# Test 23: Complex case with nested violations (should deny)
run_test "Deny complex nested violations" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "function complexFunction() {\n  /* eslint-disable no-any */\n  // @ts-expect-error\n  const result = (getData() as any).prop;\n  return result;\n}"}}' \
    "deny" \
    "ESLint block disable comment found" \
    ""

# Test 24: Check that reason contains helpful alternatives
run_test "Check helpful alternatives in reason" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.ts", "content": "// @ts-ignore\ntest"}}' \
    "deny" \
    "Fix the underlying type or linting issue" \
    ""

# Test 25: File filtering - should allow bypasses in non-JS/TS files
run_test "Allow bypasses in markdown files" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/README.md", "content": "# Example\\n// @ts-ignore\\nThis is just documentation with code examples."}}' \
    "allow" \
    "No content to check" \
    ""

# Test 26: File filtering - should allow bypasses in text files
run_test "Allow bypasses in text files" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/notes.txt", "content": "Notes about eslint-disable-next-line usage"}}' \
    "allow" \
    "No content to check" \
    ""

# Test 27: File filtering - should allow bypasses in JSON files
run_test "Allow bypasses in JSON files" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/config.json", "content": "{\\n  \\\"comment\\\": \\\"// eslint-disable-next-line is mentioned here\\\"\\n}"}}' \
    "allow" \
    "No content to check" \
    ""

# Test 28: File filtering - should still check .js files
run_test "Still check .js files" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/script.js", "content": "// @ts-ignore\\nconst x = 42;"}}' \
    "deny" \
    "TypeScript @ts-ignore comment found" \
    ""

# Test 29: File filtering - should still check .jsx files
run_test "Still check .jsx files" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/component.jsx", "content": "// eslint-disable-next-line\\nconst Component = () => <div />;"}}' \
    "deny" \
    "ESLint disable comment found" \
    ""

# Test 30: File filtering - should still check .mjs files
run_test "Still check .mjs files" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/module.mjs", "content": "const data = response as any;"}}' \
    "deny" \
    "TypeScript 'as any' type casting found" \
    ""

# Test 31: File filtering - should still check when no file_path provided
run_test "Still check when no file_path provided" \
    '{"tool_name": "Write", "tool_input": {"content": "// @ts-ignore\\ntest content"}}' \
    "deny" \
    "TypeScript @ts-ignore comment found" \
    ""

# Test 32: Verify stderr output for violations
echo -e "\n${YELLOW}Testing stderr output...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
stderr_output=$(echo '{"tool_name": "Write", "tool_input": {"content": "// @ts-ignore\ntest"}}' | "$HOOK_SCRIPT" 2>&1 >/dev/null)
if echo "$stderr_output" | grep -q "Rule bypass detected:" && echo "$stderr_output" | grep -q "TypeScript @ts-ignore comment found"; then
    echo -e "${GREEN}✓${NC} Stderr output contains violation details"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Stderr output missing violation details"
    if [ -n "$DEBUG" ]; then
        echo "  Stderr output:"
        echo "$stderr_output" | sed 's/^/    /'
    fi
fi

# Test 26: Performance test with large content
echo -e "\n${YELLOW}Testing performance with large content...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
large_content=""
for i in {1..1000}; do
    large_content="${large_content}const var$i = 'value$i';\n"
done
large_content="${large_content}// @ts-ignore\nconst final = 'test';"

start_time=$(date +%s%N)
output=$(echo "{\"tool_name\": \"Write\", \"tool_input\": {\"content\": \"$large_content\"}}" | "$HOOK_SCRIPT" 2>/dev/null)
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

decision=$(echo "$output" | jq -r '.hookSpecificOutput.permissionDecision' 2>/dev/null)
if [ "$decision" = "deny" ] && [ $duration -lt 5000 ]; then # Less than 5 seconds
    echo -e "${GREEN}✓${NC} Performance test passed (${duration}ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Performance test failed (${duration}ms, decision: $decision)"
fi

# Tests complete - jq dependency test removed as jq is always available

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