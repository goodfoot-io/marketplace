#!/bin/bash

# Test suite for print-type-analysis utility

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
PRINT_ANALYSIS="$SCRIPT_DIR/../print-type-analysis"

# Create temporary test files
TEST_DIR="/tmp/print-analysis-test-$$"
mkdir -p "$TEST_DIR/src"

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_exit_code="$3"
    local should_contain="$4"
    local should_not_contain="$5"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Run the print-type-analysis utility
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
    # Simple interface and type
    cat > "$TEST_DIR/src/simple.ts" << 'EOF'
export interface User {
  id: string;
  name: string;
  age: number;
}

export type UserStatus = "active" | "inactive" | "suspended";
EOF

    # Class with inheritance and implementation
    cat > "$TEST_DIR/src/class.ts" << 'EOF'
interface IService {
  start(): void;
  stop(): void;
}

class BaseService {
  protected running: boolean = false;
}

export class UserService extends BaseService implements IService {
  private apiUrl: string;
  
  constructor(apiUrl: string) {
    super();
    this.apiUrl = apiUrl;
  }
  
  getName(): string {
    return "UserService";
  }
  
  start(): void {
    this.running = true;
  }
  
  stop(): void {
    this.running = false;
  }
  
  async getUser(id: string): Promise<any> {
    return { id };
  }
}
EOF

    # Enum file
    cat > "$TEST_DIR/src/enum.ts" << 'EOF'
export enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Pending = "PENDING"
}

export enum Priority {
  Low = 1,
  Medium = 2,
  High = 3
}
EOF

    # Functions with complexity
    cat > "$TEST_DIR/src/functions.ts" << 'EOF'
export function simpleFunction(x: number): number {
  return x * 2;
}

export function complexFunction(n: number): string {
  if (n < 0) {
    return "negative";
  } else if (n === 0) {
    return "zero";
  } else if (n > 0 && n < 10) {
    return "small";
  } else if (n >= 10 && n < 100) {
    return "medium";
  } else {
    return "large";
  }
}

export function veryComplexFunction(arr: number[]): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > 0) {
      if (arr[i] % 2 === 0) {
        sum += arr[i];
      } else if (arr[i] % 3 === 0) {
        sum += arr[i] * 2;
      }
    } else if (arr[i] < 0) {
      sum -= arr[i];
    }
  }
  
  try {
    if (sum > 1000) {
      throw new Error("Sum too large");
    }
  } catch (e) {
    return -1;
  }
  
  return sum;
}
EOF

    # Mixed file with all types
    cat > "$TEST_DIR/src/mixed.ts" << 'EOF'
interface PrivateInterface {
  id: string;
}

export interface PublicInterface {
  name: string;
}

type InternalType = string | number;

export type PublicType = {
  value: any;
};

class InternalClass {
  private value: string;
}

export class PublicClass {
  public getValue(): string {
    return "value";
  }
}

export function publicFunction(x: number): number {
  if (x > 10) {
    return x * 2;
  }
  return x;
}
EOF

    # Complex generic types
    cat > "$TEST_DIR/src/generics.ts" << 'EOF'
export interface ApiResponse<T> {
  data: T;
  status: number;
  error?: string;
}

export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

export class Container<T> {
  private items: T[] = [];
  
  add(item: T): void {
    this.items.push(item);
  }
  
  get(index: number): T | undefined {
    return this.items[index];
  }
}
EOF

    # Nested interfaces
    cat > "$TEST_DIR/src/nested.ts" << 'EOF'
export interface Organization {
  id: string;
  name: string;
  metadata: {
    created: Date;
    updated: Date;
    tags: string[];
    settings: {
      isPublic: boolean;
      maxUsers: number;
    };
  };
}
EOF

    # Empty file
    touch "$TEST_DIR/src/empty.ts"

    # Invalid TypeScript
    cat > "$TEST_DIR/src/invalid.ts" << 'EOF'
export interface {
  broken: syntax
}
EOF

    # Class with complex members
    cat > "$TEST_DIR/src/complex-class.ts" << 'EOF'
export class ComplexClass {
  private privateField: string = "private";
  protected protectedField: number = 42;
  public publicField: boolean = true;
  
  private privateMethod(): void {
    console.log("private");
  }
  
  protected protectedMethod(): number {
    return 42;
  }
  
  public publicMethod(): string {
    return "public";
  }
}
EOF
}

echo "Running print-type-analysis tests..."
echo "======================================"

# Create test files
create_test_files

# Test 1: No arguments shows usage
run_test "Show usage when no arguments" \
    "'$PRINT_ANALYSIS'" \
    1 \
    "Usage:" \
    ""

# Test 2: Help flag
run_test "Help flag shows usage" \
    "'$PRINT_ANALYSIS' --help" \
    0 \
    "Usage: print-type-analysis" \
    ""

# Test 3: Simple interface extraction
run_test "Extract interface from simple file" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/simple.ts'" \
    0 \
    "kind: interface" \
    ""

# Test 4: Type alias extraction
run_test "Extract type alias" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/simple.ts'" \
    0 \
    "kind: type" \
    ""

# Test 5: Class extraction
run_test "Extract classes" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/class.ts'" \
    0 \
    "kind: class" \
    ""

# Test 6: Class inheritance
run_test "Show class inheritance" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/class.ts'" \
    0 \
    "extends:" \
    ""

# Test 7: Interface implementation
run_test "Show interface implementation" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/class.ts'" \
    0 \
    "implements:" \
    ""

# Test 8: Enum extraction
run_test "Extract enums" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/enum.ts'" \
    0 \
    "kind: enum" \
    ""

