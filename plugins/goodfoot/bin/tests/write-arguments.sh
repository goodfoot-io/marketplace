#!/bin/bash

# Test suite for write-arguments utility

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

# Function to run a test
run_test() {
    local test_name="$1"
    local input_args="$2"
    local expected_output="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up before test
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_sync_${CLAUDE_PID}_*
    
    # Run the write-arguments utility (redirect stderr to avoid DEBUG messages)
    local actual_output=$("$WRITE_ARGS" "$input_args" 2>/dev/null)
    
    # Check output
    if [[ "$actual_output" == "$expected_output" ]]; then
        # Check if args file was created
        if [ -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh ]; then
            # Check file contents
            local file_contents=$(cat /tmp/slash_cmd_args_${CLAUDE_PID}.sh)
            
            # Source the file and check if ARGS matches the original input
            # This verifies that escaping preserves the value when sourced
            unset ARGS
            source /tmp/slash_cmd_args_${CLAUDE_PID}.sh
            
            if [[ "$ARGS" == "$input_args" ]]; then
                # Check if sync file was created
                if ls /tmp/slash_cmd_sync_${CLAUDE_PID}_* 1> /dev/null 2>&1; then
                    echo -e "${GREEN}✓${NC} $test_name"
                    TESTS_PASSED=$((TESTS_PASSED + 1))
                else
                    echo -e "${RED}✗${NC} $test_name - sync file not created"
                fi
            else
                echo -e "${RED}✗${NC} $test_name - incorrect file contents"
                echo "  Expected: $expected_contents"
                echo "  Actual:   $file_contents"
            fi
        else
            echo -e "${RED}✗${NC} $test_name - args file not created"
        fi
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected output: $expected_output"
        echo "  Actual output:   $actual_output"
    fi
}

# Test sync file behavior
test_sync_file() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_sync_${CLAUDE_PID}_*
    
    # Get timestamp before running
    local timestamp_before=$(date +%s)
    
    # Run write-arguments
    "$WRITE_ARGS" "test sync file" > /dev/null 2>&1
    
    # Check if sync file exists with correct timestamp
    local sync_file="/tmp/slash_cmd_sync_${CLAUDE_PID}_${timestamp_before}"
    
    if [ -f "$sync_file" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        # Check if it created one with next second (edge case)
        local timestamp_after=$((timestamp_before + 1))
        local sync_file_after="/tmp/slash_cmd_sync_${CLAUDE_PID}_${timestamp_after}"
        
        if [ -f "$sync_file_after" ]; then
            echo -e "${GREEN}✓${NC} $test_name (edge case: next second)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}✗${NC} $test_name - sync file not found"
            echo "  Expected: $sync_file or $sync_file_after"
            echo "  Found: $(ls /tmp/slash_cmd_sync_${CLAUDE_PID}_* 2>/dev/null || echo 'none')"
        fi
    fi
}

# Test cleanup behavior
test_cleanup() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Create old sync files
    local old_timestamp=$(($(date +%s) - 15))
    touch "/tmp/slash_cmd_sync_${CLAUDE_PID}_${old_timestamp}"
    
    # Create recent sync file 
    local recent_timestamp=$(($(date +%s) - 5))
    touch "/tmp/slash_cmd_sync_${CLAUDE_PID}_${recent_timestamp}"
    
    # Run write-arguments
    "$WRITE_ARGS" "test cleanup" > /dev/null 2>&1
    
    # Check if ALL old files were cleaned up (only the new one should exist)
    local new_timestamp=$(date +%s)
    if [ ! -f "/tmp/slash_cmd_sync_${CLAUDE_PID}_${old_timestamp}" ] && [ ! -f "/tmp/slash_cmd_sync_${CLAUDE_PID}_${recent_timestamp}" ] && [ -f "/tmp/slash_cmd_sync_${CLAUDE_PID}_${new_timestamp}" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name - cleanup failed"
        if [ -f "/tmp/slash_cmd_sync_${CLAUDE_PID}_${old_timestamp}" ]; then
            echo "  Old file still exists: /tmp/slash_cmd_sync_${CLAUDE_PID}_${old_timestamp}"
        fi
        if [ -f "/tmp/slash_cmd_sync_${CLAUDE_PID}_${recent_timestamp}" ]; then
            echo "  Recent file still exists: /tmp/slash_cmd_sync_${CLAUDE_PID}_${recent_timestamp}"
        fi
        if [ ! -f "/tmp/slash_cmd_sync_${CLAUDE_PID}_${new_timestamp}" ]; then
            echo "  New sync file not created: /tmp/slash_cmd_sync_${CLAUDE_PID}_${new_timestamp}"
        fi
    fi
}

