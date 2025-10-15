#!/bin/bash

# Test suite for wait-for-arguments utility

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
WRITE_ARGS="$SCRIPT_DIR/../write-arguments"
WAIT_ARGS="$SCRIPT_DIR/../wait-for-arguments"

# Function to run a basic test
run_test() {
    local test_name="$1"
    local test_args="$2"
    local expected_output="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up before test
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_sync_${CLAUDE_PID}_*
    
    # Run write-arguments in background
    "$WRITE_ARGS" "$test_args" > /dev/null 2>&1 2>&1 &
    local write_pid=$!
    
    # Small delay to ensure write starts first
    sleep 0.05
    
    # Run wait-for-arguments
    local actual_output=$("$WAIT_ARGS" 2 2>/dev/null)
    local wait_exit_code=$?
    
    # Wait for write process to complete
    wait $write_pid
    
    # Check results
    if [[ "$wait_exit_code" -eq 0 ]] && [[ "$actual_output" == "$expected_output" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: $expected_output (exit 0)"
        echo "  Actual:   $actual_output (exit $wait_exit_code)"
    fi
}

# Test timeout behavior
test_timeout() {
    local test_name="$1"
    local timeout="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_sync_${CLAUDE_PID}_*
    
    # Don't run write-arguments, just wait
    local start_time=$(date +%s)
    local stderr_file="/tmp/test_stderr_$$"
    # Run wait-for-arguments and capture exit code immediately
    "$WAIT_ARGS" "$timeout" 2>"$stderr_file"
    local exit_code=$?
    local output=""  # timeout case has no stdout
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"
    local end_time=$(date +%s)
    
    # Calculate elapsed time (integer seconds)
    local elapsed=$((end_time - start_time))
    
    # Check if it timed out correctly
    if [[ "$exit_code" -eq 1 ]] && [[ "$stderr_output" == *"Timeout"* ]]; then
        # Also verify it waited approximately the right amount of time
        # For integer comparison, we'll just check it's close to timeout
        local timeout_int=${timeout%.*}  # Remove decimal part
        
        if [[ "$elapsed" -ge "$timeout_int" ]] && [[ "$elapsed" -le $((timeout_int + 1)) ]]; then
            echo -e "${GREEN}✓${NC} $test_name (waited ${elapsed}s)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}✗${NC} $test_name - incorrect wait time"
            echo "  Expected: ~${timeout}s"
            echo "  Actual:   ${elapsed}s"
        fi
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: timeout error (exit 1)"
        echo "  Actual:   $stderr_output (exit $exit_code)"
    fi
}

# Test immediate availability
test_immediate() {
    local test_name="$1"
    local test_args="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_sync_${CLAUDE_PID}_*
    
    # Run write-arguments first (not in background)
    "$WRITE_ARGS" "$test_args" > /dev/null 2>&1
    
    # Now run wait-for-arguments - should return immediately
    local start_time=$(date +%s)
    local output=$("$WAIT_ARGS" 2>/dev/null)
    local exit_code=$?
    local end_time=$(date +%s)
    
    local elapsed=$((end_time - start_time))
    
    if [[ "$exit_code" -eq 0 ]] && [[ "$output" == "$test_args" ]] && [[ "$elapsed" -eq 0 ]]; then
        echo -e "${GREEN}✓${NC} $test_name (immediate)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        if [[ "$exit_code" -ne 0 ]]; then
            echo "  Exit code: $exit_code"
        fi
        if [[ "$output" != "$test_args" ]]; then
            echo "  Output mismatch: $output"
        fi
        if [[ "$elapsed" -gt 0 ]]; then
            echo "  Too slow: ${elapsed}s"
        fi
    fi
}

# Test missing args file
test_missing_args_file() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_sync_${CLAUDE_PID}_*
    
    # Create sync file but no args file
    local timestamp=$(date +%s)
    touch "/tmp/slash_cmd_sync_${CLAUDE_PID}_${timestamp}"
    
    # Run wait-for-arguments
    local stderr_file="/tmp/test_stderr_$$"
    "$WAIT_ARGS" 2>"$stderr_file"
    local exit_code=$?
    local output=""  # error case has no stdout
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"
    
    if [[ "$exit_code" -eq 2 ]] && [[ "$stderr_output" == *"args file missing"* ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: args file missing error (exit 2)"
        echo "  Actual:   $stderr_output (exit $exit_code)"
    fi
}

# Test concurrent access - multiple bash processes waiting for same args
# This test verifies that multiple wait processes can find sync files 
# created within the last 5 seconds
test_concurrent_same_second() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_sync_${CLAUDE_PID}_*
    
    # Test case: All waiters start in same timestamp second
    # This simulates multiple bash blocks in a slash command that execute quickly
    
    # First write the arguments
    "$WRITE_ARGS" "shared arguments for all" > /dev/null 2>&1
    
    # Small delay to ensure sync file is created
    sleep 0.05
    
    # Now start multiple wait processes that should all find the sync file
    local pids=()
    for i in {1..3}; do
        (
            output=$("$WAIT_ARGS" 2 2>/dev/null)  # 2 second timeout
            echo "$output" > "/tmp/concurrent_result_$i"
        ) &
        pids+=($!)
    done
    
    # Wait for all wait processes to complete
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    # Check results - all should have gotten the same arguments
    local all_good=true
    for i in {1..3}; do
        if [ -f "/tmp/concurrent_result_$i" ]; then
            local result=$(cat "/tmp/concurrent_result_$i")
            if [[ "$result" != "shared arguments for all" ]]; then
                all_good=false
                echo "  Process $i got: '$result' (expected: 'shared arguments for all')"
            fi
            rm -f "/tmp/concurrent_result_$i"
        else
            all_good=false
            echo "  Process $i: no result file"
        fi
    done
    
    if $all_good; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name - some processes got wrong results"
    fi
}

echo "Running wait-for-arguments tests..."
echo "=================================="

# Basic functionality tests
run_test "Simple arguments" "Hello World" "Hello World"
run_test "Empty arguments" "" ""
# Test with escaped dollar sign to avoid shell expansion
run_test "Complex arguments" "test with 'quotes' and special chars @#%" "test with 'quotes' and special chars @#%"
run_test "Path arguments" "/path/to/project test" "/path/to/project test"

# Test shell escaping issues
run_test "Arguments with backticks" "test with \`echo injected\` command" "test with \`echo injected\` command"
run_test "Arguments with dollar signs" "test with \$HOME variable" "test with \$HOME variable"
run_test "Arguments with double quotes" "test with \"double quotes\"" "test with \"double quotes\""
run_test "Arguments with newlines" "test with
newline" "test with
newline"

# Test complex shell escaping scenario
run_test "Complex shell escape" "rm -rf /tmp/\`whoami\`/\$HOME/\"important\"" "rm -rf /tmp/\`whoami\`/\$HOME/\"important\""
run_test "Arguments with backslashes" "test\\with\\backslashes" "test\\with\\backslashes"

# Immediate availability tests
test_immediate "Immediate availability" "already written"

# Timeout tests
test_timeout "Timeout after 1 second" 1
test_timeout "Timeout after 0.5 seconds" 0.5

# Error condition tests
test_missing_args_file "Missing args file error"

# Concurrent access test
test_concurrent_same_second "Concurrent access (same second)"

# Test that old sync files are ignored
test_old_sync_file_ignored() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_sync_${CLAUDE_PID}_*
    
    # Create an old sync file (6 seconds ago)
    local old_timestamp=$(($(date +%s) - 6))
    touch "/tmp/slash_cmd_sync_${CLAUDE_PID}_${old_timestamp}"
    
    # Create old args file
    echo "export ARGS=\"old arguments\"" > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    
    # Wait should timeout as the sync file is too old
    local stderr_file="/tmp/test_stderr_$$"
    "$WAIT_ARGS" 1 2>"$stderr_file"
    local exit_code=$?
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"
    
    if [[ "$exit_code" -eq 1 ]] && [[ "$stderr_output" == *"Timeout"* ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: timeout (old sync file should be ignored)"
        echo "  Actual:   exit code $exit_code"
    fi
    
    # Clean up
    rm -f "/tmp/slash_cmd_sync_${CLAUDE_PID}_${old_timestamp}"
}

test_old_sync_file_ignored "Old sync files ignored"

# Test that sync files created within 5 seconds work even if different timestamps
test_different_timestamps() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_sync_${CLAUDE_PID}_*
    
    # Write arguments first
    echo "export ARGS=\"cross-second test\"" > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    
    # Create sync file with timestamp 2 seconds ago
    local past_timestamp=$(($(date +%s) - 2))
    touch "/tmp/slash_cmd_sync_${CLAUDE_PID}_${past_timestamp}"
    
    # Wait should find it as it's within 5 seconds
    local output=$("$WAIT_ARGS" 1 2>/dev/null)
    local exit_code=$?
    
    if [[ "$exit_code" -eq 0 ]] && [[ "$output" == "cross-second test" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: 'cross-second test' (exit 0)"
        echo "  Actual:   '$output' (exit $exit_code)"
    fi
    
    # Clean up
    rm -f "/tmp/slash_cmd_sync_${CLAUDE_PID}_${past_timestamp}"
}

test_different_timestamps "Different timestamp sync files"

# Test that sync files exactly 5 seconds old are rejected
test_five_second_boundary() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_sync_${CLAUDE_PID}_*
    
    # Create sync file exactly 5 seconds ago
    local boundary_timestamp=$(($(date +%s) - 5))
    touch "/tmp/slash_cmd_sync_${CLAUDE_PID}_${boundary_timestamp}"
    
    # Create args file
    echo "export ARGS=\"boundary test\"" > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    
    # Wait should timeout as the sync file is exactly 5 seconds old (now rejected)
    local stderr_file="/tmp/test_stderr_$$"
    "$WAIT_ARGS" 1 2>"$stderr_file"
    local exit_code=$?
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"
    
    if [[ "$exit_code" -eq 1 ]] && [[ "$stderr_output" == *"Timeout"* ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: timeout (5-second-old sync file should be rejected)"
        echo "  Actual:   exit code $exit_code"
    fi
    
    # Clean up
    rm -f "/tmp/slash_cmd_sync_${CLAUDE_PID}_${boundary_timestamp}"
}

test_five_second_boundary "Five second boundary test"

# Test with delays
echo -e "\n${GREEN}Testing with delays...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

rm -f /tmp/slash_cmd_args.sh
rm -f /tmp/slash_cmd_sync_*

# Start write with delay
(sleep 0.3 && "$WRITE_ARGS" "delayed write" > /dev/null 2>&1) &
write_pid=$!

# Wait should succeed (give it 2 seconds to be safe)
output=$("$WAIT_ARGS" 2 2>/dev/null)
exit_code=$?

# Wait for write process to complete
wait $write_pid

if [[ "$exit_code" -eq 0 ]] && [[ "$output" == "delayed write" ]]; then
    echo -e "${GREEN}✓${NC} Delayed write test"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Delayed write test"
    echo "  Expected: 'delayed write' (exit 0)"
    echo "  Actual:   '$output' (exit $exit_code)"
fi

# Clean up after all tests
rm -f /tmp/slash_cmd_args.sh
rm -f /tmp/slash_cmd_sync_*

# Summary
echo
echo "=================================="
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