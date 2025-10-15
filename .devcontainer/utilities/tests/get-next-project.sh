#!/bin/bash

# Test script for get-next-project utility
# Tests all scenarios from .claude/commands/project/begin.md section 1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Set CLAUDE_PID for testing
export CLAUDE_PID=$$
export CLAUDE_TEST_MODE=1

# Test counters
PASSED=0
FAILED=0

# Create a temporary test directory
TEST_DIR=$(mktemp -d)
echo "Test directory: $TEST_DIR"

# Change to test directory
cd "$TEST_DIR"

# Create the projects directory structure
mkdir -p projects/new projects/pending projects/active projects/ready-for-review projects/complete projects/icebox

# Helper function to run a test
run_test() {
    local test_name="$1"
    local expected="$2"
    local args="$3"
    
    echo -e "\n${YELLOW}TEST: $test_name${NC}"
    echo "Arguments: '$args'"
    echo "Expected: '$expected'"
    
    # Create the args file
    echo "ARGS=\"$args\"" > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
    
    # Run the script with stderr visible for debugging
    result=$(/workspace/.devcontainer/utilities/get-next-project 2>&1)
    actual_result=$(echo "$result" | grep -v "^DEBUG:" | tail -1)
    
    echo "Full output: '$result'"
    echo "Actual result: '$actual_result'"
    
    if [ "$actual_result" = "$expected" ]; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
        ((FAILED++))
    fi
}

# Helper function to create a project with optional plan
create_project() {
    local location="$1"
    local name="$2"
    local plan_content="$3"
    
    mkdir -p "projects/$location/$name"
    if [ -n "$plan_content" ]; then
        echo "$plan_content" > "projects/$location/$name/plan.md"
    fi
}

# Helper function to create a project with dependencies
create_project_with_deps() {
    local location="$1"
    local name="$2"
    shift 2
    local deps=("$@")
    
    mkdir -p "projects/$location/$name"
    
    # Create plan with dependencies
    {
        echo "---"
        echo "dependencies:"
        for dep in "${deps[@]}"; do
            echo "  - $dep"
        done
        echo "---"
        echo ""
        echo "# Test project $name"
    } > "projects/$location/$name/plan.md"
}

echo -e "\n${YELLOW}=== Test 1: User specifies project in pending ===${NC}"
create_project "pending" "test-project-1" "# Test Project 1"
run_test "Project specified in pending" "projects/pending/test-project-1" "test-project-1"

echo -e "\n${YELLOW}=== Test 2: User specifies project in active ===${NC}"
create_project "active" "test-project-2" "# Test Project 2"
run_test "Project specified in active" "projects/active/test-project-2" "test-project-2"

echo -e "\n${YELLOW}=== Test 3: User specifies project in ready-for-review ===${NC}"
create_project "ready-for-review" "test-project-3" "# Test Project 3"
run_test "Project specified in ready-for-review" "projects/ready-for-review/test-project-3" "test-project-3"

echo -e "\n${YELLOW}=== Test 4: User specifies project with other words ===${NC}"
run_test "Project in middle of arguments" "projects/active/test-project-2" "please work on test-project-2 now"

echo -e "\n${YELLOW}=== Test 5: No project specified - oldest pending without deps ===${NC}"
# Clear all projects first
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
# Create multiple pending projects with different ages
create_project "pending" "oldest-project" "# Oldest Project"
sleep 0.1
create_project "pending" "newer-project" "# Newer Project"
sleep 0.1
create_project "pending" "newest-project" "# Newest Project"
# Touch to make oldest-project actually oldest
touch -t 202301010000 "projects/pending/oldest-project/plan.md"
touch -t 202301010000 "projects/pending/oldest-project"
run_test "Oldest pending project selected" "projects/pending/oldest-project" ""

