#!/bin/bash
set -euo pipefail

#===============================================================================
# CONFIGURATION - Edit these variables as needed
#===============================================================================

# Input CSV file with repo,internal_path format (absolute path)
INPUT_CSV="/workspace/reports/hook-repositories.typescript.csv"

# Directory for stdout/stderr logs (absolute path)
LOGS_DIR="/workspace/reports/hook-migration-stdout-stderr"

# Maximum concurrent claude processes
MAX_PARALLEL=10

# Claude command (adjust flags as needed)
CLAUDE_CMD="claude --output-format stream-json --verbose"

#===============================================================================
# PROMPT TEMPLATE - Edit this to change migration instructions
#===============================================================================
# Variables available: $REPO_NAME, $HOOK_PATHS
# $HOOK_PATHS is comma-separated list of internal paths

read -r -d '' PROMPT_TEMPLATE << 'PROMPT_EOF' || true
Load the "hook-migrator" skill.
Load the "claude-code-hooks:sdk" skill.

Migrate the following repository to use @goodfoot/claude-code-hooks TypeScript SDK:

Repository: $REPO_NAME
Hook paths to migrate:
$HOOK_PATHS_FORMATTED

## Quality-First Migration Workflow

### Phase 1: Planning

1. **Fork and clone** the repository to /home/node/hook-repos/
2. **Analyze all hook paths** listed above:
   - Read each hooks.json file
   - Assess candidacy per .claude/skills/hook-migrator/references/candidate-analysis.md
   - Log concerning/poor candidates to reports/hook-repositories-status.csv and exclude them
3. **Create a detailed migration plan** covering:
   - Which hook paths WILL be migrated (ALL good candidates - migration is mandatory)
   - For each path: hook types found, conversion approach, potential challenges
   - Testing strategy for validating conversions
   - Rollback approach if issues arise

### Phase 2: Plan Review

4. **Spawn a Plan subagent** to evaluate your migration plan:
   ```
   Use Task tool with subagent_type="Plan" to review the migration plan.
   Ask it to identify: missing steps, potential risks, edge cases, and improvements.
   ```
5. **Iterate on the plan** based on Plan subagent feedback until it approves the approach.

### Phase 3: Implementation (MANDATORY)

6. **For EVERY approved hook path**, spawn a general-purpose Opus subagent to perform the migration:
   ```
   Use Task tool with subagent_type="general-purpose" and model="opus" to:
   - Install @goodfoot/claude-code-hooks if needed
   - Convert the hooks at [specific path] to TypeScript
   - Follow patterns in .claude/skills/hook-migrator/references/conversion-patterns.md
   - Run build:hooks and fix any build errors
   - Create tests in test/hooks/ using vitest
   - Run tests and ensure they pass
   ```

### Phase 4: Validation

7. **After each subagent returns**, validate its work:
   - Check that hooks.json was generated correctly
   - Verify TypeScript sources exist in hooks/src/
   - Confirm tests exist and pass
   - Review for any regressions or issues

8. **If validation fails**, spawn another subagent to fix issues:
   ```
   Use Task tool with subagent_type="general-purpose" to resolve:
   [Specific issue description and context]
   ```
   Continue until all issues are resolved.

### Phase 5: Completion

9. **Final verification** across ALL migrated paths:
   - All builds pass
   - All tests pass
   - No TypeScript errors
   - Hooks function correctly
   - EVERY good candidate path has been converted to @goodfoot/claude-code-hooks

10. **Commit and push** changes with descriptive commit message.

11. **Report summary**:
    - Paths successfully migrated (should be ALL good candidates)
    - Paths skipped (ONLY concerning/poor_candidate with reasons logged to CSV)
    - Confirmation that all suitable hooks now use @goodfoot/claude-code-hooks

## Critical Requirements

