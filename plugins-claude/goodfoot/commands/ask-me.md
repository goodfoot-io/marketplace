---
name: ask-me
description: Research and clarify user intent before taking action.
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
---

<user-request>
$ARGUMENTS
</user-request>

<instructions>

Review the `<user-request>`. If empty or incomplete, infer intent from the conversation history—assume this is a continuation of the existing conversation and look for the most recent topic, question, or task that would benefit from clarification.

## 1. Determine Research Approach

Analyze the request and determine which research method(s) will help you understand the user's intent:

- **Code changes, bugs, or features involving this codebase**: Filesystem trace
- **Technical questions, API behavior, or library capabilities**: Technical spike
- **Current events, documentation, or external information**: Web search — Task with `subagent_type=general-purpose` using WebSearch
- **Conceptual or design questions**: May not need research — Proceed to Step 2

Launch appropriate research tasks in parallel. Use your judgment; some requests need multiple approaches while some may already be fully covered in the conversation history.

## 2. Synthesize Understanding

After research completes, identify gaps in your understanding. Output a report containing:

- **The request as you understand it** — Restate what the user is asking for
- **Current state** — What exists now, what context is relevant
- **Potential answers or approaches** — One or more ways to address the request
- **Critical analysis** — Trade-offs, risks, or considerations for each approach
- **Additional context** — Anything else that would help make a decision

Do not make recommendations on potential answers or approaches until "3. Clarify with Questions".

## 3. Clarify with Questions

Use the `AskUserQuestion` tool to ask ONE question that addresses the most important gap or decision point. Based on the answer, ask follow-up questions as needed to fully understand the user's intent.

Think deeply before each question. Use subagents for additional research if the user's answer reveals new areas to explore.

## 4. State Your Understanding

After questions are resolved, conclude with a clear, natural language statement of what you understand the user wants. Do not use the `AskUserQuestion` tool at this step—simply state your understanding and wait.

- **If the user follows up**: They'll clarify or correct; continue the conversation naturally
- **If the user doesn't respond**: Treat silence as implicit confirmation

</instructions>
