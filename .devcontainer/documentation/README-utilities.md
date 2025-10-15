# Project Management Utilities

This directory contains utilities that support the Claude Code project management workflow, particularly for slash commands. These utilities handle argument synchronization, project selection, and project activation in a multi-process environment.

## Overview

When slash commands execute in Claude Code, multiple bash processes may run in parallel. These utilities provide a robust way to:
1. Share arguments between parallel processes
2. Select the appropriate project based on user input
3. Activate projects by moving them to the correct directory

All utilities are available on the system PATH and can be called directly.

## Utilities

### 1. write-arguments

**Purpose**: Writes slash command arguments to a shared file with timestamp-based synchronization.

**Usage**: 
```bash
echo $(write-arguments "$ARGUMENTS")
```

**How it works**:
- Writes arguments to `/tmp/slash_cmd_args.sh` as an exportable environment variable
- Creates a timestamp-based sync file `/tmp/slash_cmd_sync_{timestamp}` to signal completion
- Cleans up sync files older than 10 seconds
- Returns the arguments for display

**Example**:
```bash
# In a slash command's first bash block
echo $(write-arguments "$ARGUMENTS")
# Output: Hello World
# Creates: /tmp/slash_cmd_args.sh with content: export ARGS="Hello World"
# Creates: /tmp/slash_cmd_sync_1234567890
```

### 2. wait-for-arguments

**Purpose**: Waits for arguments to be written by `write-arguments` and retrieves them.

**Usage**:
```bash
ARGS=$(wait-for-arguments [timeout_seconds])
```

**How it works**:
- Generates the same timestamp as `write-arguments` (when called within the same second)
- Waits for the corresponding sync file to appear
- Sources `/tmp/slash_cmd_args.sh` to get the arguments
- Returns the arguments or times out with an error
- Default timeout is 5 seconds

**Example**:
```bash
# In a slash command's second bash block
ARGS=$(wait-for-arguments)
echo "Received: $ARGS"
# Output: Received: Hello World
```

**Limitations**:
- Only works reliably when all processes start within the same second
- Multiple independent processes will all receive the same arguments

### 3. get-next-project

**Purpose**: Selects the next project to work on based on arguments or project state.

**Usage**:
```bash
SELECTED_PROJECT=$(get-next-project)
```

**How it works**:
- If arguments contain a project name, searches for it in pending/active/ready-for-review
- If no project specified, selects the oldest pending project with resolved dependencies
- Exports `SELECTED_PROJECT` to `/tmp/slash_cmd_args.sh` for other processes
- Returns the project path (e.g., `projects/pending/my-project`) or empty if none found

**Selection priority**:
1. User-specified project (first match in: pending → active → ready-for-review)
2. Oldest pending project with all dependencies resolved
3. Empty result if no eligible projects

**Dependency resolution**:
A project's dependencies are considered resolved if they exist in:
- `projects/ready-for-review/` (production-ready)
- `projects/complete/` (user-approved)
- Or have been deleted

**Example**:
```bash
# With project in arguments
ARGS="work on authentication-feature"
SELECTED_PROJECT=$(get-next-project)
echo "$SELECTED_PROJECT"
# Output: projects/pending/authentication-feature

# Without project specified
ARGS=""
SELECTED_PROJECT=$(get-next-project)
echo "$SELECTED_PROJECT"  
# Output: projects/pending/oldest-ready-project
```

### 4. activate-project

**Purpose**: Activates a project by moving it to the active directory and preparing it for work.

**Usage**:
```bash
ACTIVE_PROJECT=$(activate-project "projects/pending/my-project")
```

**How it works**:
- Accepts paths in format: `projects/{pending|active|ready-for-review}/project-name`
- For new projects (from pending):
  - Moves to `projects/active/`
  - Finds highest versioned plan file (e.g., plan-v3.md) and renames to plan.md
  - Removes other plan versions
  - Initializes log.md with activation timestamp
- For continuing projects (already in active):
  - Returns the path without changes
  - Preserves existing plan.md and log.md
- For projects from ready-for-review:
  - Moves back to active (indicates user feedback)
- Returns the active project path or exits with error

**Example**:
```bash
# Activate new project
ACTIVE_PROJECT=$(activate-project "projects/pending/new-feature")
echo "$ACTIVE_PROJECT"
# Output: projects/active/new-feature
# Actions: Moved project, renamed plan-v2.md to plan.md, created log.md

# Continue active project  
ACTIVE_PROJECT=$(activate-project "projects/active/existing-feature")
echo "$ACTIVE_PROJECT"
# Output: projects/active/existing-feature
# Actions: None (project already active)
```

## Typical Workflow in Slash Commands

Here's how these utilities work together in a slash command:

```markdown
## Process Arguments

```!
# First bash block - write arguments for other processes
echo $(write-arguments "$ARGUMENTS")
```

## Select and Activate Project

```!
# Second bash block - wait for arguments and process
ARGS=$(wait-for-arguments)

# Select project based on arguments
SELECTED_PROJECT=$(get-next-project)

if [ -n "$SELECTED_PROJECT" ]; then
    # Activate the selected project
    ACTIVE_PROJECT=$(activate-project "$SELECTED_PROJECT")
    echo "Working on: $ACTIVE_PROJECT"
else
    echo "No eligible projects found"
fi
```
```

## Error Handling

All utilities follow consistent error handling:
- Exit code 0: Success
- Exit code 1: General error (timeout, invalid input, etc.)
- Exit code 2: Specific error (e.g., missing args file)
- Error messages are written to stderr
- Results are written to stdout

## File Locations

- Arguments file: `/tmp/slash_cmd_args.sh`
- Sync files: `/tmp/slash_cmd_sync_{timestamp}`
- Project directories: `{workspace}/projects/{new|pending|active|ready-for-review|complete|icebox}/`

## Testing

Each utility has a comprehensive test suite:
- `write-arguments`: 15 tests covering basic functionality, special characters, and cleanup
- `wait-for-arguments`: 10 tests covering timeouts, concurrent access, and error conditions
- `get-next-project`: 46 tests covering project selection, dependencies, and edge cases
- `activate-project`: 15 tests covering activation, versioning, and error handling

Run tests with:
```bash
.devcontainer/utilities/tests/write-arguments.sh
.devcontainer/utilities/tests/wait-for-arguments.sh
.devcontainer/utilities/tests/get-next-project.sh
.devcontainer/utilities/tests/activate-project.sh
```

## Notes

- These utilities assume a specific project structure with directories at `{workspace}/projects/`
- The timestamp-based synchronization in write/wait-arguments only works when processes start within the same second
- Project names should not contain spaces (though the utilities handle many special characters)
- The utilities are designed to be composable and can be used independently