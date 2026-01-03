# Implementing Claude Code Hooks: A Developer's Journey

This document describes the complete user experience for a software developer implementing Claude Code hooks. Each hook type is covered with the full implementation flow from understanding to execution.

## Overview: The Hooks Configuration Experience

A developer begins their hooks journey by understanding where hooks are configured. They learn that hooks live in settings files, with three possible locations:

- `~/.claude/settings.json` for user-wide settings that apply to all projects
- `.claude/settings.json` within a project for project-specific settings that can be committed to version control
- `.claude/settings.local.json` for local project settings that are not committed

The developer sees that hooks follow a consistent JSON structure. Each hook event contains an array of matchers, and each matcher contains an array of hooks to execute:

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolPattern",
        "hooks": [
          {
            "type": "command",
            "command": "your-command-here"
          }
        ]
      }
    ]
  }
}
```

The developer can also configure hooks interactively by running the `/hooks` slash command in Claude Code, which presents a menu-driven interface for adding and managing hooks.

---

## PreToolUse Hook Implementation

### What the Developer Needs to Understand

The developer learns that PreToolUse hooks run after Claude creates tool parameters but before the tool actually executes. This timing allows the hook to inspect what Claude intends to do and potentially block or modify the action.

The developer discovers they can match specific tools using the `matcher` field. Simple strings match exactly (e.g., `Write` matches only the Write tool), while regex patterns allow broader matching (e.g., `Edit|Write` matches both). Using `*` or an empty string matches all tools.

Common tool names the developer can match include:
- `Bash` for shell commands
- `Read` for file reading
- `Edit` for file editing
- `Write` for file writing
- `Glob` for file pattern matching
- `Grep` for content search
- `Task` for subagent tasks
- `WebFetch` and `WebSearch` for web operations

### What Configuration the Developer Provides

The developer adds a configuration block to their settings file:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/validator.py",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

The `timeout` field is optional and defaults to 60 seconds.

### What Input the Developer Receives

When the hook script runs, it receives JSON via stdin containing:

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf.jsonl",
  "cwd": "/Users/developer/project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

The `tool_input` structure varies depending on which tool is being invoked. The developer must parse this JSON and examine the relevant fields for their validation logic.

### What Output the Developer Must Produce

The developer has two output mechanisms available:

**Exit Code Method (Simple):**
- Exit code 0: The hook succeeds and the tool proceeds. Any stdout is shown in verbose mode.
- Exit code 2: The hook blocks the tool call. The stderr content is shown to Claude as feedback explaining why the action was blocked.
- Other exit codes: Non-blocking error. stderr is shown to the user in verbose mode.

**JSON Output Method (Advanced):**
When exiting with code 0, the developer can write JSON to stdout for more sophisticated control:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "Documentation file auto-approved",
    "updatedInput": {
      "file_path": "/modified/path.txt"
    }
  }
}
```

The `permissionDecision` field accepts:
- `"allow"`: Bypasses the permission system. The tool executes without user confirmation.
- `"deny"`: Prevents the tool call. The reason is shown to Claude.
- `"ask"`: Asks the user to confirm the tool call in the UI.

The optional `updatedInput` field allows modifying tool parameters before execution.

### How Errors and Blocking Work

If the developer's script exits with code 2, the tool call is blocked and the stderr message is fed back to Claude. For example, a validation script might output:

```
Command contains 'rm -rf' which is not allowed
```

Claude receives this feedback and can adjust its approach. The user sees the blocked action in the interface.

If the script times out (default 60 seconds), the hook fails but does not block the tool call.

---

## PermissionRequest Hook Implementation

### What the Developer Needs to Understand

The developer learns that PermissionRequest hooks run when Claude Code is about to show a permission dialog to the user. This allows programmatic approval or denial of permission requests before the user sees them.

This hook uses the same matcher patterns as PreToolUse, matching against tool names.

### What Configuration the Developer Provides

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/permission-handler.py"
          }
        ]
      }
    ]
  }
}
```

### What Input the Developer Receives

The input structure is similar to PreToolUse, containing the tool name and input parameters.

### What Output the Developer Must Produce

**Exit Code Method:**
- Exit code 0: Hook succeeds, normal permission flow continues.
- Exit code 2: Permission is denied. stderr is shown to Claude.

**JSON Output Method:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedInput": {
        "command": "npm run lint"
      }
    }
  }
}
```

For allowing:
- `"behavior": "allow"` grants permission without user interaction
- Optional `updatedInput` can modify the tool parameters

