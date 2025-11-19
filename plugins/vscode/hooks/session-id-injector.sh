#!/bin/bash

# Session ID Injector Hook (Bash version)
#
# This UserPromptSubmit hook injects the session ID as context whenever
# the user includes $SESSION_ID in their prompt.
#
# Usage: When a user types "$SESSION_ID" in their message, this hook
# automatically adds "SESSION_ID=<actual_session_id>" as context.

# Read JSON input from stdin
input=$(cat)

# Extract session_id and prompt using jq
session_id=$(echo "$input" | jq -r '.session_id // empty')
prompt=$(echo "$input" | jq -r '.prompt // empty')

# Check if the prompt contains $SESSION_ID or starts with vscode commands that need it
if [[ "$prompt" == *'$SESSION_ID'* ]] || [[ "$prompt" == "/vscode:fork"* ]] || [[ "$prompt" == "/vscode:session-id"* ]]; then
  # Output JSON with additionalContext to inject the session ID
  jq -n --arg sid "$session_id" '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ("SESSION_ID=" + $sid)
    }
  }'
else
  # No injection needed - output empty JSON
  echo '{}'
fi

# Exit with code 0 to allow the prompt to proceed
exit 0
