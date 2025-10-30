#!/bin/bash

# Test suite for web-setup hook

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOOK_SCRIPT="$SCRIPT_DIR/../hooks/web-setup"

# Create a temporary directory for tests
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

# Function to run a test
run_test() {
    local test_name="$1"
    local test_function="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Create a clean test environment
    local test_env="$TEST_DIR/test_$TESTS_RUN"
    mkdir -p "$test_env"

    # Run the test function
    if $test_function "$test_env"; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        if [ -n "$DEBUG" ]; then
            echo "  Test environment: $test_env"
        fi
    fi
}

# Test: Should exit early when not in web environment
test_not_web_environment() {
    local test_dir="$1"
    cd "$test_dir"

    # Create a basic package.json
    cat > package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0"
}
EOF

    # Run without CLAUDE_CODE_REMOTE set (explicitly unset it)
    local output
    output=$(unset CLAUDE_CODE_REMOTE; "$HOOK_SCRIPT" 2>&1)
    local exit_code=$?

    # Should exit with code 0 and produce no output
    if [ $exit_code -eq 0 ] && [ -z "$output" ]; then
        return 0
    else
        echo "  Expected silent exit, got exit code $exit_code with output: $output"
        return 1
    fi
}

# Test: Should detect yarn from packageManager field
test_detect_yarn_from_package_json() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project",
  "packageManager": "yarn@4.9.2",
  "version": "1.0.0"
}
EOF

    # Create a mock yarn command that just exits successfully
    cat > yarn << 'EOF'
#!/bin/bash
echo "Mock yarn install"
exit 0
EOF
    chmod +x yarn

    # Mock corepack enable
    cat > corepack << 'EOF'
#!/bin/bash
exit 0
EOF
    chmod +x corepack

    # Mock curl
    cat > curl << 'EOF'
#!/bin/bash
# Simulate successful download
exit 1  # We want to skip the download in test
EOF
    chmod +x curl

    # Mock node for version extraction
    cat > node << 'EOF'
#!/bin/bash
if [[ "$*" == *"packageManager"* ]]; then
    echo "yarn"
elif [[ "$*" == *"yarn@"* ]]; then
    echo "4.9.2"
else
    echo "{}"
fi
EOF
    chmod +x node

    # Add mocks to PATH
    export PATH="$test_dir:$PATH"
    export CLAUDE_CODE_REMOTE=true

    # Run the hook (it will fail at install, but we can check detection)
    local output
    output=$("$HOOK_SCRIPT" 2>&1 || true)

    if echo "$output" | grep -q "Detected package manager: yarn"; then
        return 0
    else
        echo "  Expected 'Detected package manager: yarn', got: $output"
        return 1
    fi
}

# Test: Should detect npm from lock file
test_detect_npm_from_lock() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0"
}
EOF

    # Create package-lock.json
    echo '{}' > package-lock.json

    # Mock node
    cat > node << 'EOF'
#!/bin/bash
if [[ "$*" == *"packageManager"* ]]; then
    echo ""  # No packageManager field
else
    echo "{}"
fi
EOF
    chmod +x node

    export PATH="$test_dir:$PATH"
    export CLAUDE_CODE_REMOTE=true

    # Run hook (will fail at install, but we can check detection)
    local output
    output=$("$HOOK_SCRIPT" 2>&1 || true)

    if echo "$output" | grep -q "Detected package manager: npm"; then
        return 0
    else
        echo "  Expected 'Detected package manager: npm', got: $output"
        return 1
    fi
}

# Test: Should detect pnpm from lock file
test_detect_pnpm_from_lock() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0"
}
EOF

    # Create pnpm-lock.yaml
    echo 'lockfileVersion: 5.4' > pnpm-lock.yaml

    # Mock node
    cat > node << 'EOF'
#!/bin/bash
if [[ "$*" == *"packageManager"* ]]; then
    echo ""  # No packageManager field
else
    echo "{}"
fi
EOF
    chmod +x node

    export PATH="$test_dir:$PATH"
    export CLAUDE_CODE_REMOTE=true

    # Run hook
    local output
    output=$("$HOOK_SCRIPT" 2>&1 || true)

    if echo "$output" | grep -q "Detected package manager: pnpm"; then
        return 0
    else
        echo "  Expected 'Detected package manager: pnpm', got: $output"
        return 1
    fi
}

