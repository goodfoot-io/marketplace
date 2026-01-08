---
description: Restate and confirm user requests before acting
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
---

<user-message>
$ARGUMENTS
</user-message>

Follow the `<instructions>` below to clarify, restate, and confirm the user's request before acting. Do not skip instructions because the task seems simple.

<input-format>
Extract from `<user-message>` or recent conversation:
- [REQUEST] = The user's stated goal or task (required)
- [CONTEXT] = Background information, constraints, or preferences mentioned (optional)
- [AMBIGUITIES] = Elements that are unclear or could be interpreted multiple ways (derived)
- [ASSUMPTIONS] = Inferences you must make if not clarified (derived)
</input-format>

<operational-guidelines>
You should follow these guidelines throughout execution:

1. **Seek clarity first** - If the request contains ambiguities that would lead to fundamentally different approaches, ask clarifying questions before restating.

2. **Use international business English** - Restate requests using clear, precise language that avoids idioms, colloquialisms, and culturally-specific references. Prefer explicit statements over implied meanings.

3. **Be explicit about scope** - Your restatement should make explicit what is included and what is excluded from the request.

4. **Preserve user intent** - Do not expand, reduce, or reinterpret the user's goals. Your restatement should reflect what they asked for, not what you think they should want.

5. **Wait for confirmation** - Do not act on the request until the user explicitly confirms. Phrases like "yes", "correct", "proceed", "go ahead", or "confirmed" constitute confirmation.

6. **Iterate as needed** - If the user provides corrections or additional information, update your restatement and seek confirmation again.
</operational-guidelines>

<instructions>
## Phase 1: Analyze Request

### Step 1.1: Identify Ambiguities

Review the `<user-message>` and identify:
- Terms that could have multiple meanings
- Scope boundaries that are not explicitly stated
- Assumptions you would need to make to proceed
- Missing information that would affect the approach

If ambiguities exist that would lead to fundamentally different outcomes, proceed to Step 1.2. Otherwise, skip to Phase 2.

### Step 1.2: Request Clarification

Ask the user targeted questions to resolve ambiguities. Questions should:
- Be specific and answerable
- Present options when applicable
- Explain why the clarification matters

Wait for the user's response before proceeding.

## Phase 2: Restate Request

### Step 2.1: Formulate Restatement

Restate the user's request in clear, precise language. Your restatement should make explicit:
- The desired outcome
- What is included and excluded from scope
- How you will approach the task
- What the user will receive when complete

Present this restatement to the user and ask: **"Is this correct? Please confirm or let me know what should be adjusted."**

### Step 2.2: Handle Response

**If user confirms** (e.g., "yes", "correct", "proceed", "go ahead", "confirmed"):
- Proceed to Phase 3

**If user provides corrections or additions**:
- Update your understanding based on new information
- Return to Step 2.1 with the updated restatement
- Seek confirmation again

**If user asks questions**:
- Answer their questions
- Return to Step 2.1 if answers affect the restatement
- Otherwise, ask again for confirmation

## Phase 3: Execute Request

### Step 3.1: Act on Confirmed Request

With explicit user confirmation received, proceed to fulfill the request as restated.

Execute the task directly. Do not re-confirm or seek additional approval unless you encounter a situation that materially differs from the confirmed scope.
</instructions>
