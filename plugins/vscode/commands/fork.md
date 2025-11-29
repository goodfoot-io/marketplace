---
description: Fork the current session in a new VSCode terminal
---

The session ID was provided at session start via the session-id-injector hook (look for SESSION_ID in your context).

Fork the current session by executing the following commands in a single message, replacing $SESSION_ID with the actual session ID value:

```xml
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">workbench.action.terminal.new</parameter>
<parameter name="args">[]</parameter>
</invoke>

<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">workbench.action.terminal.sendSequence</parameter>
<parameter name="args">[{"text": "claude --fork-session --resume $SESSION_ID\n"}]</parameter>
</invoke>
```

Do not include any other content in your response.
