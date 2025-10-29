#!/bin/bash

# Test suite for activate-project utility

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create a test directory
TEST_DIR="/tmp/test-activate-project-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create project directories
mkdir -p projects/{new,pending,active,ready-for-review,complete,icebox}

# Test counters
PASSED=0
FAILED=0

# Utility function to create a test project
create_project() {
    local location="$1"
    local name="$2"
    local plan_content="${3:-# Test Plan}"
    local plan_file="${4:-plan.md}"
    
    mkdir -p "projects/$location/$name"
    if [ -n "$plan_file" ]; then
        echo "$plan_content" > "projects/$location/$name/$plan_file"
    fi
}

# Utility function to run a test
run_test() {
    local test_name="$1"
    local project_path="$2"
    local expected_result="$3"
    local should_fail="${4:-false}"
    
    echo -e "\n${YELLOW}TEST: $test_name${NC}"
    echo "Input path: '$project_path'"
    echo "Expected: '$expected_result'"
    
    # Run the command and capture both stdout and stderr
    local output
    local stderr_file="/tmp/activate_stderr_$$"
    output=$(/workspace/.devcontainer/utilities/activate-project "$project_path" 2>"$stderr_file")
    local exit_code=$?
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"
    
    echo "Actual result: '$output'"
    echo "Exit code: $exit_code"
    
    if [ "$should_fail" = "true" ]; then
        if [ $exit_code -ne 0 ]; then
            echo -e "${GREEN}PASS${NC} - Correctly failed"
            ((PASSED++))
        else
            echo -e "${RED}FAIL${NC} - Should have failed but didn't"
            ((FAILED++))
        fi
    else
        if [ "$output" = "$expected_result" ] && [ $exit_code -eq 0 ]; then
            echo -e "${GREEN}PASS${NC}"
            ((PASSED++))
            
            # Verify the project is actually in active
            if [ -d "$expected_result" ]; then
                echo "Verified: Project exists at $expected_result"
            else
                echo -e "${RED}ERROR${NC}: Project not found at expected location!"
                ((FAILED++))
                ((PASSED--))
            fi
        else
            echo -e "${RED}FAIL${NC}"
            if [ -n "$stderr_output" ]; then
                echo "Stderr: $stderr_output"
            fi
            ((FAILED++))
        fi
    fi
}

echo "Test directory: $TEST_DIR"

echo -e "\n${YELLOW}=== Test 1: Activate project from pending ===${NC}"
create_project "pending" "test-project-1" "# Plan for test project 1"
run_test "Pending to active" "projects/pending/test-project-1" "projects/active/test-project-1"

# Check if log was created
if [ -f "projects/active/test-project-1/log.md" ]; then
    echo -e "${GREEN}Log file created${NC}"
else
    echo -e "${RED}Log file NOT created${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 2: Activate project from ready-for-review ===${NC}"
create_project "ready-for-review" "test-project-2" "# Plan for test project 2"
run_test "Ready-for-review to active" "projects/ready-for-review/test-project-2" "projects/active/test-project-2"

echo -e "\n${YELLOW}=== Test 3: Continue active project ===${NC}"
create_project "active" "test-project-3" "# Active project"
if [ ! -f "projects/active/test-project-3/log.md" ]; then
    echo "# Existing log" > "projects/active/test-project-3/log.md"
fi
run_test "Continue active project" "projects/active/test-project-3" "projects/active/test-project-3"

echo -e "\n${YELLOW}=== Test 4: Versioned plan files ===${NC}"
rm -rf projects/pending/versioned-project
create_project "pending" "versioned-project" "# Plan v1" "plan-v1.md"
create_project "pending" "versioned-project" "# Plan v2" "plan-v2.md"
create_project "pending" "versioned-project" "# Plan v3" "plan-v3.md"
run_test "Versioned plans" "projects/pending/versioned-project" "projects/active/versioned-project"

# Check that plan.md contains v3 content
if [ -f "projects/active/versioned-project/plan.md" ]; then
    content=$(cat "projects/active/versioned-project/plan.md")
    if [ "$content" = "# Plan v3" ]; then
        echo -e "${GREEN}Correct plan version selected${NC}"
    else
        echo -e "${RED}Wrong plan version: $content${NC}"
        ((FAILED++))
    fi
fi

# Check that versioned files were removed
if ls projects/active/versioned-project/plan-v*.md 2>/dev/null; then
    echo -e "${RED}Versioned plan files not removed${NC}"
    ((FAILED++))
