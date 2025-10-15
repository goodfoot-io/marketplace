#!/bin/bash

# Test suite for create-plan-version utility

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Create a test directory
TEST_DIR="/tmp/test-create-plan-version-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create project directories structure
mkdir -p projects/{new,pending,active,ready-for-review,complete,icebox}

# Get the utility path
CREATE_PLAN="/workspace/.devcontainer/utilities/create-plan-version"

# Function to run a test
run_test() {
    local test_name="$1"
    local project_name="$2"
    local input_content="$3"
    local expected_filename="$4"
    local should_fail="${5:-false}"
    local expected_path="${6:-}"  # Optional: full expected path for tests that need it
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    echo -e "\n${YELLOW}TEST: $test_name${NC}"
    echo "Project name: '$project_name'"
    echo "Expected file: '$expected_filename'"
    
    # Run the create-plan-version utility
    local output
    local stderr_file="/tmp/plan_stderr_$$"
    
    output=$("$CREATE_PLAN" "$project_name" "$input_content" 2>"$stderr_file")
    
    local exit_code=$?
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"
    
    echo "Exit code: $exit_code"
    echo "Output: '$output'"
    
    if [ "$should_fail" = "true" ]; then
        if [ $exit_code -ne 0 ]; then
            echo -e "${GREEN}✓ PASS${NC} - correctly failed"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            if [ -n "$stderr_output" ]; then
                echo "Expected error: $stderr_output"
            fi
        else
            echo -e "${RED}✗ FAIL${NC} - should have failed but didn't"
        fi
    else
        # If expected_path is provided, use it; otherwise construct from project name
        if [ -z "$expected_path" ]; then
            # Find the project to get its actual path
            for status_dir in projects/new projects/pending projects/active projects/ready-for-review projects/complete projects/icebox; do
                if [ -d "$status_dir/$project_name" ]; then
                    expected_path="$status_dir/$project_name/$expected_filename"
                    break
                fi
            done
        fi
        if [ $exit_code -eq 0 ] && [ "$output" = "$expected_path" ]; then
            # Check if file was created
            if [ -f "$output" ]; then
                # Check content if provided
                if [ -n "$input_content" ]; then
                    actual_content=$(cat "$output")
                    if [ "$actual_content" = "$input_content" ]; then
                        echo -e "${GREEN}✓ PASS${NC}"
                        TESTS_PASSED=$((TESTS_PASSED + 1))
                    else
                        echo -e "${RED}✗ FAIL${NC} - incorrect content"
                        echo "Expected: '$input_content'"
                        echo "Actual: '$actual_content'"
                    fi
                else
                    # Empty file test
                    if [ ! -s "$output" ]; then
                        echo -e "${GREEN}✓ PASS${NC}"
                        TESTS_PASSED=$((TESTS_PASSED + 1))
                    else
                        echo -e "${RED}✗ FAIL${NC} - file should be empty"
                    fi
                fi
            else
                echo -e "${RED}✗ FAIL${NC} - file not created"
            fi
        else
            echo -e "${RED}✗ FAIL${NC} - unexpected result"
            if [ -n "$stderr_output" ]; then
                echo "Stderr: $stderr_output"
            fi
        fi
    fi
}

# Function to create test project
create_test_project() {
    local status="$1"
    local name="$2"
    mkdir -p "projects/$status/$name"
}

echo "Running create-plan-version tests..."
echo "===================================="
echo "Test directory: $TEST_DIR"

# Test 1: First plan version
create_test_project "new" "first-version-test"
run_test "First plan version" "first-version-test" "# First Plan" "plan-v1.md"

# Test 2: Sequential version increment
create_test_project "new" "sequential-test"
"$CREATE_PLAN" "sequential-test" "# Plan v1" >/dev/null 2>&1
"$CREATE_PLAN" "sequential-test" "# Plan v2" >/dev/null 2>&1
run_test "Sequential increment" "sequential-test" "# Plan v3" "plan-v3.md"

# Test 3: Version with gaps
create_test_project "new" "gap-test"
touch "projects/new/gap-test/plan-v1.md"
touch "projects/new/gap-test/plan-v5.md"
touch "projects/new/gap-test/plan-v8.md"
run_test "Version with gaps" "gap-test" "# Plan after gaps" "plan-v9.md"

