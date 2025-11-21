---
name: rebasing-git-history
description: Perform programmatic git rebases non-interactively using bash scripts, environment variables, and automated conflict resolution. Consolidate commits, drop checkpoints, squash by pattern, and clean up branch history. Use when the user needs to rebase git commits, consolidate git history, drop checkpoint commits, squash commits by pattern, or perform interactive rebases programmatically without manual editing.
---

# Rebasing Git History

Perform interactive git rebases programmatically using Claude Code's bash capabilities. Execute complex commit consolidation, pattern-based squashing, and automated conflict resolution—all without interactive editors.

## Overview

This skill enables fully automated git rebases by leveraging:
- **GIT_SEQUENCE_EDITOR** environment variable for programmatic todo list editing
- **Direct file manipulation** of `.git/rebase-merge/git-rebase-todo`
- **sed/awk/perl** for sophisticated commit pattern matching
- **Automated conflict resolution** strategies

<context>
Claude Code cannot use interactive editors (vim, nano, emacs with -i flag) or handle interactive prompts. All rebase operations must use programmatic workarounds: environment variables, file manipulation, and bash text processing tools.
</context>

## Quick Start

<example>
**Most Common Use Case: Drop Checkpoint Commits**

```bash
# 1. Create backup
git checkout -b my-branch-copy
git branch backup/pre-rebase-$(date +%Y%m%d-%H%M%S)

# 2. Create simple drop script
cat > /tmp/rebase.sh << 'EOF'
#!/bin/bash
sed -i '/checkpoint:/d' "$1"
EOF
chmod +x /tmp/rebase.sh

# 3. Execute rebase
GIT_SEQUENCE_EDITOR=/tmp/rebase.sh \
GIT_MERGE_AUTOEDIT=no \
git rebase -i main

# 4. Verify results
git log --oneline -10
```
</example>

<instructions>
**Essential workflow**:
1. **Always test on copy branch first** (`git checkout -b my-branch-copy`)
2. **Create timestamped backup** (`git branch backup/pre-rebase-$(date +%s)`)
3. **Build rebase script** using sed/awk/perl patterns
4. **Execute with environment variables** to avoid interactive prompts
5. **Verify with automated checks** (tests, linting, type checking)
6. **Apply to real branch only after success**
</instructions>

## Core Rebase Patterns

### Pattern 1: Drop All Checkpoints

Use when you have checkpoint commits (checkpoint:, iteration:, etc.) to remove.

```bash
cat > /tmp/rebase-drop-checkpoints.sh << 'EOF'
#!/bin/bash
sed -i '/checkpoint:/d' "$1"
EOF

chmod +x /tmp/rebase-drop-checkpoints.sh
GIT_SEQUENCE_EDITOR=/tmp/rebase-drop-checkpoints.sh git rebase -i main
```

### Pattern 2: Squash All Into One Commit

Use when consolidating entire branch into single commit.

```bash
cat > /tmp/rebase-squash-all.sh << 'EOF'
#!/bin/bash
# Keep first commit as pick, change rest to fixup (discards messages)
sed -i '1!s/^pick /fixup /' "$1"
EOF

chmod +x /tmp/rebase-squash-all.sh
GIT_SEQUENCE_EDITOR=/tmp/rebase-squash-all.sh git rebase -i main
```

### Pattern 3: Keep Milestones, Squash Others

Use when you want to preserve important commits (feat:, fix:, production-ready:) but consolidate everything else.

```bash
cat > /tmp/rebase-keep-milestones.sh << 'EOF'
#!/bin/bash
TODO="$1"

awk '
# Drop checkpoints entirely
/checkpoint:/ { next }

# Keep milestone commits as pick
/^pick [a-f0-9]+ (feat|fix|production-ready):/ {
    print $0
    next
}

# First non-milestone: keep as pick
NR == 1 || !found_first {
    print $0
    found_first = 1
    next
}

# Everything else: squash
{
    sub(/^pick/, "squash")
    print $0
}
' "$TODO" > "$TODO.tmp" && mv "$TODO.tmp" "$TODO"
EOF

chmod +x /tmp/rebase-keep-milestones.sh
GIT_SEQUENCE_EDITOR=/tmp/rebase-keep-milestones.sh git rebase -i main
```

### Pattern 4: Custom Pattern Matching

