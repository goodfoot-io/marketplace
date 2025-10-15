#!/bin/bash

# Test suite for initialize-project utility

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Create a test directory
TEST_DIR="/tmp/test-initialize-project-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create project directories structure
mkdir -p projects/{new,pending,active,ready-for-review,complete,icebox}

# Get the utility path
INIT_PROJECT="/workspace/.devcontainer/utilities/initialize-project"

# Function to run a test
run_test() {
    local test_name="$1"
    local project_name="$2"
    local expected_success="$3"
    local expected_path="projects/new/$project_name"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    echo -e "\n${YELLOW}TEST: $test_name${NC}"
    echo "Project name: '$project_name'"
    
    # Run the initialize-project utility
    local output
    local stderr_file="/tmp/init_stderr_$$"
    output=$("$INIT_PROJECT" "$project_name" 2>"$stderr_file")
    local exit_code=$?
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"
    
    echo "Exit code: $exit_code"
    echo "Output: '$output'"
    
    if [ "$expected_success" = "true" ]; then
        if [ $exit_code -eq 0 ] && [ "$output" = "$expected_path" ]; then
            # Check if directory was created
            if [ -d "$expected_path" ]; then
                # Check if log.md was created
                if [ -f "$expected_path/log.md" ]; then
                    # Check log.md content
                    if grep -q "# Project: $project_name" "$expected_path/log.md" && \
                       grep -q "Created: " "$expected_path/log.md"; then
                        echo -e "${GREEN}✓ PASS${NC}"
                        TESTS_PASSED=$((TESTS_PASSED + 1))
                    else
                        echo -e "${RED}✗ FAIL${NC} - log.md has incorrect content"
                        cat "$expected_path/log.md"
                    fi
                else
                    echo -e "${RED}✗ FAIL${NC} - log.md not created"
                fi
            else
                echo -e "${RED}✗ FAIL${NC} - directory not created"
            fi
        else
            echo -e "${RED}✗ FAIL${NC} - unexpected result"
            if [ -n "$stderr_output" ]; then
                echo "Stderr: $stderr_output"
            fi
        fi
    else
        if [ $exit_code -ne 0 ]; then
            echo -e "${GREEN}✓ PASS${NC} - correctly failed"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            if [ -n "$stderr_output" ]; then
                echo "Expected error: $stderr_output"
            fi
        else
            echo -e "${RED}✗ FAIL${NC} - should have failed but didn't"
        fi
    fi
}


echo "Running initialize-project tests..."
echo "=================================="
echo "Test directory: $TEST_DIR"

# Valid project names
run_test "Simple project name" "test-project" "true"
run_test "Project with numbers" "test-123-project" "true"
run_test "Long project name" "this-is-a-very-long-project-name-but-still-ok" "true"
run_test "Short project name" "abc" "true"
run_test "Single letter boundaries" "a-b-c" "true"

# Invalid project names
run_test "Empty project name" "" "false"
run_test "Uppercase letters" "Test-Project" "false"
run_test "Starting with hyphen" "-test-project" "false"
run_test "Ending with hyphen" "test-project-" "false"
run_test "With spaces" "test project" "false"
run_test "With underscore" "test_project" "false"
run_test "With special chars" "test@project" "false"
run_test "Too long name (>50 chars)" "this-is-an-extremely-long-project-name-that-exceeds-fifty-characters" "false"
run_test "Starting with number" "123-test" "true"  # This should actually be allowed

# Test for special characters that could cause shell escaping issues
run_test "Project with backticks" "test\`whoami\`project" "false"
run_test "Project with dollar sign" "test\$USER" "false"
run_test "Project with backslash" "test\\project" "false"
run_test "Project with single quote" "test'project" "false"
run_test "Project with double quote" "test\"project" "false"
run_test "Project with semicolon" "test;project" "false"
run_test "Project with pipe" "test|project" "false"
run_test "Project with ampersand" "test&project" "false"
run_test "Project with parentheses" "test(project)" "false"
run_test "Project with brackets" "test[project]" "false"
run_test "Project with asterisk" "test*project" "false"
run_test "Project with question mark" "test?project" "false"

# Test idempotent behavior (should return existing project path)
echo -e "\n${YELLOW}TEST: Idempotent behavior - existing in new${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
mkdir -p "projects/new/idempotent-test-new"
output=$("$INIT_PROJECT" "idempotent-test-new" 2>/dev/null)
if [ "$output" = "projects/new/idempotent-test-new" ]; then
    echo -e "${GREEN}✓ PASS${NC} - returned existing project path"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - unexpected output: $output"
fi

echo -e "\n${YELLOW}TEST: Idempotent behavior - existing in pending${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
mkdir -p "projects/pending/idempotent-test-pending"
output=$("$INIT_PROJECT" "idempotent-test-pending" 2>/dev/null)
if [ "$output" = "projects/pending/idempotent-test-pending" ]; then
    echo -e "${GREEN}✓ PASS${NC} - returned existing project path in pending"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - unexpected output: $output"