# Test 4: Empty file creation
create_test_project "pending" "empty-plan-test"
run_test "Empty plan creation" "empty-plan-test" "" "plan-v1.md"

# Test 5: Non-existent project name
run_test "Non-existent project" "does-not-exist" "" "" "true"

# Test 6: Empty project name
run_test "Empty project name" "" "" "" "true"

# Test 7: Project name with slashes (invalid)
run_test "Project name with slashes" "invalid/project/name" "" "" "true"

# Test 8: Project in different status directories
create_test_project "active" "status-move-test"
run_test "Project in active status" "status-move-test" "# Active project" "plan-v1.md"

# Test 9: Large version numbers
create_test_project "new" "large-version-test"
touch "projects/new/large-version-test/plan-v99.md"
run_test "Large version number" "large-version-test" "# Plan v100" "plan-v100.md"

# Test 10: Multiple digit sorting
create_test_project "new" "sort-test"
touch "projects/new/sort-test/plan-v1.md"
touch "projects/new/sort-test/plan-v10.md"
touch "projects/new/sort-test/plan-v2.md"
touch "projects/new/sort-test/plan-v20.md"
run_test "Numeric sorting" "sort-test" "# Correctly sorted" "plan-v21.md"

# Test 11: Special characters in content
create_test_project "new" "special-content-test"
special_content='# Plan with "quotes" and $pecial ch@rs
Line with tabs	and spaces
Line with backslash \ and forward slash /'
run_test "Special characters in content" "special-content-test" "$special_content" "plan-v1.md"

# Test 12: Multiline content
create_test_project "new" "multiline-test"
multiline_content='# Project Plan

## Goals
- Goal 1
- Goal 2

## Technical Approach
1. Step one
2. Step two'
run_test "Multiline content" "multiline-test" "$multiline_content" "plan-v1.md"

# Test 12a: Content with backticks (command substitution)
create_test_project "new" "backtick-test"
backtick_content='# Plan with backticks

## Code Changes
- Change from: `testSessionId ? `transcript/${testSessionId}` : '"'"''"'"'`
- To: `testSessionId ? `transcript/${testSessionId}` : '"'"'transcript/test-default'"'"'`

## Another example
```javascript
const roomName = `room-${id}`;
```'
run_test "Content with backticks" "backtick-test" "$backtick_content" "plan-v1.md"

# Test 12b: Content with unescaped backticks and shell variables
create_test_project "new" "shell-expansion-test"
shell_content='# Shell Expansion Test

## Problematic patterns that should be preserved:
- Backticks: `echo $HOME` and `pwd`
- Variables: $USER, ${PATH}, $1
- Command substitution: $(date) and $(whoami)
- Glob patterns: *.txt and file?.log
- Special chars: & | > < ; 
- Quotes: "double" and '"'"'single'"'"' quotes'
run_test "Shell expansion patterns" "shell-expansion-test" "$shell_content" "plan-v1.md"

# Test 13: All project statuses
for status in new pending active ready-for-review complete icebox; do
    create_test_project "$status" "status-test-$status"
    run_test "Project in $status" "status-test-$status" "# Plan for $status" "plan-v1.md"
done

# Test 14: File permissions
echo -e "\n${YELLOW}TEST: File permissions${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

create_test_project "new" "perm-test"
"$CREATE_PLAN" "perm-test" "# Test content" >/dev/null 2>&1
if [ -r "projects/new/perm-test/plan-v1.md" ] && [ -w "projects/new/perm-test/plan-v1.md" ]; then
    echo -e "${GREEN}✓ PASS${NC} - plan file has correct permissions"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - incorrect file permissions"
fi

# Test 15: Existing non-versioned plans don't interfere
echo -e "\n${YELLOW}TEST: Non-versioned plan files${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

create_test_project "new" "mixed-plans"
touch "projects/new/mixed-plans/plan.md"
touch "projects/new/mixed-plans/plan-draft.md"
touch "projects/new/mixed-plans/plan-v2.md"
output=$("$CREATE_PLAN" "mixed-plans" "" 2>/dev/null)
if [ "$output" = "projects/new/mixed-plans/plan-v3.md" ]; then
    echo -e "${GREEN}✓ PASS${NC} - correctly ignored non-versioned plans"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - incorrect version with mixed plans"
    echo "Output: $output"
fi


# Clean up
cd /
rm -rf "$TEST_DIR"

# Summary
echo
echo "===================================="
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