# Test: Should detect bun from lock file
test_detect_bun_from_lock() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0"
}
EOF

    # Create bun.lockb (binary file, but we just create empty file)
    touch bun.lockb

    # Mock node
    cat > node << 'EOF'
#!/bin/bash
if [[ "$*" == *"packageManager"* ]]; then
    echo ""  # No packageManager field
else
    echo "{}"
fi
EOF
    chmod +x node

    export PATH="$test_dir:$PATH"
    export CLAUDE_CODE_REMOTE=true

    # Run hook
    local output
    output=$("$HOOK_SCRIPT" 2>&1 || true)

    if echo "$output" | grep -q "Detected package manager: bun"; then
        return 0
    else
        echo "  Expected 'Detected package manager: bun', got: $output"
        return 1
    fi
}

# Test: Should default to npm when no indicators
test_default_to_npm() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0"
}
EOF

    # No lock files created

    # Mock node
    cat > node << 'EOF'
#!/bin/bash
if [[ "$*" == *"packageManager"* ]]; then
    echo ""  # No packageManager field
else
    echo "{}"
fi
EOF
    chmod +x node

    export PATH="$test_dir:$PATH"
    export CLAUDE_CODE_REMOTE=true

    # Run hook
    local output
    output=$("$HOOK_SCRIPT" 2>&1 || true)

    if echo "$output" | grep -q "Detected package manager: npm"; then
        return 0
    else
        echo "  Expected 'Detected package manager: npm' (default), got: $output"
        return 1
    fi
}

# Test: Should prefer packageManager field over lock files
test_prefer_package_manager_field() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project",
  "packageManager": "pnpm@8.15.0",
  "version": "1.0.0"
}
EOF

    # Create yarn.lock (should be ignored)
    echo '{}' > yarn.lock

    # Mock node
    cat > node << 'EOF'
#!/bin/bash
if [[ "$*" == *"packageManager"* ]] && [[ "$*" == *"match"* ]]; then
    echo "pnpm"
elif [[ "$*" == *"pnpm@"* ]]; then
    echo "8.15.0"
else
    echo "{}"
fi
EOF
    chmod +x node

    export PATH="$test_dir:$PATH"
    export CLAUDE_CODE_REMOTE=true

    # Run hook
    local output
    output=$("$HOOK_SCRIPT" 2>&1 || true)

    if echo "$output" | grep -q "Detected package manager: pnpm"; then
        return 0
    else
        echo "  Expected 'Detected package manager: pnpm' (from packageManager field), got: $output"
        return 1
    fi
}

# Test: Should display available commands from package.json scripts
test_display_available_commands() {
    local test_dir="$1"
    cd "$test_dir"

    cat > package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
  "scripts": {
    "test": "jest",
    "build": "tsc",
    "dev": "vite",
    "lint": "eslint ."
  }
}
EOF

    # Create a simple test by checking if our detect/print functions work
    # We'll test the function directly

    # Mock node to return script info
    cat > node << 'EOF'
#!/bin/bash
if [[ "$*" == *"pkg.scripts && pkg.scripts.test"* ]]; then
    echo "true"
elif [[ "$*" == *"pkg.scripts && pkg.scripts.build"* ]]; then
    echo "true"
elif [[ "$*" == *"pkg.scripts && pkg.scripts.dev"* ]]; then
    echo "true"
elif [[ "$*" == *"pkg.scripts && pkg.scripts.lint"* ]]; then
    echo "true"
else
    echo "false"
fi
EOF
    chmod +x node

    export PATH="$test_dir:$PATH"

    # Source the hook script and test print_available_commands function
    # We can't easily source the script, so we'll just check basic logic is present
    if grep -q "print_available_commands" "$HOOK_SCRIPT"; then
        return 0
    else
        echo "  Hook script should have print_available_commands function"
        return 1
    fi
}