For denying:
- `"behavior": "deny"` rejects the permission request
- Optional `"message"` string tells Claude why permission was denied
- Optional `"interrupt"` boolean stops Claude entirely if true

### How Errors and Blocking Work

Exit code 2 denies the permission and shows stderr to Claude. The permission dialog is not shown to the user in this case.

---

## PostToolUse Hook Implementation

### What the Developer Needs to Understand

The developer learns that PostToolUse hooks run immediately after a tool completes successfully. This is useful for formatting output, logging, or providing feedback to Claude based on results.

The hook cannot prevent the tool from running since it has already executed, but it can influence what Claude does next.

### What Configuration the Developer Provides

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/format.sh"
          }
        ]
      }
    ]
  }
}
```

The `CLAUDE_PROJECT_DIR` environment variable provides the absolute path to the project root.

### What Input the Developer Receives

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf.jsonl",
  "cwd": "/Users/developer/project",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  },
  "tool_response": {
    "filePath": "/path/to/file.txt",
    "success": true
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

The `tool_response` field contains the result of the tool execution.

### What Output the Developer Must Produce

**Exit Code Method:**
- Exit code 0: Success. stdout shown in verbose mode.
- Exit code 2: Error. stderr is shown to Claude.

**JSON Output Method:**
```json
{
  "decision": "block",
  "reason": "Explanation for decision",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Additional information for Claude"
  }
}
```

The `decision` field:
- `"block"`: Automatically prompts Claude with the reason
- `undefined` or omitted: Does nothing special

The `additionalContext` field adds context for Claude to consider in its next action.

### How Errors and Blocking Work

Exit code 2 causes stderr to be shown to Claude as feedback. Since the tool already ran, this feedback influences Claude's next action rather than preventing the tool.

---

## UserPromptSubmit Hook Implementation

### What the Developer Needs to Understand

The developer learns that UserPromptSubmit hooks run when the user submits a prompt, before Claude processes it. This allows validating prompts, blocking certain requests, or adding context to the conversation.

This hook does not use matchers since it applies to all user prompts.

### What Configuration the Developer Provides

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/prompt-validator.py"
          }
        ]
      }
    ]
  }
}
```

### What Input the Developer Receives

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf.jsonl",
  "cwd": "/Users/developer/project",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Write a function to calculate the factorial of a number"
}
```

### What Output the Developer Must Produce

**Adding Context (Exit Code 0):**
Plain text written to stdout is added as context to the conversation. The developer can simply print information that Claude should know.

```
Current time: 2024-01-15 10:30:00
Project uses TypeScript strict mode
```

**JSON Output Method:**
```json
{
  "decision": "block",
  "reason": "Security policy violation: prompt contains sensitive information",
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Context to add if not blocking"
  }
}
```

The `decision` field:
- `"block"`: Prevents the prompt from being processed. The reason is shown to the user (not Claude).
- `undefined` or omitted: Allows the prompt to proceed.

### How Errors and Blocking Work

Exit code 2 blocks prompt processing, erases the prompt, and shows stderr to the user only. The prompt is not processed by Claude.

When using JSON output with `"decision": "block"`, the prompt is blocked and the reason is displayed to the user.

---

## Notification Hook Implementation

### What the Developer Needs to Understand

The developer learns that Notification hooks run when Claude Code sends notifications to the user. These can be filtered by notification type using matchers.

Common notification types include:
- `permission_prompt`: Permission requests from Claude Code
- `idle_prompt`: When Claude is waiting for user input after 60+ seconds
- `auth_success`: Authentication success notifications
- `elicitation_dialog`: When Claude needs input for MCP tool elicitation

### What Configuration the Developer Provides

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "notify-send 'Claude Code' 'Permission needed'"
          }
        ]
      },
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "notify-send 'Claude Code' 'Awaiting input'"
          }
        ]
      }
    ]
  }
}
```

### What Input the Developer Receives

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf.jsonl",
  "cwd": "/Users/developer/project",
  "permission_mode": "default",
  "hook_event_name": "Notification",
  "message": "Claude needs your permission to use Bash",
  "notification_type": "permission_prompt"
}
```

### What Output the Developer Must Produce

Notification hooks are fire-and-forget. Exit code 0 indicates success. Exit code 2 shows stderr to the user only (logged to debug). Other exit codes show errors in verbose mode.

### How Errors and Blocking Work

Notification hooks cannot block notifications. They are purely for custom notification handling. Errors are logged but do not affect Claude's operation.

---

## Stop Hook Implementation

### What the Developer Needs to Understand

The developer learns that Stop hooks run when Claude Code's main agent finishes responding. This allows evaluating whether Claude should actually stop or continue working.

This hook does not run if the stoppage was caused by user interrupt.

### What Configuration the Developer Provides

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/stop-validator.py"
          }
        ]
      }
    ]
  }
}
```

