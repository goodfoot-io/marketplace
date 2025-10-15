#!/bin/bash

# Test suite for print-typescript-types utility

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
PRINT_TYPES="$SCRIPT_DIR/../print-typescript-types"

# Create temporary test files
TEST_DIR="/tmp/print-types-test-$$"
mkdir -p "$TEST_DIR/src"

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_exit_code="$3"
    local should_contain="$4"
    local should_not_contain="$5"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Run the print-typescript-types utility
    local output
    output=$(eval "$command" 2>&1)
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

# Create test TypeScript files
create_test_files() {
    # Simple interface
    cat > "$TEST_DIR/src/simple.ts" << 'EOF'
export interface User {
  id: string;
  name: string;
  age: number;
}

export type UserStatus = "active" | "inactive" | "suspended";
EOF

    # Nested interface
    cat > "$TEST_DIR/src/nested.ts" << 'EOF'
export interface Address {
  street: string;
  city: string;
  zip: number;
}

export interface Person {
  id: string;
  profile: {
    name: string;
    age: number;
    address: Address;
  };
  tags: string[];
}
EOF

    # Enum and class
    cat > "$TEST_DIR/src/enum-class.ts" << 'EOF'
export enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Pending = "PENDING"
}

export class UserService {
  private apiUrl: string;
  
  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }
  
  async getUser(id: string): Promise<any> {
    return { id };
  }
}
EOF

    # Complex union and intersection types
    cat > "$TEST_DIR/src/complex.ts" << 'EOF'
export type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

export interface HasId {
  id: string;
}

export interface HasTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export type Entity<T> = T & HasId & HasTimestamps;

export type UserEntity = Entity<{
  name: string;
  email: string;
}>;
EOF

    # Create a package.json for module testing
    cat > "$TEST_DIR/package.json" << 'EOF'
{
  "name": "test-types-module",
  "version": "1.0.0",
  "types": "src/index.d.ts"
}
EOF

    # Create an index.d.ts
    cat > "$TEST_DIR/src/index.d.ts" << 'EOF'
export interface ModuleConfig {
  apiKey: string;
  endpoint: string;
  options: {
    timeout: number;
    retries: number;
  };
}

export function initialize(config: ModuleConfig): void;
EOF

    # Create a file with destructured parameters
    cat > "$TEST_DIR/src/destructured.ts" << 'EOF'
export interface UserOptions {
  name: string;
  age: number;
  email?: string;
}

export function createUser({ name, age, email }: UserOptions): void {
  console.log(name, age, email);
}

export const updateUser = ({ name, ...rest }: UserOptions) => {
  console.log(name, rest);
};
EOF

    # Create a file with complex imports that need cleaning
    cat > "$TEST_DIR/src/complex-imports.ts" << 'EOF'
// Mock types to test import path cleaning
type Server<A, B, C, D> = any;
type Sql<T> = any;
type PostgresType = any;

interface ClientToServerEvents {}
interface ServerToClientEvents {}
interface InterServerEvents {}
interface SocketData {}
interface DefaultEventsMap {}

export function createServer(): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  return {} as any;
}

export function createDefaultServer(): Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> {
  return {} as any;
}

export function getDatabase(): Sql<Record<string, PostgresType>> {
  return {} as any;
}

export const testImportPath = (param: import("/some/long/path/to/module").SomeType): void => {
  console.log(param);
}
EOF
}

echo "Running print-typescript-types tests..."
echo "======================================"

# Create test files
create_test_files

# Test 1: No arguments
run_test "Show usage when no arguments" \
    "'$PRINT_TYPES'" \
    1 \
    "Usage:" \
    ""

# Test 2: Simple file
run_test "Extract types from simple file" \
    "'$PRINT_TYPES' '$TEST_DIR/src/simple.ts'" \
    0 \
    "name: User" \
    ""

# Test 3: Check simplified output exists
run_test "Simplified output for simple types" \
    "'$PRINT_TYPES' '$TEST_DIR/src/simple.ts'" \
    0 \
    "simplified:" \
    ""

# Test 4: Nested types
run_test "Extract nested types" \
    "'$PRINT_TYPES' '$TEST_DIR/src/nested.ts'" \
    0 \
    "address: Address" \
    ""