else
    echo -e "${GREEN}Versioned plan files removed${NC}"
fi

echo -e "\n${YELLOW}=== Test 5: Invalid project path ===${NC}"
run_test "Invalid path format" "invalid/path/format" "" true

echo -e "\n${YELLOW}=== Test 6: Non-existent project ===${NC}"
run_test "Non-existent project" "projects/pending/does-not-exist" "" true

echo -e "\n${YELLOW}=== Test 7: Empty project path ===${NC}"
run_test "Empty path" "" "" true

echo -e "\n${YELLOW}=== Test 8: Absolute path ===${NC}"
create_project "pending" "absolute-test" "# Absolute path test"
run_test "Absolute path" "$TEST_DIR/projects/pending/absolute-test" "projects/active/absolute-test"

echo -e "\n${YELLOW}=== Test 9: Path with trailing slash ===${NC}"
create_project "pending" "trailing-slash" "# Trailing slash test"
run_test "Trailing slash" "projects/pending/trailing-slash/" "projects/active/trailing-slash"

echo -e "\n${YELLOW}=== Test 10: Project already exists in active ===${NC}"
# First activation
create_project "pending" "duplicate-test" "# Duplicate test"
/workspace/.devcontainer/utilities/activate-project "projects/pending/duplicate-test" >/dev/null 2>&1

# Try to activate another project with same name from ready-for-review
create_project "ready-for-review" "duplicate-test" "# Another duplicate"
output=$(/workspace/.devcontainer/utilities/activate-project "projects/ready-for-review/duplicate-test" 2>&1)
exit_code=$?
if [ $exit_code -ne 0 ]; then
    echo -e "${GREEN}PASS${NC} - Correctly failed when active project exists"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC} - Should have failed with duplicate project"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 11: Project with no plan file ===${NC}"
mkdir -p projects/pending/no-plan-project
run_test "No plan file" "projects/pending/no-plan-project" "projects/active/no-plan-project"

echo -e "\n${YELLOW}=== Test 12: Project with special characters ===${NC}"
create_project "pending" "test-project-@#$" "# Special chars"
run_test "Special characters" "projects/pending/test-project-@#$" "projects/active/test-project-@#$"

echo -e "\n${YELLOW}=== Test 13: Nested project structure ===${NC}"
create_project "pending" "parent/child/project" "# Nested project"
run_test "Nested project" "projects/pending/parent/child/project" "projects/active/parent/child/project"

echo -e "\n${YELLOW}=== Test 14: Already activated project (idempotent) ===${NC}"
create_project "active" "already-active" "# Already active"
echo "# Existing log content" > "projects/active/already-active/log.md"
run_test "Already active project" "projects/active/already-active" "projects/active/already-active"

# Verify log wasn't overwritten
if grep -q "Existing log content" "projects/active/already-active/log.md"; then
    echo -e "${GREEN}Log preserved for continuing project${NC}"
else
    echo -e "${RED}Log was overwritten!${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 15: Mixed case versioned plans ===${NC}"
rm -rf projects/pending/mixed-version
create_project "pending" "mixed-version" "# Plan 1" "plan-v1.md"
create_project "pending" "mixed-version" "# Plan 10" "plan-v10.md"
create_project "pending" "mixed-version" "# Plan 2" "plan-v2.md"
run_test "Mixed version numbers" "projects/pending/mixed-version" "projects/active/mixed-version"

# Check that v10 was selected (natural sort)
if grep -q "Plan 10" "projects/active/mixed-version/plan.md"; then
    echo -e "${GREEN}Correct version sorting (v10 > v2)${NC}"
else
    echo -e "${RED}Incorrect version sorting${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 16: Project with backticks in filename ===${NC}"
# Create a project with backticks in the plan filename that could cause command substitution
rm -rf projects/pending/backtick-test
mkdir -p projects/pending/backtick-test
# Create files with backticks in name - this simulates what could happen with versioned plans
touch "projects/pending/backtick-test/plan-v\`date\`.md"
touch "projects/pending/backtick-test/plan-v1.md"
echo "# Safe plan content" > "projects/pending/backtick-test/plan-v1.md"
echo "# Dangerous plan" > "projects/pending/backtick-test/plan-v\`date\`.md"
run_test "Backticks in filename" "projects/pending/backtick-test" "projects/active/backtick-test"

