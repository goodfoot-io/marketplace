---
description: Register files to be re-injected into context after every compaction
argument-hint: <file-path> [file-path...]
disable-model-invocation: "true"
---

```!
source "${CLAUDE_PLUGIN_ROOT}/bin/find-claude-pid"
CLAUDE_PID=$(find_claude_pid)
PATHS_FILE="/tmp/claude_remind_${CLAUDE_PID}.paths"

# Ensure the paths file exists
touch "$PATHS_FILE"

ARGS="$ARGUMENTS"
if [ -z "$ARGS" ]; then
  echo "ERROR: No file paths provided."
  echo "Usage: /remind <file-path> [file-path...]"
  exit 1
fi

ADDED=()
SKIPPED=()
ERRORS=()

for arg in $ARGS; do
  # Resolve to absolute path
  if [[ "$arg" = /* ]]; then
    abs_path="$arg"
  else
    abs_path="$(pwd)/$arg"
  fi

  # Normalize (resolve .., symlinks, etc.)
  abs_path="$(realpath "$abs_path" 2>/dev/null || echo "$abs_path")"

  if [ ! -f "$abs_path" ]; then
    ERRORS+=("$abs_path")
    continue
  fi

  # Deduplicate: skip if already registered
  if grep -qxF "$abs_path" "$PATHS_FILE" 2>/dev/null; then
    SKIPPED+=("$abs_path")
    continue
  fi

  echo "$abs_path" >> "$PATHS_FILE"
  ADDED+=("$abs_path")
done

# Report results
if [ ${#ADDED[@]} -gt 0 ]; then
  echo "Registered ${#ADDED[@]} file(s) for post-compaction reminder:"
  for f in "${ADDED[@]}"; do
    echo "  + $f"
  done
fi

if [ ${#SKIPPED[@]} -gt 0 ]; then
  echo "Already registered (skipped ${#SKIPPED[@]}):"
  for f in "${SKIPPED[@]}"; do
    echo "  ~ $f"
  done
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "ERROR: ${#ERRORS[@]} file(s) not found:"
  for f in "${ERRORS[@]}"; do
    echo "  ! $f"
  done
fi

echo ""
echo "Total files tracked: $(wc -l < "$PATHS_FILE" | tr -d ' ')"
```

## Remind Files Registered

The files listed above will be re-injected into your context after every future compaction. This is **not** one-shot: the files persist across multiple compactions.

- Run `/remind` again with additional paths to add more files.
- Files are resolved to absolute paths and deduplicated.
