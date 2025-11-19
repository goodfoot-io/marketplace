# Project Plugin Binaries

This directory contains utility binaries used by the project plugin commands.

## Binaries

### Project Management Utilities

#### `initialize-project`
Creates and initializes a new project directory with standard structure.

**Usage:**
```bash
"${CLAUDE_PLUGIN_ROOT}"/bin/initialize-project "project-name"
```

**Returns:** Path to created project or empty if failed

**Features:**
- Creates project in `projects/new/` directory
- Initializes `log.md` file with header
- Creates `scratchpad/` directory for testing
- Idempotent: returns existing project path if already exists
- Validates project name (kebab-case, max 50 chars)

#### `create-plan-version`
Creates versioned plan files with automatic version numbering.

**Usage:**
```bash
"${CLAUDE_PLUGIN_ROOT}"/bin/create-plan-version "project-name" "plan-content"
```

**Returns:** Path to created plan file

**Features:**
- Auto-increments version numbers (plan-v1.md, plan-v2.md, etc.)
- Searches across all project status directories
- Handles special characters safely
- Preserves shell metacharacters in content

### IPC and Workflow Utilities

#### `write-arguments`
Writes user arguments to IPC state for cross-process communication.

**Usage:**
```bash
"${CLAUDE_PLUGIN_ROOT}"/bin/write-arguments "$ARGUMENTS"
```

#### `wait-for-arguments`
Reads user arguments from IPC state with timeout support.

**Usage:**
```bash
ARGS=$("${CLAUDE_PLUGIN_ROOT}"/bin/wait-for-arguments)
```

#### `get-next-project`
Selects the next project to work on based on arguments and dependency status.

**Usage:**
```bash
SELECTED_PROJECT=$("${CLAUDE_PLUGIN_ROOT}"/bin/get-next-project)
```

#### `wait-for-project-name`
Waits for project path to be available in IPC state.

**Usage:**
```bash
PROJECT_PATH=$("${CLAUDE_PLUGIN_ROOT}"/bin/wait-for-project-name 2)
```

#### `activate-project`
Moves a project from pending/ready-for-review to active status.

**Usage:**
```bash
ACTIVE_PROJECT=$("${CLAUDE_PLUGIN_ROOT}"/bin/activate-project "$PROJECT_PATH")
```

#### `update-project-path`
Updates the project path in IPC state after activation.

**Usage:**
```bash
"${CLAUDE_PLUGIN_ROOT}"/bin/update-project-path "$PROJECT_PATH"
```

#### `activate-project-with-args`
Activates a project based on user arguments with fuzzy matching.

**Usage:**
```bash
"${CLAUDE_PLUGIN_ROOT}"/bin/activate-project-with-args "user input"
```

#### `complete-iteration`
Completes an iteration by moving project to next status and updating git.

**Usage:**
```bash
"${CLAUDE_PLUGIN_ROOT}"/bin/complete-iteration "project-name"
```

### Support Utilities

#### `find-claude-pid`
Helper utility that finds the Claude process ID for IPC communication.

**Usage:**
```bash
source "${CLAUDE_PLUGIN_ROOT}"/bin/find-claude-pid
CLAUDE_PID=$(find_claude_pid)
```

## Tests

Run all tests:
```bash
cd "${CLAUDE_PLUGIN_ROOT}"/bin/tests
./write-arguments.sh
./wait-for-arguments.sh
./get-next-project.sh
./wait-for-project-name.sh
./activate-project.sh
./activate-project-with-args.sh
./activate-project-with-args-integration.sh
./initialize-project.sh
./create-plan-version.sh
```

Or use the plugin command:
```bash
/project:bin-test
```

## Integration

These binaries are available through `${CLAUDE_PLUGIN_ROOT}/bin/` in plugin commands and use plugin-relative paths for all dependencies.

## Source

Originally from `.devcontainer/utilities/` - migrated for plugin self-containment.
