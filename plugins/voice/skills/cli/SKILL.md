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

The voice has no access to files or the things you know. Provide a clearly stated, full context and make sure it understands the user's goals.

Avoid mentioning artifacts created solely to support the conversation - such as your notes or todo list items - unless they are actionable for the user.

```xml
<invoke name="Bash">
<parameter name="command">voice context <<'EOF'
[BACKGROUND KNOWLEDGE, FACTS, OR ANSWERS]
EOF</parameter>
</invoke>
```

### §TOPICS
Use `voice topics` — to guide the conversation or ask questions.

Do not include quoted text for the voice to say.

Topics should be no more than three sentences. Provide them frequently to keep the conversation on track.

Use imperative voice that assumes competence. Lead with the action, not the motivation.

```xml
<invoke name="Bash">
<parameter name="command">voice topics <<'EOF'
[ONE TO THREE SENTENCES GUIDING THE CONVERSATION AND ASKING QUESTIONS]
EOF</parameter>
</invoke>
```

### §RESET
Resetting frequently is the default hygiene for a sustained conversation — not a last resort. `voice conversation reset` ends and restarts the session atomically with no audible gap, so a fresh session keeps the avatar coherent, latency low, and the model free of stale earlier turns. Prefer reset over letting one session accumulate an ever-growing transcript.

Reset proactively when any of these hold — do not wait for an error:
- **Topic change** — the subject matter has moved on from what the running session was seeded with.
- **Drift or repetition** — the avatar repeats itself, contradicts earlier turns, or seems confused about earlier content.
- **Long conversation** — periodically during any extended conversation, roughly every 8–12 exchanges, even when nothing is visibly wrong.

**Always pair a reset with a re-seed.** A reset alone drops continuity; `voice context` and `voice topics` replace prior blocks latest-wins, so re-seeding immediately after reset is cheap and preserves the thread. This is the canonical pattern — reset, then carry forward a tight summary and the next direction in a single atomic step:

```xml
<invoke name="Bash">
<parameter name="command">voice conversation reset && voice context <<'EOF'
[TIGHT SUMMARY OF WHAT CARRIES FORWARD — key facts, decisions, and the user's goals]
EOF && voice topics <<'EOF'
[NEXT DIRECTION — one to three sentences guiding where the conversation goes next]
EOF</parameter>
</invoke>
```

When the transcript is long but you want to preserve the exact running session (no reset), inject a summary instead — see §SUMMARY_INJECT in ./reference/context-management.md for when to prefer each. Full lifecycle details: ./reference/conversation-lifecycle.md

### §STAGE
Use `voice html` to paint a full-viewport HTML document **behind** the voice overlays. Use it to show the user anything visual the conversation calls for — diagrams, data, illustrations, slides.

The stage is an unsandboxed, same-origin iframe: full DOM and script access. **Only absolute or CDN URLs load** — there is no asset server, so relative `<script>`/`<link>`/`<img>` paths 404. Use inline styles or CDN libraries (Tailwind v4 + DaisyUI v5, Three.js, Mermaid all work from CDN).

**File mode (preferred — live reload).** Write to an absolute path, then point the stage at it. The daemon watches the file and re-renders on every save, so you can iterate by rewriting the file:

```xml
<invoke name="Bash">
<parameter name="command">voice html /tmp/stage.html</parameter>
</invoke>
```

**Stdin mode (one-shot).** Pipe the document directly:

```xml
<invoke name="Bash">
<parameter name="command">voice html <<'EOF'
<!doctype html><html>...</html>
EOF</parameter>
</invoke>
```

**Clear the stage.** Bare invocation removes the iframe and returns to an empty background:

```xml
<invoke name="Bash">
<parameter name="command">voice html</parameter>
</invoke>
```

Render proactively when it helps the user see what is being discussed; clear it when the visual is no longer relevant. Inject only HTML you control or trust. Default to a full-viewport, one-idea-per-stage slide — copy a template from [§Slide-style stages](./reference/html-stage.md#slide-style-stages) rather than hand-rolling layout. Full details: ./reference/html-stage.md

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
**When:** rendering an HTML document full-viewport behind the voice UI → ./reference/html-stage.md

---

```!
# Embedded bash — stdout and stderr are shown to Claude as skill context.

output=$(voice start <<'EOF'
Speak naturally and directly. Match the user's vocal and conversational style.

Avoid being sycophantic and do not repeat yourself or the user.

## Context and Topics
- `<context>`: Background knowledge, facts, and answers.
- `<topics>`: Topics for discussion and questions.

Discuss `<topics>` with the user, referencing `<context>` as necessary.

## Use the `wait_for_context` Tool

Use the `wait_for_context` tool when:
- You do not know an answer. (Instead of saying "I do not know.")
- The user has asked you to do something you cannot do. (Instead of saying "I don't have that capability.")
- You have reached the end of a topic or the user has changed the subject. (Instead of saying "What do you want to talk about next?")

EOF
)
if [ $? -ne 0 ]; then
  echo "The voice server did not start correctly" >&2
  echo "$output" >&2
  exit 2
fi
echo "$output" | jq -r '"**Send the initial topics then instruct the user to open a browser to \(.url)**"'

```