- **MANDATORY MIGRATION**: You MUST migrate all suitable hook paths to @goodfoot/claude-code-hooks. This is not optional. If a path is a good candidate, it MUST be converted to TypeScript using the SDK.
- **Quality over speed**: Take time to get it right. Run all tests. Fix all errors.
- **Use subagents**: Delegate implementation to general-purpose Opus subagents.
- **Iterate until complete**: Keep spawning subagents to fix issues until everything passes.
- **Follow the skill docs**: Adhere to .claude/skills/hook-migrator/SKILL.md exactly.
- **Do not skip suitable candidates**: The only acceptable reasons to skip a path are if it's logged as "concerning" or "poor_candidate" in the status CSV. All other paths MUST be migrated.
PROMPT_EOF

#===============================================================================
# SCRIPT LOGIC - Modify below with caution
#===============================================================================

DRY_RUN=false
VERBOSE=false
MAX_REPOS=0  # 0 means unlimited

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Migrate hook repositories to @goodfoot/claude-code-hooks SDK using parallel claude processes.

Options:
    -d, --dry-run    Print commands without executing (demonstrates parallel execution)
    -v, --verbose    Show detailed progress information
    -j, --jobs N     Set max parallel jobs (default: $MAX_PARALLEL)
    -m, --max N      Process at most N repositories then stop (default: unlimited)
    -h, --help       Show this help message

Examples:
    $(basename "$0")                    # Run migrations with 10 parallel processes
    $(basename "$0") --dry-run          # Show what would be executed
    $(basename "$0") -j 5               # Run with 5 parallel processes
    $(basename "$0") --max 1            # Process only 1 repository (for testing)
    $(basename "$0") --max 5 -j 5       # Process 5 repos with 5 parallel jobs
EOF
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -j|--jobs)
            MAX_PARALLEL="$2"
            shift 2
            ;;
        -m|--max)
            MAX_REPOS="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate input file exists
if [[ ! -f "$INPUT_CSV" ]]; then
    echo "Error: Input CSV not found: $INPUT_CSV"
    exit 1
fi

# Create output directory
mkdir -p "$LOGS_DIR"

# Convert repo name to filename: "owner/repo" -> "owner__repo"
escape_filename() {
    local input="$1"
    local owner="${input%%/*}"
    local repo="${input#*/}"
    # Sanitize each part separately, then join with double underscore
    owner=$(echo "$owner" | tr -cd '[:alnum:]_-')
    repo=$(echo "$repo" | tr -cd '[:alnum:]_-')
    echo "${owner}__${repo}"
}

# Build prompt from template
build_prompt() {
    local repo_name="$1"
    local hook_paths="$2"

    # Format paths as bullet list
    local paths_formatted
    paths_formatted=$(echo "$hook_paths" | tr ',' '\n' | sed 's/^/  - /')

    # Substitute variables in template
    local prompt="$PROMPT_TEMPLATE"
    prompt="${prompt//\$REPO_NAME/$repo_name}"
    prompt="${prompt//\$HOOK_PATHS_FORMATTED/$paths_formatted}"
    prompt="${prompt//\$HOOK_PATHS/$hook_paths}"

    echo "$prompt"
}

# Track running jobs
declare -a RUNNING_PIDS=()
declare -A PID_TO_REPO=()
TOTAL_REPOS=0
COMPLETED_REPOS=0
STARTED_REPOS=0

