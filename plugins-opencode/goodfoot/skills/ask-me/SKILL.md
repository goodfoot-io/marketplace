---
name: ask-me
description: Research a request and clarify the user's intent before acting on
  it. Use when the user says "ask me", "clarify", "understand what I want", or
  "research this first", or gives a request too vague to act on without
  investigation and questions.
---

<instructions>

## 1. Establish the Request

Take [REQUEST] from the user's message for this invocation — the `<user-request>` block above on Claude Code, otherwise the message that invoked this skill. A model invocation normally carries no text of its own.

- **Empty or incomplete request**: Treat it as a continuation of the current conversation. Find the most recent topic, question, or task that would benefit from clarification, and use that.
- **Nothing to clarify**: Say so and stop rather than manufacturing a question.

## 2. Determine the Research Approach

Pick the methods that fit [REQUEST] and launch them together, one subagent per method:

Spawn `general-purpose` sub-agents in parallel (`spawn_agent` with `agent_type: general-purpose`)

- **Code changes, bugs, or features in this codebase**: Filesystem trace.
- **Technical questions, API behavior, or library capabilities**: Technical spike.
- **Current events, documentation, or external information**: Web search.
- **Conceptual or design questions**: Research may add nothing — skip to Step 3: Synthesize Understanding.

Some requests need several methods at once; some are already answered by the conversation history.

## 3. Synthesize Understanding

Report:

- **The request as understood** — Restate what the user is asking for.
- **Current state** — What exists now, and which context is relevant.
- **Potential answers or approaches** — One or more ways to address the request.
- **Critical analysis** — Trade-offs, risks, and considerations for each approach.
- **Additional context** — Anything else that would inform a decision.

Do not recommend an approach yet.

## 4. Clarify with Questions

Ask ONE question, addressing the most important gap or decision point, through the `AskUserQuestion` tool. Think before each question. Ask follow-ups as the answers open new ground, and research further when an answer reveals an unexplored area.

## 5. State Your Understanding

Conclude with a plain statement of what the user wants. Do not use `AskUserQuestion` here — state it and wait.

- **The user follows up**: Continue from their correction.
- **The user stays silent**: Treat that as confirmation.

</instructions>
