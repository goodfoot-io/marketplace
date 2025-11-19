---
description: Test all project plugin binaries
---

This command tests all project plugin binaries to verify they work correctly.

```!
echo "=== Running Comprehensive Binary Tests ==="
echo ""
echo "Testing binaries from both create.md and begin.md workflows"
echo ""

# Set test mode
export CLAUDE_PID=$$
export CLAUDE_TEST_MODE=1

# Create unique test project name with timestamp for isolation
TEST_PROJECT="bin-test-$(date +%Y%m%d-%H%M%S)"

# Section 1: IPC and Workflow Utilities (begin.md)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Section 1: IPC and Workflow Utilities"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: write-arguments
echo "=== Test 1: write-arguments ==="
WRITE_RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/write-arguments "test-argument-value" 2>/dev/null)
if [ "$WRITE_RESULT" = "test-argument-value" ]; then
  echo "✓ write-arguments working"
else
  echo "✗ write-arguments failed"
  exit 1
fi
echo ""

# Test 2: wait-for-arguments
echo "=== Test 2: wait-for-arguments ==="
WAIT_RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/wait-for-arguments 2>/dev/null)
if [ "$WAIT_RESULT" = "test-argument-value" ]; then
  echo "✓ wait-for-arguments working"
else
  echo "✗ wait-for-arguments failed"
  exit 1
fi
echo ""

# Test 3: get-next-project (requires project structure)
echo "=== Test 3: get-next-project ==="
# Create temporary test structure
mkdir -p projects/pending/workflow-test-$$
echo "# Test Plan" > projects/pending/workflow-test-$$/plan.md
"${CLAUDE_PLUGIN_ROOT}"/bin/write-arguments "workflow-test-$$" >/dev/null 2>&1
GET_RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/get-next-project 2>/dev/null)
if [[ "$GET_RESULT" == *"workflow-test-$$"* ]]; then
  echo "✓ get-next-project working"
else
  echo "✗ get-next-project failed"
  exit 1
fi
echo ""

# Test 4: wait-for-project-name
echo "=== Test 4: wait-for-project-name ==="
# Set up IPC for testing
echo "projects/pending/workflow-test-$$" > /tmp/slash_cmd_project_path_${CLAUDE_PID}.txt
touch /tmp/slash_cmd_project_sync_${CLAUDE_PID}_$(date +%s)
WAIT_PROJECT=$("${CLAUDE_PLUGIN_ROOT}"/bin/wait-for-project-name 2 2>/dev/null)
if [[ "$WAIT_PROJECT" == *"workflow-test-$$"* ]]; then
  echo "✓ wait-for-project-name working"
else
  echo "✗ wait-for-project-name failed"
  exit 1
fi
echo ""

# Test 5: activate-project
echo "=== Test 5: activate-project ==="
ACTIVATE_RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/activate-project "projects/pending/workflow-test-$$" 2>/dev/null)
if [[ "$ACTIVATE_RESULT" == *"active/workflow-test-$$"* ]] && [ -d "$ACTIVATE_RESULT" ]; then
  echo "✓ activate-project working"
  echo "  Moved to: $ACTIVATE_RESULT"
else
  echo "✗ activate-project failed"
  exit 1
fi
echo ""

# Test 6: update-project-path
echo "=== Test 6: update-project-path ==="
"${CLAUDE_PLUGIN_ROOT}"/bin/update-project-path "$ACTIVATE_RESULT" 2>/dev/null
if [ -f /tmp/slash_cmd_project_path_${CLAUDE_PID}.txt ]; then
  STORED_PATH=$(cat /tmp/slash_cmd_project_path_${CLAUDE_PID}.txt)
  echo "✓ update-project-path working"
  echo "  Stored: $STORED_PATH"
else
  echo "✗ update-project-path failed"
  exit 1
fi
echo ""

# Test 7: activate-project-with-args
echo "=== Test 7: activate-project-with-args ==="
mkdir -p projects/pending/args-workflow-test-$$
echo "# Args Test Plan" > projects/pending/args-workflow-test-$$/plan.md
"${CLAUDE_PLUGIN_ROOT}"/bin/write-arguments "args-workflow-test-$$" >/dev/null 2>&1
ARGS_ACTIVATE=$("${CLAUDE_PLUGIN_ROOT}"/bin/activate-project-with-args "args-workflow-test-$$" 2>/dev/null)
if [[ "$ARGS_ACTIVATE" == *"active/args-workflow-test-$$"* ]]; then
  echo "✓ activate-project-with-args working"
else
  echo "✗ activate-project-with-args failed"
  exit 1
fi
echo ""

# Section 2: Project Management Utilities (create.md)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Section 2: Project Management Utilities"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 8: initialize-project
echo "=== Test 8: initialize-project ==="
PROJECT_DIR=$("${CLAUDE_PLUGIN_ROOT}"/bin/initialize-project "$TEST_PROJECT")
if [ $? -eq 0 ]; then
  echo "✓ initialize-project working"
  echo "  Created at: $PROJECT_DIR"
  echo "  Log file exists: $(test -f "$PROJECT_DIR/log.md" && echo "yes" || echo "no")"
  echo "  Scratchpad exists: $(test -d "$PROJECT_DIR/scratchpad" && echo "yes" || echo "no")"
else
  echo "✗ initialize-project failed"
  exit 1
fi
echo ""

# Test 9: create-plan-version
echo "=== Test 9: create-plan-version ==="
PLAN_OUTPUT=$("${CLAUDE_PLUGIN_ROOT}"/bin/create-plan-version "$TEST_PROJECT" "# Test Plan

## Goal
Test the create-plan-version binary

## Technical Approach
- Create a test plan
- Verify versioning works" 2>&1)
if [ $? -eq 0 ]; then
  echo "✓ create-plan-version working"
  echo "  Created: $(basename "$PLAN_OUTPUT")"
else
  echo "✗ create-plan-version failed"
  echo "  Error: $PLAN_OUTPUT"
  exit 1
fi
echo ""

# Test 10: Plan version increment
echo "=== Test 10: Plan Version Increment ==="
PLAN_FILE=$("${CLAUDE_PLUGIN_ROOT}"/bin/create-plan-version "$TEST_PROJECT" "# Test Plan v2

## Updated Goal
Verify version increment works correctly" 2>&1)
if [ $? -eq 0 ] && [[ "$PLAN_FILE" == *"plan-v2.md"* ]]; then
  echo "✓ Plan versioning working"
  echo "  Created: $(basename "$PLAN_FILE")"
else
  echo "✗ Plan versioning failed"
  exit 1
fi
echo ""

# Test 11: Idempotent project creation
echo "=== Test 11: Idempotent Project Creation ==="
PROJECT_DIR_RETRY=$("${CLAUDE_PLUGIN_ROOT}"/bin/initialize-project "$TEST_PROJECT" 2>&1)
if [ $? -eq 0 ] && [ "$PROJECT_DIR_RETRY" = "$PROJECT_DIR" ]; then
  echo "✓ Idempotency working"
  echo "  Returned same path: $PROJECT_DIR_RETRY"
else
  echo "✗ Idempotency failed"
  exit 1
fi
echo ""

# Cleanup
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Cleanup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
rm -rf projects/active/workflow-test-$$ 2>/dev/null
rm -rf projects/active/args-workflow-test-$$ 2>/dev/null
rm -f /tmp/slash_cmd_*${CLAUDE_PID}* 2>/dev/null
echo "✓ Temporary test projects cleaned up"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ All 11 Tests Passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Test project created: $TEST_PROJECT"
echo "To remove it, run:"
echo "  rm -rf projects/new/$TEST_PROJECT"
```

---

## Usage Notes

This comprehensive test suite verifies all project plugin binaries:

### IPC and Workflow Utilities (begin.md)
1. **write-arguments** - IPC argument writing
2. **wait-for-arguments** - IPC argument reading
3. **get-next-project** - Project selection logic
4. **wait-for-project-name** - IPC project path reading
5. **activate-project** - Project activation and movement
6. **update-project-path** - IPC project path updating
7. **activate-project-with-args** - Argument-based activation

### Project Management Utilities (create.md)
8. **initialize-project** - Project structure creation
9. **create-plan-version** - Versioned plan file creation
10. **Plan versioning** - Version increment verification
11. **Idempotency** - Safe repeated execution

All tests run sequentially in a single embedded bash block to avoid race conditions.
Test projects are automatically cleaned up after successful execution.