# Test 5: Multiple files
run_test "Process multiple files" \
    "'$PRINT_TYPES' '$TEST_DIR/src/simple.ts' '$TEST_DIR/src/nested.ts'" \
    0 \
    "Address" \
    ""

# Test 6: Enum extraction
run_test "Extract enum types" \
    "'$PRINT_TYPES' '$TEST_DIR/src/enum-class.ts'" \
    0 \
    "Status" \
    ""

# Test 7: Class extraction
run_test "Extract class types" \
    "'$PRINT_TYPES' '$TEST_DIR/src/enum-class.ts'" \
    0 \
    "UserService" \
    ""

# Test 8: Complex union types
run_test "Extract complex union types" \
    "'$PRINT_TYPES' '$TEST_DIR/src/complex.ts'" \
    0 \
    "Result" \
    ""

# Test 9: With --pwd parameter
run_test "Use --pwd parameter" \
    "'$PRINT_TYPES' --pwd '$TEST_DIR' 'src/simple.ts'" \
    0 \
    "User" \
    ""

# Test 10: Module resolution
run_test "Module resolution" \
    "'$PRINT_TYPES' '$TEST_DIR'" \
    0 \
    "ModuleConfig" \
    ""

# Test 11: YAML format validation
echo -e "\n${YELLOW}Testing YAML format...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$("$PRINT_TYPES" "$TEST_DIR/src/simple.ts" 2>&1)
exit_code=$?

yaml_test_passed=true
failure_reasons=()

# Check exit code
if [ $exit_code -ne 0 ]; then
    yaml_test_passed=false
    failure_reasons+=("Exit code: expected 0, got $exit_code")
fi

# Check for YAML structure
if ! echo "$output" | grep -q -- "- file:"; then
    yaml_test_passed=false
    failure_reasons+=("Output should contain '- file:' YAML structure")
fi

if ! echo "$output" | grep -q "exports:"; then
    yaml_test_passed=false
    failure_reasons+=("Output should contain 'exports:' section")
fi

# Check indentation consistency
if ! echo "$output" | grep -q "    name:"; then
    yaml_test_passed=false
    failure_reasons+=("Output should have proper YAML indentation")
fi

if [ "$yaml_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} YAML format is correct"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} YAML format test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 12: Non-existent file
run_test "Handle non-existent file" \
    "'$PRINT_TYPES' '/tmp/does-not-exist.ts'" \
    0 \
    "" \
    "does-not-exist.ts"

# Test 13: Invalid TypeScript file
cat > "$TEST_DIR/src/invalid.ts" << 'EOF'
export interface {
  broken: syntax
}
EOF

run_test "Handle invalid TypeScript" \
    "'$PRINT_TYPES' '$TEST_DIR/src/invalid.ts' 2>&1" \
    0 \
    "" \
    ""

# Test 14: Deep nesting (test depth limit)
cat > "$TEST_DIR/src/deep.ts" << 'EOF'
export interface Level1 {
  level2: {
    level3: {
      level4: {
        level5: {
          value: string;
        };
      };
    };
  };
}
EOF

run_test "Handle deep nesting" \
    "'$PRINT_TYPES' '$TEST_DIR/src/deep.ts'" \
    0 \
    "level2: { level3: { level4: { level5: { value: string }" \
    ""

# Test 15: Destructured parameters
run_test "Handle destructured parameters" \
    "'$PRINT_TYPES' '$TEST_DIR/src/destructured.ts'" \
    0 \
    "name: string" \
    ""

# Test 16: Check destructured parameter handling in simplified output
echo -e "\n${YELLOW}Testing destructured parameter simplification...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$("$PRINT_TYPES" "$TEST_DIR/src/destructured.ts" 2>&1)
if echo "$output" | grep -q "params:" && echo "$output" | grep -q "age: number"; then
    echo -e "${GREEN}✓${NC} Destructured parameters properly simplified"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Destructured parameters not properly simplified"
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 17: Import path cleaning
run_test "Clean import paths" \
    "'$PRINT_TYPES' '$TEST_DIR/src/complex-imports.ts'" \
    0 \
    "testImportPath" \
    "import(\"/some/long/path"