# Verify no command substitution occurred
if [ -f "projects/active/backtick-test/plan.md" ]; then
    echo -e "${GREEN}Plan file created successfully${NC}"
    # Check that the dangerous file was handled correctly
    if ls "projects/active/backtick-test/" | grep -q date; then
        echo -e "${RED}Command substitution may have occurred!${NC}"
        ((FAILED++))
    else
        echo -e "${GREEN}No command substitution detected${NC}"
    fi
else
    echo -e "${RED}Plan file not created${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 17: Project name with shell metacharacters ===${NC}"
# Test various shell metacharacters in project names
create_project "pending" "test\$(whoami)" "# Project with dollar paren"
run_test "Dollar paren in name" "projects/pending/test\$(whoami)" "projects/active/test\$(whoami)"

echo -e "\n${YELLOW}=== Test 18: Versioned plans in active project ===${NC}"
# Test handling of versioned plan files in an already active project
rm -rf projects/active/versioned-test
create_project "active" "versioned-test" "# Original plan"
chmod 444 "projects/active/versioned-test/plan.md"  # Make it read-only like it would be

# Add versioned plan files
echo "# Plan v1 - Old version" > "projects/active/versioned-test/plan-v1.md"
echo "# Plan v2 - New version" > "projects/active/versioned-test/plan-v2.md"

# Save original plan content for verification
original_plan=$(cat "projects/active/versioned-test/plan.md")

# Activate the project (should replace plan.md with plan-v2.md)
run_test "Versioned plans in active" "projects/active/versioned-test" "projects/active/versioned-test"

# Verify the new plan is in place
if [ -f "projects/active/versioned-test/plan.md" ]; then
    new_content=$(cat "projects/active/versioned-test/plan.md")
    if [ "$new_content" = "# Plan v2 - New version" ]; then
        echo -e "${GREEN}New plan correctly installed${NC}"
    else
        echo -e "${RED}Wrong plan content: $new_content${NC}"
        ((FAILED++))
    fi
    
    # Check that plan.md is read-only
    if [ ! -w "projects/active/versioned-test/plan.md" ]; then
        echo -e "${GREEN}Plan is read-only${NC}"
    else
        echo -e "${RED}Plan is not read-only${NC}"
        ((FAILED++))
    fi
fi

# Check that backup was created
backup_files=$(ls projects/active/versioned-test/plan.md.backup-* 2>/dev/null | wc -l)
if [ "$backup_files" -gt 0 ]; then
    echo -e "${GREEN}Backup of original plan created${NC}"
    # Verify backup content
    backup_content=$(cat projects/active/versioned-test/plan.md.backup-*)
    if [ "$backup_content" = "$original_plan" ]; then
        echo -e "${GREEN}Backup contains correct content${NC}"
    else
        echo -e "${RED}Backup has wrong content${NC}"
        ((FAILED++))
    fi
else
    echo -e "${RED}No backup created${NC}"
    ((FAILED++))
fi

# Check that versioned files were removed
if ls projects/active/versioned-test/plan-v*.md 2>/dev/null; then
    echo -e "${RED}Versioned plan files not removed${NC}"
    ((FAILED++))
else
    echo -e "${GREEN}Versioned plan files removed${NC}"
fi

echo -e "\n${YELLOW}=== Test 19: Verify printf vs echo safety ===${NC}"
# Create a specific test to ensure printf is safer than echo
rm -rf projects/pending/printf-test
mkdir -p projects/pending/printf-test
# Create multiple versioned files including one with backticks
for i in 1 2 3; do
    touch "projects/pending/printf-test/plan-v${i}.md"
    echo "# Plan version $i" > "projects/pending/printf-test/plan-v${i}.md"
done
# Add a file with backticks that would be selected last by sort
touch "projects/pending/printf-test/plan-v\`echo INJECTED\`.md"
echo "# Dangerous content" > "projects/pending/printf-test/plan-v\`echo INJECTED\`.md"

# Activate the project
output=$(/workspace/.devcontainer/utilities/activate-project "projects/pending/printf-test" 2>&1)
exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}Project activated successfully${NC}"
    # Check the content of the final plan.md
    if [ -f "projects/active/printf-test/plan.md" ]; then
        content=$(cat "projects/active/printf-test/plan.md")
        if [[ "$content" == *"INJECTED"* ]]; then
            echo -e "${RED}FAIL: Command injection detected in plan content!${NC}"
            ((FAILED++))
        elif [[ "$content" == *"Dangerous content"* ]]; then
            echo -e "${GREEN}PASS: Backtick file was selected but handled safely${NC}"
            ((PASSED++))
        else
            echo -e "${GREEN}PASS: Safe plan version was selected${NC}"
            ((PASSED++))
        fi
    fi
