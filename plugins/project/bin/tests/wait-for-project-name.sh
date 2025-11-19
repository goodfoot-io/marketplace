#!/bin/bash

# Test suite for wait-for-project-name utility

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
GET_NEXT_PROJECT="$SCRIPT_DIR/../get-next-project"
WAIT_PROJECT="$SCRIPT_DIR/../wait-for-project-name"

# Create a temporary test directory
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"

# Create the projects directory structure
mkdir -p projects/pending projects/active projects/ready-for-review

# Function to run a basic test
run_test() {
    local test_name="$1"
    local args="$2"
    local expected_output="$3"
    local setup_projects="$4"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up before test
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_project_sync_${CLAUDE_PID}_*
    rm -rf projects/*/*
    
    # Setup test projects if specified
    if [ -n "$setup_projects" ]; then
        eval "$setup_projects"
    fi
    
    # Write arguments
    echo "ARGS=\"$args\"" > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    
    # Run get-next-project in background
    "$GET_NEXT_PROJECT" > /dev/null 2>&1 &
    local get_pid=$!
    
    # Small delay to ensure get-next-project starts first
    sleep 0.05
    
    # Run wait-for-project-name
    local actual_output=$("$WAIT_PROJECT" 2 2>/dev/null)
    local wait_exit_code=$?
    
    # Wait for get-next-project to complete
    wait $get_pid
    
    # Check results
    if [[ "$wait_exit_code" -eq 0 ]] && [[ "$actual_output" == "$expected_output" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: '$expected_output' (exit 0)"
        echo "  Actual:   '$actual_output' (exit $wait_exit_code)"
    fi
}

# Test timeout behavior
test_timeout() {
    local test_name="$1"
    local timeout="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_project_sync_${CLAUDE_PID}_*
    
    # Don't run get-next-project, just wait
    local start_time=$(date +%s)
    local stderr_file="/tmp/test_stderr_$$"
    # Run wait-for-project-name and capture exit code immediately
    "$WAIT_PROJECT" "$timeout" 2>"$stderr_file"
    local exit_code=$?
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"
    local end_time=$(date +%s)
    
    # Calculate elapsed time (integer seconds)
    local elapsed=$((end_time - start_time))
    
    # Check if it timed out correctly
    if [[ "$exit_code" -eq 1 ]] && [[ "$stderr_output" == *"Timeout"* ]]; then
        # Verify it waited approximately the right amount of time
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

# Test no project found scenario (should return empty string, not timeout)
test_no_project_found() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up before test
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_project_sync_${CLAUDE_PID}_*
    rm -rf projects/*/*
    
    # Write empty arguments (simulating no projects available)
    echo "ARGS=\"\"" > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    
    # Run get-next-project in background
    "$GET_NEXT_PROJECT" > /dev/null 2>&1 &
    local get_pid=$!
    
    # Small delay to ensure get-next-project starts first
    sleep 0.05
    
    # Run wait-for-project-name
    local start_time=$(date +%s%N)
    local actual_output=$("$WAIT_PROJECT" 2 2>/dev/null)
    local wait_exit_code=$?
    local end_time=$(date +%s%N)
    
    # Wait for get-next-project to complete
    wait $get_pid
    
    # Calculate elapsed time in milliseconds
    local elapsed_ms=$(( (end_time - start_time) / 1000000 ))
    
    # Check results - should return empty string with exit code 0, quickly
    if [[ "$wait_exit_code" -eq 0 ]] && [[ "$actual_output" == "" ]] && [[ "$elapsed_ms" -lt 2000 ]]; then
        echo -e "${GREEN}✓${NC} $test_name (returned quickly: ${elapsed_ms}ms)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: empty string with exit 0, quickly"
        echo "  Actual:   '$actual_output' (exit $wait_exit_code) in ${elapsed_ms}ms"
    fi
}

