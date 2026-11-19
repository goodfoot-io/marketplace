# Cursor hook target contract

Sources checked 2026-11-19:
- https://cursor.com/docs/hooks (formerly /docs/agent/hooks)
- https://cursor.com/docs/reference/plugins
- Linear GOO-144

This target implements sessionStart, postToolUse, preToolUse, beforeSubmitPrompt,
stop, and subagentStop, not every event supported by Cursor.

## Manifest and execution

Emit `version: 1` and flat arrays of scripts under native camelCase event keys.
There are no Claude-style matcher groups or `type: "command"` wrappers. Factory
`timeout` is milliseconds; script `timeout` is seconds, rounded upward (minimum 1).
`loopLimit` maps to script `loop_limit`; omission retains Cursor's default 5, and
null explicitly removes the cap. `failClosed` applies to permission-bearing
preToolUse and beforeSubmitPrompt. This library defaults it to true, including
host-enforced timeouts and process failures; false explicitly selects host fail-open
behavior. Malformed permission responses may still block according to Cursor's schema.

`.cursor-plugin/` marks a plugin root; the default output is `hooks/hooks.json` at
that root, with bundles under `hooks/bin`. Ordinary plugin commands run from the
plugin root. Plugin stop/subagentStop commands run from the workspace root, so
those commands require the shell-expanded CURSOR_PLUGIN_ROOT environment variable.
No assumption is made that Cursor interpolates variables in command strings.
Project `.cursor/hooks.json` commands run from the project root; user-level hooks
run from `~/.cursor`. Other outputs use absolute bundle paths. Commands use POSIX
shell syntax; Windows PowerShell command generation is not implemented.

## Event-specific replies

- sessionStart: env and additional_context. Fire-and-forget: cannot gate the session.
- postToolUse: additional_context and updated_mcp_tool_output (MCP only).
- preToolUse: permission allow/deny, user_message, agent_message, updated_input.
  The host accepts ask syntactically but does not enforce it, so the library rejects it.
- beforeSubmitPrompt: continue and user_message; no context-injection channel.
- stop/subagentStop: followup_message. Subagent follow-ups require completed status.

Host-provided tool_output is a JSON-encoded string. Cloud HTTP MCP tools may have
redacted results, and ignore input/output replacements; the target does not promise
to bypass these host restrictions.

No matcher is accepted for sessionStart. Tool matchers select Shell, Read, Write,
Grep, Delete, Task, or MCP:<name>. beforeSubmitPrompt and stop match the host's
literal UserPromptSubmit and Stop labels; subagentStop matches subagent type.

## Error policy

Successful replies serialize only native stdout fields at exit 0. Empty permission
replies explicitly allow/continue. Unexpected failures use stderr and exit 1; the
manifest's failClosed setting governs host enforcement. Only sessionStart and
postToolUse can opt into unexpectedError: "continue" for advisory enrichment.
Handler failures under the advisory policy return `{}`; serialization failures exit
0 without retrying stdout, following the shared driver's single-finalization rule.
Intentional CursorBlockError is classified before this policy: permission events
emit native deny/continue:false; other events preserve the exit-2 block signal.
This cannot make observational or fire-and-forget events enforce permissions.

Build-time config must be an inline object with literal metadata. Computed config,
spreads, shorthand fields, unsupported options and invalid values fail the build
rather than silently losing a matcher, timeout, or failClosed setting.