# Test 9: Enum members
run_test "Show enum members" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/enum.ts'" \
    0 \
    'Active = "ACTIVE"' \
    ""

# Test 10: Process multiple files
run_test "Process multiple files" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/simple.ts' '$TEST_DIR/src/enum.ts'" \
    0 \
    "Status" \
    ""

# Test 11: Functions are always included
run_test "Functions are included" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/functions.ts'" \
    0 \
    "kind: function" \
    ""

# Test 12: Function parameters
run_test "Show function parameters" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/functions.ts'" \
    0 \
    "parameters:" \
    ""

# Test 13: Function return types
run_test "Show function return types" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/functions.ts'" \
    0 \
    "returnType:" \
    ""

# Test 14: Complexity is always calculated
run_test "Calculate complexity" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/functions.ts'" \
    0 \
    "complexity:" \
    ""

# Test 15: Export detection
run_test "Detect exported items" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/mixed.ts'" \
    0 \
    "exported: true" \
    ""

# Test 16: YAML format validation
echo -e "\n${YELLOW}Testing YAML format...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$("$PRINT_ANALYSIS" "$TEST_DIR/src/simple.ts" 2>&1)
exit_code=$?

yaml_test_passed=true
failure_reasons=()

# Check exit code
if [ $exit_code -ne 0 ]; then
    yaml_test_passed=false
    failure_reasons+=("Exit code: expected 0, got $exit_code")
fi

# Check for YAML structure
if ! echo "$output" | grep -q "^files:"; then
    yaml_test_passed=false
    failure_reasons+=("Output should start with 'files:' YAML key")
fi

if ! echo "$output" | grep -q "summary:"; then
    yaml_test_passed=false
    failure_reasons+=("Output should contain 'summary:' section")
fi

if ! echo "$output" | grep -q "  - path:"; then
    yaml_test_passed=false
    failure_reasons+=("Output should have '  - path:' for file entries")
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

# Test 17: Summary statistics
run_test "Show summary statistics" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/mixed.ts'" \
    0 \
    "total:" \
    ""

# Test 18: Glob pattern support
run_test "Support glob patterns" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/*.ts' 2>&1 | head -50" \
    0 \
    "kind:" \
    ""

# Test 19: Complex generic types
run_test "Handle complex generic types" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/generics.ts'" \
    0 \
    "ApiResponse" \
    ""

# Test 20: Nested interfaces
run_test "Handle nested interfaces" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/nested.ts'" \
    0 \
    "metadata:" \
    ""

# Test 21: Complexity metrics
echo -e "\n${YELLOW}Testing complexity metrics...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$("$PRINT_ANALYSIS" "$TEST_DIR/src/functions.ts" 2>&1)
if echo "$output" | grep -q "simpleFunction" && echo "$output" | grep -q "complexity: 1"; then
    echo -e "${GREEN}✓${NC} Complexity metrics calculated"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Complexity metrics not calculated"
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 22: High complexity detection
echo -e "\n${YELLOW}Testing high complexity detection...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$("$PRINT_ANALYSIS" "$TEST_DIR/src/functions.ts" 2>&1)
# Check if we have different complexity values
if echo "$output" | grep -E "complexity: [0-9]+" | grep -v "complexity: 1" > /dev/null; then
    echo -e "${GREEN}✓${NC} Different complexity levels detected"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Different complexity levels not detected"
fi

# Test 23: Handle non-existent file
run_test "Handle non-existent file" \
    "'$PRINT_ANALYSIS' '/tmp/does-not-exist.ts' 2>&1" \
    1 \
    "Error: File or pattern not found" \
    ""

# Test 24: Handle invalid TypeScript
run_test "Handle invalid TypeScript" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/invalid.ts'" \
    0 \
    "" \
    ""

# Test 25: Handle empty file
run_test "Handle empty file" \
    "'$PRINT_ANALYSIS' '$TEST_DIR/src/empty.ts'" \
    0 \
    "total: 0" \
    ""

# Test 26: Class member visibility
echo -e "\n${YELLOW}Testing class member visibility...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
output=$("$PRINT_ANALYSIS" "$TEST_DIR/src/complex-class.ts" 2>&1)
if echo "$output" | grep -q "private" && echo "$output" | grep -q "protected" && echo "$output" | grep -q "public"; then
    echo -e "${GREEN}✓${NC} Class member visibility shown"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Class member visibility not shown"
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$output" | sed 's/^/    /'
    fi
fi

# Test 27: Real workspace file (if exists)
if [ -f "/workspace/packages/models/src/database.ts" ]; then
    echo -e "\n${YELLOW}Testing with real workspace file...${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    
    output=$("$PRINT_ANALYSIS" "/workspace/packages/models/src/database.ts" 2>&1 | head -20)
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Real file processing succeeded"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Real file processing failed"
    fi
fi

# Test 28: Performance with multiple files
echo -e "\n${YELLOW}Testing performance with multiple files...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
start_time=$(date +%s%N)
"$PRINT_ANALYSIS" "$TEST_DIR/src/"*.ts > /dev/null 2>&1
end_time=$(date +%s%N)
elapsed=$((($end_time - $start_time) / 1000000))

if [ $elapsed -lt 5000 ]; then
    echo -e "${GREEN}✓${NC} Performance acceptable (${elapsed}ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Performance too slow (${elapsed}ms)"
fi

# Clean up
rm -rf "$TEST_DIR"

# Summary
echo
echo "======================================"
echo "Tests run: $TESTS_RUN"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $(($TESTS_RUN - $TESTS_PASSED))"

if [ "$TESTS_PASSED" -eq "$TESTS_RUN" ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    echo "Run with DEBUG=1 to see detailed output"
    exit 1
fi