else
    echo -e "${RED}Project activation failed${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 20: Versioned description files from pending ===${NC}"
# Test handling of versioned description files
rm -rf projects/pending/project-with-desc
create_project "pending" "project-with-desc" "# Plan v1" "plan-v1.md"
echo "# Description v1" > "projects/pending/project-with-desc/description-v1.md"
echo "# Description v2" > "projects/pending/project-with-desc/description-v2.md"

run_test "Project with versioned descriptions" "projects/pending/project-with-desc" "projects/active/project-with-desc"

# Check that highest versioned description became description.md
if [ -f "projects/active/project-with-desc/description.md" ]; then
    content=$(cat "projects/active/project-with-desc/description.md")
    if [ "$content" = "# Description v2" ]; then
        echo -e "${GREEN}PASS: Highest versioned description became description.md${NC}"
        ((PASSED++))
    else
        echo -e "${RED}FAIL: Wrong description content${NC}"
        ((FAILED++))
    fi
    
    # Check that description.md is read-only
    if [ ! -w "projects/active/project-with-desc/description.md" ]; then
        echo -e "${GREEN}Description is read-only${NC}"
    else
        echo -e "${RED}Description is not read-only${NC}"
        ((FAILED++))
    fi
else
    echo -e "${RED}FAIL: description.md not created${NC}"
    ((FAILED++))
fi

# Check that versioned descriptions were removed
if ls projects/active/project-with-desc/description-v*.md 2>/dev/null; then
    echo -e "${RED}FAIL: Versioned description files still exist${NC}"
    ((FAILED++))
else
    echo -e "${GREEN}PASS: Versioned description files removed${NC}"
    ((PASSED++))
fi

echo -e "\n${YELLOW}=== Test 21: Replan with description in active project ===${NC}"
# Test handling of versioned description files in an already active project (replan scenario)
rm -rf projects/active/replan-desc-test
create_project "active" "replan-desc-test" "# Original plan"
echo "# Original description" > "projects/active/replan-desc-test/description.md"
chmod 444 "projects/active/replan-desc-test/plan.md"
chmod 444 "projects/active/replan-desc-test/description.md"

# Add versioned files (simulating a replan with descriptions)
echo "# Plan v2 - New replan" > "projects/active/replan-desc-test/plan-v2.md"
echo "# Description v2 - New description" > "projects/active/replan-desc-test/description-v2.md"

# Save original content for verification
original_desc=$(cat "projects/active/replan-desc-test/description.md")

# Activate the project
run_test "Replan with description in active" "projects/active/replan-desc-test" "projects/active/replan-desc-test"

# Verify the new description is in place
if [ -f "projects/active/replan-desc-test/description.md" ]; then
    new_content=$(cat "projects/active/replan-desc-test/description.md")
    if [ "$new_content" = "# Description v2 - New description" ]; then
        echo -e "${GREEN}New description correctly installed${NC}"
        ((PASSED++))
    else
        echo -e "${RED}Wrong description content: $new_content${NC}"
        ((FAILED++))
    fi
    
    # Check that description.md is read-only
    if [ ! -w "projects/active/replan-desc-test/description.md" ]; then
        echo -e "${GREEN}Description is read-only${NC}"
    else
        echo -e "${RED}Description is not read-only${NC}"
        ((FAILED++))
    fi
fi

# Check that backup was created for description
backup_files=$(ls projects/active/replan-desc-test/description.md.backup-* 2>/dev/null | wc -l)
if [ "$backup_files" -gt 0 ]; then
    echo -e "${GREEN}Backup of original description created${NC}"
    # Verify backup content
    backup_content=$(cat projects/active/replan-desc-test/description.md.backup-*)
    if [ "$backup_content" = "$original_desc" ]; then
        echo -e "${GREEN}Description backup contains correct content${NC}"
    else
        echo -e "${RED}Description backup has wrong content${NC}"
        ((FAILED++))
    fi
else
    echo -e "${RED}No description backup created${NC}"
    ((FAILED++))
fi