Use when you need sophisticated pattern matching based on commit message structure.

```bash
cat > /tmp/rebase-custom.sh << 'EOF'
#!/bin/bash
TODO="$1"

# Example: Drop checkpoints, keep setup commits, squash completed commits
awk '
BEGIN { setup_found = 0; migration_found = 0 }

# Drop all checkpoint commits
/checkpoint:/ { next }

# Setup commits: keep first, squash rest
/^pick [a-f0-9]+ (chore|docs):.*setup/ {
    if (setup_found == 0) {
        print $0
        setup_found = 1
    } else {
        sub(/^pick/, "squash")
        print $0
    }
    next
}

# Migration commits: keep first, squash rest
/^pick [a-f0-9]+ completed:/ {
    if (migration_found == 0) {
        print $0
        migration_found = 1
    } else {
        sub(/^pick/, "squash")
        print $0
    }
    next
}

# Everything else: keep as-is
{ print $0 }
' "$TODO" > "$TODO.tmp" && mv "$TODO.tmp" "$TODO"
EOF

chmod +x /tmp/rebase-custom.sh
GIT_SEQUENCE_EDITOR=/tmp/rebase-custom.sh git rebase -i main
```

## Essential Environment Variables

<instructions>
**Recommended approach**: Use inline variables (single-command scope) to avoid side effects.

```bash
# ✅ Best practice: Inline (only affects this command)
GIT_SEQUENCE_EDITOR=/tmp/rebase.sh \
GIT_MERGE_AUTOEDIT=no \
git rebase -i main
```

**Critical variables**:
- `GIT_SEQUENCE_EDITOR`: Path to script that edits rebase todo list
- `GIT_MERGE_AUTOEDIT=no`: Disables merge commit message prompts
- `GIT_EDITOR="cat /tmp/msg.txt >"`: Provides commit messages non-interactively

**For continuing rebases without prompts**:
```bash
git -c core.editor=true rebase --continue
```
</instructions>

## Pre-Rebase Workflow

<workflow>
**Automated pre-rebase checks**:

```bash
# Create comprehensive check script
cat > /tmp/prerebase-check.sh << 'EOF'
#!/bin/bash

echo "=== Pre-Rebase Checklist ==="

# Check for uncommitted changes
echo -n "Uncommitted changes: "
if git diff --quiet && git diff --staged --quiet; then
    echo "NONE (safe to proceed)"
else
    echo "FOUND (needs handling)"
    git status --short
    exit 1
fi

# Check for merge commits
echo -n "Merge commits: "
MERGE_COUNT=$(git log --oneline --merges HEAD ^main 2>/dev/null | wc -l)
if [ "$MERGE_COUNT" -eq 0 ]; then
    echo "NONE (safe for standard rebase)"
else
    echo "FOUND ($MERGE_COUNT commits - consider linearization)"
fi

# Show commit count
COMMIT_COUNT=$(git rev-list --count main..HEAD)
echo "Commits to consolidate: $COMMIT_COUNT"

# Show commit summary
echo -e "\n=== Commit Summary ==="
git log --oneline main..HEAD

echo -e "\n=== Ready to proceed ==="
EOF

bash /tmp/prerebase-check.sh
```

**Create safety backup**:
```bash
BACKUP_BRANCH="backup/pre-rebase-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH"
echo "Created backup: $BACKUP_BRANCH"
```
</workflow>

## Conflict Resolution Strategies

<context>
Most simple rebases with linear history won't have conflicts. Use these strategies only when conflicts occur.
</context>

### Strategy 1: Accept Ours (Current Version)

```bash
# Accept current version for all conflicts
for file in $(git diff --name-only --diff-filter=U); do
    git checkout --ours "$file"
    git add "$file"
done

git rebase --continue
```

### Strategy 2: Accept Theirs (Incoming Version)

```bash
# Accept incoming version for all conflicts
for file in $(git diff --name-only --diff-filter=U); do
    git checkout --theirs "$file"
    git add "$file"
done

git rebase --continue
```

### Strategy 3: Automated Conflict Handler