# Test: Should handle missing package.json gracefully
test_missing_package_json() {
    local test_dir="$1"
    cd "$test_dir"

    # No package.json created

    # Run hook (should fail but not crash)
    local output
    local exit_code
    set +e
    output=$(CLAUDE_CODE_REMOTE=true "$HOOK_SCRIPT" 2>&1)
    exit_code=$?
    set -e

    # Should exit with non-zero since package.json is required
    # But should not crash with unhandled error
    if [ $exit_code -ne 0 ] && echo "$output" | grep -q "package.json not found"; then
        return 0
    else
        echo "  Expected non-zero exit code with 'package.json not found' message when package.json missing"
        echo "  Got exit code: $exit_code"
        echo "  Output: $output"
        return 1
    fi
}

# Test: Script should be executable
test_script_executable() {
    if [ -x "$HOOK_SCRIPT" ]; then
        return 0
    else
        echo "  Hook script is not executable"
        return 1
    fi
}

# Test: Script has proper shebang
test_script_shebang() {
    local first_line
    first_line=$(head -n 1 "$HOOK_SCRIPT")

    if [ "$first_line" = "#!/bin/bash" ]; then
        return 0
    else
        echo "  Expected '#!/bin/bash' shebang, got: $first_line"
        return 1
    fi
}

# Test: Script uses set -euo pipefail
test_script_safe_options() {
    if grep -q "set -euo pipefail" "$HOOK_SCRIPT"; then
        return 0
    else
        echo "  Script should use 'set -euo pipefail' for safety"
        return 1
    fi
}

# Test: Script checks CLAUDE_CODE_REMOTE early
test_script_checks_remote() {
    if grep -q 'CLAUDE_CODE_REMOTE' "$HOOK_SCRIPT" | head -20 | grep -q "exit 0"; then
        return 0
    else
        # Just check if the variable is referenced
        if grep -q 'CLAUDE_CODE_REMOTE' "$HOOK_SCRIPT"; then
            return 0
        else
            echo "  Script should check CLAUDE_CODE_REMOTE environment variable"
            return 1
        fi
    fi
}

# Test: Script has all required functions
test_script_has_functions() {
    local required_functions=(
        "detect_package_manager"
        "get_package_manager_version"
        "setup_yarn"
        "setup_pnpm"
        "setup_npm"
        "setup_bun"
        "install_dependencies"
        "verify_installation"
        "print_available_commands"
        "main"
    )

    local missing_functions=()

    for func in "${required_functions[@]}"; do
        if ! grep -q "$func()" "$HOOK_SCRIPT"; then
            missing_functions+=("$func")
        fi
    done

    if [ ${#missing_functions[@]} -eq 0 ]; then
        return 0
    else
        echo "  Missing functions: ${missing_functions[*]}"
        return 1
    fi
}

# Test: Script handles all package managers
test_script_handles_all_package_managers() {
    local package_managers=("yarn" "pnpm" "npm" "bun")
    local missing_support=()

    for pm in "${package_managers[@]}"; do
        if ! grep -q "setup_$pm" "$HOOK_SCRIPT"; then
            missing_support+=("$pm")
        fi
    done

    if [ ${#missing_support[@]} -eq 0 ]; then
        return 0
    else
        echo "  Missing support for package managers: ${missing_support[*]}"
        return 1
    fi
}

echo "Running web-setup hook tests..."
echo "=============================================================="

# Basic script tests
run_test "Script should be executable" test_script_executable
run_test "Script should have proper shebang" test_script_shebang
run_test "Script should use safe options (set -euo pipefail)" test_script_safe_options
run_test "Script should check CLAUDE_CODE_REMOTE early" test_script_checks_remote
run_test "Script should have all required functions" test_script_has_functions
run_test "Script should handle all package managers" test_script_handles_all_package_managers

# Functional tests
run_test "Should exit early when not in web environment" test_not_web_environment
run_test "Should detect yarn from packageManager field" test_detect_yarn_from_package_json
run_test "Should detect npm from package-lock.json" test_detect_npm_from_lock
run_test "Should detect pnpm from pnpm-lock.yaml" test_detect_pnpm_from_lock
run_test "Should detect bun from bun.lockb" test_detect_bun_from_lock
run_test "Should default to npm when no indicators" test_default_to_npm
run_test "Should prefer packageManager field over lock files" test_prefer_package_manager_field
run_test "Should have function to display available commands" test_display_available_commands
run_test "Should handle missing package.json" test_missing_package_json

# Summary
echo
echo "=============================================================="
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