echo -e "\n${YELLOW}=== Test 22: Mixed versioned plans and descriptions ===${NC}"
# Test that plans and descriptions are handled independently
rm -rf projects/pending/mixed-versions
create_project "pending" "mixed-versions" "# Plan v1" "plan-v1.md"
echo "# Plan v3" > "projects/pending/mixed-versions/plan-v3.md"
echo "# Description v2" > "projects/pending/mixed-versions/description-v2.md"
echo "# Description v4" > "projects/pending/mixed-versions/description-v4.md"

run_test "Mixed version numbers" "projects/pending/mixed-versions" "projects/active/mixed-versions"

# Check that correct versions were selected
if [ -f "projects/active/mixed-versions/plan.md" ]; then
    plan_content=$(cat "projects/active/mixed-versions/plan.md")
    if [ "$plan_content" = "# Plan v3" ]; then
        echo -e "${GREEN}PASS: Highest plan version (v3) selected${NC}"
        ((PASSED++))
    else
        echo -e "${RED}FAIL: Wrong plan selected${NC}"
        ((FAILED++))
    fi
fi

if [ -f "projects/active/mixed-versions/description.md" ]; then
    desc_content=$(cat "projects/active/mixed-versions/description.md")
    if [ "$desc_content" = "# Description v4" ]; then
        echo -e "${GREEN}PASS: Highest description version (v4) selected${NC}"
        ((PASSED++))
    else
        echo -e "${RED}FAIL: Wrong description selected${NC}"
        ((FAILED++))
    fi
fi

echo -e "\n${YELLOW}=== Test 23: Path Synchronization Failure Reproduction ===${NC}"
# This test reproduces the path synchronization bug where activate-project returns
# the new path but the IPC state (used by wait-for-project-name) still contains the old path
echo -e "${YELLOW}Demonstrating the path sync failure from begin.md workflow${NC}"

# Setup: Create a pending project
rm -rf projects/pending/path-sync-test
create_project "pending" "path-sync-test" "# Path sync test plan"

# Simulate the begin.md workflow
echo "Step 1: Simulating get-next-project storing path in IPC state"
PROJECT_PATH="projects/pending/path-sync-test"
echo "  Initial path from get-next-project: $PROJECT_PATH"

echo "Step 2: Calling activate-project (moves to active)"
ACTIVE_PROJECT=$(/workspace/.devcontainer/utilities/activate-project "$PROJECT_PATH" 2>/dev/null)
echo "  Returned path from activate-project: $ACTIVE_PROJECT"

echo "Step 3: Checking if files exist at original location"
if [ -f "$PROJECT_PATH/plan.md" ]; then
    echo -e "  ${RED}ERROR: File still exists at original location (shouldn't happen)${NC}"
    ((FAILED++))
else
    echo -e "  ${GREEN}Correct: File no longer at original location${NC}"
fi

echo "Step 4: Checking if files exist at new location"
if [ -f "$ACTIVE_PROJECT/plan.md" ]; then
    echo -e "  ${GREEN}Correct: File exists at new location${NC}"
else
    echo -e "  ${RED}ERROR: File not found at new location${NC}"
    ((FAILED++))
fi

echo "Step 5: Simulating Task() call with original path (the bug)"
echo "  Task() would use: @$PROJECT_PATH/plan.md"
if [ -f "$PROJECT_PATH/plan.md" ]; then
    echo -e "  ${GREEN}Would succeed (file found)${NC}"
else
    echo -e "  ${RED}Would FAIL: File not found at $PROJECT_PATH/plan.md${NC}"
    echo -e "  ${RED}This is the PATH SYNCHRONIZATION BUG!${NC}"
    echo -e "  ${YELLOW}The file is actually at: $ACTIVE_PROJECT/plan.md${NC}"
    # Don't count this as a test failure since we're demonstrating the bug
fi

echo "Step 6: Simulating Task() call with returned path (the fix)"
echo "  Task() should use: @$ACTIVE_PROJECT/plan.md"
if [ -f "$ACTIVE_PROJECT/plan.md" ]; then
    echo -e "  ${GREEN}Would succeed (file found at correct location)${NC}"
else
    echo -e "  ${RED}Would fail (unexpected)${NC}"
    ((FAILED++))
fi

# Clean up
cd /
rm -rf "$TEST_DIR"

# Summary
echo -e "\n${YELLOW}===== TEST SUMMARY =====${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total: $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi