---
description: Analyze user decisions to extract underlying first principles
argument-hint: [context or decisions to analyze]
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
---

# First Principles Analysis

You are conducting a first-principles analysis to uncover the user's underlying values, constraints, and reasoning patterns based on their decisions and preferences.

## Context

The user has provided the following context for analysis:

$ARGUMENTS

## Your Task

### Phase 1: Initial Analysis

Review the conversation history and the provided context. Identify:

1. **Observable decisions** - What specific choices has the user made?
2. **Patterns** - What recurring themes or preferences emerge?
3. **Rejections** - What has the user explicitly avoided or dismissed?
4. **Emphasis** - What does the user spend time explaining or defending?

### Phase 2: Hypothesis Formation

Based on your analysis, form hypotheses about the user's first principles. Consider:

- **Efficiency principles** - How they think about time, effort, cognitive load
- **Quality principles** - What "good" means to them
- **Communication principles** - How they prefer information structured
- **Control principles** - What they want to decide vs. delegate
- **Risk principles** - How they balance safety vs. speed

### Phase 3: Clarifying Questions

Use the `AskUserQuestion` tool to validate and refine your hypotheses. Follow these guidelines:

1. **Ask one focused question at a time** - Don't overwhelm with multiple questions
2. **Propose probable answers** - When you have a strong hypothesis, include it as an option (e.g., "You seem to value X over Y - is that accurate?")
3. **Explain why you're asking** - Connect the question to specific observations
4. **Build sequentially** - Each question should deepen understanding based on previous answers

Example question structure:
```
Based on [specific observation], it seems like you prioritize [principle A] over [principle B].

Is this accurate, or is there a different way to frame this?
```

### Phase 4: Synthesis

Continue the question-answer cycle until you have clarity on the core principles. Then state them clearly:

**Format for final output:**

## First Principles

Based on our discussion, here are your core principles in this domain:

1. **[Principle Name]** - [One sentence description]
   - *Evidence*: [What led to this conclusion]
   - *Implication*: [How this should guide future decisions]

2. **[Principle Name]** - ...

[Continue for each principle identified]

---

### Early Termination

If the user asks you to "proceed" or "move forward with what you have," immediately:

1. State the most likely first principles based on available evidence
2. Note which principles have lower confidence and why
3. Proceed with the requested work using these principles as guidance

### Important Notes

- First principles should be **actionable** - they should guide future decisions
- First principles should be **falsifiable** - the user should be able to disagree
- First principles should be **independent** - avoid principles that are just restatements of each other
- Prefer **fewer, stronger principles** over many weak ones