The developer can also use prompt-based hooks for intelligent evaluation:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Evaluate if Claude should stop: $ARGUMENTS. Check if all tasks are complete.",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### What Input the Developer Receives

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf.jsonl",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": true
}
```

The `stop_hook_active` field indicates if Claude is already continuing as a result of a stop hook. The developer should check this to prevent infinite loops.

### What Output the Developer Must Produce

**Exit Code Method:**
- Exit code 0: Claude stops normally.
- Exit code 2: Claude is blocked from stopping. stderr is shown to Claude as instructions for what to do next.

**JSON Output Method:**
```json
{
  "decision": "block",
  "reason": "Tests are still failing. Please fix the remaining test errors."
}
```

The `decision` field:
- `"block"`: Prevents Claude from stopping. The reason is shown to Claude.
- `undefined` or omitted: Allows Claude to stop.

**Prompt-based Output:**
When using `type: "prompt"`, the LLM responds with:
```json
{
  "decision": "approve",
  "reason": "All tasks are complete."
}
```

### How Errors and Blocking Work

Exit code 2 or `"decision": "block"` prevents Claude from stopping and provides feedback for Claude to continue working. The developer must provide a clear reason explaining what still needs to be done.

---

## SubagentStop Hook Implementation

### What the Developer Needs to Understand

The developer learns that SubagentStop hooks run when a Claude Code subagent (created via the Task tool) finishes responding. This allows evaluating whether subagents completed their assigned tasks.

### What Configuration the Developer Provides

```json
{
  "hooks": {
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Evaluate if this subagent should stop. Input: $ARGUMENTS\nCheck if the subagent completed its assigned task."
          }
        ]
      }
    ]
  }
}
```

### What Input the Developer Receives

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf.jsonl",
  "permission_mode": "default",
  "hook_event_name": "SubagentStop",
  "stop_hook_active": true
}
```

### What Output the Developer Must Produce

Same as Stop hooks:
- `"decision": "block"` with a reason prevents the subagent from stopping
- The reason is shown to the subagent

### How Errors and Blocking Work

Same behavior as Stop hooks, but applies to subagent tasks rather than the main agent.

---

## PreCompact Hook Implementation

### What the Developer Needs to Understand

The developer learns that PreCompact hooks run before Claude Code compacts the conversation. Compaction occurs either manually via `/compact` or automatically when the context window fills.

Matchers distinguish the trigger:
- `manual`: Invoked from `/compact`
- `auto`: Invoked from auto-compact

### What Configuration the Developer Provides

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "auto",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/save-context.sh"
          }
        ]
      }
    ]
  }
}
```

### What Input the Developer Receives

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf.jsonl",
  "permission_mode": "default",
  "hook_event_name": "PreCompact",
  "trigger": "manual",
  "custom_instructions": ""
}
```

For manual compaction, `custom_instructions` contains any instructions passed to `/compact`. For auto compaction, it is empty.

### What Output the Developer Must Produce

Exit code 0 indicates success. Exit code 2 shows stderr to the user only. The hook cannot block compaction.

### How Errors and Blocking Work

PreCompact hooks cannot block the compaction operation. They are for preparatory actions like saving state before context is compressed.

---

## SessionStart Hook Implementation

### What the Developer Needs to Understand

The developer learns that SessionStart hooks run when Claude Code starts or resumes a session. This is useful for loading development context, installing dependencies, or setting up environment variables.

Matchers distinguish the session type:
- `startup`: New session startup
- `resume`: Resumed via `--resume`, `--continue`, or `/resume`
- `clear`: Session cleared via `/clear`
- `compact`: Session restarted due to compaction

A special feature is available: the `CLAUDE_ENV_FILE` environment variable provides a file path where the developer can persist environment variables for subsequent bash commands.

### What Configuration the Developer Provides

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/setup.sh"
          }
        ]
      }
    ]
  }
}
```

### What Input the Developer Receives

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf.jsonl",
  "permission_mode": "default",
  "hook_event_name": "SessionStart",
  "source": "startup"
}
```

### What Output the Developer Must Produce

**Adding Context (Exit Code 0):**
stdout is added as context for Claude. This allows loading project-specific information at session start.

