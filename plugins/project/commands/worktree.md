---
description: Create a worktree for a project
allowed-tools: Bash(mkdir:*), Bash(echo:*), Bash(write-arguments:*), Bash(wait-for-arguments), Bash(get-next-project), Bash(wait-for-project-name:*), Bash(worktree-create:*), Bash(mv:*), Bash(complete-iteration:*), Bash(git:*), Bash(basename:*), Bash(ls:*), Bash(date:*), Bash(pwd), Bash(if:*), Bash(for:*), Bash([[:*), Task, Read(projects/**), Read(.claude/**), TodoWrite, LS, Grep, Glob
---

<user-message>
```!
write-arguments "$ARGUMENTS"
```
</user-message>

```!
# Check if in worktree first
if git rev-parse --is-inside-work-tree &>/dev/null; then
    TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null)
    if echo "$TOPLEVEL" | grep -q "/.worktrees/"; then
        echo "Inform the user they are in a worktree."
        exit 0
    fi
fi

# Wait for arguments to be available
ARGS=$(wait-for-arguments)

# Select project based on arguments or find the oldest eligible one
SELECTED_PROJECT=$(get-next-project)

# Wait for project selection to complete
PROJECT_PATH=$(wait-for-project-name 2)

# Define BACKTICK for use in markdown code blocks
BACKTICK='`'

if [ -z "$PROJECT_PATH" ]; then
    # No project found - show available projects and prompt for selection
    echo "## 1. Create Worktree and Halt"
    echo ""
    echo "Available projects:"
    for dir in projects/pending projects/active projects/ready-for-review; do
        if [ -d "$dir" ] && [ "$(ls -A "$dir" 2>/dev/null)" ]; then
            for project in "$dir"/*; do
                if [ -d "$project" ]; then
                    echo "- $project"
                fi
            done
        fi
    done
    echo ""
    echo "Ask the user which project they'd like to work on, then run the following with a 600s timeout:"
    echo ""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}bash"
    echo "worktree-create \"[PROJECT-NAME]\""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}"
    echo ""
    echo "Do not attempt to create a worktree manually with git. Only use worktree-create"
else
    # Project found - extract project name and prompt for worktree creation
    PROJECT_NAME=$(basename "$PROJECT_PATH")
    echo "Run the following with a 600s timeout:"
    echo ""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}bash"
    echo "worktree-create \"$PROJECT_NAME\""
    echo "${BACKTICK}${BACKTICK}${BACKTICK}"
    echo ""
    echo "Do not attempt to create a worktree manually with git. Only use worktree-create"
fi
```