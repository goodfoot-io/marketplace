#!/bin/bash

# Session ID Output Hook
#
# SessionStart hook that outputs the session ID as context.

# Read JSON input from stdin
input=$(cat)

# Extract session_id and hook_event_name using jq
session_id=$(echo "$input" | jq -r '.session_id // empty')
hook_event_name=$(echo "$input" | jq -r '.hook_event_name // "SessionStart"')

# Output the session ID as additional context
jq -n --arg sid "$session_id" --arg event "$hook_event_name" '{
  hookSpecificOutput: {
    hookEventName: $event,
    additionalContext: ("SESSION_ID=" + $sid)
  }
}'

exit 0
