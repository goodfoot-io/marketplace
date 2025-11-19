---
description: Move utility binaries from .devcontainer to plugin bin directory with proper scoping
argument-hint: [target-file-path]
---

<user-message>
$ARGUMENTS
</user-message>

You will help migrate utility binaries from the global `.devcontainer/utilities` directory into a plugin's local `bin` directory for better encapsulation and portability.

## Overview

This command guides you through:
1. Identifying binaries referenced in a target file
2. Locating binaries and tests in `.devcontainer/utilities`
3. Copying to plugin `bin/` and `bin/tests/`
4. Updating test files for plugin-local execution
5. Updating target file to use `${CLAUDE_PLUGIN_ROOT}/bin/` paths
6. Creating test command to verify functionality

## Prerequisites

Review embedded bash documentation: @plugins/CLAUDE.md (section: "Embedded Bash in Commands and Skills")

Key concepts you'll need:
- `${CLAUDE_PLUGIN_ROOT}` for plugin-relative paths
- Embedded bash blocks execute from workspace root
- Single bash block for sequential test operations

## Phase 1: Identify Binaries

### Step 1: Read Target File

Read the target file specified by the user to identify which binaries it references.

**Example patterns to look for:**
```bash
binary-name "argument"
some-utility "arg1" "arg2"
helper-script --flag value
```

**Common locations in target files:**
- Command reference sections
- Example usage blocks
- Embedded bash blocks
- Code examples in documentation

### Step 2: List Referenced Binaries

Create a list of all unique binary names found in the target file.

**Output format:**
```
Found binaries referenced in [TARGET_FILE]:
1. binary-name-1
2. binary-name-2
3. helper-script
```

## Phase 2: Locate Source Files

### Step 1: Find Binaries in .devcontainer/utilities

For each binary identified, verify it exists:

```bash
ls -la .devcontainer/utilities/[binary-name-1]
ls -la .devcontainer/utilities/[binary-name-2]
```

### Step 2: Find Corresponding Tests

Tests follow the naming pattern: `.devcontainer/utilities/tests/[binary-name].sh`

```bash
ls -la .devcontainer/utilities/tests/[binary-name-1].sh
ls -la .devcontainer/utilities/tests/[binary-name-2].sh
```

### Step 3: Verify Files Exist

Report any missing binaries or tests:
- If binary exists but test doesn't: Note this and continue
- If binary doesn't exist: Alert user and ask for clarification

## Phase 3: Copy Files to Plugin

### Step 1: Determine Plugin Path

Ask user which plugin to use, or infer from target file path:
- Target: `plugins/project/commands/create.md` → Plugin: `project`
- Target: `plugins/goodfoot/commands/analyze.md` → Plugin: `goodfoot`

### Step 2: Create Directory Structure

```bash
mkdir -p plugins/[PLUGIN_NAME]/bin/tests
```

### Step 3: Copy Binaries

```bash
cp .devcontainer/utilities/[BINARY_NAME] plugins/[PLUGIN_NAME]/bin/
chmod +x plugins/[PLUGIN_NAME]/bin/[BINARY_NAME]
```

Repeat for all identified binaries.

### Step 4: Copy Test Files

```bash
cp .devcontainer/utilities/tests/[BINARY_NAME].sh plugins/[PLUGIN_NAME]/bin/tests/
chmod +x plugins/[PLUGIN_NAME]/bin/tests/[BINARY_NAME].sh
```

## Phase 4: Update Test Files

### Step 1: Read Test File

For each test file, read it to find the binary path reference.

**Common pattern:**
```bash
# Get the utility path
BINARY_PATH="/workspace/.devcontainer/utilities/[binary-name]"
```

### Step 2: Update to Plugin-Relative Path

Replace global path with plugin-relative path that resolves at runtime:

**Before:**
```bash
BINARY_PATH="/workspace/.devcontainer/utilities/[binary-name]"
```

**After:**
```bash
# Get the utility path from plugin directory (must be before cd to test directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY_PATH="$SCRIPT_DIR/../[binary-name]"
```

**CRITICAL**: This must be computed BEFORE any `cd` commands in the test file, otherwise the path resolution will be incorrect.

### Step 3: Verify Test Updates

Check that:
1. Path computation happens before any `cd` commands
2. Relative path uses `../` to go from `tests/` to `bin/`
3. No hardcoded absolute paths remain

## Phase 5: Update Target File

### Step 1: Identify Binary References

Find all places where binaries are called in the target file.

**Common patterns:**
```bash
binary-name "argument"
RESULT=$(binary-name "arg1" "arg2")
```

### Step 2: Update to Use ${CLAUDE_PLUGIN_ROOT}

Replace direct binary calls with `${CLAUDE_PLUGIN_ROOT}/bin/` paths:

**Before:**
```bash
RESULT=$(binary-name "argument")
```

**After:**
```bash
RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/binary-name "argument")
```

**Before:**
```bash
helper-script "arg1" "arg2"
```

**After:**
```bash
"${CLAUDE_PLUGIN_ROOT}"/bin/helper-script "arg1" "arg2"
```

### Step 3: Update Command Reference Sections

If the target file has a command reference section with examples, update those as well:

```bash
<command-reference>
```bash
# Example usage with plugin binary
RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/binary-name "[ARG1]")

# Another example
"${CLAUDE_PLUGIN_ROOT}"/bin/helper-script "[ARG1]" "[ARG2]"
```
</command-reference>
```