echo "Running write-arguments tests..."
echo "=============================="

# Basic functionality tests
run_test "Simple arguments" "Hello World" "Hello World"
run_test "Empty arguments" "" ""
run_test "Arguments with special characters" "test@#$%^&*()" "test@#$%^&*()"
run_test "Arguments with quotes" "test \"quoted\" string" "test \"quoted\" string"
run_test "Arguments with single quotes" "test 'single' quotes" "test 'single' quotes"
run_test "Arguments with newlines" "test\nwith\nnewlines" "test\nwith\nnewlines"
run_test "Arguments with tabs" "test\twith\ttabs" "test\twith\ttabs"
run_test "Arguments with backslashes" "test\\with\\backslashes" "test\\with\\backslashes"
run_test "Arguments with dollar signs" "test \$HOME \${VAR}" "test \$HOME \${VAR}"
run_test "Long arguments" "$(printf 'x%.0s' {1..1000})" "$(printf 'x%.0s' {1..1000})"
run_test "Arguments with paths" "/path/to/file and/or another/path" "/path/to/file and/or another/path"
run_test "Project path argument" "test identify-event-based-e2e-improvements" "test identify-event-based-e2e-improvements"

# Shell escaping vulnerability tests
run_test "Arguments with backticks" "test \`echo injected\` code" "test \`echo injected\` code"
run_test "Arguments with command substitution" "test \$(echo injected) code" "test \$(echo injected) code"
run_test "Arguments with complex backticks" "value is \`cat /etc/passwd\`" "value is \`cat /etc/passwd\`"
run_test "Arguments with nested quotes and backticks" "test \"\`echo 'nested'\`\" string" "test \"\`echo 'nested'\`\" string"

# Sync file tests
test_sync_file "Sync file creation"

# Cleanup tests
test_cleanup "Old sync file cleanup"

# Security test - verify no command injection when sourcing
test_security() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/test_injection_marker
    
    # Run write-arguments with potential injection
    "$WRITE_ARGS" "test \`touch /tmp/test_injection_marker\` code" > /dev/null 2>&1
    
    # Source the file
    source /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    
    # Check if injection happened
    if [ ! -f /tmp/test_injection_marker ]; then
        echo -e "${GREEN}✓${NC} $test_name - no command injection"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Also verify ARGS contains the literal backticks
        if [[ "$ARGS" == "test \`touch /tmp/test_injection_marker\` code" ]]; then
            echo -e "  ${GREEN}✓${NC} ARGS contains literal backticks"
        else
            echo -e "  ${RED}✗${NC} ARGS doesn't contain literal backticks"
            echo "    Expected: test \`touch /tmp/test_injection_marker\` code"
            echo "    Actual:   $ARGS"
        fi
    else
        echo -e "${RED}✗${NC} $test_name - COMMAND INJECTION DETECTED!"
        rm -f /tmp/test_injection_marker
    fi
}

test_security "Security test - command injection prevention"

# Multiple invocation test
echo -e "\n${GREEN}Testing multiple invocations...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

# Clean up
rm -f /tmp/slash_cmd_args.sh
rm -f /tmp/slash_cmd_sync_*

# Run multiple times quickly
"$WRITE_ARGS" "first call" > /dev/null 2>&1
"$WRITE_ARGS" "second call" > /dev/null 2>&1
"$WRITE_ARGS" "third call" > /dev/null 2>&1

# Check that args file contains the last call
if grep -q "third call" /tmp/slash_cmd_args_${CLAUDE_PID}.sh; then
    echo -e "${GREEN}✓${NC} Multiple invocations overwrites correctly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Multiple invocations failed"
fi

# Clean up after all tests
rm -f /tmp/slash_cmd_args.sh
rm -f /tmp/slash_cmd_sync_*

# Summary
echo
echo "=============================="
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