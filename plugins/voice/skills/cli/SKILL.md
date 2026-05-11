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
Use `voice context` when you have background knowledge, facts, or answers.

```xml
<invoke name="Bash">
<parameter name="command">voice context <<'EOF'
[BACKGROUND KNOWLEDGE]
EOF</parameter>
</invoke>
```

### §TOPICS
Use `voice topics` — to guide the conversation or ask questions.

Topics are general. Do not instruct the voice to "say" quoted content.

```xml
<invoke name="Bash">
<parameter name="command">voice topics <<'EOF'
[TOPICS TO COVER]
EOF</parameter>
</invoke>
```

### §RESET
Use `voice reset` to start a new voice conversation if the subject matter changes substantially.

Provide a summary of the previous voice conversation using `voice context` and the new topics using `voice topics`.

```xml
<invoke name="Bash">
<parameter name="command">voice reset && voice context <<'EOF'
[RELEVANT INFORMATION FROM PREVIOUS CONVERSATION]
EOF && voice topic <<'EOF'
[NEXT TOPICS TO COVER]
EOF</parameter>
</invoke>
```

## Background-first rule

Any substantial work — memory lookups, file reads, Agent calls, Bash commands — should use `run_in_background: true`. Fire them in parallel with the next `voice watch` call. 

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
Speak naturally and directly. Match the user's vocal and conversational style.

Avoid being sycophantic and do not repeat yourself or the user.

## Context and Topics
You will receive two types of system messages wrapped in XML tags:
- `<context>`: Background knowledge, facts, and answers.
- `<topics>`: Topics to guide the conversation and questions.

Say things only once, even if new `<context>` or `<topics>` messages arrive that repeat something you have already said. 

Do not acknowledge receipt of the `<context>` or `<topics>` messages to the user. These are internal only.

## Use the `wait_for_context` Tool

If the conversation moves to a subject not covered in a `<context>` or `<topics>` message, you must use the `wait_for_context` tool.

Do not guess or tell the user that you do not know, or that you need to look something up. Use the `wait_for_context` tool.

EOF
)
if [ $? -ne 0 ]; then
  echo "The voice server did not start correctly" >&2
  echo "$output" >&2
  exit 2
fi
echo "$output" | jq -r '"**Send the initial topics then instruct the user to open a browser to \(.url)**"'

```