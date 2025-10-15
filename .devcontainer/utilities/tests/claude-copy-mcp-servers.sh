#!/bin/bash

# Test suite for claude-copy-mcp-servers utility

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Create test directories
TEST_DIR="/tmp/test-claude-mcp-$$"
SOURCE_DIR="$TEST_DIR/source"
TARGET_DIR="$TEST_DIR/target"
mkdir -p "$SOURCE_DIR" "$TARGET_DIR"

# Backup original Claude config
CLAUDE_CONFIG="/home/node/.claude/.claude.json"
CLAUDE_CONFIG_BACKUP="/tmp/claude-config-backup-$$.json"

# Get the utility path
COPY_MCP="/workspace/.devcontainer/utilities/claude-copy-mcp-servers"

# Function to backup Claude config
backup_config() {
    if [ -f "$CLAUDE_CONFIG" ]; then
        cp "$CLAUDE_CONFIG" "$CLAUDE_CONFIG_BACKUP"
        echo -e "${BLUE}Backed up Claude config${NC}"
    fi
}

# Function to restore Claude config
restore_config() {
    if [ -f "$CLAUDE_CONFIG_BACKUP" ]; then
        cp "$CLAUDE_CONFIG_BACKUP" "$CLAUDE_CONFIG"
        rm -f "$CLAUDE_CONFIG_BACKUP"
        echo -e "${BLUE}Restored Claude config${NC}"
    fi
}

# Function to clear MCP servers for a directory
clear_mcp_servers() {
    local dir="$1"
    cd "$dir"
    
    # Get list of all MCP servers and remove them
    claude mcp list 2>/dev/null | while read -r line; do
        if [[ $line =~ ^([^:]+): ]]; then
            server_name="${BASH_REMATCH[1]}"
            claude mcp remove "$server_name" -s local 2>/dev/null
        fi
    done
}

# Function to add test MCP servers
add_test_servers() {
    local dir="$1"
    cd "$dir"
    
    # Add various types of MCP servers for testing
    claude mcp add test-sse https://example.com/sse -t sse -s local 2>/dev/null
    claude mcp add test-stdio npx test-package@latest -s local 2>/dev/null
    claude mcp add test-env node test.js -e TEST_VAR=value1 -e ANOTHER_VAR=value2 -s local 2>/dev/null
    
    # Return number of servers added
    echo "3"
}

# Function to count MCP servers in a directory
count_mcp_servers() {
    local dir="$1"
    cd "$dir"
    
    local count=0
    claude mcp list 2>/dev/null | while read -r line; do
        if [[ $line =~ ^([^:]+): ]]; then
            ((count++))
        fi
    done
    echo "$count"
}

# Function to check if specific server exists
server_exists() {
    local dir="$1"
    local server_name="$2"
    cd "$dir"
    
    if claude mcp list 2>/dev/null | grep -q "^${server_name}:"; then
        return 0
    else
        return 1
    fi
}

# Function to run a test
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    echo -e "\n${YELLOW}TEST: $test_name${NC}"
    
    if $test_function; then
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
    fi
}

# Test functions

test_no_arguments() {
    local output
    output=$("$COPY_MCP" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 1 ]; then
        echo "Expected exit code 1, got $exit_code"
        return 1
    fi
    
    if ! echo "$output" | grep -q "Error: Target directory is required"; then
        echo "Expected error message not found"
        return 1
    fi
    
    return 0
}

test_nonexistent_target() {
    local output
    output=$("$COPY_MCP" "/nonexistent/directory" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 1 ]; then
        echo "Expected exit code 1, got $exit_code"
        return 1
    fi
    
    if ! echo "$output" | grep -q "Error: Target directory does not exist"; then
        echo "Expected error message not found"
        return 1
    fi
    
    return 0
}