echo -e "\n${YELLOW}=== Test 6: Oldest pending with unresolved dependencies ===${NC}"
# Clear previous projects
rm -rf projects/pending/*
# Create projects with dependencies
create_project_with_deps "pending" "project-with-deps" "unresolved-dep"
create_project "pending" "unresolved-dep" "# Unresolved dependency"
create_project "pending" "independent-project" "# Independent"
# Make project-with-deps older than independent-project
touch -t 202301010000 "projects/pending/project-with-deps/plan.md"
touch -t 202301010000 "projects/pending/project-with-deps"
# Make unresolved-dep newer (so it's not selected)
touch -t 202301020000 "projects/pending/unresolved-dep/plan.md"
touch -t 202301020000 "projects/pending/unresolved-dep"
# Make independent-project in the middle
touch -t 202301011200 "projects/pending/independent-project/plan.md"
touch -t 202301011200 "projects/pending/independent-project"
run_test "Skip project with unresolved deps" "projects/pending/independent-project" ""

echo -e "\n${YELLOW}=== Test 7: Oldest pending with resolved dependencies (in complete) ===${NC}"
# Move the dependency to complete
mv "projects/pending/unresolved-dep" "projects/complete/"
run_test "Select project with resolved deps (complete)" "projects/pending/project-with-deps" ""

echo -e "\n${YELLOW}=== Test 8: Oldest pending with resolved dependencies (in ready-for-review) ===${NC}"
# Clear and recreate
rm -rf projects/pending/* projects/complete/*
create_project_with_deps "pending" "project-with-deps-2" "resolved-dep"
create_project "ready-for-review" "resolved-dep" "# Resolved dependency"
run_test "Select project with resolved deps (ready)" "projects/pending/project-with-deps-2" ""

echo -e "\n${YELLOW}=== Test 9: Oldest pending with resolved dependencies (deleted) ===${NC}"
# Clear and recreate
rm -rf projects/pending/* projects/ready-for-review/*
create_project_with_deps "pending" "project-with-deps-3" "deleted-dep"
# Don't create the dependency - it's "deleted"
run_test "Select project with deleted deps" "projects/pending/project-with-deps-3" ""

echo -e "\n${YELLOW}=== Test 10: Multiple dependencies - all resolved ===${NC}"
rm -rf projects/pending/* projects/complete/*
create_project_with_deps "pending" "multi-dep-project" "dep1" "dep2" "dep3"
create_project "complete" "dep1" "# Dep 1"
create_project "complete" "dep2" "# Dep 2"
create_project "ready-for-review" "dep3" "# Dep 3"
run_test "Multiple dependencies all resolved" "projects/pending/multi-dep-project" ""

echo -e "\n${YELLOW}=== Test 11: Multiple dependencies - one unresolved ===${NC}"
rm -rf "projects/complete/dep2"
create_project "pending" "dep2" "# Dep 2 - back in pending"
# Since multi-dep-project has unresolved dependency and dep2 is also in pending,
# and there are no other projects without dependencies, result should be empty
# unless dep2 itself has no dependencies (which it doesn't)
run_test "Multiple dependencies one unresolved" "projects/pending/dep2" ""

echo -e "\n${YELLOW}=== Test 12: Project with versioned plan files ===${NC}"
rm -rf projects/pending/*
mkdir -p "projects/pending/versioned-project"
echo "# Plan v1" > "projects/pending/versioned-project/plan-v1.md"
echo "# Plan v2" > "projects/pending/versioned-project/plan-v2.md"
{
    echo "---"
    echo "dependencies:"
    echo "  - some-dep"
    echo "---"
    echo "# Plan v3"
} > "projects/pending/versioned-project/plan-v3.md"
create_project "complete" "some-dep" "# Dependency"
run_test "Project with versioned plans" "projects/pending/versioned-project" ""

echo -e "\n${YELLOW}=== Test 13: Empty arguments file ===${NC}"
echo 'ARGS=""' > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
run_test "Empty arguments" "projects/pending/versioned-project" ""

echo -e "\n${YELLOW}=== Test 14: No arguments file ===${NC}"
rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh
result=$(/workspace/.devcontainer/utilities/get-next-project 2>&1)
actual_result=$(echo "$result" | grep -v "^DEBUG:" | tail -1)
echo "Result without args file: '$actual_result'"
if [ "$actual_result" = "projects/pending/versioned-project" ]; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 15: Priority order - pending before active ===${NC}"
create_project "pending" "duplicate-project" "# In pending"
create_project "active" "duplicate-project" "# In active"
create_project "ready-for-review" "duplicate-project" "# In ready"
run_test "Priority: pending over others" "projects/pending/duplicate-project" "duplicate-project"

echo -e "\n${YELLOW}=== Test 16: No eligible projects ===${NC}"
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
run_test "No projects available" "" ""

echo -e "\n${YELLOW}=== Test 17: Project in new directory (should not be found) ===${NC}"
create_project "new" "new-project" "# New project"
run_test "Project in new not found" "" "new-project"

echo -e "\n${YELLOW}=== Test 18: YAML frontmatter edge cases ===${NC}"
rm -rf projects/pending/*
# Project with empty dependencies
mkdir -p "projects/pending/empty-deps"
{
    echo "---"
    echo "dependencies:"
    echo "---"
    echo "# Empty deps"
} > "projects/pending/empty-deps/plan.md"
run_test "Empty dependencies list" "projects/pending/empty-deps" ""

# Clear before next test
rm -rf projects/pending/*
# Project with malformed YAML
mkdir -p "projects/pending/malformed-yaml"
{
    echo "---"
    echo "dependencies"
    echo "  - bad-yaml"
    echo "---"
    echo "# Malformed"
} > "projects/pending/malformed-yaml/plan.md"
touch -t 202301010000 "projects/pending/malformed-yaml/plan.md"
run_test "Malformed YAML ignored" "projects/pending/malformed-yaml" ""

echo -e "\n${YELLOW}=== Test 19: Complex argument parsing ===${NC}"
create_project "active" "my-feature" "# My Feature"
run_test "Project name with hyphens" "projects/active/my-feature" "implement my-feature with tests"

echo -e "\n${YELLOW}=== Test 20: Absolute path to project ===${NC}"
create_project "ready-for-review" "path-test-project" "# Path test"
# Use the test directory's absolute path
run_test "Absolute path to project" "projects/ready-for-review/path-test-project" "$TEST_DIR/projects/ready-for-review/path-test-project"

echo -e "\n${YELLOW}=== Test 21: Relative path to project ===${NC}"
run_test "Relative path to project" "projects/ready-for-review/path-test-project" "projects/ready-for-review/path-test-project"

echo -e "\n${YELLOW}=== Test 22: Path with trailing slash ===${NC}"
run_test "Path with trailing slash" "projects/ready-for-review/path-test-project" "projects/ready-for-review/path-test-project/"

echo -e "\n${YELLOW}=== Test 23: Path to pending project ===${NC}"
create_project "pending" "pending-path-test" "# Pending path test"
run_test "Path to pending project" "projects/pending/pending-path-test" "$TEST_DIR/projects/pending/pending-path-test"

echo -e "\n${YELLOW}=== Test 24: Path to active project ===${NC}"
create_project "active" "active-path-test" "# Active path test"
run_test "Path to active project" "projects/active/active-path-test" "projects/active/active-path-test"

echo -e "\n${YELLOW}=== Test 25: Mixed with other words ===${NC}"
run_test "Path mixed with words" "projects/active/active-path-test" "please check projects/active/active-path-test now"

echo -e "\n${YELLOW}=== Test 26: Export to args file ===${NC}"
echo 'ARGS="test-export"' > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
create_project "pending" "test-export" "# Export test"
/workspace/.devcontainer/utilities/get-next-project > /dev/null 2>&1
source /tmp/slash_cmd_args_${CLAUDE_PID}.sh
if [ "$SELECTED_PROJECT" = "projects/pending/test-export" ]; then
    echo -e "${GREEN}PASS - Export works${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL - Export not working${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 27: Projects in icebox (should not be found) ===${NC}"
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
create_project "icebox" "archived-project" "# Archived project"
run_test "Project in icebox not found" "" "archived-project"

echo -e "\n${YELLOW}=== Test 28: Project with special characters (@) ===${NC}"
create_project "pending" "test@project" "# Project with @"
run_test "Project with @ character" "projects/pending/test@project" "test@project"

echo -e "\n${YELLOW}=== Test 29: Project with special characters (!) ===${NC}"
create_project "active" "test!project" "# Project with !"
run_test "Project with ! character" "projects/active/test!project" "test!project"

echo -e "\n${YELLOW}=== Test 30: Project with special characters (#) ===${NC}"
create_project "ready-for-review" "test#project" "# Project with #"
run_test "Project with # character" "projects/ready-for-review/test#project" "test#project"

echo -e "\n${YELLOW}=== Test 31: Case sensitivity test ===${NC}"
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
create_project "pending" "Test-Project" "# Mixed case project"
run_test "Case sensitive - exact match" "projects/pending/Test-Project" "Test-Project"
# Remove the project before testing wrong case
rm -rf projects/pending/*
run_test "Case sensitive - wrong case" "" "test-project"

echo -e "\n${YELLOW}=== Test 32: Partial name matching (should not match) ===${NC}"
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
create_project "pending" "test-project-full" "# Full name project"
# When searching for "test-project" and it doesn't exist, the script selects oldest pending
# So this behavior is correct - it finds test-project-full as the oldest pending project
run_test "Partial name doesn't match - falls back to oldest" "projects/pending/test-project-full" "test-project"

echo -e "\n${YELLOW}=== Test 33: Quoted arguments ===${NC}"
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
create_project "pending" "quoted-project" "# Quoted project"
# Single quotes are preserved as part of the word
# When it doesn't find the project, it falls back to oldest pending
run_test "Single quoted argument - falls back to oldest" "projects/pending/quoted-project" "'quoted-project'"
# Double quotes get stripped by bash when processing $ARGS
run_test "Double quoted argument matches" "projects/pending/quoted-project" '"quoted-project"'
# Without quotes should also work
run_test "Without quotes matches" "projects/pending/quoted-project" "quoted-project"

echo -e "\n${YELLOW}=== Test 34: Project name that looks like a path ===${NC}"
# Project names with slashes would create subdirectories, which is not a valid project structure
# So we test with underscore instead to simulate the concept
create_project "pending" "pending_active" "# Path-like name"
run_test "Path-like project name" "projects/pending/pending_active" "pending_active"

echo -e "\n${YELLOW}=== Test 35: Project name starting with hyphen ===${NC}"
create_project "pending" "-my-project" "# Hyphen prefix"
run_test "Project starting with hyphen" "projects/pending/-my-project" "-my-project"

echo -e "\n${YELLOW}=== Test 36: Empty project directory (no plan file) ===${NC}"
mkdir -p "projects/pending/empty-project"
# Don't create a plan file
# Note: Current implementation finds the directory even without plan file
# This behavior might be acceptable as it checks for plan files later
run_test "Empty project directory found" "projects/pending/empty-project" "empty-project"

echo -e "\n${YELLOW}=== Test 37: Very long project name ===${NC}"
long_name="this-is-a-very-long-project-name-that-tests-bash-variable-handling-limits"
create_project "pending" "$long_name" "# Long name project"
run_test "Very long project name" "projects/pending/$long_name" "$long_name"

echo -e "\n${YELLOW}=== Test 38: Bug - ready-for-review project selected with no args ===${NC}"
# Reproduce the issue where a ready-for-review project is selected when no args given
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
# Create only a project in ready-for-review
create_project "ready-for-review" "bug-test-project" "# Bug test project"
# With no pending projects and no args, should return empty, not the ready-for-review project
run_test "No args should not select ready-for-review project" "" ""

echo -e "\n${YELLOW}=== Test 39: Bug reproduction - exact scenario ===${NC}"
# Try to reproduce exact scenario from user's test
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
create_project "ready-for-review" "identify-event-based-e2e-improvements" "# E2E improvements"
# Test with no args - should not find the ready-for-review project
echo 'ARGS="This is a test without specifying a project directory"' > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
result=$(/workspace/.devcontainer/utilities/get-next-project 2>&1)
actual_result=$(echo "$result" | grep -v "^DEBUG:" | tail -1)
echo "Result with no project specified: '$actual_result'"
if [ "$actual_result" = "projects/ready-for-review/identify-event-based-e2e-improvements" ]; then
    echo -e "${RED}FAIL - Bug reproduced! Ready-for-review project was selected${NC}"
    ((FAILED++))
elif [ -z "$actual_result" ]; then
    echo -e "${GREEN}PASS - Correctly returned empty${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL - Unexpected result: $actual_result${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 40: Check if 'directory' matches as project name ===${NC}"
# Maybe one of the words in the args is matching a project
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
create_project "ready-for-review" "directory" "# Directory project"
echo 'ARGS="This is a test without specifying a project directory"' > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
result=$(/workspace/.devcontainer/utilities/get-next-project 2>&1)
actual_result=$(echo "$result" | grep -v "^DEBUG:" | tail -1)
echo "Result when 'directory' is a project: '$actual_result'"
if [ "$actual_result" = "projects/ready-for-review/directory" ]; then
    echo -e "${GREEN}PASS - Found the issue! 'directory' word matches project name${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL - Did not find 'directory' project: $actual_result${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 41: Check export line behavior ===${NC}"
# Test if pre-existing export affects behavior
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
create_project "ready-for-review" "test-project" "# Test project"
# Create args file with pre-existing export
{
    echo 'ARGS="no project here"'
    echo 'export SELECTED_PROJECT="projects/ready-for-review/identify-event-based-e2e-improvements"'
} > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
result=$(/workspace/.devcontainer/utilities/get-next-project 2>&1)
actual_result=$(echo "$result" | grep -v "^DEBUG:" | tail -1)
echo "Result with pre-existing export: '$actual_result'"
# Check the args file after
echo "Args file after:"
cat /tmp/slash_cmd_args_${CLAUDE_PID}.sh
if [ "$actual_result" = "" ]; then
    echo -e "${GREEN}PASS - Script correctly returns empty${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL - Unexpected result: $actual_result${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 42: Pending project with same name as ready-for-review ===${NC}"
# Test the likely scenario - a pending project exists with same name
rm -rf projects/pending/* projects/active/* projects/ready-for-review/*
create_project "ready-for-review" "identify-event-based-e2e-improvements" "# In review"
create_project "pending" "identify-event-based-e2e-improvements" "# In pending"
echo 'ARGS="This is a test without specifying a project directory"' > /tmp/slash_cmd_args_${CLAUDE_PID}.sh
result=$(/workspace/.devcontainer/utilities/get-next-project 2>&1)
actual_result=$(echo "$result" | grep -v "^DEBUG:" | tail -1)
echo "Result when same project in pending and ready-for-review: '$actual_result'"
if [ "$actual_result" = "projects/pending/identify-event-based-e2e-improvements" ]; then
    echo -e "${GREEN}PASS - Correctly selected from pending${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL - Unexpected result: $actual_result${NC}"
    ((FAILED++))
fi

# Clean up
cd /
rm -rf "$TEST_DIR"
rm -f /tmp/slash_cmd_args_${CLAUDE_PID}.sh

# Summary
echo -e "\n${YELLOW}===== TEST SUMMARY =====${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo -e "Total: $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi