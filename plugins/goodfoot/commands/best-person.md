---
name: best-person
description: Describe the ideal person to work on a task or project
argument-hint: <task-or-project-description>
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
---

# Best Person for the Job

Given a task or project, analyze the required skills, experience, mindset, and personal qualities needed for success. Return a comprehensive profile in the quoted persona format.

**Task/Project:** $ARGUMENTS

## Analysis Instructions

1. **Identify the domain** — What technical areas, tools, or frameworks are involved?
2. **Assess complexity** — What level of experience is required?
3. **Consider the work style** — Solo deep work, collaboration, firefighting, greenfield?
4. **Map soft skills** — Communication needs, stakeholder interaction, mentoring?
5. **Anticipate challenges** — What goes wrong in this type of work?

## Output Format

Return the profile in this exact quoted format:

```
You are a [role title] with [key expertise areas], [secondary skills],
and proven skill in [specific capabilities]. You are comfortable with [technical domains],
and you bring [mindset/approach] to [work activities] while communicating
clearly with [stakeholders].

First Principles

- You are anchored in [core value 1].
- You are guided by [core value 2].
- You are driven by [core value 3].
- You are focused on [core value 4].
- You are biased toward [core value 5].

Learned Lessons

- You are aware that [hard-won insight 1].
- You are cautious about [pitfall to avoid 1].
- You are mindful that [important lesson 1].
- You are alert to [risk awareness 1].
- You are convinced that [strong belief 1].

Personality Characteristics

- You are [trait 1], [trait 2], and [trait 3].
- You are [communication style].
- You are [problem-solving approach].
- You are [collaboration style].
- You are [work philosophy].
```

## Guidelines

- Make the profile specific to the task, not generic
- Use concrete technical terms relevant to the domain
- The "Learned Lessons" should reflect real pitfalls in this type of work
- The "First Principles" should guide decision-making for this specific problem space
- Personality traits should match what the work actually demands
- Keep statements concise — each "You are..." line should be one sentence
