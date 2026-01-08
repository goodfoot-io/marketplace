---
description: Enable skill reload after the next context compaction
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
---

```!
# Source find-claude-pid utility
source "${CLAUDE_PLUGIN_ROOT}/bin/find-claude-pid"

# Get Claude PID for session-scoped storage
CLAUDE_PID=$(find_claude_pid)

# Create the enablement flag
touch "/tmp/claude_skills_reload_${CLAUDE_PID}.enabled"

echo "Skill reload enabled for session PID: ${CLAUDE_PID}"
```

## Skill Reload Enabled

The skill reload flag has been created. On the **next context compaction**, any skills that were tracked during this session will be automatically reloaded.

**This is a one-shot operation**: The flag is consumed after the next compaction. If you want skills reloaded after a subsequent compaction, run this command again before that compaction occurs.

**How it works**:
1. Skills are tracked as they are used during your session
2. When compaction occurs, the skill-reloader hook checks for the enablement flag
3. If enabled, it outputs instructions to reload the tracked skills
4. The flag is then deleted (one-shot behavior)
