#!/bin/bash

# Integration test for activate-project-with-args utility
# This test uses the actual utilities instead of mocks

# Setup test environment
export REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
UTILITIES_DIR="$REPO_ROOT/.devcontainer/utilities"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "Running activate-project-with-args integration test..."
echo "======================================================"

# Check if required utilities exist
echo -n "Checking for required utilities... "
required_utils=("write-arguments" "get-next-project" "wait-for-project-name" "activate-project")
all_found=true

for util in "${required_utils[@]}"; do
    if ! command -v "$util" &> /dev/null; then
        echo -e "${RED}Missing: $util${NC}"
        all_found=false
    fi
done

if [ "$all_found" = true ]; then
    echo -e "${GREEN}All utilities found${NC}"
else
    echo -e "${YELLOW}Warning: Some utilities are missing. Test may fail.${NC}"
fi

# Test the utility with --help or no args (safe test)
echo ""
echo "Testing utility existence and basic execution..."
if [ -x "$UTILITIES_DIR/activate-project-with-args" ]; then
    echo -e "${GREEN}✓ Utility exists and is executable${NC}"
    
    # Try running with a nonexistent project (safe test)
    echo ""
    echo "Testing with nonexistent project..."
    output=$("$UTILITIES_DIR/activate-project-with-args" "nonexistent-test-project-$$" 2>&1)
    
    if [[ "$output" == *"Project not found"* ]] || [[ "$output" == *"unmet dependencies"* ]]; then
        echo -e "${GREEN}✓ Handles nonexistent projects correctly${NC}"
    else
        echo -e "${YELLOW}⚠ Unexpected output: $output${NC}"
    fi
    
    # Test punctuation handling
    echo ""
    echo "Testing punctuation handling..."
    
    # Test with trailing period
    echo -n "  Testing project name with trailing period... "
    output=$("$UTILITIES_DIR/activate-project-with-args" "nonexistent-test-project-$$." 2>&1)
    if [[ "$output" == *"Project not found"* ]] || [[ "$output" == *"unmet dependencies"* ]]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ Unexpected output${NC}"
    fi
    
    # Test with quotes and comma
    echo -n "  Testing project name with quotes and comma... "
    output=$("$UTILITIES_DIR/activate-project-with-args" '"nonexistent-test-project-$$", please' 2>&1)
    if [[ "$output" == *"Project not found"* ]] || [[ "$output" == *"unmet dependencies"* ]]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ Unexpected output${NC}"
    fi
    
    # Test with @ symbol
    echo -n "  Testing project name with @ prefix... "
    output=$("$UTILITIES_DIR/activate-project-with-args" "@nonexistent-test-project-$$ status" 2>&1)
    if [[ "$output" == *"Project not found"* ]] || [[ "$output" == *"unmet dependencies"* ]]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ Unexpected output${NC}"
    fi
else
    echo -e "${RED}✗ Utility not found or not executable${NC}"
    exit 1
fi

    # Test with a real project name (if expandable-events-voice-instructions exists)
    echo ""
    echo "Testing with real project (if exists)..."
    if [ -d "$REPO_ROOT/projects/ready-for-review/expandable-events-voice-instructions" ] || \
       [ -d "$REPO_ROOT/projects/active/expandable-events-voice-instructions" ] || \
       [ -d "$REPO_ROOT/projects/pending/expandable-events-voice-instructions" ]; then
        echo -n "  Testing real project with punctuation... "
        # This should find the project despite the period
        output=$("$UTILITIES_DIR/activate-project-with-args" "expandable-events-voice-instructions." 2>&1)
        if [[ "$output" != *"Project not found"* ]]; then
            echo -e "${GREEN}✓ Found project despite trailing punctuation${NC}"
        else
            echo -e "${YELLOW}⚠ Project not found with punctuation${NC}"
        fi
    else
        echo "  Skipping real project test (expandable-events-voice-instructions not found)"
    fi

    # Test path synchronization issue reproduction
    echo ""
    echo "Testing path synchronization issue (begin.md bug)..."
    echo "====================================================="
    
    # Create a temporary test environment
    TEST_DIR="/tmp/path-sync-test-$$"
    mkdir -p "$TEST_DIR/projects/pending/sync-test-project"
    echo "# Test Plan" > "$TEST_DIR/projects/pending/sync-test-project/plan.md"
    
    echo "Step 1: Simulating begin.md workflow with IPC state"
    
    # Simulate what begin.md does: store project path in IPC state
    CLAUDE_PID=$$
    IPC_FILE="/tmp/slash_cmd_args_${CLAUDE_PID}.sh"
    echo "PROJECT_PATH=\"$TEST_DIR/projects/pending/sync-test-project\"" > "$IPC_FILE"
    echo "  Stored in IPC: $TEST_DIR/projects/pending/sync-test-project"
    
    # Simulate activate-project moving the project
    echo "Step 2: Simulating activate-project (moving pending -> active)"
    mkdir -p "$TEST_DIR/projects/active"
    mv "$TEST_DIR/projects/pending/sync-test-project" "$TEST_DIR/projects/active/"
    ACTIVE_PROJECT="$TEST_DIR/projects/active/sync-test-project"
    echo "  New location: $ACTIVE_PROJECT"
    
    # Simulate wait-for-project-name reading the IPC state (stale path)
    echo "Step 3: Reading IPC state (simulating wait-for-project-name)"
    source "$IPC_FILE"
    echo "  IPC returns: $PROJECT_PATH"
    
    # Check if the path from IPC still works
    echo "Step 4: Checking if IPC path is still valid"
    if [ -f "$PROJECT_PATH/plan.md" ]; then
        echo -e "  ${GREEN}✓ File found at IPC path (unexpected)${NC}"
    else
        echo -e "  ${RED}✗ File NOT found at IPC path${NC}"
        echo -e "  ${RED}  This demonstrates the PATH SYNCHRONIZATION BUG${NC}"
        echo -e "  ${YELLOW}  The file is actually at: $ACTIVE_PROJECT/plan.md${NC}"
    fi
    
    # Show the fix
    echo "Step 5: Demonstrating the fix"
    echo "  If begin.md used ACTIVE_PROJECT instead of PROJECT_PATH:"
    if [ -f "$ACTIVE_PROJECT/plan.md" ]; then
        echo -e "  ${GREEN}✓ File found at correct location${NC}"
    fi
    
    # Clean up
    rm -rf "$TEST_DIR"
    rm -f "$IPC_FILE"

echo ""
echo "======================================================"
echo -e "${GREEN}Integration test completed${NC}"
echo ""
echo "Note: This is a limited integration test that doesn't"
echo "create actual projects to avoid modifying the workspace."
echo "Full integration testing should be done in a dedicated"
echo "test environment."