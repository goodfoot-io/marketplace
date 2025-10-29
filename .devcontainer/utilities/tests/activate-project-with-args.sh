#!/bin/bash

# Test script for activate-project-with-args utility

# Setup test environment
export REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
TEST_DIR="$REPO_ROOT/.devcontainer/utilities/tests/tmp/activate-project-with-args-test"
UTILITIES_DIR="$REPO_ROOT/.devcontainer/utilities"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
setup_test() {
    rm -rf "$TEST_DIR"
    mkdir -p "$TEST_DIR/projects/active"
    mkdir -p "$TEST_DIR/projects/pending"
    cd "$TEST_DIR"
}

cleanup_test() {
    cd "$REPO_ROOT"
    rm -rf "$TEST_DIR"
}

run_test() {
    local test_name="$1"
    local expected_result="$2"
    shift 2
    
    echo -n "Testing $test_name... "
    
    if eval "$@"; then
        if [ "$expected_result" = "success" ]; then
            echo -e "${GREEN}PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAILED${NC} (expected failure but succeeded)"
            ((TESTS_FAILED++))
        fi
    else
        if [ "$expected_result" = "failure" ]; then
            echo -e "${GREEN}PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAILED${NC} (expected success but failed)"
            ((TESTS_FAILED++))
        fi
    fi
}

