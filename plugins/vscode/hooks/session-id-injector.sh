#!/bin/bash

# Session ID Output Hook
#
# SessionStart hook that outputs the session ID as context.

# Read JSON input from stdin
input=$(cat)

# Extract session_id using jq
session_id=$(echo "$input" | jq -r '.session_id // empty')

# Output the session ID as additional context
jq -n --arg sid "$session_id" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ("SESSION_ID=" + $sid)
  }
}'

exit 0
