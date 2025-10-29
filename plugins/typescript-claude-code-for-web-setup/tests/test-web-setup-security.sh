#!/bin/bash

# Security and validation test suite for web-setup hook

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOOK_SCRIPT="$SCRIPT_DIR/../hooks/web-setup"

# Create a temporary directory for tests
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

# Function to run a test
run_test() {
    local test_name="$1"
    local test_function="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Create a clean test environment
    local test_env="$TEST_DIR/test_$TESTS_RUN"
    mkdir -p "$test_env"

    # Run the test function
    if $test_function "$test_env"; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        if [ -n "$DEBUG" ]; then
            echo "  Test environment: $test_env"
        fi
    fi
}

# Helper to create minimal node mock
create_mock_node() {
    local test_dir="$1"
    cat > "$test_dir/node" << 'EOF'
#!/bin/bash
# Minimal node mock that can parse JSON
if [[ "$*" == *"JSON.parse"* ]]; then
    # Simulate JSON.parse validation
    if grep -q "^{" ./package.json 2>/dev/null; then
        eval "$2"
    else
        echo "SyntaxError: Unexpected token" >&2
        exit 1
    fi
else
    echo ""
fi
EOF
    chmod +x "$test_dir/node"
}

# Test: Invalid JSON syntax should be caught
test_invalid_json_syntax() {
    local test_dir="$1"
    cd "$test_dir"

    # Invalid JSON - trailing comma
    cat > package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
}
EOF

    export CLAUDE_CODE_REMOTE=true
    export PATH="$test_dir:$PATH"

    local output
    local exit_code
    set +e
    output=$("$HOOK_SCRIPT" 2>&1)
    exit_code=$?
    set -e

    if [ $exit_code -ne 0 ] && echo "$output" | grep -q "invalid JSON"; then
        return 0
    else
        echo "  Expected validation error for invalid JSON"
        return 1
    fi
}

# Test: Non-object package.json should be rejected
test_non_object_package_json() {
    local test_dir="$1"
    cd "$test_dir"

    echo '"just a string"' > package.json

    export CLAUDE_CODE_REMOTE=true

    local output
    local exit_code
    set +e
    output=$("$HOOK_SCRIPT" 2>&1)
    exit_code=$?
    set -e

    if [ $exit_code -ne 0 ] && echo "$output" | grep -q "must be a JSON object"; then
        return 0
    else
        echo "  Expected error for non-object package.json"
        return 1
    fi
}

# Test: Invalid packageManager format should show warning
test_invalid_package_manager_format() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project",
  "packageManager": "invalid-format"
}
EOF

    export CLAUDE_CODE_REMOTE=true

    local output
    output=$("$HOOK_SCRIPT" 2>&1 || true)

    if echo "$output" | grep -q "Warning.*Invalid packageManager format"; then
        return 0
    else
        echo "  Expected warning for invalid packageManager format"
        return 1
    fi
}

# Test: Missing Node.js should be detected
test_missing_node() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project"
}
EOF

    # Create a mock node that doesn't exist
    # Set PATH to only include test_dir with no node
    export CLAUDE_CODE_REMOTE=true

    # Use a subshell with restricted PATH
    local output
    local exit_code
    set +e
    output=$(PATH="$test_dir" "$HOOK_SCRIPT" 2>&1)
    exit_code=$?
    set -e

    # Should fail with either our error message or bash's command not found
    if [ $exit_code -ne 0 ] && (echo "$output" | /usr/bin/grep -q "Node.js is required" || [ $exit_code -eq 127 ]); then
        return 0
    else
        echo "  Expected error about missing Node.js (exit=$exit_code)"
        return 1
    fi
}