# Clean up on exit
cleanup() {
    if [[ ${#RUNNING_PIDS[@]} -gt 0 ]]; then
        echo ""
        echo "Cleaning up ${#RUNNING_PIDS[@]} running processes..."
        for pid in "${RUNNING_PIDS[@]}"; do
            kill "$pid" 2>/dev/null || true
        done
    fi
}
trap cleanup EXIT

# Remove PID from tracking array
remove_pid() {
    local pid_to_remove="$1"
    local new_pids=()
    for pid in "${RUNNING_PIDS[@]}"; do
        if [[ "$pid" != "$pid_to_remove" ]]; then
            new_pids+=("$pid")
        fi
    done
    RUNNING_PIDS=("${new_pids[@]+"${new_pids[@]}"}")
}

# Wait for a slot to become available
wait_for_slot() {
    while [[ ${#RUNNING_PIDS[@]} -ge $MAX_PARALLEL ]]; do
        # Wait for any child to finish
        if wait -n 2>/dev/null; then
            : # Process succeeded
        else
            : # Process failed (but we continue)
        fi

        # Find which process finished
        for pid in "${RUNNING_PIDS[@]}"; do
            if ! kill -0 "$pid" 2>/dev/null; then
                local repo="${PID_TO_REPO[$pid]:-unknown}"
                ((COMPLETED_REPOS++)) || true
                echo "[${COMPLETED_REPOS}/${TOTAL_REPOS}] Completed: $repo"
                remove_pid "$pid"
                unset "PID_TO_REPO[$pid]"
                break
            fi
        done
    done
}

# Check if repo was already processed (directory exists)
repo_already_processed() {
    local repo_name="$1"
    local repo_dir="/home/node/hook-repos/${repo_name#*/}"
    [[ -d "$repo_dir" ]]
}

# Start a migration job
start_job() {
    local repo_name="$1"
    local hook_paths="$2"
    local escaped_name
    escaped_name=$(escape_filename "$repo_name")
    local stdout_file="${LOGS_DIR}/${escaped_name}.stdout.log"
    local stderr_file="${LOGS_DIR}/${escaped_name}.stderr.log"
    local prompt
    prompt=$(build_prompt "$repo_name" "$hook_paths")

    ((STARTED_REPOS++)) || true

    if [[ "$DRY_RUN" == true ]]; then
        echo ""
        echo "=========================================="
        echo "[DRY RUN] Job $STARTED_REPOS: $repo_name"
        echo "=========================================="
        echo "Stdout log:  $stdout_file"
        echo "Stderr log:  $stderr_file"
        echo "Hook paths:"
        echo "$hook_paths" | tr ',' '\n' | sed 's/^/  - /'
        echo ""
        echo "Prompt preview (first 500 chars):"
        echo "${prompt:0:500}..."
        echo ""

        # Simulate parallel execution timing
        if [[ $STARTED_REPOS -le $MAX_PARALLEL ]]; then
            echo "[Slot $STARTED_REPOS/$MAX_PARALLEL] Would start immediately"
        else
            local wait_batch=$(( (STARTED_REPOS - 1) / MAX_PARALLEL ))
            echo "[Batch $wait_batch] Would wait for slot"
        fi
    else
        if [[ "$VERBOSE" == true ]]; then
            echo "[${STARTED_REPOS}/${TOTAL_REPOS}] Starting: $repo_name (${#RUNNING_PIDS[@]}/$MAX_PARALLEL slots used)"
        fi

        # Start claude in background from /workspace, redirect stdout and stderr to separate files
        (cd /workspace && $CLAUDE_CMD -p "$prompt") > "$stdout_file" 2> "$stderr_file" &
        local pid=$!
        RUNNING_PIDS+=("$pid")
        PID_TO_REPO[$pid]="$repo_name"
    fi
}

# Wait for all remaining jobs
wait_for_all() {
    while [[ ${#RUNNING_PIDS[@]} -gt 0 ]]; do
        wait -n 2>/dev/null || true

        for pid in "${RUNNING_PIDS[@]}"; do
            if ! kill -0 "$pid" 2>/dev/null; then
                local repo="${PID_TO_REPO[$pid]:-unknown}"
                ((COMPLETED_REPOS++)) || true
                echo "[${COMPLETED_REPOS}/${TOTAL_REPOS}] Completed: $repo"
                remove_pid "$pid"
                unset "PID_TO_REPO[$pid]"
            fi
        done
    done
}

#===============================================================================
# MAIN EXECUTION
#===============================================================================

echo "Hook Repository Migration Script"
echo "================================="
echo "Input:      $INPUT_CSV"
echo "Logs:       $LOGS_DIR/"
echo "Parallel:   $MAX_PARALLEL"
echo "Max repos:  $( [[ $MAX_REPOS -eq 0 ]] && echo "unlimited" || echo "$MAX_REPOS" )"
echo "Dry run:    $DRY_RUN"
echo ""

# Parse CSV and group paths by repository
declare -A REPO_PATHS=()

while IFS=',' read -r repo path || [[ -n "$repo" ]]; do
    # Skip empty lines
    [[ -z "$repo" ]] && continue

    # Trim whitespace
    repo=$(echo "$repo" | xargs)
    path=$(echo "$path" | xargs)

    # Append path to repo's list
    if [[ -n "${REPO_PATHS[$repo]:-}" ]]; then
        REPO_PATHS[$repo]="${REPO_PATHS[$repo]},$path"
    else
        REPO_PATHS[$repo]="$path"
    fi
done < "$INPUT_CSV"

TOTAL_REPOS=${#REPO_PATHS[@]}

# Apply max repos limit
REPOS_TO_PROCESS=$TOTAL_REPOS
if [[ $MAX_REPOS -gt 0 ]] && [[ $MAX_REPOS -lt $TOTAL_REPOS ]]; then
    REPOS_TO_PROCESS=$MAX_REPOS
fi

echo "Found $TOTAL_REPOS unique repositories"
if [[ $MAX_REPOS -gt 0 ]]; then
    echo "Processing limited to $REPOS_TO_PROCESS repositories (--max $MAX_REPOS)"
fi
echo ""

if [[ "$DRY_RUN" == true ]]; then
    echo "=== DRY RUN MODE ==="
    dry_run_show=$REPOS_TO_PROCESS
    if [[ $dry_run_show -gt 10 ]]; then
        dry_run_show=10
        echo "Showing first 10 of $REPOS_TO_PROCESS repositories..."
    else
        echo "Showing all $REPOS_TO_PROCESS repositories..."
    fi
    echo ""

    count=0
    skipped=0
    for repo in "${!REPO_PATHS[@]}"; do
        # Skip if already processed
        if repo_already_processed "$repo"; then
            ((skipped++)) || true
            continue
        fi

        ((count++)) || true
        start_job "$repo" "${REPO_PATHS[$repo]}"

        # Check max repos limit
        if [[ $MAX_REPOS -gt 0 ]] && [[ $count -ge $MAX_REPOS ]]; then
            break
        fi

        # In dry run, only show first 10 for brevity
        if [[ $count -ge 10 ]]; then
            remaining=$((REPOS_TO_PROCESS - 10 - skipped))
            if [[ $remaining -gt 0 ]]; then
                echo ""
                echo "... and $remaining more repositories"
            fi
            break
        fi
    done

    if [[ $skipped -gt 0 ]]; then
        echo ""
        echo "Skipped $skipped repositories (already exist in /home/node/hook-repos/)"
    fi

    echo ""
    echo "=== DRY RUN SUMMARY ==="
    echo "Total in CSV: $TOTAL_REPOS"
    echo "Would process: $REPOS_TO_PROCESS"
    echo "Max parallel: $MAX_PARALLEL"
    echo "Estimated batches: $(( (REPOS_TO_PROCESS + MAX_PARALLEL - 1) / MAX_PARALLEL ))"
else
    echo "Starting migration..."
    echo ""

    count=0
    skipped=0
    for repo in "${!REPO_PATHS[@]}"; do
        # Skip if already processed
        if repo_already_processed "$repo"; then
            ((skipped++)) || true
            if [[ "$VERBOSE" == true ]]; then
                echo "Skipping $repo (already exists in /home/node/hook-repos/)"
            fi
            continue
        fi

        # Check max repos limit
        if [[ $MAX_REPOS -gt 0 ]] && [[ $count -ge $MAX_REPOS ]]; then
            echo "Reached max repos limit ($MAX_REPOS)"
            break
        fi

        wait_for_slot
        start_job "$repo" "${REPO_PATHS[$repo]}"
        ((count++)) || true
    done

    echo ""
    echo "All jobs started. Waiting for completion..."
    wait_for_all

    echo ""
    echo "=== MIGRATION COMPLETE ==="
    echo "Processed: $COMPLETED_REPOS repositories"
    if [[ $skipped -gt 0 ]]; then
        echo "Skipped:   $skipped repositories (already in /home/node/hook-repos/)"
    fi
    echo "Stdout/stderr logs: $LOGS_DIR/"
fi
