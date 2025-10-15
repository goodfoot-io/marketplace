#!/bin/bash

# Test suite for create-knowledge-graph utility

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
KNOWLEDGE_GRAPH="$SCRIPT_DIR/../create-knowledge-graph"

# Create temporary test files
TEST_DIR="/tmp/knowledge-graph-test-$$"
mkdir -p "$TEST_DIR/src/models"
mkdir -p "$TEST_DIR/src/services"
mkdir -p "$TEST_DIR/src/controllers"

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local should_contain="$3"
    local should_not_contain="$4"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Run the command
    local output
    output=$(eval "$command" 2>&1)
    local exit_code=$?
    
    local test_passed=true
    local failure_reasons=()
    
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
            echo "  Output (first 20 lines):"
            echo "$output" | head -20 | sed 's/^/    /'
        fi
    fi
}

# Create test TypeScript project
create_test_project() {
    # Create model file
    cat > "$TEST_DIR/src/models/user.ts" << 'EOF'
export interface IUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest'
}

export class User implements IUser {
  constructor(
    public id: string,
    public name: string,
    public email: string,
    public role: UserRole
  ) {}

  isAdmin(): boolean {
    return this.role === UserRole.Admin;
  }
}

export type UserId = string;
export type UserEmail = string;
EOF

    # Create service file
    cat > "$TEST_DIR/src/services/userService.ts" << 'EOF'
import { User, IUser, UserRole } from '../models/user';

export interface IService<T> {
  get(id: string): Promise<T | null>;
  save(item: T): Promise<void>;
}

export abstract class BaseService<T> {
  protected abstract repository: any;
  
  abstract get(id: string): Promise<T | null>;
  abstract save(item: T): Promise<void>;
}

export class UserService extends BaseService<User> implements IService<User> {
  protected repository: any = {};

  async get(id: string): Promise<User | null> {
    const data = this.repository[id];
    if (!data) return null;
    
    return new User(data.id, data.name, data.email, data.role);
  }

  async save(user: User): Promise<void> {
    this.repository[user.id] = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }
}
EOF

    # Create controller file
    cat > "$TEST_DIR/src/controllers/userController.ts" << 'EOF'
import { UserService } from '../services/userService';
import { User, UserRole } from '../models/user';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async createUser(data: {
    id: string;
    name: string;
    email: string;
    role: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const role = data.role as UserRole;
      const user = new User(data.id, data.name, data.email, role);
      
      await this.userService.save(user);
      
      return {
        success: true,
        message: 'User created successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create user'
      };
    }
  }

  async getUser(id: string): Promise<User | null> {
    return this.userService.get(id);
  }
}
EOF

    # Create a test file (to test --include-tests flag)
    cat > "$TEST_DIR/src/models/user.test.ts" << 'EOF'
import { User, UserRole } from './user';

describe('User', () => {
  it('should create a user', () => {
    const user = new User('1', 'Test User', 'test@example.com', UserRole.Admin);
    expect(user.isAdmin()).toBe(true);
  });
});
EOF

    # Create an isolated utility file
    cat > "$TEST_DIR/src/utils.ts" << 'EOF'
export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseJSON<T>(json: string): T | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
EOF
}

# Create mocks for print-dependencies and print-inverse-dependencies
create_mocks() {
    mkdir -p "$TEST_DIR/bin"
    
    # Mock print-dependencies
    cat > "$TEST_DIR/bin/print-dependencies" << 'EOF'
#!/bin/bash
file="$1"
case "$file" in
    */models/user.ts)
        echo ""
        ;;
    */services/userService.ts)
        echo "../models/user"
        ;;
    */controllers/userController.ts)
        echo "../services/userService ../models/user"
        ;;
    */utils.ts)
        echo ""
        ;;
    *)
        echo ""
        ;;
esac
EOF
    chmod +x "$TEST_DIR/bin/print-dependencies"
    
    # Mock print-inverse-dependencies
    cat > "$TEST_DIR/bin/print-inverse-dependencies" << 'EOF'
#!/bin/bash
file="$1"
case "$file" in
    */models/user.ts)
        echo "../services/userService ../controllers/userController"
        ;;
    */services/userService.ts)
        echo "../controllers/userController"
        ;;
    */controllers/userController.ts)
        echo ""
        ;;
    */utils.ts)
        echo ""
        ;;
    *)
        echo ""
        ;;
esac
EOF
    chmod +x "$TEST_DIR/bin/print-inverse-dependencies"
}

echo "Running create-knowledge-graph tests..."
echo "======================================"

# Create test project and mocks
create_test_project
create_mocks

# Save original PATH and add mocks
ORIGINAL_PATH="$PATH"
export PATH="$TEST_DIR/bin:$ORIGINAL_PATH"

# Test 1: Help flag
run_test "Help flag shows usage" \
    "$KNOWLEDGE_GRAPH -h" \
    "Usage: create-knowledge-graph" \
    ""

