#!/bin/bash

# Test suite for claude-posttooluse-hook-typescript utility

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
CHECK_TS="$SCRIPT_DIR/../claude-posttooluse-hook-typescript"

# Create temporary test files
TEST_DIR="/tmp/check-typescript-test-$$"
mkdir -p "$TEST_DIR/src"

# Function to run a test
run_test() {
    local test_name="$1"
    local json_input="$2"
    local expected_exit_code="$3"
    local should_contain="$4"
    local should_not_contain="$5"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Run the claude-posttooluse-hook-typescript utility
    local output
    output=$(echo "$json_input" | "$CHECK_TS" 2>&1)
    local exit_code=$?
    
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

# Create a simple TypeScript project structure for testing
create_test_project() {
    # Create a mock npx that simulates TypeScript behavior
    mkdir -p "$TEST_DIR/node_modules/.bin"
    cat > "$TEST_DIR/node_modules/.bin/npx" << EOF
#!/bin/bash
if [[ "\$1" == "tsc" ]]; then
    # Check for --project flag (used by the hook)
    PROJECT_MODE=false
    if [[ "\$@" == *"--project"* ]]; then
        PROJECT_MODE=true
    fi
    
    # For valid.ts, succeed silently
    if [[ "\$@" == *"valid.ts"* ]]; then
        exit 0
    fi
    
    # For dependent files (importer.ts), simulate import errors
    if [[ "\$@" == *"importer.ts"* ]]; then
        echo "importer.ts:1:10 - error TS2305: Module './exported' has no exported member 'missingExport'." >&2
        echo "" >&2
        echo "1 import { missingExport } from './exported';" >&2
        echo "           ~~~~~~~~~~~~~" >&2
        exit 1
    fi
    
    # For consumer.ts, simulate type mismatch error
    if [[ "\$@" == *"consumer.ts"* ]]; then
        echo "consumer.ts:3:5 - error TS2322: Type 'string' is not assignable to type 'number'." >&2
        echo "" >&2
        echo "3 const result: number = processData('test');" >&2
        echo "       ~~~~~~" >&2
        exit 1
    fi
    
    # When running with --project on test directory
    if [[ "\$PROJECT_MODE" == "true" ]]; then
        # Check which test files exist to determine what to output
        if [[ -f "$TEST_DIR/src/signature-test.ts" ]]; then
            # Output signature test errors to stderr
            cat >&2 << 'EOFERR'
signature-test.ts:2:1 - error TS2554: Expected 2 arguments, but got 1.

2 testFunc("hello"); // Missing argument
  ~~~~~~~~

  signature-test.ts:1:30
    1 function testFunc(a: string, b: number): void {}
                                   ~~~~~~~~~
    An argument for 'b' was not provided.

signature-test.ts:10:1 - error TS2554: Expected 2 arguments, but got 1.

10 obj.method(42); // Missing argument
   ~~~~~~~~~~

  signature-test.ts:5:20
    5   method(x: number, y: string): boolean {
                         ~~~~~~~~~~
    An argument for 'y' was not provided.
EOFERR
            exit 1
        elif [[ -f "$TEST_DIR/src/yaml-test.ts" ]]; then
            # Output yaml test error to stderr (where tsc outputs)
            echo "yaml-test.ts:2:3 - error TS2322: Type 'string' is not assignable to type 'number'." >&2
            echo "" >&2
            echo "2   return \"string\"; // Type error" >&2
            echo "           ~~~~~~~~" >&2
            exit 1
        elif [[ -f "$TEST_DIR/src/valid.ts" ]]; then
            # Valid file - no errors
            exit 0
        elif [[ -f "$TEST_DIR/src/exported.ts" ]]; then
            # No errors in the exported file itself
            exit 0
        fi
    fi
    
    # For yaml-test.ts, output TypeScript error to stderr
    if [[ "$@" == *"yaml-test.ts"* ]]; then
        echo "yaml-test.ts(2,3): error TS2322: Type 'string' is not assignable to type 'number'." >&2
        exit 1
    fi
    
    # For signature-test.ts, output TypeScript errors with signature info to stderr
    if [[ "$@" == *"signature-test.ts"* ]]; then
        cat >&2 << 'EOFERR'
signature-test.ts:2:1 - error TS2554: Expected 2 arguments, but got 1.

2 testFunc("hello"); // Missing argument
  ~~~~~~~~

  signature-test.ts:1:30
    1 function testFunc(a: string, b: number): void {}
                                   ~~~~~~~~~
    An argument for 'b' was not provided.

signature-test.ts:10:1 - error TS2554: Expected 2 arguments, but got 1.

10 obj.method(42); // Missing argument
   ~~~~~~~~~~

  signature-test.ts:5:20
    5   method(x: number, y: string): boolean {
                         ~~~~~~~~~~
    An argument for 'y' was not provided.
EOFERR
        exit 1
    fi
    
    # For other files, fail with TypeScript-like error to stderr
    echo "errors.ts(1,1): error TS2322: Type 'string' is not assignable to type 'number'." >&2
    exit 1
fi
# Pass through for other commands
exec /usr/bin/env npx "$@"
EOF
    chmod +x "$TEST_DIR/node_modules/.bin/npx"
    
    # Create a mock yarn that simulates ESLint behavior
    cat > "$TEST_DIR/node_modules/.bin/yarn" << 'EOF'
#!/bin/bash
if [[ "$1" == "eslint:files" ]]; then
    # For valid files, succeed silently
    if [[ "$@" == *"valid.ts"* ]]; then
        exit 0
    fi
    # For yaml-test.ts, succeed (only TypeScript error for this test)
    if [[ "$@" == *"yaml-test.ts"* ]]; then
        exit 0
    fi
    # For error files, fail with ESLint-like output
    if [[ "$@" == *"errors.ts"* ]]; then
        echo "$TEST_DIR/error-pkg/src/errors.ts"
        echo "  1:1  error  Unexpected var  no-var"
        echo ""
        echo "✖ 1 problem (1 error, 0 warnings)"
        exit 1
    fi
    # Default error
    echo "✖ 1 problem (1 error, 0 warnings)"
    exit 1
fi
# Pass through for other commands
exec /usr/bin/env yarn "$@"
EOF
    chmod +x "$TEST_DIR/node_modules/.bin/yarn"
    
    # No mock for rg - we'll use the real ripgrep
    
    cat > "$TEST_DIR/package.json" << 'EOF'
{
  "name": "test-project",
  "scripts": {
    "typecheck": "echo 'TypeScript check passed'",
    "eslint:files": "echo 'ESLint check passed'"
  }
}
EOF

    cat > "$TEST_DIR/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
EOF

    cat > "$TEST_DIR/src/valid.ts" << 'EOF'
export function add(a: number, b: number): number {
  return a + b;
}
EOF

    cat > "$TEST_DIR/src/type-error.ts" << 'EOF'
export function broken(a: string): number {
  return a; // Type error: string is not assignable to number
}
EOF

    # Create files for testing external dependency checking
    cat > "$TEST_DIR/src/exported.ts" << 'EOF'
export function processData(input: string): string {
  return input.toUpperCase();
}

export interface DataType {
  id: number;
  value: string;
}
EOF

    cat > "$TEST_DIR/src/importer.ts" << 'EOF'
import { missingExport } from './exported';
// This will cause TS2305 error
EOF

    cat > "$TEST_DIR/src/consumer.ts" << 'EOF'
import { processData } from './exported';

const result: number = processData('test');
// This will cause TS2322 error
EOF
}

# Create a mock package for testing with real errors
create_error_test_project() {
    local pkg_dir="$TEST_DIR/error-pkg"
    mkdir -p "$pkg_dir/src"
    
    cat > "$pkg_dir/package.json" << 'EOF'
{
  "name": "error-test-project",
  "scripts": {
    "typecheck": "exit 1",
    "eslint:files": "echo 'ESLint error' && exit 1"
  }
}
EOF

    cat > "$pkg_dir/src/errors.ts" << 'EOF'
export const test = "file with errors";
EOF
}

echo "Running claude-posttooluse-hook-typescript tests..."
echo "======================================"

# Save original PATH
ORIGINAL_PATH="$PATH"

# Create test projects
create_test_project
create_error_test_project

# Ensure mocks are in PATH for all tests
export PATH="$TEST_DIR/node_modules/.bin:$ORIGINAL_PATH"

# Test 1: Non-TypeScript file should be skipped
run_test "Skip non-TypeScript file" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.md"}}' \
    0 \
    "" \
    ""

# Test 2: Non-existent file
run_test "Handle non-existent file" \
    '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/does-not-exist.ts"}}' \
    0 \
    "" \
    ""

# Test 3: Invalid JSON input
run_test "Handle invalid JSON" \
    'not valid json' \
    2 \
    "Failed to parse JSON input" \
    ""

# Test 4: Missing file_path in input
run_test "Handle missing file path" \
    '{"tool_name": "Write", "tool_input": {}}' \
    0 \
    "" \
    ""

# Test 5: Valid TypeScript file (mocked success - should be silent)
run_test "Check valid TypeScript file" \
    "{\"tool_name\": \"Write\", \"tool_input\": {\"file_path\": \"$TEST_DIR/src/valid.ts\"}}" \
    0 \
    "" \
    ""

# Test 6: File with errors (mocked)
run_test "Detect TypeScript/ESLint errors" \
    "{\"tool_name\": \"Edit\", \"tool_input\": {\"file_path\": \"$TEST_DIR/error-pkg/src/errors.ts\"}}" \
    2 \
    "errors:" \
    ""

# Test 7: MultiEdit tool support
run_test "Handle MultiEdit tool" \
    "{\"tool_name\": \"MultiEdit\", \"tool_input\": {\"file_path\": \"$TEST_DIR/src/valid.ts\", \"edits\": [{\"old_string\": \"test\", \"new_string\": \"test2\"}]}}" \
    0 \
    "" \
    ""

# Test 8: File without package.json
TEST_ORPHAN_DIR="/tmp/orphan-test-$$"
mkdir -p "$TEST_ORPHAN_DIR"
cat > "$TEST_ORPHAN_DIR/orphan.ts" << 'EOF'
export const orphan = true;
EOF

# Remove any package.json from parent directories that might interfere
rm -f /tmp/package.json /tmp/tsconfig.json 2>/dev/null || true

run_test "Handle file without package.json" \
    "{\"tool_name\": \"Write\", \"tool_input\": {\"file_path\": \"$TEST_ORPHAN_DIR/orphan.ts\"}}" \
    2 \
    "Could not find package.json" \
    ""

# Test 9: Debug mode shows output even on success
echo -e "\n${YELLOW}Testing DEBUG mode...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$(echo "{\"tool_name\": \"Write\", \"tool_input\": {\"file_path\": \"$TEST_DIR/src/valid.ts\"}}" | DEBUG=1 "$CHECK_TS" 2>&1)
if echo "$output" | grep -q "Checking:" && echo "$output" | grep -q "All checks passed"; then
    echo -e "${GREEN}✓${NC} DEBUG mode shows verbose output"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} DEBUG mode failed to show verbose output"
fi

# Test 10: YAML output format for errors
echo -e "\n${YELLOW}Testing YAML output format...${NC}"
# Create a file with a known TypeScript error
cat > "$TEST_DIR/src/yaml-test.ts" << 'EOF'
function testError(): number {
  return "string"; // Type error
}
EOF

TESTS_RUN=$((TESTS_RUN + 1))
output=$(echo "{\"tool_name\": \"Write\", \"tool_input\": {\"file_path\": \"$TEST_DIR/src/yaml-test.ts\"}}" | "$CHECK_TS" 2>&1)
exit_code=$?

yaml_test_passed=true
failure_reasons=()

# Check exit code
if [ $exit_code -ne 2 ]; then
    yaml_test_passed=false
    failure_reasons+=("Exit code: expected 2, got $exit_code")
fi

# Check for YAML format
if ! echo "$output" | grep -q "errors:"; then
    yaml_test_passed=false
    failure_reasons+=("Output should contain 'errors:' YAML header")
fi

# Check for context lines
if ! echo "$output" | grep -q "context:"; then
    yaml_test_passed=false
    failure_reasons+=("Output should contain 'context:' section")
fi

# Check for line markers
if ! echo "$output" | grep -q ">"; then
    yaml_test_passed=false
    failure_reasons+=("Output should contain '>' marker for current line")
fi

if [ "$yaml_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} YAML output format is correct"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} YAML output format test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 10b: Check for usage section with signatures
echo -e "\n${YELLOW}Testing usage section with signatures...${NC}"
# Create a file with function signature errors
cat > "$TEST_DIR/src/signature-test.ts" << 'EOF'
function testFunc(a: string, b: number): void {}
testFunc("hello"); // Missing argument

class TestClass {
  method(x: number, y: string): boolean {
    return true;
  }
}
const obj = new TestClass();
obj.method(42); // Missing argument
EOF

# Don't update mock npx here - it was already created in create_test_project

TESTS_RUN=$((TESTS_RUN + 1))
output=$(echo "{\"tool_name\": \"Write\", \"tool_input\": {\"file_path\": \"$TEST_DIR/src/signature-test.ts\"}}" | "$CHECK_TS" 2>&1)
exit_code=$?

usage_test_passed=true
failure_reasons=()

# Check exit code
if [ $exit_code -ne 2 ]; then
    usage_test_passed=false
    failure_reasons+=("Exit code: expected 2, got $exit_code")
fi

# Check for usage section
if ! echo "$output" | grep -q "^usage:"; then
    usage_test_passed=false
    failure_reasons+=("Output should contain 'usage:' section")
fi

# Check for usage_ref in errors
if ! echo "$output" | grep -q "usage_ref:"; then
    usage_test_passed=false
    failure_reasons+=("Errors should contain 'usage_ref:' field")
fi

# Check for signature field in usage section
if ! echo "$output" | grep -q "signature:"; then
    usage_test_passed=false
    failure_reasons+=("Usage section should contain 'signature:' field")
fi

if [ "$usage_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Usage section with signatures is correct"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Usage section test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 11: External dependency checking - file with dependent imports
echo -e "\n${YELLOW}Testing external dependency checking...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

# Real ripgrep will find importer.ts and consumer.ts as dependent files
output=$(echo "{\"tool_name\": \"Write\", \"tool_input\": {\"file_path\": \"$TEST_DIR/src/exported.ts\"}}" | "$CHECK_TS" 2>&1)
exit_code=$?

external_test_passed=true
failure_reasons=()

# Check exit code (should fail due to errors in dependent files)
if [ $exit_code -ne 2 ]; then
    external_test_passed=false
    failure_reasons+=("Exit code: expected 2, got $exit_code")
fi

# Check for external section in output
if ! echo "$output" | grep -q "^external:"; then
    external_test_passed=false
    failure_reasons+=("Output should contain 'external:' section")
fi

# Check for dependent file errors
if ! echo "$output" | grep -q "importer.ts"; then
    external_test_passed=false
    failure_reasons+=("Output should contain errors from importer.ts")
fi

# Check for TS2305 error (missing export)
if ! echo "$output" | grep -q "TS2305"; then
    external_test_passed=false
    failure_reasons+=("Output should contain TS2305 error for missing export")
fi

if [ "$external_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} External dependency checking works correctly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} External dependency checking failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 12: File with no dependent files (should have no external section)
echo -e "\n${YELLOW}Testing file with no dependencies...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))

output=$(echo "{\"tool_name\": \"Write\", \"tool_input\": {\"file_path\": \"$TEST_DIR/src/valid.ts\"}}" | "$CHECK_TS" 2>&1)
exit_code=$?

no_deps_test_passed=true
failure_reasons=()

# Check exit code (should succeed)
if [ $exit_code -ne 0 ]; then
    no_deps_test_passed=false
    failure_reasons+=("Exit code: expected 0, got $exit_code")
fi

# Check that there's no external section
if echo "$output" | grep -q "^external:"; then
    no_deps_test_passed=false
    failure_reasons+=("Output should NOT contain 'external:' section for file with no dependencies")
fi

if [ "$no_deps_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} File with no dependencies handled correctly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} File with no dependencies test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 13: Real monorepo file (if exists)
if [ -f "/workspace/packages/website/app/routes.ts" ]; then
    echo -e "\n${YELLOW}Testing with real monorepo file...${NC}"
    
    # This might actually run real checks, so we just verify it completes
    output=$(echo '{"tool_name": "Write", "tool_input": {"file_path": "/workspace/packages/website/app/routes.ts"}}' | "$CHECK_TS" 2>&1)
    exit_code=$?
    
    TESTS_RUN=$((TESTS_RUN + 1))
    if [ $exit_code -eq 0 ] || [ $exit_code -eq 2 ]; then
        echo -e "${GREEN}✓${NC} Real file check completed (exit code: $exit_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Real file check failed unexpectedly (exit code: $exit_code)"
    fi
fi

# Test 14: Workspace package resolution
if [ -f "/workspace/packages/website/app/utils/generate-voice-instructions.ts" ]; then
    echo -e "\n${YELLOW}Testing workspace package resolution...${NC}"
    
    # Check the specific file that imports workspace packages
    output=$(echo '{"tool_name": "Write", "tool_input": {"file_path": "/workspace/packages/website/app/utils/generate-voice-instructions.ts"}}' | "$CHECK_TS" 2>&1)
    exit_code=$?
    
    TESTS_RUN=$((TESTS_RUN + 1))
    # Should not have TS2307 error for workspace packages
    if echo "$output" | grep -q "TS2307.*@productivity-bot/models"; then
        echo -e "${RED}✗${NC} Workspace package resolution failed - still getting TS2307 error"
        if [ -n "$DEBUG" ]; then
            echo "  Output:"
            echo "$output" | sed 's/^/    /'
        fi
    else
        echo -e "${GREEN}✓${NC} Workspace package resolution works correctly"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
fi

# Clean up
rm -rf "$TEST_DIR"
rm -rf "$TEST_ORPHAN_DIR"

# Restore original PATH
export PATH="$ORIGINAL_PATH"

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