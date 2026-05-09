---
name: cli
description: Use for voice conversations
---

You must use the `voice` CLI on the path to guide a voice conversation with a user. The voice conversation will not proceed without you.

## Watch loop

Use `voice watch` to "hear" both sides of the conversation. It will return an incremental transcript.

**Use the `Bash` tool to run `voice watch` in the background right now.**.

```xml
<invoke name="Bash">
<parameter name="command">voice watch</parameter>
<parameter name="run_in_background">true</parameter>
</invoke>
```

When the `voice watch` process exits **immediately restart `voice watch` in the background** before doing any other work. This keeps the loop alive so events are never missed while work is in flight. 

### §CONTEXT
Use `voice context` when you have background knowledge, facts, or state for the voice conversation.

```xml
<invoke name="Bash">
<parameter name="command">voice context <<'EOF'
[BACKGROUND KNOWLEDGE]
EOF</parameter>
</invoke>
```

### §TOPICS
Use `voice topics` — you want to steer the conversation, ask questions, and provide specific answers.

```xml
<invoke name="Bash">
<parameter name="command">voice topics <<'EOF'
[TOPICS TO COVER]
EOF</parameter>
</invoke>
```

**Background-first rule:** Any substantial work — memory lookups, file reads, Agent calls, Bash commands — should use `run_in_background: true`. Fire them in parallel with the next `voice watch` call. You'll be notified when each completes.

## Reference guides

You **must** load the relevant guide before acting on any of these situations.

**When:** the browser has not connected or audio is not ready → ./reference/browser-audio.md
**When:** starting, pausing, resuming, ending, or restarting a conversation → ./reference/conversation-lifecycle.md
**When:** the conversation is long, the avatar seems confused, or context needs refreshing → ./reference/context-management.md
**When:** the avatar says something wrong, goes off-track, or needs redirecting → ./reference/intervention.md
**When:** the user signals they are done and the session should end → ./reference/shutdown.md
**When:** the server fails to start, becomes unresponsive, or crashes → ./reference/startup-failure.md

---

```!
# Embedded bash — stdout and stderr are shown to Claude as skill context.

output=$(voice start <<'EOF'
You are the voice. Speak naturally and directly. Match the user's vocal and conversational style.

## Context and Topics
There two types of system messages:
- <context>: Background knowledge.
- <topics>: The topics you should cover. **Move the discussion to these.**

## If You Do Not Know
If you are less than 80% sure of an answer, **STOP** and wait for <context> and <topics>. Do not tell the user you are waiting.

EOF
)
if [ $? -ne 0 ]; then
  echo "The voice server did not start correctly" >&2
  echo "$output" >&2
  exit 2
fi
echo "$output" | jq -r '"**Send the initial topics then instruct the user to open a browser to \(.url)**"'

```