## Phase 6: Create Test Command

### Step 1: Create bin-test.md Command

Create `plugins/[PLUGIN_NAME]/commands/bin-test.md` to verify binary functionality.

**Template structure:**

The test command should have:
- Frontmatter with description
- Single embedded bash block containing all tests
- Clear test descriptions and pass/fail indicators
- Exit on first failure
- Cleanup instructions

**Example structure (replace placeholders with actual values):**

    ---
    description: Test [plugin] plugin binaries
    ---

    This command tests the plugin binaries to verify they work correctly.

    ``` !
    echo "=== Running Binary Tests ==="
    echo ""

    # Test 1: [First binary test]
    echo "=== Test 1: [Description] ==="
    RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/[BINARY_NAME] [ARGS])
    if [ $? -eq 0 ]; then
      echo "✓ Test 1 passed"
      echo "Result: $RESULT"
    else
      echo "✗ Test 1 failed"
      exit 1
    fi

    echo ""
    echo ""

    # Test 2: [Second binary test]
    echo "=== Test 2: [Description] ==="
    # ... more tests ...

    echo "=== All Tests Passed! ==="
    ```

    ---

    ## Usage Notes

    All tests run sequentially in a single embedded bash block to avoid race conditions.
    See @plugins/CLAUDE.md for embedded bash best practices.

Note: Remove the space between ``` and ! when creating the actual file.

**Key patterns for test commands:**
- Use **single embedded bash block** for all tests (prevents parallel execution race conditions)
- Capture exit codes: `RESULT=$(...); EXIT_CODE=$?`
- Exit on first failure: `exit 1`
- Clear indicators: `✓` for pass, `✗` for fail
- Include cleanup instructions

### Step 2: Add README.md

Create `plugins/[PLUGIN_NAME]/bin/README.md` documenting the binaries:

```markdown
# [Plugin Name] Plugin Binaries

This directory contains utility binaries used by the [plugin] plugin commands.

## Binaries

### `[binary-name]`
[Description of what it does]

**Usage:**
\`\`\`bash
[binary-name] [args]
\`\`\`

**Returns:** [What it returns]

**Features:**
- [Feature 1]
- [Feature 2]

## Tests

Run tests:
\`\`\`bash
cd bin/tests
./[binary-name].sh
\`\`\`

## Integration

These binaries are available through `${CLAUDE_PLUGIN_ROOT}/bin/` in plugin commands.

## Source

Originally from `.devcontainer/utilities/` - migrated for plugin self-containment.
```

## Phase 7: Verification

### Step 1: Run Original Tests

Verify the original tests still pass:

```bash
cd .devcontainer/utilities/tests
./[binary-name].sh
```

### Step 2: Run Plugin Tests

Verify the plugin-local tests pass:

```bash
cd plugins/[PLUGIN_NAME]/bin/tests
./[binary-name].sh
```

### Step 3: Test Command Functionality

Run the bin-test command to verify end-to-end integration:

```bash
# User runs: /[plugin]:bin-test
```

### Step 4: Verify Target File Works

If the target file has embedded bash that uses the binaries, verify it executes correctly.

## Common Issues and Solutions

### Issue: Test fails with "No such file or directory"

**Cause:** Path computation happens after `cd` command

**Solution:** Move `SCRIPT_DIR` computation to before any `cd` commands in test file

### Issue: Binary not found when running command

**Cause:** `${CLAUDE_PLUGIN_ROOT}` not properly expanded

**Solution:** Verify embedded bash block syntax - should use direct variable expansion, not `!`echo` wrapper

### Issue: Tests run in wrong order or have race conditions

**Cause:** Multiple embedded bash blocks executing in parallel

**Solution:** Combine all tests into single embedded bash block (see @plugins/CLAUDE.md)

### Issue: Variables not persisting between test steps

**Cause:** Multiple embedded bash blocks with isolated contexts

**Solution:** Use single embedded bash block for sequential operations

## Checklist

Before considering the migration complete, verify:

- [ ] All referenced binaries copied to `plugins/[PLUGIN_NAME]/bin/`
- [ ] All test files copied to `plugins/[PLUGIN_NAME]/bin/tests/`
- [ ] Test files updated to use plugin-relative paths (computed before `cd`)
- [ ] Target file updated to use `${CLAUDE_PLUGIN_ROOT}/bin/` paths
- [ ] bin-test.md command created with single embedded bash block
- [ ] bin/README.md created documenting binaries
- [ ] Original tests still pass
- [ ] Plugin-local tests pass
- [ ] bin-test command passes
- [ ] Target file functionality verified

## Example: Complete Migration

**Input:** "Move binaries from plugins/project/commands/create.md"

**Process:**
1. ✓ Found: `initialize-project`, `create-plan-version`
2. ✓ Located in `.devcontainer/utilities/`
3. ✓ Found tests in `.devcontainer/utilities/tests/`
4. ✓ Copied to `plugins/project/bin/` and `plugins/project/bin/tests/`
5. ✓ Updated test files with plugin-relative paths
6. ✓ Updated create.md to use `${CLAUDE_PLUGIN_ROOT}/bin/`
7. ✓ Created `plugins/project/commands/bin-test.md`
8. ✓ Created `plugins/project/bin/README.md`
9. ✓ All tests passing

**Result:** Plugin is now self-contained with local binaries!