test_no_servers_to_copy() {
    # Clear any existing servers in source
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"
    
    cd "$SOURCE_DIR"
    local output
    output=$("$COPY_MCP" "$TARGET_DIR" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo "Expected exit code 0, got $exit_code"
        return 1
    fi
    
    if ! echo "$output" | grep -q "No MCP servers found"; then
        echo "Expected message not found"
        echo "Output: $output"
        return 1
    fi
    
    return 0
}

test_copy_sse_server() {
    # Setup
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"
    
    cd "$SOURCE_DIR"
    claude mcp add test-sse https://example.com/sse -t sse -s local 2>/dev/null
    
    # Run copy
    local output
    output=$("$COPY_MCP" "$TARGET_DIR" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo "Copy failed with exit code $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    # Verify server was copied
    if ! server_exists "$TARGET_DIR" "test-sse"; then
        echo "Server test-sse was not copied to target"
        return 1
    fi
    
    return 0
}

test_copy_stdio_server() {
    # Setup
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"
    
    cd "$SOURCE_DIR"
    claude mcp add test-stdio npx test-package@latest -s local 2>/dev/null
    
    # Run copy
    cd "$SOURCE_DIR"
    local output
    output=$("$COPY_MCP" "$TARGET_DIR" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo "Copy failed with exit code $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    # Verify server was copied
    if ! server_exists "$TARGET_DIR" "test-stdio"; then
        echo "Server test-stdio was not copied to target"
        return 1
    fi
    
    return 0
}

test_copy_server_with_env() {
    # Setup
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"
    
    cd "$SOURCE_DIR"
    claude mcp add test-env node test.js -e TEST_VAR=value1 -e ANOTHER_VAR=value2 -s local 2>/dev/null
    
    # Run copy
    local output
    output=$("$COPY_MCP" "$TARGET_DIR" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo "Copy failed with exit code $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    # Verify server was copied
    if ! server_exists "$TARGET_DIR" "test-env"; then
        echo "Server test-env was not copied to target"
        return 1
    fi
    
    # Check if environment variables were preserved
    cd "$TARGET_DIR"
    local server_details
    server_details=$(claude mcp get test-env 2>/dev/null)
    
    if ! echo "$server_details" | grep -q "TEST_VAR=value1"; then
        echo "Environment variable TEST_VAR not preserved"
        echo "Server details: $server_details"
        return 1
    fi
    
    if ! echo "$server_details" | grep -q "ANOTHER_VAR=value2"; then
        echo "Environment variable ANOTHER_VAR not preserved"
        echo "Server details: $server_details"
        return 1
    fi
    
    return 0
}

test_copy_multiple_servers() {
    # Setup
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"
    
    # Add multiple servers
    cd "$SOURCE_DIR"
    claude mcp add server1 https://example1.com/sse -t sse -s local 2>/dev/null
    claude mcp add server2 npx package2@latest -s local 2>/dev/null
    claude mcp add server3 node script3.js -e VAR3=val3 -s local 2>/dev/null
    
    # Run copy
    local output
    output=$("$COPY_MCP" "$TARGET_DIR" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo "Copy failed with exit code $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    # Verify all servers were copied
    local missing_servers=0
    for server in server1 server2 server3; do
        if ! server_exists "$TARGET_DIR" "$server"; then
            echo "Server $server was not copied"
            ((missing_servers++))
        fi
    done
    
    if [ $missing_servers -gt 0 ]; then
        return 1
    fi
    
    # Check summary in output
    if ! echo "$output" | grep -q "Copied:.*3.*servers"; then
        echo "Expected summary not found in output"
        return 1
    fi
    
    return 0
}

test_overwrite_existing_servers() {
    # Setup - add different servers to both directories
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"
    
    cd "$SOURCE_DIR"
    claude mcp add shared-server https://source.com/sse -t sse -s local 2>/dev/null
    
    cd "$TARGET_DIR"
    claude mcp add shared-server https://target.com/sse -t sse -s local 2>/dev/null
    
    # Run copy
    cd "$SOURCE_DIR"
    local output
    output=$("$COPY_MCP" "$TARGET_DIR" 2>&1)
    
    # The copy should succeed (claude mcp add will update existing servers)
    if echo "$output" | grep -q "✓ Copied MCP server: shared-server"; then
        # Server was successfully updated
        return 0
    else
        echo "Server was not copied/updated"
        echo "Output: $output"
        return 1
    fi
}

test_relative_path() {
    # Setup
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"
    
    cd "$SOURCE_DIR"
    claude mcp add test-relative https://example.com/sse -t sse -s local 2>/dev/null
    
    # Use relative path for target
    local output
    output=$("$COPY_MCP" "../target" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo "Copy failed with exit code $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    # Verify server was copied
    if ! server_exists "$TARGET_DIR" "test-relative"; then
        echo "Server was not copied using relative path"
        return 1
    fi
    
    return 0
}

test_absolute_path() {
    # Setup
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"
    
    cd "$SOURCE_DIR"
    claude mcp add test-absolute https://example.com/sse -t sse -s local 2>/dev/null
    
    # Use absolute path for target
    local output
    output=$("$COPY_MCP" "$TARGET_DIR" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo "Copy failed with exit code $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    # Verify server was copied
    if ! server_exists "$TARGET_DIR" "test-absolute"; then
        echo "Server was not copied using absolute path"
        return 1
    fi
    
    return 0
}

test_server_with_args() {
    # Setup
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"

    cd "$SOURCE_DIR"
    # Use correct syntax for adding server with arguments
    claude mcp add -s local test-args npx -- some-package@latest arg1 arg2 2>/dev/null

    # Run copy
    local output
    output=$("$COPY_MCP" "$TARGET_DIR" 2>&1)
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "Copy failed with exit code $exit_code"
        echo "Output: $output"
        return 1
    fi

    # Verify server was copied
    if ! server_exists "$TARGET_DIR" "test-args"; then
        echo "Server test-args was not copied"
        return 1
    fi

    # Check if arguments were preserved
    cd "$TARGET_DIR"
    local server_details
    server_details=$(claude mcp get test-args 2>/dev/null)

    if ! echo "$server_details" | grep -q "some-package@latest"; then
        echo "Package name not preserved"
        echo "Server details: $server_details"
        return 1
    fi

    # Check if arguments were preserved
    if ! echo "$server_details" | grep -q "arg1"; then
        echo "Arguments not preserved"
        echo "Server details: $server_details"
        return 1
    fi

    return 0
}

test_server_with_dash_args() {
    # This test specifically covers the vscode case where args start with dashes
    # Setup
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"

    cd "$SOURCE_DIR"
    # Simulate vscode server: npx -y @vscode-mcp/vscode-mcp-server@latest
    claude mcp add -s local test-vscode npx -- -y @vscode-mcp/vscode-mcp-server@latest 2>/dev/null

    # Run copy
    local output
    output=$("$COPY_MCP" "$TARGET_DIR" 2>&1)
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "Copy failed with exit code $exit_code"
        echo "Output: $output"
        return 1
    fi

    # Verify server was copied
    if ! server_exists "$TARGET_DIR" "test-vscode"; then
        echo "Server test-vscode was not copied"
        return 1
    fi

    # Check if arguments with dashes were preserved
    cd "$TARGET_DIR"
    local server_details
    server_details=$(claude mcp get test-vscode 2>/dev/null)

    if ! echo "$server_details" | grep -q -- "-y"; then
        echo "Dash argument -y not preserved"
        echo "Server details: $server_details"
        return 1
    fi

    if ! echo "$server_details" | grep -q "@vscode-mcp/vscode-mcp-server@latest"; then
        echo "Package name not preserved"
        echo "Server details: $server_details"
        return 1
    fi

    return 0
}

test_server_with_double_dash_args() {
    # This test specifically covers the browser case where args use --
    # Setup
    clear_mcp_servers "$SOURCE_DIR"
    clear_mcp_servers "$TARGET_DIR"

    cd "$SOURCE_DIR"
    # Simulate browser server: node /path/to/script.mjs --browserUrl http://example.com
    claude mcp add -s local test-browser node -- /tmp/test-script.mjs --browserUrl http://example.com:9222/ 2>/dev/null

    # Run copy
    local output
    output=$("$COPY_MCP" "$TARGET_DIR" 2>&1)
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "Copy failed with exit code $exit_code"
        echo "Output: $output"
        return 1
    fi

    # Verify server was copied
    if ! server_exists "$TARGET_DIR" "test-browser"; then
        echo "Server test-browser was not copied"
        return 1
    fi

    # Check if arguments with double dashes were preserved
    cd "$TARGET_DIR"
    local server_details
    server_details=$(claude mcp get test-browser 2>/dev/null)

    if ! echo "$server_details" | grep -q -- "--browserUrl"; then
        echo "Double dash argument --browserUrl not preserved"
        echo "Server details: $server_details"
        return 1
    fi

    if ! echo "$server_details" | grep -q "http://example.com:9222/"; then
        echo "URL not preserved"
        echo "Server details: $server_details"
        return 1
    fi

    return 0
}

# Main test execution
echo "Running claude-copy-mcp-servers tests..."
echo "========================================"
echo "Test directories:"
echo "  Source: $SOURCE_DIR"
echo "  Target: $TARGET_DIR"

# Backup current config
backup_config

# Run tests
run_test "No arguments provided" test_no_arguments
run_test "Non-existent target directory" test_nonexistent_target
run_test "No servers to copy" test_no_servers_to_copy
run_test "Copy SSE server" test_copy_sse_server
run_test "Copy stdio server" test_copy_stdio_server
run_test "Copy server with environment variables" test_copy_server_with_env
run_test "Copy multiple servers" test_copy_multiple_servers
run_test "Overwrite existing servers" test_overwrite_existing_servers
run_test "Copy with relative path" test_relative_path
run_test "Copy with absolute path" test_absolute_path
run_test "Copy server with arguments" test_server_with_args
run_test "Copy server with dash arguments (vscode case)" test_server_with_dash_args
run_test "Copy server with double-dash arguments (browser case)" test_server_with_double_dash_args

# Restore original config
restore_config

# Clean up test directories
cd /
rm -rf "$TEST_DIR"

# Summary
echo
echo "========================================"
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