# Test immediate availability
test_immediate() {
    local test_name="$1"
    local project_name="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_project_sync_${CLAUDE_PID}_*
    
    # Create args file with SELECTED_PROJECT already set
    cat > /tmp/slash_cmd_args_${CLAUDE_PID}.sh << EOF
export ARGS="test"
export SELECTED_PROJECT="$project_name"
EOF
    
    # Create recent sync file
    local timestamp=$(date +%s)
    touch "/tmp/slash_cmd_project_sync_${CLAUDE_PID}_${timestamp}"
    
    # Run wait-for-project-name (should return immediately)
    local start_time=$(date +%s%N)
    local output=$("$WAIT_PROJECT" 2>/dev/null)
    local exit_code=$?
    local end_time=$(date +%s%N)
    
    # Calculate elapsed time in milliseconds
    local elapsed_ms=$(( (end_time - start_time) / 1000000 ))
    
    if [[ "$exit_code" -eq 0 ]] && [[ "$output" == "$project_name" ]] && [[ "$elapsed_ms" -lt 200 ]]; then
        echo -e "${GREEN}✓${NC} $test_name (immediate)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: '$project_name' immediately"
        echo "  Actual:   '$output' in ${elapsed_ms}ms (exit $exit_code)"
    fi
}

# Test old sync files are ignored
test_old_sync_file() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_project_sync_${CLAUDE_PID}_*
    
    # Create an old sync file (6 seconds ago)
    local old_timestamp=$(($(date +%s) - 6))
    touch "/tmp/slash_cmd_project_sync_${CLAUDE_PID}_${old_timestamp}"
    
    # Create args file
    cat > /tmp/slash_cmd_args_${CLAUDE_PID}.sh << EOF
export ARGS=""
export SELECTED_PROJECT="projects/pending/old-project"
EOF
    
    # Wait should timeout as the sync file is too old
    local stderr_file="/tmp/test_stderr_$$"
    "$WAIT_PROJECT" 1 2>"$stderr_file"
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
    rm -f "/tmp/slash_cmd_project_sync_${CLAUDE_PID}_${old_timestamp}"
}

# Test boundary (exactly 5 seconds)
test_five_second_boundary() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_project_sync_${CLAUDE_PID}_*
    
    # Create sync file exactly 5 seconds ago
    local boundary_timestamp=$(($(date +%s) - 5))
    touch "/tmp/slash_cmd_project_sync_${CLAUDE_PID}_${boundary_timestamp}"
    
    # Create args file
    cat > /tmp/slash_cmd_args_${CLAUDE_PID}.sh << EOF
export ARGS=""
export SELECTED_PROJECT="projects/pending/boundary-project"
EOF
    
    # Wait should timeout as the sync file is exactly 5 seconds old (now rejected)
    local stderr_file="/tmp/test_stderr_$$"
    "$WAIT_PROJECT" 1 2>"$stderr_file"
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
    rm -f "/tmp/slash_cmd_project_sync_${CLAUDE_PID}_${boundary_timestamp}"
}

echo "Running wait-for-project-name tests..."
echo "====================================="

# Basic functionality tests
run_test "Project specified" "test-project" "projects/pending/test-project" "mkdir -p projects/pending/test-project"
run_test "No project specified" "" "" ""
run_test "Project in active" "active-proj" "projects/active/active-proj" "mkdir -p projects/active/active-proj"
run_test "Multiple projects, first match" "proj1 proj2" "projects/pending/proj1" "mkdir -p projects/pending/proj1 projects/pending/proj2"

# Test the specific issue from the debug case - working directory context sensitivity
run_test "Project name in long sentence" "This is a test of example-project-1 . Output the full content" "projects/active/example-project-1" "mkdir -p projects/active/example-project-1"
run_test "Project name with hyphens in active" "example-project-1" "projects/active/example-project-1" "mkdir -p projects/active/example-project-1"
run_test "Project name with punctuation" "test of example-project-1." "projects/active/example-project-1" "mkdir -p projects/active/example-project-1"

# Test working directory context issue - this reveals the actual bug
run_test "Long args fallback to oldest pending" "This is a test of non-existent-project . Output the full content" "projects/pending/oldest-project" "mkdir -p projects/pending/oldest-project && touch projects/pending/oldest-project/plan.md"

