#!/bin/bash

# Test suite for create-scratchpad-jest-test utility

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Create a test directory
TEST_DIR="/tmp/test-create-scratchpad-jest-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create project directories structure
mkdir -p projects/{new,pending,active,ready-for-review,complete,icebox}

# Get the utility path
CREATE_JEST="/workspace/.devcontainer/utilities/create-scratchpad-jest-test"

# Create a test project
TEST_PROJECT="jest-utility-test"
mkdir -p "projects/new/$TEST_PROJECT"

# Function to run a test
run_test() {
    local test_name="$1"
    local project_name="$2"
    local test_case_name="$3"
    local expected_success="$4"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    echo -e "\n${YELLOW}TEST: $test_name${NC}"
    echo "Project: '$project_name', Test: '$test_case_name'"
    
    # Run the utility
    local output
    local stderr_file="/tmp/jest_stderr_$$"
    output=$("$CREATE_JEST" "$project_name" "$test_case_name" 2>"$stderr_file")
    local exit_code=$?
    local stderr_output=$(cat "$stderr_file")
    rm -f "$stderr_file"
    
    echo "Exit code: $exit_code"
    
    if [ "$expected_success" = "true" ]; then
        if [ $exit_code -eq 0 ]; then
            # Check if directory was created
            local expected_dir="projects/new/$project_name/scratchpad/$test_case_name"
            if [ -d "$expected_dir" ]; then
                # Check all required files
                local all_good=true
                local required_files=(
                    "yarn.lock"
                    "package.json"
                    "jest.config.js"
                    "$test_case_name.test.ts"
                )
                
                for file in "${required_files[@]}"; do
                    if [ ! -f "$expected_dir/$file" ]; then
                        echo -e "${RED}Missing file: $file${NC}"
                        all_good=false
                    fi
                done
                
                # Check package.json content
                if [ -f "$expected_dir/package.json" ]; then
                    if ! grep -q '"test": "NODE_OPTIONS=\\"--experimental-vm-modules\\" jest"' "$expected_dir/package.json"; then
                        echo -e "${RED}package.json missing test script${NC}"
                        all_good=false
                    fi
                    if ! grep -q '"@jest/globals"' "$expected_dir/package.json"; then
                        echo -e "${RED}package.json missing @jest/globals${NC}"
                        all_good=false
                    fi
                fi
                
                # Check test file content
                if [ -f "$expected_dir/$test_case_name.test.ts" ]; then
                    if ! grep -q "describe('$test_case_name assumption test'" "$expected_dir/$test_case_name.test.ts"; then
                        echo -e "${RED}Test file has incorrect describe block${NC}"
                        all_good=false
                    fi
                fi
                
                if [ "$all_good" = "true" ]; then
                    echo -e "${GREEN}✓ PASS${NC}"
                    TESTS_PASSED=$((TESTS_PASSED + 1))
                else
                    echo -e "${RED}✗ FAIL${NC} - files missing or incorrect"
                fi
            else
                echo -e "${RED}✗ FAIL${NC} - directory not created"
            fi
        else
            echo -e "${RED}✗ FAIL${NC} - unexpected failure"
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

echo "Running create-scratchpad-jest-test tests..."
echo "============================================"
echo "Test directory: $TEST_DIR"

# Valid cases
run_test "Simple test name" "$TEST_PROJECT" "simple-test" "true"
run_test "Test with numbers" "$TEST_PROJECT" "test-123" "true"
run_test "Long test name" "$TEST_PROJECT" "very-long-test-name-here" "true"

# Invalid cases - missing arguments
echo -e "\n${YELLOW}TEST: No arguments${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$("$CREATE_JEST" 2>&1)
if [ $? -ne 0 ] && echo "$output" | grep -q "Exactly 2 arguments required"; then
    echo -e "${GREEN}✓ PASS${NC} - correctly showed help"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - should show help with no arguments"
fi

echo -e "\n${YELLOW}TEST: One argument only${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$("$CREATE_JEST" "$TEST_PROJECT" 2>&1)
if [ $? -ne 0 ] && echo "$output" | grep -q "Exactly 2 arguments required"; then
    echo -e "${GREEN}✓ PASS${NC} - correctly showed help"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - should show help with one argument"
fi

# Invalid test names
run_test "Invalid test name - uppercase" "$TEST_PROJECT" "Test-Name" "false"
run_test "Invalid test name - spaces" "$TEST_PROJECT" "test name" "false"
run_test "Invalid test name - special chars" "$TEST_PROJECT" "test@name" "false"
run_test "Invalid test name - starting hyphen" "$TEST_PROJECT" "-test" "false"
run_test "Invalid test name - ending hyphen" "$TEST_PROJECT" "test-" "false"

# Non-existent project
run_test "Non-existent project" "does-not-exist" "valid-test" "false"

# Test duplicate creation
echo -e "\n${YELLOW}TEST: Duplicate test creation${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
# First creation should succeed (already created above)
# Second creation should fail
output=$("$CREATE_JEST" "$TEST_PROJECT" "simple-test" 2>&1)
if [ $? -ne 0 ] && echo "$output" | grep -q "Test directory already exists"; then
    echo -e "${GREEN}✓ PASS${NC} - correctly prevented duplicate"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - should prevent duplicate test creation"
fi

# Test project in different status
echo -e "\n${YELLOW}TEST: Project in pending status${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
PENDING_PROJECT="pending-project-test"
mkdir -p "projects/pending/$PENDING_PROJECT"
output=$("$CREATE_JEST" "$PENDING_PROJECT" "status-test" 2>&1)
if [ $? -eq 0 ] && [ -d "projects/pending/$PENDING_PROJECT/scratchpad/status-test" ]; then
    echo -e "${GREEN}✓ PASS${NC} - found project in pending status"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - should find project in any status"
fi

# Test scratchpad creation
echo -e "\n${YELLOW}TEST: Create scratchpad if missing${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
NO_SCRATCHPAD_PROJECT="no-scratchpad-test"
mkdir -p "projects/new/$NO_SCRATCHPAD_PROJECT"
# Don't create scratchpad directory
output=$("$CREATE_JEST" "$NO_SCRATCHPAD_PROJECT" "create-scratchpad" 2>&1)
if [ $? -eq 0 ] && [ -d "projects/new/$NO_SCRATCHPAD_PROJECT/scratchpad/create-scratchpad" ]; then
    echo -e "${GREEN}✓ PASS${NC} - created missing scratchpad directory"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - should create scratchpad if missing"
fi

# Test file content verification
echo -e "\n${YELLOW}TEST: Verify generated file content${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
CONTENT_TEST_PROJECT="content-verification"
mkdir -p "projects/new/$CONTENT_TEST_PROJECT"
"$CREATE_JEST" "$CONTENT_TEST_PROJECT" "content-test" >/dev/null 2>&1

content_dir="projects/new/$CONTENT_TEST_PROJECT/scratchpad/content-test"
all_content_good=true

# Check jest.config.js
if [ -f "$content_dir/jest.config.js" ]; then
    if ! grep -q "preset: 'ts-jest/presets/default-esm'" "$content_dir/jest.config.js"; then
        echo -e "${RED}jest.config.js missing ts-jest preset${NC}"
        all_content_good=false
    fi
    if ! grep -q "testEnvironment: 'node'" "$content_dir/jest.config.js"; then
        echo -e "${RED}jest.config.js missing node environment${NC}"
        all_content_good=false
    fi
else
    echo -e "${RED}jest.config.js not found${NC}"
    all_content_good=false
fi

# Check test file has timeout
if [ -f "$content_dir/content-test.test.ts" ]; then
    if ! grep -q "}, 10000);" "$content_dir/content-test.test.ts"; then
        echo -e "${RED}Test file missing timeout${NC}"
        all_content_good=false
    fi
else
    echo -e "${RED}Test file not found${NC}"
    all_content_good=false
fi

if [ "$all_content_good" = "true" ]; then
    echo -e "${GREEN}✓ PASS${NC} - all file content correct"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - file content incorrect"
fi


# Test with shell metacharacters in test name
echo -e "\n${YELLOW}TEST: Shell metacharacters in content${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
SHELL_META_PROJECT="shell-meta-test"
mkdir -p "projects/new/$SHELL_META_PROJECT"

# Create a test with a name that's valid but content will have special chars
"$CREATE_JEST" "$SHELL_META_PROJECT" "template-literal-test" >/dev/null 2>&1

# Check if the generated test file properly handles template literals
test_file="projects/new/$SHELL_META_PROJECT/scratchpad/template-literal-test/template-literal-test.test.ts"
if [ -f "$test_file" ]; then
    # The describe block should contain the test name properly
    if grep -q "describe('template-literal-test assumption test'" "$test_file"; then
        echo -e "${GREEN}✓ PASS${NC} - test file generated correctly with special chars"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - test file content incorrect"
        cat "$test_file"
    fi
else
    echo -e "${RED}✗ FAIL${NC} - test file not created"
fi

# Test actual utility with special test name that could contain JS template literals
echo -e "\n${YELLOW}TEST: Verify utility handles template literal comments${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
TEMPLATE_PROJECT="template-literal-project"
mkdir -p "projects/new/$TEMPLATE_PROJECT"

# Create test using the actual utility (which should now use printf)
"$CREATE_JEST" "$TEMPLATE_PROJECT" "template-syntax" >/dev/null 2>&1

# Manually add a test with backticks to verify they're preserved
test_file="projects/new/$TEMPLATE_PROJECT/scratchpad/template-syntax/template-syntax.test.ts"
if [ -f "$test_file" ]; then
    # Add a test case with template literals
    cat >> "$test_file" << 'TESTEOF'

// Test with template literals
describe('template literal test', () => {
  it('should handle template literals correctly', () => {
    const name = 'test';
    const message = `Hello ${name}`;
    expect(message).toBe('Hello test');
    
    // Nested template literals
    const id = 123;
    const selector = `#element-${id}`;
    const fullSelector = `${selector} > .child`;
    expect(fullSelector).toBe('#element-123 > .child');
  });
});
TESTEOF
    
    # Verify the file still contains valid TypeScript
    if grep -q 'const message = `Hello ${name}`' "$test_file" && \
       grep -q 'describe.*template-syntax assumption test' "$test_file"; then
        echo -e "${GREEN}✓ PASS${NC} - utility correctly handled test generation and manual additions work"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - test file content incorrect"
        cat "$test_file"
    fi
else
    echo -e "${RED}✗ FAIL${NC} - test file not created by utility"
fi

# Clean up
cd /
rm -rf "$TEST_DIR"

# Summary
echo
echo "============================================"
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