# Test 2: Default behavior (should output to stdout)
run_test "Outputs to stdout by default" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "# Codebase Knowledge Graph" \
    ""

# Test 3: Generated timestamp
run_test "Includes generation timestamp" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "*Generated on" \
    ""

# Test 4: Module dependencies section
run_test "Generates module dependencies" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "## Modules and Their Dependencies" \
    ""

# Test 5: Type hierarchy section
run_test "Generates type hierarchy" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "## Type Hierarchy" \
    ""

# Test 6: Relationship summary table
run_test "Generates relationship summary" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "## Relationship Summary" \
    ""

# Test 7: Module tree visualization
run_test "Generates module tree" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "## Module Tree" \
    ""

# Test 8: Key insights section
run_test "Generates key insights" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "## Key Insights" \
    ""

# Test 9: Always includes test files
run_test "Always includes test files" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "user.test.ts" \
    ""

# Test 10: Classes are detected
run_test "Detects classes" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "**User**" \
    ""

# Test 11: Interfaces are detected
run_test "Detects interfaces" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "**IUser**" \
    ""

# Test 12: Enums are detected
run_test "Detects enums" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "**UserRole**" \
    ""

# Test 13: Type aliases are detected
run_test "Detects type aliases" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "**UserId**" \
    ""

# Test 14: Inheritance relationships
run_test "Shows inheritance relationships" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "extends: BaseService" \
    ""

# Test 15: Interface implementations
run_test "Shows interface implementations" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "implements: IService" \
    ""

# Test 16: Most depended upon modules
run_test "Identifies most depended upon modules" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "### Most Depended Upon Modules" \
    ""

# Test 17: Modules with most dependencies
run_test "Identifies modules with most dependencies" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "### Modules with Most Dependencies" \
    ""

# Test 18: Isolated modules
run_test "Identifies isolated modules" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "### Isolated Modules" \
    ""

# Test 19: Statistics section
run_test "Includes statistics" \
    "$KNOWLEDGE_GRAPH -s $TEST_DIR/src" \
    "### Statistics" \
    ""

# Test 20: Handles non-existent directory gracefully (generates empty graph)
run_test "Handles non-existent directory" \
    "$KNOWLEDGE_GRAPH -s /non/existent/directory 2>&1" \
    "# Codebase Knowledge Graph" \
    ""

# Test 21: Positional argument for source path
run_test "Accepts positional argument for source" \
    "$KNOWLEDGE_GRAPH $TEST_DIR/src" \
    "# Codebase Knowledge Graph" \
    ""

# Test 22: Piping to file works
echo -e "\n${YELLOW}Testing pipe to file...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
OUTPUT_FILE="$TEST_DIR/output.md"
$KNOWLEDGE_GRAPH -s $TEST_DIR/src > "$OUTPUT_FILE" 2>/dev/null
if [ -f "$OUTPUT_FILE" ] && grep -q "# Codebase Knowledge Graph" "$OUTPUT_FILE"; then
    echo -e "${GREEN}✓${NC} Can pipe output to file"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Piping to file failed"
fi

# Test 23: Auto-detects source directory
echo -e "\n${YELLOW}Testing auto-detection...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
# Create a test project with src directory
mkdir -p "$TEST_DIR/auto-detect/src"
cat > "$TEST_DIR/auto-detect/src/index.ts" << 'EOF'
export const test = 'auto-detected';
EOF
cat > "$TEST_DIR/auto-detect/package.json" << 'EOF'
{"name": "test"}
EOF

# Run from the auto-detect directory without specifying source
original_dir=$(pwd)
cd "$TEST_DIR/auto-detect"
output=$($KNOWLEDGE_GRAPH 2>&1 | head -50)
cd "$original_dir"

if echo "$output" | grep -q "src/index.ts"; then
    echo -e "${GREEN}✓${NC} Auto-detects src directory"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Failed to auto-detect src directory"
    if [ -n "$DEBUG" ]; then
        echo "  Output (first 20 lines):"
        echo "$output" | head -20 | sed 's/^/    /'
    fi
fi

# Test 24: Real monorepo (if exists)
if [ -d "/workspace/packages" ]; then
    echo -e "\n${YELLOW}Testing with real monorepo...${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Restore real PATH for this test
    export PATH="$ORIGINAL_PATH"
    
    output=$($KNOWLEDGE_GRAPH -s /workspace/packages/website/app/utils 2>&1 | head -50)
    if echo "$output" | grep -q "# Codebase Knowledge Graph"; then
        echo -e "${GREEN}✓${NC} Works with real monorepo files"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Failed with real monorepo files"
        if [ -n "$DEBUG" ]; then
            echo "  Output (first 20 lines):"
            echo "$output" | head -20 | sed 's/^/    /'
        fi
    fi
    
    # Restore mock PATH
    export PATH="$TEST_DIR/bin:$ORIGINAL_PATH"
fi

# Clean up
rm -rf "$TEST_DIR"

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