**JSON Output Method:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Project uses React 18 with TypeScript strict mode"
  }
}
```

**Persisting Environment Variables:**
The developer can write to `CLAUDE_ENV_FILE` to set environment variables for subsequent bash commands:

```bash
#!/bin/bash
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
  echo 'export API_KEY=your-api-key' >> "$CLAUDE_ENV_FILE"
fi
exit 0
```

### How Errors and Blocking Work

Exit code 2 shows stderr to the user only. SessionStart hooks cannot block session startup.

---

## SessionEnd Hook Implementation

### What the Developer Needs to Understand

The developer learns that SessionEnd hooks run when a Claude Code session ends. This is useful for cleanup tasks, logging session statistics, or saving session state.

The `reason` field indicates how the session ended:
- `clear`: Session cleared with /clear command
- `logout`: User logged out
- `prompt_input_exit`: User exited while prompt input was visible
- `other`: Other exit reasons

### What Configuration the Developer Provides

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/cleanup.sh"
          }
        ]
      }
    ]
  }
}
```

### What Input the Developer Receives

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf.jsonl",
  "cwd": "/Users/developer/project",
  "permission_mode": "default",
  "hook_event_name": "SessionEnd",
  "reason": "exit"
}
```

### What Output the Developer Must Produce

SessionEnd hooks are for cleanup. They cannot block session termination. Exit code 0 indicates success. Errors are logged to debug only.

### How Errors and Blocking Work

SessionEnd hooks cannot block session termination. They run for cleanup purposes only.

---

## Prompt-Based Hooks

### What the Developer Needs to Understand

The developer learns that in addition to bash command hooks (`type: "command"`), they can use prompt-based hooks (`type: "prompt"`) that use an LLM to evaluate whether to allow or block an action.

Instead of executing a script, prompt-based hooks:
1. Send the hook input and the configured prompt to a fast LLM (Haiku)
2. The LLM responds with structured JSON containing a decision
3. Claude Code processes the decision automatically

This is most useful for Stop and SubagentStop hooks where context-aware decisions are valuable.

### What Configuration the Developer Provides

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Evaluate if Claude should stop: $ARGUMENTS. Check if all tasks are complete.",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

The `$ARGUMENTS` placeholder is replaced with the hook input JSON. If omitted, input is appended to the prompt.

### What Output the LLM Must Produce

The LLM responds with:

```json
{
  "decision": "approve",
  "reason": "All tasks completed successfully",
  "continue": true,
  "stopReason": "Custom stop message",
  "systemMessage": "Warning shown to user"
}
```

- `decision`: `"approve"` allows the action, `"block"` prevents it
- `reason`: Explanation shown to Claude when blocked
- `continue`: If false, stops Claude entirely
- `stopReason`: Message shown when continue is false
- `systemMessage`: Additional message for the user

---

## Common JSON Fields for All Hook Types

The developer learns that all JSON output can include these optional fields:

```json
{
  "continue": true,
  "stopReason": "Message when continue is false",
  "suppressOutput": false,
  "systemMessage": "Warning message for user"
}
```

- `continue`: If false, Claude stops processing after hooks run
- `stopReason`: Message shown when continue is false
- `suppressOutput`: If true, hides stdout from transcript mode
- `systemMessage`: Warning message shown to the user

---

## Hook Execution Details

The developer learns these execution behaviors:

- **Timeout**: 60-second execution limit by default, configurable per command
- **Parallelization**: All matching hooks run in parallel
- **Deduplication**: Multiple identical hook commands are deduplicated automatically
- **Environment**: Runs in current directory with Claude Code's environment
  - `CLAUDE_PROJECT_DIR`: Absolute path to project root
  - `CLAUDE_ENV_FILE`: Available only for SessionStart hooks
  - `CLAUDE_CODE_REMOTE`: Indicates remote vs local environment

---

## Debugging Hooks

When hooks are not working, the developer can:

1. Run `/hooks` to see if the hook is registered
2. Verify JSON syntax in settings files
3. Test hook commands manually in terminal
4. Check that scripts are executable
5. Use `claude --debug` to see detailed hook execution logs

Debug output shows:
- Which hook is running
- Command being executed
- Success/failure status
- Output or error messages

---

## Security Considerations

The developer is warned that hooks execute arbitrary shell commands automatically. They must:

- Validate and sanitize all inputs
- Always quote shell variables (`"$VAR"` not `$VAR`)
- Block path traversal by checking for `..`
- Use absolute paths for scripts
- Avoid processing sensitive files like `.env` or `.git/`

Direct edits to hooks in settings files do not take effect immediately. Claude Code captures a snapshot at startup and warns if hooks are modified externally. Changes require review in the `/hooks` menu.
