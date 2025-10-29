#!/bin/bash

# Test suite for get-prompt-var and set-prompt-var utilities

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Set CLAUDE_PID for testing
export CLAUDE_PID=$$
export CLAUDE_TEST_MODE=1

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SET_VAR="$SCRIPT_DIR/../set-prompt-var"
GET_VAR="$SCRIPT_DIR/../get-prompt-var"

# Function to run a basic test
run_test() {
    local test_name="$1"
    local key="$2"
    local value="$3"
    local expected_output="$4"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Clean up before test
    rm -f /tmp/prompt_var_${CLAUDE_PID}_${key}.sh
    rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_${key}_*

    # Run set-prompt-var
    local set_output=$("$SET_VAR" "$key" $value 2>/dev/null)
    local set_exit_code=$?

    # Check set output
    if [[ "$set_exit_code" -ne 0 ]] || [[ "$set_output" != "$expected_output" ]]; then
        echo -e "${RED}✗${NC} $test_name - set failed"
        echo "  Expected: $expected_output (exit 0)"
        echo "  Actual:   $set_output (exit $set_exit_code)"
        return
    fi

    # Run get-prompt-var
    local get_output=$("$GET_VAR" "$key" 2>/dev/null)
    local get_exit_code=$?

    # Check results
    if [[ "$get_exit_code" -eq 0 ]] && [[ "$get_output" == "$expected_output" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: $expected_output (exit 0)"
        echo "  Actual:   $get_output (exit $get_exit_code)"
    fi
}

# Test concurrent set and get
test_concurrent() {
    local test_name="$1"
    local key="$2"
    local value="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Clean up before test
    rm -f /tmp/prompt_var_${CLAUDE_PID}_${key}.sh
    rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_${key}_*

    # Run set-prompt-var in background
    "$SET_VAR" "$key" $value > /dev/null 2>&1 &
    local set_pid=$!

    # Small delay to ensure set starts first
    sleep 0.05

    # Run get-prompt-var
    local get_output=$("$GET_VAR" "$key" 2>/dev/null)
    local get_exit_code=$?

    # Wait for set process to complete
    wait $set_pid

    # Check results
    if [[ "$get_exit_code" -eq 0 ]] && [[ "$get_output" == "$value" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: $value (exit 0)"
        echo "  Actual:   $get_output (exit $get_exit_code)"
    fi
}

# Test timeout behavior
test_timeout() {
    local test_name="$1"
    local key="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Clean up
    rm -f /tmp/prompt_var_${CLAUDE_PID}_${key}.sh
    rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_${key}_*

    # Don't run set-prompt-var, just get
    local start_time=$(date +%s)
    local stderr_file="/tmp/test_stderr_$$"
    "$GET_VAR" "$key" 2>"$stderr_file"
    local exit_code=$?
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"
    local end_time=$(date +%s)

    # Calculate elapsed time
    local elapsed=$((end_time - start_time))

    # Check if it timed out correctly (should be ~3 seconds)
    if [[ "$exit_code" -eq 1 ]] && [[ "$stderr_output" == *"Timeout"* ]] && [[ "$elapsed" -ge 2 ]] && [[ "$elapsed" -le 4 ]]; then
        echo -e "${GREEN}✓${NC} $test_name (waited ${elapsed}s)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: timeout error after ~3s (exit 1)"
        echo "  Actual:   $stderr_output (exit $exit_code, ${elapsed}s)"
    fi
}

# Test immediate availability
test_immediate() {
    local test_name="$1"
    local key="$2"
    local value="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Clean up
    rm -f /tmp/prompt_var_${CLAUDE_PID}_${key}.sh
    rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_${key}_*

    # Run set-prompt-var first (not in background)
    "$SET_VAR" "$key" $value > /dev/null 2>&1

    # Now run get-prompt-var - should return immediately
    # Use nanoseconds for more precise timing
    local start_time=$(date +%s%N)
    local output=$("$GET_VAR" "$key" 2>/dev/null)
    local exit_code=$?
    local end_time=$(date +%s%N)

    # Calculate elapsed time in milliseconds
    local elapsed_ns=$((end_time - start_time))
    local elapsed_ms=$((elapsed_ns / 1000000))

    # Should complete within 100ms for immediate availability
    if [[ "$exit_code" -eq 0 ]] && [[ "$output" == "$value" ]] && [[ "$elapsed_ms" -lt 100 ]]; then
        echo -e "${GREEN}✓${NC} $test_name (${elapsed_ms}ms)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        if [[ "$exit_code" -ne 0 ]]; then
            echo "  Exit code: $exit_code"
        fi
        if [[ "$output" != "$value" ]]; then
            echo "  Output mismatch: $output (expected: $value)"
        fi
        if [[ "$elapsed_ms" -ge 100 ]]; then
            echo "  Too slow: ${elapsed_ms}ms (expected < 100ms)"
        fi
    fi
}

# Test invalid key names
test_invalid_key() {
    local test_name="$1"
    local invalid_key="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Test set-prompt-var with invalid key
    local stderr_file="/tmp/test_stderr_$$"
    "$SET_VAR" "$invalid_key" "test value" 2>"$stderr_file"
    local set_exit_code=$?
    local set_stderr=$(cat "$stderr_file")

    # Test get-prompt-var with invalid key
    "$GET_VAR" "$invalid_key" 2>"$stderr_file"
    local get_exit_code=$?
    local get_stderr=$(cat "$stderr_file")
    rm -f "$stderr_file"

    if [[ "$set_exit_code" -eq 1 ]] && [[ "$set_stderr" == *"must contain only alphanumeric"* ]] &&
       [[ "$get_exit_code" -eq 1 ]] && [[ "$get_stderr" == *"must contain only alphanumeric"* ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: both commands to fail with alphanumeric error"
        echo "  set exit: $set_exit_code, get exit: $get_exit_code"
    fi
}

# Test missing key argument
test_missing_key() {
    local test_name="$1"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Test set-prompt-var without key
    local stderr_file="/tmp/test_stderr_$$"
    "$SET_VAR" 2>"$stderr_file"
    local set_exit_code=$?
    local set_stderr=$(cat "$stderr_file")

    # Test get-prompt-var without key
    "$GET_VAR" 2>"$stderr_file"
    local get_exit_code=$?
    local get_stderr=$(cat "$stderr_file")
    rm -f "$stderr_file"

    if [[ "$set_exit_code" -eq 1 ]] && [[ "$set_stderr" == *"Key name required"* ]] &&
       [[ "$get_exit_code" -eq 1 ]] && [[ "$get_stderr" == *"Key name required"* ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: both commands to fail with 'Key name required'"
        echo "  set exit: $set_exit_code, get exit: $get_exit_code"
    fi
}

# Test multiple keys
test_multiple_keys() {
    local test_name="$1"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Clean up
    rm -f /tmp/prompt_var_${CLAUDE_PID}_*.sh
    rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_*

    # Set multiple keys
    "$SET_VAR" "key1" "value1" > /dev/null 2>&1
    "$SET_VAR" "key2" "value2" > /dev/null 2>&1
    "$SET_VAR" "key3" "value3" > /dev/null 2>&1

    # Get all keys
    local val1=$("$GET_VAR" "key1" 2>/dev/null)
    local val2=$("$GET_VAR" "key2" 2>/dev/null)
    local val3=$("$GET_VAR" "key3" 2>/dev/null)

    if [[ "$val1" == "value1" ]] && [[ "$val2" == "value2" ]] && [[ "$val3" == "value3" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  key1: $val1 (expected: value1)"
        echo "  key2: $val2 (expected: value2)"
        echo "  key3: $val3 (expected: value3)"
    fi
}

# Test overwriting values
test_overwrite() {
    local test_name="$1"
    local key="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Clean up
    rm -f /tmp/prompt_var_${CLAUDE_PID}_${key}.sh
    rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_${key}_*

    # Set initial value
    "$SET_VAR" "$key" "initial value" > /dev/null 2>&1

    # Overwrite with new value
    "$SET_VAR" "$key" "new value" > /dev/null 2>&1

    # Get the value
    local output=$("$GET_VAR" "$key" 2>/dev/null)

    if [[ "$output" == "new value" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: new value"
        echo "  Actual:   $output"
    fi
}

# Test shell escaping
test_escaping() {
    local test_name="$1"
    local key="$2"
    local value="$3"
    local expected="$4"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Clean up
    rm -f /tmp/prompt_var_${CLAUDE_PID}_${key}.sh
    rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_${key}_*

    # Set value with special characters
    "$SET_VAR" "$key" "$value" > /dev/null 2>&1

    # Get the value
    local output=$("$GET_VAR" "$key" 2>/dev/null)

    if [[ "$output" == "$expected" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))

        # Verify no command injection by checking if file exists
        if [ ! -f /tmp/test_injection_marker ]; then
            echo -e "  ${GREEN}✓${NC} No command injection"
        else
            echo -e "  ${RED}✗${NC} COMMAND INJECTION DETECTED!"
            rm -f /tmp/test_injection_marker
        fi
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: $expected"
        echo "  Actual:   $output"
    fi
}

# Test missing var file
test_missing_var_file() {
    local test_name="$1"
    local key="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Clean up
    rm -f /tmp/prompt_var_${CLAUDE_PID}_${key}.sh
    rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_${key}_*

    # Create sync file but no var file
    local timestamp=$(date +%s)
    touch "/tmp/prompt_var_sync_${CLAUDE_PID}_${key}_${timestamp}"

    # Run get-prompt-var
    local stderr_file="/tmp/test_stderr_$$"
    "$GET_VAR" "$key" 2>"$stderr_file"
    local exit_code=$?
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"

    if [[ "$exit_code" -eq 2 ]] && [[ "$stderr_output" == *"value file missing"* ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: value file missing error (exit 2)"
        echo "  Actual:   $stderr_output (exit $exit_code)"
    fi
}

# Test cleanup behavior
test_cleanup() {
    local test_name="$1"
    local key="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Create old sync files for this key
    local old_timestamp=$(($(date +%s) - 15))
    touch "/tmp/prompt_var_sync_${CLAUDE_PID}_${key}_${old_timestamp}"

    # Create recent sync file for this key
    local recent_timestamp=$(($(date +%s) - 5))
    touch "/tmp/prompt_var_sync_${CLAUDE_PID}_${key}_${recent_timestamp}"

    # Create sync file for different key (should not be cleaned)
    local other_key="otherkey"
    touch "/tmp/prompt_var_sync_${CLAUDE_PID}_${other_key}_${old_timestamp}"

    # Run set-prompt-var
    "$SET_VAR" "$key" "test cleanup" > /dev/null 2>&1

    # Check if only the key-specific old files were cleaned up
    local new_timestamp=$(date +%s)
    if [ ! -f "/tmp/prompt_var_sync_${CLAUDE_PID}_${key}_${old_timestamp}" ] &&
       [ ! -f "/tmp/prompt_var_sync_${CLAUDE_PID}_${key}_${recent_timestamp}" ] &&
       [ -f "/tmp/prompt_var_sync_${CLAUDE_PID}_${key}_${new_timestamp}" ] &&
       [ -f "/tmp/prompt_var_sync_${CLAUDE_PID}_${other_key}_${old_timestamp}" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name - cleanup failed"
        if [ -f "/tmp/prompt_var_sync_${CLAUDE_PID}_${key}_${old_timestamp}" ]; then
            echo "  Old file still exists for key"
        fi
        if [ -f "/tmp/prompt_var_sync_${CLAUDE_PID}_${key}_${recent_timestamp}" ]; then
            echo "  Recent file still exists for key"
        fi
        if [ ! -f "/tmp/prompt_var_sync_${CLAUDE_PID}_${key}_${new_timestamp}" ]; then
            echo "  New sync file not created for key"
        fi
        if [ ! -f "/tmp/prompt_var_sync_${CLAUDE_PID}_${other_key}_${old_timestamp}" ]; then
            echo "  Other key's sync file was incorrectly deleted"
        fi
    fi

    # Clean up other key file
    rm -f "/tmp/prompt_var_sync_${CLAUDE_PID}_${other_key}_${old_timestamp}"
}

echo "Running get-prompt-var and set-prompt-var tests..."
echo "=================================================="

# Basic functionality tests
run_test "Simple value" "mykey" "Hello World" "Hello World"
run_test "Empty value" "emptykey" "" ""
run_test "Value with spaces" "spacekey" "test with spaces" "test with spaces"
run_test "Value with special chars" "specialkey" "test@#$%^&*()" "test@#$%^&*()"
run_test "Path value" "pathkey" "/path/to/file" "/path/to/file"
run_test "Numeric value" "numkey" "12345" "12345"
run_test "Underscore in key" "my_key_name" "value" "value"
run_test "Alphanumeric key" "key123ABC" "test" "test"

# Shell escaping tests
test_escaping "Value with quotes" "quotekey" "test \"quoted\" string" "test \"quoted\" string"
test_escaping "Value with single quotes" "squotekey" "test 'single' quotes" "test 'single' quotes"
test_escaping "Value with dollar signs" "dollarkey" "test \$HOME \${VAR}" "test \$HOME \${VAR}"
test_escaping "Value with backticks" "btickkey" "test \`echo injected\` code" "test \`echo injected\` code"
test_escaping "Value with backslashes" "bslashkey" "test\\with\\backslashes" "test\\with\\backslashes"
test_escaping "Complex escaping" "complexkey" "rm -rf /tmp/\`whoami\`/\$HOME/\"important\"" "rm -rf /tmp/\`whoami\`/\$HOME/\"important\""

# Security test - verify no command injection
test_escaping "Security test" "seckey" "\`touch /tmp/test_injection_marker\`" "\`touch /tmp/test_injection_marker\`"

# Test with newlines (special handling needed)
TESTS_RUN=$((TESTS_RUN + 1))
rm -f /tmp/prompt_var_${CLAUDE_PID}_nlkey.sh
rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_nlkey_*
"$SET_VAR" "nlkey" "test
with
newlines" > /dev/null 2>&1
output=$("$GET_VAR" "nlkey" 2>/dev/null)
if [[ "$output" == "test
with
newlines" ]]; then
    echo -e "${GREEN}✓${NC} Value with newlines"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Value with newlines"
fi

# Test with tabs
TESTS_RUN=$((TESTS_RUN + 1))
rm -f /tmp/prompt_var_${CLAUDE_PID}_tabkey.sh
rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_tabkey_*
"$SET_VAR" "tabkey" "test	with	tabs" > /dev/null 2>&1
output=$("$GET_VAR" "tabkey" 2>/dev/null)
if [[ "$output" == "test	with	tabs" ]]; then
    echo -e "${GREEN}✓${NC} Value with tabs"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Value with tabs"
fi

# Invalid key tests
test_invalid_key "Invalid key with spaces" "my key"
test_invalid_key "Invalid key with dash" "my-key"
test_invalid_key "Invalid key with dot" "my.key"
test_invalid_key "Invalid key with slash" "my/key"

# Missing key test
test_missing_key "Missing key argument"

# Concurrent access tests
test_concurrent "Concurrent set and get" "concurrentkey" "concurrent value"

# Immediate availability test
test_immediate "Immediate availability" "immediatekey" "already written"

# Timeout test
test_timeout "Timeout after 3 seconds" "timeoutkey"

# Multiple keys test
test_multiple_keys "Multiple keys coexist"

# Overwrite test
test_overwrite "Overwrite existing value" "overwritekey"

# Missing var file test
test_missing_var_file "Missing var file error" "missingkey"

# Cleanup test
test_cleanup "Key-specific cleanup" "cleanupkey"

# Test with long values
TESTS_RUN=$((TESTS_RUN + 1))
long_value=$(printf 'x%.0s' {1..1000})
rm -f /tmp/prompt_var_${CLAUDE_PID}_longkey.sh
rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_longkey_*
"$SET_VAR" "longkey" "$long_value" > /dev/null 2>&1
output=$("$GET_VAR" "longkey" 2>/dev/null)
if [[ "$output" == "$long_value" ]]; then
    echo -e "${GREEN}✓${NC} Long value (1000 chars)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Long value (1000 chars)"
fi

# Test with delayed set
echo -e "\n${GREEN}Testing with delays...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

rm -f /tmp/prompt_var_${CLAUDE_PID}_delaykey.sh
rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_delaykey_*

# Start set with delay
(sleep 0.3 && "$SET_VAR" "delaykey" "delayed value" > /dev/null 2>&1) &
set_pid=$!

# Get should succeed within timeout
output=$("$GET_VAR" "delaykey" 2>/dev/null)
exit_code=$?

# Wait for set process to complete
wait $set_pid

if [[ "$exit_code" -eq 0 ]] && [[ "$output" == "delayed value" ]]; then
    echo -e "${GREEN}✓${NC} Delayed set test"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Delayed set test"
    echo "  Expected: 'delayed value' (exit 0)"
    echo "  Actual:   '$output' (exit $exit_code)"
fi

# Clean up after all tests
rm -f /tmp/prompt_var_${CLAUDE_PID}_*.sh
rm -f /tmp/prompt_var_sync_${CLAUDE_PID}_*

# Summary
echo
echo "=================================================="
echo "Tests run: $TESTS_RUN"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $((TESTS_RUN - TESTS_PASSED))"

if [ "$TESTS_PASSED" -eq "$TESTS_RUN" ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    exit 1
fi