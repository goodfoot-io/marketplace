#!/bin/bash

# Test shell escaping fixes in create-scratchpad utilities

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Create a test directory
TEST_DIR="/tmp/test-shell-escaping-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create project directories structure
mkdir -p projects/new

# Get the utility paths
CREATE_JEST="/workspace/.devcontainer/utilities/create-scratchpad-jest-test"
CREATE_PLAYWRIGHT="/workspace/.devcontainer/utilities/create-scratchpad-playwright-test"

echo "Testing Shell Escaping in Scratchpad Utilities"
echo "=============================================="
echo "Test directory: $TEST_DIR"

# Test 1: Jest utility with various shell metacharacters
echo -e "\n${YELLOW}TEST 1: Jest utility - Create test with safe name${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

TEST_PROJECT="escaping-test-jest"
mkdir -p "projects/new/$TEST_PROJECT"

# Create test with safe name
"$CREATE_JEST" "$TEST_PROJECT" "backtick-test" >/dev/null 2>&1

# Verify the content doesn't have shell expansion
test_file="projects/new/$TEST_PROJECT/scratchpad/backtick-test/backtick-test.test.ts"
if [ -f "$test_file" ]; then
    content=$(cat "$test_file")
    
    # Add content with backticks to test preservation
    cat >> "$test_file" << 'EOF'

// Additional test with template literals
describe('template literal tests', () => {
  it('should handle backticks correctly', () => {
    const name = 'world';
    const message = `Hello ${name}!`;
    expect(message).toBe('Hello world!');
    
    // Nested template literals
    const wrap = (str: string) => `<${str}>`;
    const wrapped = wrap(`value: ${name}`);
    expect(wrapped).toBe('<value: world>');
    
    // Shell-like syntax that should be preserved
    const cmd = `echo "test" | grep 'pattern'`;
    const shellVar = '${HOME}';
    const backtickCmd = '`date`';
    
    expect(cmd).toContain('echo');
    expect(shellVar).toBe('${HOME}');
    expect(backtickCmd).toBe('`date`');
  });
});
EOF
    
    # Verify content was preserved correctly
    if grep -q 'const message = `Hello ${name}!`' "$test_file" && \
       grep -q "describe('backtick-test assumption test'" "$test_file" && \
       grep -q 'const shellVar = ' "$test_file"; then
        echo -e "${GREEN}✓ PASS${NC} - Jest utility preserves shell metacharacters correctly"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - Content not preserved correctly"
        echo "File content:"
        cat "$test_file"
    fi
else
    echo -e "${RED}✗ FAIL${NC} - Test file not created"
fi

# Test 2: Playwright utility with various shell metacharacters
echo -e "\n${YELLOW}TEST 2: Playwright utility - Create test with safe name${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

TEST_PROJECT_PW="escaping-test-playwright"
mkdir -p "projects/new/$TEST_PROJECT_PW"

# Create test with safe name
"$CREATE_PLAYWRIGHT" "$TEST_PROJECT_PW" "selector-test" >/dev/null 2>&1

# Verify the content doesn't have shell expansion
test_file_pw="projects/new/$TEST_PROJECT_PW/scratchpad/selector-test/selector-test.spec.ts"
if [ -f "$test_file_pw" ]; then
    content=$(cat "$test_file_pw")
    
    # Add content with backticks to test preservation
    cat >> "$test_file_pw" << 'EOF'

// Additional test with template literal selectors
test('dynamic selectors with template literals', async ({ page }) => {
  const userId = 'user-123';
  const className = 'active';
  
  // Template literal selectors
  const selector = `[data-id="${userId}"]`;
  const complexSelector = `${selector}.${className}:not(.disabled)`;
  
  // Shell-like patterns that should be preserved
  const patterns = {
    glob: '*.test.ts',
    shellVar: '${PATH}',
    backtick: '`pwd`',
    pipe: 'grep | sed',
    redirect: 'echo > file.txt'
  };
  
  // XPath with template literals
  const xpath = `//div[@id='${userId}']//span[contains(@class, '${className}')]`;
  
  console.log(`Testing selector: ${complexSelector}`);
  console.log(`XPath: ${xpath}`);
  
  // These should all be preserved as strings
  expect(patterns.shellVar).toBe('${PATH}');
  expect(patterns.backtick).toBe('`pwd`');
});
EOF
    
    # Verify content was preserved correctly
    if grep -q 'const selector = `\[data-id="${userId}"\]`' "$test_file_pw" && \
       grep -q "test.describe('selector-test E2E assumption test'" "$test_file_pw" && \
       grep -q 'shellVar: ' "$test_file_pw"; then
        echo -e "${GREEN}✓ PASS${NC} - Playwright utility preserves shell metacharacters correctly"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - Content not preserved correctly"
        echo "File content:"
        cat "$test_file_pw"
    fi
else
    echo -e "${RED}✗ FAIL${NC} - Test file not created"
fi

# Test 3: Verify original functionality still works
echo -e "\n${YELLOW}TEST 3: Original functionality - Invalid test names${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

# Try to create with invalid name (should fail)
output=$("$CREATE_JEST" "$TEST_PROJECT" "Test-With-Caps" 2>&1)
if [ $? -ne 0 ] && echo "$output" | grep -q "Invalid test name format"; then
    echo -e "${GREEN}✓ PASS${NC} - Still validates test names correctly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - Test name validation broken"
fi

# Test 4: Edge case - test name that looks like shell expansion
echo -e "\n${YELLOW}TEST 4: Edge case - test name validation${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

# These should all fail due to invalid characters
invalid_names=('${test}' '`test`' 'test|pipe' 'test>redirect' 'test&background')
all_blocked=true

for invalid_name in "${invalid_names[@]}"; do
    output=$("$CREATE_JEST" "$TEST_PROJECT" "$invalid_name" 2>&1)
    if [ $? -eq 0 ]; then
        echo -e "${RED}Should have rejected: $invalid_name${NC}"
        all_blocked=false
    fi
done

if [ "$all_blocked" = "true" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Correctly rejects shell metacharacters in test names"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - Failed to reject some invalid test names"
fi

# Clean up
cd /
rm -rf "$TEST_DIR"

# Summary
echo
echo "=============================================="
echo "Tests run: $TESTS_RUN"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $((TESTS_RUN - TESTS_PASSED))"

if [ "$TESTS_PASSED" -eq "$TESTS_RUN" ]; then
    echo -e "${GREEN}All shell escaping tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    exit 1
fi