```bash
cat > /tmp/handle-conflicts.sh << 'EOF'
#!/bin/bash

# Strategy selection based on file types
for file in $(git diff --name-only --diff-filter=U); do
    case "$file" in
        *.json|*.lock)
            echo "Config file: accepting theirs for $file"
            git checkout --theirs "$file"
            git add "$file"
            ;;
        *.md)
            echo "Documentation: keeping both for $file"
            sed -i '/^<<<<<<< HEAD$/d; /^=======$/d; /^>>>>>>> /d' "$file"
            git add "$file"
            ;;
        *.ts|*.js)
            echo "Code file: accepting ours for $file"
            git checkout --ours "$file"
            git add "$file"
            ;;
        *)
            echo "Unknown type: using ours for $file"
            git checkout --ours "$file"
            git add "$file"
            ;;
    esac
done

# Continue rebase non-interactively
git -c core.editor=true rebase --continue
EOF

chmod +x /tmp/handle-conflicts.sh
bash /tmp/handle-conflicts.sh
```

## Post-Rebase Verification

<instructions>
**Automated verification workflow**:

```bash
cat > /tmp/post-rebase-verify.sh << 'EOF'
#!/bin/bash

echo "=== Post-Rebase Verification ==="

# 1. Verify history
echo -e "\n[1/4] History verification..."
echo "Commit count: $(git rev-list --count main..HEAD)"
git log --oneline --graph -5

# 2. Check for conflict markers
echo -e "\n[2/4] Checking for conflict markers..."
CONFLICT_MARKERS=$(git grep -n "^<<<<<<< HEAD" 2>/dev/null || true)
if [ -n "$CONFLICT_MARKERS" ]; then
    echo "ERROR: Conflict markers found:"
    echo "$CONFLICT_MARKERS"
    exit 1
else
    echo "No conflict markers found"
fi

# 3. Run linting
echo -e "\n[3/4] Running linter..."
if [ -f package.json ]; then
    npm run lint || echo "Linting errors detected"
else
    echo "Skipping lint (no package.json)"
fi

# 4. Run tests
echo -e "\n[4/4] Running tests..."
if [ -f package.json ]; then
    npm test || echo "Tests failed"
else
    echo "Skipping tests (no package.json)"
fi

echo -e "\n=== Verification Complete ==="
EOF

chmod +x /tmp/post-rebase-verify.sh
bash /tmp/post-rebase-verify.sh
```
</instructions>

## Recovery Procedures

<instructions>
**Quick recovery commands**:

```bash
# Abort rebase in progress
if [ -d .git/rebase-merge ]; then
    git rebase --abort
    echo "Rebase aborted"
fi

# Reset to most recent backup
BACKUP=$(git branch --list 'backup/pre-rebase-*' --sort=-committerdate | head -1 | tr -d ' ')
if [ -n "$BACKUP" ]; then
    git reset --hard "$BACKUP"
    echo "Reset to: $BACKUP"
fi

# Or use reflog
BEFORE_REBASE=$(git reflog | grep "rebase -i" | head -1 | cut -d' ' -f1)
if [ -n "$BEFORE_REBASE" ]; then
    git reset --hard "$BEFORE_REBASE^"
    echo "Reset using reflog: $BEFORE_REBASE"
fi
```
</instructions>

## Complete Example: End-to-End Rebase

<example>
**Full automated rebase workflow**:

```bash
#!/bin/bash
set -e  # Exit on error

BRANCH_NAME="feature-branch"
BASE_BRANCH="main"
BACKUP_BRANCH="backup/pre-rebase-$(date +%Y%m%d-%H%M%S)"

echo "=== Automated Git Rebase: $BRANCH_NAME ==="

# Step 1: Pre-checks
echo -e "\n[1/6] Pre-rebase checks..."
if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH_NAME" ]; then
    echo "ERROR: Not on $BRANCH_NAME branch"
    exit 1
fi

if ! git diff --quiet || ! git diff --staged --quiet; then
    echo "ERROR: Uncommitted changes detected"
    exit 1
fi

COMMIT_COUNT=$(git rev-list --count $BASE_BRANCH..HEAD)
echo "Commits to consolidate: $COMMIT_COUNT"

# Step 2: Create backup
echo -e "\n[2/6] Creating backup..."
git branch "$BACKUP_BRANCH"
echo "Created: $BACKUP_BRANCH"

# Step 3: Create rebase script
echo -e "\n[3/6] Preparing rebase strategy..."
cat > /tmp/rebase-consolidate.sh << 'REBASE_SCRIPT'
#!/bin/bash
TODO="$1"

awk '
BEGIN { first_found = 0 }

# Drop all checkpoint commits
/checkpoint:/ { next }

# Keep first commit as pick
NR == 1 {
    print $0
    first_found = 1
    next
}

# Squash everything else
{
    sub(/^pick/, "squash")
    print $0
}
' "$TODO" > "$TODO.tmp" && mv "$TODO.tmp" "$TODO"
REBASE_SCRIPT

chmod +x /tmp/rebase-consolidate.sh

# Step 4: Execute rebase
echo -e "\n[4/6] Executing rebase..."
GIT_SEQUENCE_EDITOR=/tmp/rebase-consolidate.sh \
GIT_MERGE_AUTOEDIT=no \
git rebase -i "$BASE_BRANCH"

# Step 5: Handle conflicts if any
if [ -d .git/rebase-merge ]; then
    echo -e "\n[5/6] Handling conflicts..."
    while [ -d .git/rebase-merge ]; do
        CONFLICTS=$(git diff --name-only --diff-filter=U)
        if [ -z "$CONFLICTS" ]; then
            git -c core.editor=true rebase --continue || break
        else
            for file in $CONFLICTS; do
                git checkout --ours "$file"
                git add "$file"
            done
            git -c core.editor=true rebase --continue || break
        fi
    done
fi

# Step 6: Verify completion
echo -e "\n[6/6] Verification..."
if [ -d .git/rebase-merge ]; then
    echo "ERROR: Rebase did not complete"
    git rebase --abort
    git reset --hard "$BACKUP_BRANCH"
    exit 1
fi

echo -e "\n=== Rebase Complete ==="
git log --oneline --graph -10
echo -e "\nCommit count: $(git rev-list --count $BASE_BRANCH..HEAD)"
echo "Backup: $BACKUP_BRANCH"
echo "To undo: git reset --hard $BACKUP_BRANCH"
```
</example>

## Quick Reference Commands

```bash
# Drop all checkpoints, keep everything else
GIT_SEQUENCE_EDITOR="sed -i '/checkpoint:/d'" git rebase -i main

# Squash all but first commit (keep messages for editing)
GIT_SEQUENCE_EDITOR="sed -i '1!s/^pick/squash/'" git rebase -i main

# Fixup all but first commit (discard all messages except first)
GIT_SEQUENCE_EDITOR="sed -i '1!s/^pick/fixup/'" git rebase -i main

# Continue rebase without editor
git -c core.editor=true rebase --continue

# Accept ours for all conflicts and continue
git diff --name-only --diff-filter=U | xargs -I {} git checkout --ours {}
git add -A && git -c core.editor=true rebase --continue

# Accept theirs for all conflicts and continue
git diff --name-only --diff-filter=U | xargs -I {} git checkout --theirs {}
git add -A && git -c core.editor=true rebase --continue

# Abort and reset to backup
git rebase --abort
git reset --hard $(git branch --list 'backup/pre-rebase-*' --sort=-committerdate | head -1)
```

## Troubleshooting

<requirements>
**Common issues and solutions**:

| Issue | Solution |
|-------|----------|
| Editor opens despite GIT_SEQUENCE_EDITOR | Use `git -c core.editor=true rebase -i main` |
| Rebase hangs waiting for input | Add `GIT_MERGE_AUTOEDIT=no` to environment |
| Commit message editor opens | Use `GIT_EDITOR="echo 'message' >"` or `git -c core.editor=true rebase --continue` |
| Complex conflicts need resolution | Create file-type-specific handler script (see Strategy 3 above) |
</requirements>

## Summary

<context>
**Core principles for programmatic rebasing**:

1. **Never use interactive editors** - always use GIT_SEQUENCE_EDITOR
2. **Always create backup branches first** - use timestamped names
3. **Use sed/awk/perl for pattern matching** - powerful text manipulation
4. **Set environment variables inline** - avoid side effects
5. **Automate conflict resolution** - use checkout --ours/--theirs strategies
6. **Verify with automated scripts** - run tests, linting, type checking
7. **Test on copy branch first** - apply to real branch only after success

**Essential workflow**: Backup → Script → Execute → Resolve → Verify → Apply
</context>