# Test that punctuation-only words don't match empty project paths  
run_test "Punctuation words ignored" "This is a test . , ! ? Output" "" ""

# No project found tests
test_no_project_found "No projects available"

# Immediate availability tests
test_immediate "Immediate availability" "projects/active/immediate-test"
test_immediate "Empty project immediate" ""

# Timeout tests (only when sync files are not created at all)
test_timeout "True timeout (no sync file)" 1
test_timeout "Short timeout (no sync file)" 0.5

# Old sync file test
test_old_sync_file "Old sync files ignored"

# Boundary test
test_five_second_boundary "Five second boundary test"

# Test the activate-project path update issue
test_activated_project_path() {
    local test_name="$1"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Clean up
    rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    rm -f /tmp/slash_cmd_project_sync_${CLAUDE_PID}_*
    rm -rf projects/*/*
    
    # Create a test project in pending
    mkdir -p projects/pending/test-activation
    echo "# Test Plan" > projects/pending/test-activation/plan.md
    
    # Write initial args with pending path
    cat > /tmp/slash_cmd_args_${CLAUDE_PID}.sh << EOF
export ARGS="test-activation"
export SELECTED_PROJECT="projects/pending/test-activation"
EOF
    
    # Create sync file
    local timestamp=$(date +%s)
    touch "/tmp/slash_cmd_project_sync_${CLAUDE_PID}_${timestamp}"
    
    # First wait should return pending path
    local first_output=$("$WAIT_PROJECT" 2>/dev/null)
    
    # Now simulate activate-project moving it and updating the path
    mkdir -p projects/active
    mv projects/pending/test-activation projects/active/
    
    # Update the SELECTED_PROJECT in args file (simulating update-project-path)
    cat > /tmp/slash_cmd_args_${CLAUDE_PID}.sh << EOF
export ARGS="test-activation"
export SELECTED_PROJECT="projects/active/test-activation"
EOF
    
    # Create a new sync file for the update
    sleep 0.1
    local new_timestamp=$(date +%s)
    touch "/tmp/slash_cmd_project_sync_${CLAUDE_PID}_${new_timestamp}"
    
    # Second wait should return active path
    local second_output=$("$WAIT_PROJECT" 2>/dev/null)
    
    if [[ "$first_output" == "projects/pending/test-activation" ]] && [[ "$second_output" == "projects/active/test-activation" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  First output:  '$first_output' (expected: 'projects/pending/test-activation')"
        echo "  Second output: '$second_output' (expected: 'projects/active/test-activation')"
    fi
}

# Run the activated project path test
test_activated_project_path "Activated project path update"

# Integration test
echo -e "\n${GREEN}Testing integration with get-next-project...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

# Clean up
rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
rm -f /tmp/slash_cmd_project_sync_${CLAUDE_PID}_*

# Create a test project
mkdir -p projects/pending/integration-test
echo "# Test Plan" > projects/pending/integration-test/plan.md

# Write args specifying the project
echo "ARGS=\"work on integration-test\"" > /tmp/slash_cmd_args_${CLAUDE_PID}.sh

# Run get-next-project
project_output=$("$GET_NEXT_PROJECT" 2>/dev/null)

# Now wait for it
wait_output=$("$WAIT_PROJECT" 2 2>/dev/null)
exit_code=$?

if [[ "$exit_code" -eq 0 ]] && [[ "$wait_output" == "projects/pending/integration-test" ]] && [[ "$wait_output" == "$project_output" ]]; then
    echo -e "${GREEN}✓${NC} Integration test"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Integration test"
    echo "  get-next-project output: '$project_output'"
    echo "  wait-for-project output: '$wait_output' (exit $exit_code)"
fi

# Clean up test directory
cd /
rm -rf "$TEST_DIR"

# Clean up any remaining files
rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
rm -f /tmp/slash_cmd_project_sync_${CLAUDE_PID}_*

# Summary
echo
echo "====================================="
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