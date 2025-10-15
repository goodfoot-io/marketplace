#!/bin/bash

# Test suite for claude-subagentstop-hook-checks utility

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
HOOK_CHECKS="$SCRIPT_DIR/../claude-subagentstop-hook-checks"

# Create temporary test directory
TEST_DIR="/tmp/claude-subagentstop-test-$$"
mkdir -p "$TEST_DIR"

# Function to run a test
run_test() {
    local test_name="$1"
    local setup_function="$2"
    local expected_exit_code="$3"
    local should_contain="$4"
    local should_not_contain="$5"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Create a clean test environment
    rm -rf "$TEST_DIR/subagent-stop-checks"
    
    # Run setup function if provided
    if [ -n "$setup_function" ]; then
        $setup_function
    fi
    
    # Change to test directory and run the hook checks
    cd "$TEST_DIR"
    local output
    output=$("$HOOK_CHECKS" 2>&1)
    local exit_code=$?
    cd - > /dev/null
    
    local test_passed=true
    local failure_reasons=()
    
    # Check exit code
    if [ $exit_code -ne $expected_exit_code ]; then
        test_passed=false
        failure_reasons+=("Exit code: expected $expected_exit_code, got $exit_code")
    fi
    
    # Check if output contains expected text
    if [ -n "$should_contain" ]; then
        if ! echo "$output" | grep -q "$should_contain"; then
            test_passed=false
            failure_reasons+=("Output should contain: '$should_contain'")
        fi
    fi
    
    # Check if output doesn't contain unexpected text
    if [ -n "$should_not_contain" ]; then
        if echo "$output" | grep -q "$should_not_contain"; then
            test_passed=false
            failure_reasons+=("Output should not contain: '$should_not_contain'")
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

# Setup functions for different test scenarios
setup_no_directory() {
    # Do nothing - directory doesn't exist
    true
}

setup_empty_directory() {
    mkdir -p "$TEST_DIR/subagent-stop-checks"
}

setup_non_executable_files() {
    mkdir -p "$TEST_DIR/subagent-stop-checks"
    echo "#!/bin/bash" > "$TEST_DIR/subagent-stop-checks/test1.sh"
    echo "echo 'This should not run'" >> "$TEST_DIR/subagent-stop-checks/test1.sh"
    # Don't make it executable
}

setup_successful_scripts() {
    mkdir -p "$TEST_DIR/subagent-stop-checks"
    
    # Create first successful script
    cat > "$TEST_DIR/subagent-stop-checks/check1.sh" << 'EOF'
#!/bin/bash
echo "Check 1: All good"
exit 0
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/check1.sh"
    
    # Create second successful script
    cat > "$TEST_DIR/subagent-stop-checks/check2.sh" << 'EOF'
#!/bin/bash
echo "Check 2: Also good"
exit 0
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/check2.sh"
}

setup_one_warning_script() {
    mkdir -p "$TEST_DIR/subagent-stop-checks"
    
    # Create successful script
    cat > "$TEST_DIR/subagent-stop-checks/check1.sh" << 'EOF'
#!/bin/bash
echo "Check 1: Passing"
exit 0
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/check1.sh"
    
    # Create warning script (exit code 1) that outputs to both stdout and stderr
    cat > "$TEST_DIR/subagent-stop-checks/check2.sh" << 'EOF'
#!/bin/bash
echo "Check 2: Warning stdout"
echo "Check 2: Warning stderr" >&2
exit 1
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/check2.sh"
}

setup_one_error_script() {
    mkdir -p "$TEST_DIR/subagent-stop-checks"
    
    # Create successful script
    cat > "$TEST_DIR/subagent-stop-checks/check1.sh" << 'EOF'
#!/bin/bash
echo "Check 1: OK"
exit 0
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/check1.sh"
    
    # Create error script (exit code > 1) that outputs to both stdout and stderr
    cat > "$TEST_DIR/subagent-stop-checks/check2.sh" << 'EOF'
#!/bin/bash
echo "Check 2: Error stdout"
echo "Check 2: Error stderr" >&2
exit 5
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/check2.sh"
}

setup_mixed_exit_codes() {
    mkdir -p "$TEST_DIR/subagent-stop-checks"
    
    # Create script with exit code 0
    cat > "$TEST_DIR/subagent-stop-checks/check1.sh" << 'EOF'
#!/bin/bash
echo "Check 1: Success"
exit 0
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/check1.sh"
    
    # Create script with exit code 1
    cat > "$TEST_DIR/subagent-stop-checks/check2.sh" << 'EOF'
#!/bin/bash
echo "Check 2: Warning"
exit 1
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/check2.sh"
    
    # Create script with exit code 3
    cat > "$TEST_DIR/subagent-stop-checks/check3.sh" << 'EOF'
#!/bin/bash
echo "Check 3: Error"
exit 3
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/check3.sh"
}

setup_output_passthrough() {
    mkdir -p "$TEST_DIR/subagent-stop-checks"
    
    # Create script that outputs to stdout and stderr
    cat > "$TEST_DIR/subagent-stop-checks/verbose.sh" << 'EOF'
#!/bin/bash
echo "This goes to stdout"
echo "This goes to stderr" >&2
echo "More stdout output"
exit 0
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/verbose.sh"
}

echo "Running claude-subagentstop-hook-checks tests..."
echo "======================================"

# Test 1: No directory exists
run_test "No checks directory - should exit 0" \
    "setup_no_directory" \
    0 \
    "" \
    ""

# Test 2: Empty directory exists
run_test "Empty checks directory - should exit 0" \
    "setup_empty_directory" \
    0 \
    "" \
    ""

# Test 3: Directory with non-executable files
run_test "Non-executable files - should exit 0" \
    "setup_non_executable_files" \
    0 \
    "" \
    "This should not run"

# Test 4: All scripts succeed
run_test "All scripts succeed - should exit 0" \
    "setup_successful_scripts" \
    0 \
    "Check 1: All good" \
    ""

# Test 5: One script returns exit code 1
run_test "One script returns 1 - should exit 1" \
    "setup_one_warning_script" \
    1 \
    "Warning stdout" \
    ""

# Test 6: One script returns exit code > 1
run_test "One script returns >1 - should exit 2" \
    "setup_one_error_script" \
    2 \
    "Error stdout" \
    ""

# Test 7: Mixed exit codes (0, 1, 3)
run_test "Mixed exit codes - should exit 2 (highest >1)" \
    "setup_mixed_exit_codes" \
    2 \
    "Check 3: Error" \
    ""

# Test 8: Output passthrough
run_test "Output passthrough - stdout and stderr" \
    "setup_output_passthrough" \
    0 \
    "This goes to stdout" \
    ""

# Test 9: Verify stderr is also passed through
TESTS_RUN=$((TESTS_RUN + 1))
cd "$TEST_DIR"
setup_output_passthrough
output=$("$HOOK_CHECKS" 2>&1)
cd - > /dev/null
if echo "$output" | grep -q "This goes to stderr"; then
    echo -e "${GREEN}✓${NC} Stderr passthrough works"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Stderr passthrough failed"
fi

# Test 10: Multiple scripts run in order
setup_execution_order() {
    mkdir -p "$TEST_DIR/subagent-stop-checks"
    
    # Scripts will be executed in alphabetical order
    cat > "$TEST_DIR/subagent-stop-checks/01_first.sh" << 'EOF'
#!/bin/bash
echo "First"
exit 0
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/01_first.sh"
    
    cat > "$TEST_DIR/subagent-stop-checks/02_second.sh" << 'EOF'
#!/bin/bash
echo "Second"
exit 0
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/02_second.sh"
    
    cat > "$TEST_DIR/subagent-stop-checks/03_third.sh" << 'EOF'
#!/bin/bash
echo "Third"
exit 0
EOF
    chmod +x "$TEST_DIR/subagent-stop-checks/03_third.sh"
}

TESTS_RUN=$((TESTS_RUN + 1))
cd "$TEST_DIR"
setup_execution_order
output=$("$HOOK_CHECKS" 2>&1)
cd - > /dev/null

# Check if output contains all three in the right order
if echo "$output" | grep -zo "First.*Second.*Third" > /dev/null; then
    echo -e "${GREEN}✓${NC} Scripts execute in alphabetical order"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Scripts don't execute in expected order"
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 11: Verify stderr redirection when exit code >= 1
echo "Additional stderr redirection tests..."

# Test that stdout is redirected to stderr when exit code = 1
TESTS_RUN=$((TESTS_RUN + 1))
cd "$TEST_DIR"
rm -rf "$TEST_DIR/subagent-stop-checks"
setup_one_warning_script
# Capture only stderr
stderr_output=$("$HOOK_CHECKS" 2>&1 1>/dev/null)
# Capture only stdout (should be empty for failing scripts)
stdout_output=$("$HOOK_CHECKS" 2>/dev/null)
cd - > /dev/null

if echo "$stderr_output" | grep -q "Warning stdout" && echo "$stderr_output" | grep -q "Warning stderr"; then
    echo -e "${GREEN}✓${NC} Exit code 1: Both stdout and stderr redirected to stderr"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Exit code 1: Failed to redirect all output to stderr"
    if [ -n "$DEBUG" ]; then
        echo "  Stderr output:"
        echo "$stderr_output" | sed 's/^/    /'
    fi
fi

# Test that stdout is redirected to stderr when exit code > 1
TESTS_RUN=$((TESTS_RUN + 1))
cd "$TEST_DIR"
rm -rf "$TEST_DIR/subagent-stop-checks"
setup_one_error_script
# Capture only stderr
stderr_output=$("$HOOK_CHECKS" 2>&1 1>/dev/null)
cd - > /dev/null

if echo "$stderr_output" | grep -q "Error stdout" && echo "$stderr_output" | grep -q "Error stderr"; then
    echo -e "${GREEN}✓${NC} Exit code >1: Both stdout and stderr redirected to stderr"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Exit code >1: Failed to redirect all output to stderr"
    if [ -n "$DEBUG" ]; then
        echo "  Stderr output:"
        echo "$stderr_output" | sed 's/^/    /'
    fi
fi

# Test that successful scripts still output normally (stdout to stdout, stderr to stderr)
TESTS_RUN=$((TESTS_RUN + 1))
cd "$TEST_DIR"
# Clean setup for isolated test
rm -rf "$TEST_DIR/subagent-stop-checks"
setup_output_passthrough
# Capture stdout and stderr separately
stdout_output=$("$HOOK_CHECKS" 2>/dev/null)
stderr_output=$("$HOOK_CHECKS" 2>&1 1>/dev/null)
cd - > /dev/null

if echo "$stdout_output" | grep -q "This goes to stdout" && ! echo "$stdout_output" | grep -q "This goes to stderr"; then
    if echo "$stderr_output" | grep -q "This goes to stderr" && ! echo "$stderr_output" | grep -q "This goes to stdout"; then
        echo -e "${GREEN}✓${NC} Exit code 0: Normal output routing preserved"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Exit code 0: stderr not properly routed"
        if [ -n "$DEBUG" ]; then
            echo "  Stderr output:"
            echo "$stderr_output" | sed 's/^/    /'
        fi
    fi
else
    echo -e "${RED}✗${NC} Exit code 0: stdout not properly routed"
    if [ -n "$DEBUG" ]; then
        echo "  Stdout output:"
        echo "$stdout_output" | sed 's/^/    /'
        echo "  Stderr output:"
        echo "$stderr_output" | sed 's/^/    /'
    fi
fi

# Clean up
rm -rf "$TEST_DIR"

# Summary
echo
echo "======================================"
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