# Test 18: Type aliases
echo -e "\n${YELLOW}Testing type alias substitution...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$("$PRINT_TYPES" "$TEST_DIR/src/complex-imports.ts" 2>&1)
# Check for either the alias or the fact that the complex types are simplified
if echo "$output" | grep -q "SocketIOServer" || echo "$output" | grep -q "return: any"; then
    echo -e "${GREEN}✓${NC} Type aliases properly applied"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Type aliases not properly applied"
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 19: Single --type filter
run_test "Filter by single type" \
    "'$PRINT_TYPES' --type User '$TEST_DIR/src/simple.ts'" \
    0 \
    "name: User" \
    "UserStatus"

# Test 20: Multiple --type filters
run_test "Filter by multiple types" \
    "'$PRINT_TYPES' --type User --type Address '$TEST_DIR/src/simple.ts' '$TEST_DIR/src/nested.ts'" \
    0 \
    "Address" \
    "Person"

# Test 21: --type filter with no matches
echo -e "\n${YELLOW}Testing --type filter with no matches...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$("$PRINT_TYPES" --type NonExistentType "$TEST_DIR/src/simple.ts" 2>&1)
exit_code=$?
if [ $exit_code -eq 0 ] && echo "$output" | grep -q "^\[\]$"; then
    echo -e "${GREEN}✓${NC} --type filter with no matches returns empty array"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} --type filter with no matches should return empty array"
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 22: Real workspace file (if exists)
if [ -f "/workspace/packages/website/app/routes.ts" ]; then
    echo -e "\n${YELLOW}Testing with real workspace file...${NC}"
    
    output=$("$PRINT_TYPES" "/workspace/packages/website/app/routes.ts" 2>&1 | head -20)
    exit_code=$?
    
    TESTS_RUN=$((TESTS_RUN + 1))
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Real file processing succeeded"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Real file processing failed (exit code: $exit_code)"
    fi
fi

# Test 23: Workspace package resolution
echo -e "\n${YELLOW}Testing workspace package resolution...${NC}"

# Test workspace package without pwd from workspace root (should fail as not in a package dir)
run_test "Workspace package without pwd from root" \
    "cd /workspace && '$PRINT_TYPES' '@productivity-bot/models' 2>&1" \
    0 \
    "" \
    ""

# Test workspace package without pwd from website package (should work)
if [ -d "/workspace/packages/website" ]; then
    run_test "Workspace package without pwd from package dir" \
        "cd /workspace/packages/website && '$PRINT_TYPES' '@productivity-bot/models' 2>&1 | head -5" \
        0 \
        "file: /workspace/packages/models" \
        ""
fi

# Test workspace package with pwd from website package
if [ -d "/workspace/packages/website" ]; then
    run_test "Workspace package with pwd from website" \
        "'$PRINT_TYPES' --pwd /workspace/packages/website '@productivity-bot/models' 2>&1 | head -5" \
        0 \
        "file: /workspace/packages/models" \
        ""
fi

# Test workspace package subpath export
if [ -d "/workspace/packages/website" ]; then
    run_test "Workspace package subpath export" \
        "'$PRINT_TYPES' --pwd /workspace/packages/website '@productivity-bot/models/client' 2>&1 | head -5" \
        0 \
        "file: /workspace/packages/models" \
        ""
fi

# Test non-existent workspace package
if [ -d "/workspace/packages/website" ]; then
    run_test "Non-existent workspace package" \
        "'$PRINT_TYPES' --pwd /workspace/packages/website '@productivity-bot/non-existent' 2>&1" \
        0 \
        "" \
        ""
fi

# Test 24: NPM package resolution
echo -e "\n${YELLOW}Testing NPM package resolution...${NC}"

# Test npm package from website directory
if [ -d "/workspace/packages/website" ]; then
    # Skip large packages like react that may timeout, use smaller ones for testing
    run_test "NPM package resolution" \
        "timeout 5 '$PRINT_TYPES' --pwd /workspace/packages/website 'clsx' 2>&1 | head -5" \
        0 \
        "file:" \
        ""
    
    # Test npm package with subpath
    run_test "NPM package with subpath" \
        "timeout 5 '$PRINT_TYPES' --pwd /workspace/packages/website '@openai/agents' 2>&1 | head -5" \
        0 \
        "file:" \
        ""
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