fi

echo -e "\n${YELLOW}TEST: Idempotent behavior - existing in active${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
mkdir -p "projects/active/idempotent-test-active"
output=$("$INIT_PROJECT" "idempotent-test-active" 2>/dev/null)
if [ "$output" = "projects/active/idempotent-test-active" ]; then
    echo -e "${GREEN}✓ PASS${NC} - returned existing project path in active"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - unexpected output: $output"
fi

echo -e "\n${YELLOW}TEST: Existing project preserves log${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
# Create project with existing log
mkdir -p "projects/new/preserve-log-test"
echo "# Existing log content" > "projects/new/preserve-log-test/log.md"
echo "This should be preserved" >> "projects/new/preserve-log-test/log.md"

# Run initialize-project on existing project
output=$("$INIT_PROJECT" "preserve-log-test" 2>/dev/null)

# Check that log was preserved
if [ "$output" = "projects/new/preserve-log-test" ] && \
   grep -q "# Existing log content" "projects/new/preserve-log-test/log.md" && \
   grep -q "This should be preserved" "projects/new/preserve-log-test/log.md"; then
    echo -e "${GREEN}✓ PASS${NC} - existing log file preserved"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - log file was modified or not preserved"
    echo "Log content:"
    cat "projects/new/preserve-log-test/log.md"
fi

# Test log file content
echo -e "\n${YELLOW}TEST: Log file content verification${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

"$INIT_PROJECT" "log-test-project" >/dev/null 2>&1
if [ -f "projects/new/log-test-project/log.md" ]; then
    log_content=$(cat "projects/new/log-test-project/log.md")
    
    # Check for required sections (now minimal - just header and timestamp)
    has_header=$(echo "$log_content" | grep -c "# Project: log-test-project")
    has_timestamp=$(echo "$log_content" | grep -c "Created: ")
    
    if [ $has_header -eq 1 ] && [ $has_timestamp -eq 1 ]; then
        echo -e "${GREEN}✓ PASS${NC} - log file has correct structure"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - log file missing required header sections"
        echo "Log content:"
        cat "projects/new/log-test-project/log.md"
    fi
else
    echo -e "${RED}✗ FAIL${NC} - log file not created"
fi

# Test filesystem permissions
echo -e "\n${YELLOW}TEST: File permissions${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

"$INIT_PROJECT" "perm-test-project" >/dev/null 2>&1
if [ -r "projects/new/perm-test-project/log.md" ] && [ -w "projects/new/perm-test-project/log.md" ]; then
    echo -e "${GREEN}✓ PASS${NC} - log file has correct permissions"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - incorrect file permissions"
fi

# Test that icebox projects are ignored
echo -e "\n${YELLOW}TEST: Icebox projects should be ignored${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

# Create a project in icebox
mkdir -p "projects/icebox/icebox-test-project"
echo "# Old project" > "projects/icebox/icebox-test-project/log.md"

# Try to create a new project with the same name
output=$("$INIT_PROJECT" "icebox-test-project" 2>/dev/null)
expected_path="projects/new/icebox-test-project"

if [ "$output" = "$expected_path" ] && [ -d "$expected_path" ] && [ -f "$expected_path/log.md" ]; then
    # Verify the new project was created
    if grep -q "# Project: icebox-test-project" "$expected_path/log.md"; then
        echo -e "${GREEN}✓ PASS${NC} - new project created despite existing icebox project"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - new project created but log file incorrect"
    fi
else
    echo -e "${RED}✗ FAIL${NC} - failed to create new project (output: $output)"
    if [ "$output" = "projects/icebox/icebox-test-project" ]; then
        echo "Error: Script incorrectly returned icebox project path"
    fi
fi

# Test that complete projects are ignored
echo -e "\n${YELLOW}TEST: Complete projects should be ignored${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

# Create a project in complete
mkdir -p "projects/complete/complete-test-project"
echo "# Completed project" > "projects/complete/complete-test-project/log.md"

# Try to create a new project with the same name
output=$("$INIT_PROJECT" "complete-test-project" 2>/dev/null)
expected_path="projects/new/complete-test-project"

if [ "$output" = "$expected_path" ] && [ -d "$expected_path" ] && [ -f "$expected_path/log.md" ]; then
    # Verify the new project was created
    if grep -q "# Project: complete-test-project" "$expected_path/log.md"; then
        echo -e "${GREEN}✓ PASS${NC} - new project created despite existing complete project"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - new project created but log file incorrect"
    fi
else
    echo -e "${RED}✗ FAIL${NC} - failed to create new project (output: $output)"
    if [ "$output" = "projects/complete/complete-test-project" ]; then
        echo "Error: Script incorrectly returned complete project path"
    fi
fi


# Clean up
cd /
rm -rf "$TEST_DIR"

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