# Test: CLAUDE_CODE_REMOTE edge cases
test_claude_code_remote_edge_cases() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project"
}
EOF

    # Test with empty string
    local output1=$(CLAUDE_CODE_REMOTE="" "$HOOK_SCRIPT" 2>&1)
    if [ -n "$output1" ]; then
        echo "  Expected silent exit for CLAUDE_CODE_REMOTE=''"
        return 1
    fi

    # Test with "false"
    local output2=$(CLAUDE_CODE_REMOTE="false" "$HOOK_SCRIPT" 2>&1)
    if [ -n "$output2" ]; then
        echo "  Expected silent exit for CLAUDE_CODE_REMOTE='false'"
        return 1
    fi

    # Test with "0"
    local output3=$(CLAUDE_CODE_REMOTE="0" "$HOOK_SCRIPT" 2>&1)
    if [ -n "$output3" ]; then
        echo "  Expected silent exit for CLAUDE_CODE_REMOTE='0'"
        return 1
    fi

    return 0
}

# Test: Validation catches command injection attempts
test_command_injection_prevention() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project",
  "packageManager": "yarn@4.9.2; echo INJECTED"
}
EOF

    export CLAUDE_CODE_REMOTE=true

    local output
    output=$("$HOOK_SCRIPT" 2>&1 || true)

    # Should either reject with warning or not execute the injection
    if echo "$output" | grep -q "Warning.*Invalid packageManager format" || ! echo "$output" | grep -q "INJECTED"; then
        return 0
    else
        echo "  SECURITY ISSUE: Command injection may be possible"
        return 1
    fi
}

# Test: Empty package.json is handled
test_empty_package_json() {
    local test_dir="$1"
    cd "$test_dir"

    echo '{}' > package.json

    # Create minimal mocks
    cat > node << 'EOF'
#!/bin/bash
if [[ "$*" == *"JSON.parse"* ]]; then
    exit 0
else
    echo ""
fi
EOF
    chmod +x node

    cat > npm << 'EOF'
#!/bin/bash
exit 0
EOF
    chmod +x npm

    export CLAUDE_CODE_REMOTE=true
    export PATH="$test_dir:$PATH"

    local output
    output=$("$HOOK_SCRIPT" 2>&1 || true)

    # Should handle gracefully and default to npm
    if echo "$output" | grep -q "Detected package manager: npm"; then
        return 0
    else
        echo "  Expected successful handling of empty package.json"
        return 1
    fi
}

# Test: packageManager with pre-release version is accepted
test_prerelease_version_format() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project",
  "packageManager": "yarn@4.0.0-rc.1"
}
EOF

    # Create minimal mocks
    cat > node << 'EOF'
#!/bin/bash
if [[ "$*" == *"JSON.parse"* ]]; then
    exit 0
elif [[ "$*" == *"packageManager"* ]] && [[ "$*" == *"match"* ]]; then
    echo "yarn"
else
    echo ""
fi
EOF
    chmod +x node

    cat > yarn << 'EOF'
#!/bin/bash
exit 0
EOF
    chmod +x yarn

    cat > corepack << 'EOF'
#!/bin/bash
exit 0
EOF
    chmod +x corepack

    export CLAUDE_CODE_REMOTE=true
    export PATH="$test_dir:$PATH"
    export HOME="$test_dir/home"
    mkdir -p "$HOME"

    local output
    output=$("$HOOK_SCRIPT" 2>&1 || true)

    # Should not show warning for valid pre-release format
    if ! echo "$output" | grep -q "Warning.*Invalid packageManager format"; then
        return 0
    else
        echo "  Pre-release version format should be valid"
        return 1
    fi
}

echo "Running security and validation tests..."
echo "=============================================================="

# Security tests
run_test "Should detect invalid JSON syntax" test_invalid_json_syntax
run_test "Should reject non-object package.json" test_non_object_package_json
run_test "Should warn on invalid packageManager format" test_invalid_package_manager_format
run_test "Should prevent command injection" test_command_injection_prevention

# Prerequisite tests
run_test "Should detect missing Node.js" test_missing_node

# Environment variable tests
run_test "Should handle CLAUDE_CODE_REMOTE edge cases" test_claude_code_remote_edge_cases

# Format validation tests
run_test "Should handle empty package.json" test_empty_package_json
run_test "Should accept pre-release version format" test_prerelease_version_format

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