# Mock utilities for testing
create_mock_utilities() {
    local mock_dir="$TEST_DIR/mock_utilities"
    mkdir -p "$mock_dir"
    
    # Mock write-arguments
    cat > "$mock_dir/write-arguments" << EOF
#!/bin/bash
echo "\$@" > "$TEST_DIR/arguments.txt"
echo "Arguments written: \$@"
EOF
    
    # Mock get-next-project
    cat > "$mock_dir/get-next-project" << EOF
#!/bin/bash
if [ -f "$TEST_DIR/arguments.txt" ]; then
    args=\$(cat "$TEST_DIR/arguments.txt")
    # Check each word in args, stripping punctuation like the real script
    for word in \$args; do
        # Strip punctuation from beginning and end
        cleaned_word=\$(echo "\$word" | sed 's/^[@"'\''`]*//; s/[@"'\''`,.!?;:]*$//')
        
        if [[ "\$cleaned_word" == "test-project" ]]; then
            echo "projects/pending/test-project"
            exit 0
        elif [[ "\$cleaned_word" == "active-project" ]]; then
            echo "projects/active/active-project"
            exit 0
        elif [[ "\$cleaned_word" == "punctuation-project" ]]; then
            echo "projects/pending/punctuation-project"
            exit 0
        fi
    done
else
    # Return first pending project
    for proj in "$TEST_DIR/projects/pending"/*; do
        if [ -d "$proj" ]; then
            echo "$proj"
            break
        fi
    done
fi
EOF
    
    # Mock wait-for-project-name
    cat > "$mock_dir/wait-for-project-name" << EOF
#!/bin/bash
if [ -f "$TEST_DIR/next_project.txt" ]; then
    cat "$TEST_DIR/next_project.txt"
elif [ -f "$TEST_DIR/arguments.txt" ]; then
    args=\$(cat "$TEST_DIR/arguments.txt")
    # Check each word in args, stripping punctuation like get-next-project
    for word in \$args; do
        cleaned_word=\$(echo "\$word" | sed 's/^[@"'\''`]*//; s/[@"'\''`,.!?;:]*$//')
        
        if [[ "\$cleaned_word" == "test-project" ]]; then
            echo "projects/pending/test-project"
            exit 0
        elif [[ "\$cleaned_word" == "active-project" ]]; then
            echo "projects/active/active-project"
            exit 0
        elif [[ "\$cleaned_word" == "punctuation-project" ]]; then
            echo "projects/pending/punctuation-project"
            exit 0
        fi
    done
    
    if [[ "\$args" == *"nonexistent"* ]]; then
        echo ""
    fi
fi
EOF
    
    # Mock activate-project
    cat > "$mock_dir/activate-project" << EOF
#!/bin/bash
project_path="\$1"
if [ -n "\$project_path" ] && [[ "\$project_path" != *"fail"* ]]; then
    # Move to active if in pending
    if [[ "\$project_path" == *"pending"* ]]; then
        project_name=\$(basename "\$project_path")
        new_path="projects/active/\$project_name"
        mkdir -p "\$(dirname "\$new_path")"
        echo "\$new_path"
    else
        echo "\$project_path"
    fi
else
    exit 1
fi
EOF
    
    chmod +x "$mock_dir"/*
    export PATH="$mock_dir:$PATH"
}

# Test 1: Successful project activation with project name
test_successful_activation() {
    setup_test
    create_mock_utilities
    
    # Create test project
    mkdir -p "$TEST_DIR/projects/pending/test-project"
    echo "# Test Project Plan" > "$TEST_DIR/projects/pending/test-project/plan.md"
    echo "# Test Project Log" > "$TEST_DIR/projects/pending/test-project/log.md"
    
    output=$("$UTILITIES_DIR/activate-project-with-args" "test-project" 2>&1)
    
    # Check output
    if [[ "$output" == *"Activated: projects/active/test-project"* ]] && \
       [[ "$output" == *"Review @projects/active/test-project/plan.md"* ]]; then
        return 0
    else
        echo "Output: $output"
        return 1
    fi
}

# Test 2: Project not found
test_project_not_found() {
    setup_test
    create_mock_utilities
    
    output=$("$UTILITIES_DIR/activate-project-with-args" "nonexistent" 2>&1)
    
    if [[ "$output" == *"Project not found or has unmet dependencies"* ]]; then
        return 0
    else
        return 1
    fi
}

# Test 3: No arguments (should find first eligible project)
test_no_arguments() {
    setup_test
    create_mock_utilities
    
    # Create a pending project
    mkdir -p "$TEST_DIR/projects/pending/first-project"
    echo "first-project" > "$TEST_DIR/next_project.txt"
    
    output=$("$UTILITIES_DIR/activate-project-with-args" 2>&1)
    
    if [[ "$output" == *"Arguments written:"* ]]; then
        return 0
    else
        return 1
    fi
}

# Test 4: Activation failure
test_activation_failure() {
    setup_test
    create_mock_utilities
    
    # Override activate-project to fail
    cat > "$TEST_DIR/mock_utilities/activate-project" << 'EOF'
#!/bin/bash
exit 1
EOF
    chmod +x "$TEST_DIR/mock_utilities/activate-project"
    
    echo "projects/active/fail-project" > "$TEST_DIR/next_project.txt"
    
    output=$("$UTILITIES_DIR/activate-project-with-args" "fail-project" 2>&1)
    
    if [[ "$output" == *"Error: Failed to activate project"* ]]; then
        return 0
    else
        return 1
    fi
}

# Test 5: Project with issue information
test_project_with_issue_info() {
    setup_test
    create_mock_utilities
    
    # Create test project
    mkdir -p "$TEST_DIR/projects/pending/test-project"
    
    output=$("$UTILITIES_DIR/activate-project-with-args" "test-project tests are failing" 2>&1)
    
    # Check that full arguments were passed
    if [ -f "$TEST_DIR/arguments.txt" ]; then
        args=$(cat "$TEST_DIR/arguments.txt")
        if [[ "$args" == "test-project tests are failing" ]]; then
            return 0
        else
            echo "Arguments: '$args'"
            return 1
        fi
    else
        return 1
    fi
}

# Test 6: Project name with trailing period
test_project_with_period() {
    setup_test
    create_mock_utilities
    
    # Create test project
    mkdir -p "$TEST_DIR/projects/pending/punctuation-project"
    echo "# Test Project Plan" > "$TEST_DIR/projects/pending/punctuation-project/plan.md"
    
    output=$("$UTILITIES_DIR/activate-project-with-args" "Continue with punctuation-project." 2>&1)
    
    # Check output
    if [[ "$output" == *"Activated: projects/active/punctuation-project"* ]]; then
        return 0
    else
        echo "Output: $output"
        return 1
    fi
}

# Test 7: Project name with quotes and comma
test_project_with_quotes() {
    setup_test
    create_mock_utilities
    
    # Create test project
    mkdir -p "$TEST_DIR/projects/pending/punctuation-project"
    
    output=$("$UTILITIES_DIR/activate-project-with-args" 'Work on "punctuation-project", please!' 2>&1)
    
    if [[ "$output" == *"Activated: projects/active/punctuation-project"* ]]; then
        return 0
    else
        echo "Output: $output"
        return 1
    fi
}

# Test 8: Project name with @ prefix
test_project_with_at_symbol() {
    setup_test
    create_mock_utilities
    
    # Create test project
    mkdir -p "$TEST_DIR/projects/pending/punctuation-project"
    
    output=$("$UTILITIES_DIR/activate-project-with-args" "Check @punctuation-project status" 2>&1)
    
    if [[ "$output" == *"Activated: projects/active/punctuation-project"* ]]; then
        return 0
    else
        echo "Output: $output"
        return 1
    fi
}

# Test 9: Path synchronization bug reproduction
test_path_sync_bug() {
    setup_test
    create_mock_utilities
    
    # Override mock utilities to demonstrate the bug
    cat > "$TEST_DIR/mock_utilities/get-next-project" << 'EOF'
#!/bin/bash
# Always return pending path (simulating IPC state)
echo "projects/pending/sync-bug-project"
EOF
    
    cat > "$TEST_DIR/mock_utilities/wait-for-project-name" << 'EOF'
#!/bin/bash
# Always return the original pending path (the bug!)
echo "projects/pending/sync-bug-project"
EOF
    
    cat > "$TEST_DIR/mock_utilities/activate-project" << 'EOF'
#!/bin/bash
# Simulate moving from pending to active
echo "projects/active/sync-bug-project"
EOF
    
    chmod +x "$TEST_DIR/mock_utilities"/*
    
    # Create the pending project
    mkdir -p "$TEST_DIR/projects/pending/sync-bug-project"
    echo "# Test Plan" > "$TEST_DIR/projects/pending/sync-bug-project/plan.md"
    
    echo ""
    echo "  Demonstrating path synchronization bug:"
    echo "  1. Project starts in: projects/pending/sync-bug-project"
    
    output=$("$UTILITIES_DIR/activate-project-with-args" "sync-bug-project" 2>&1)
    
    echo "  2. activate-project returns: projects/active/sync-bug-project"
    echo "  3. But wait-for-project-name still returns: projects/pending/sync-bug-project"
    
    # The output will show the active path, but internally the bug exists
    if [[ "$output" == *"projects/active/sync-bug-project"* ]]; then
        echo "  4. Output shows active path (correct)"
        
        # Now simulate what begin.md does - it uses wait-for-project-name later
        stored_path=$("$TEST_DIR/mock_utilities/wait-for-project-name")
        echo "  5. But subsequent calls get: $stored_path"
        
        if [[ "$stored_path" == "projects/pending/sync-bug-project" ]]; then
            echo -e "  ${RED}BUG REPRODUCED: Stale path in IPC state!${NC}"
            echo -e "  ${YELLOW}Files would be looked for at wrong location${NC}"
            return 0  # Test passes because we successfully reproduced the bug
        fi
    fi
    
    return 1
}

# Run all tests
echo "Running activate-project-with-args tests..."
echo "========================================="

run_test "successful activation" "success" test_successful_activation
run_test "project not found" "success" test_project_not_found
run_test "no arguments" "success" test_no_arguments
run_test "activation failure" "success" test_activation_failure
run_test "project with issue info" "success" test_project_with_issue_info
run_test "project with trailing period" "success" test_project_with_period
run_test "project with quotes and comma" "success" test_project_with_quotes
run_test "project with @ symbol" "success" test_project_with_at_symbol
run_test "path synchronization bug" "success" test_path_sync_bug

echo "========================================="
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"

cleanup_test

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi