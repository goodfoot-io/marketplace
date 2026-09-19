---
name: best-person
description: Describe the ideal person for a task or project as a quoted persona
  profile. Use when the user asks "who is the best person for this", "what kind
  of person should work on this", or wants a role, hiring, or candidate profile
  for a piece of work.
---

<instructions>

## 1. Identify the Work

Take [TASK_OR_PROJECT] from the user's message, or from the conversation when the message names nothing specific. **STOP** — ask for the task when neither supplies one; a generic profile serves nobody.

## 2. Analyze the Work

- **Domain** — Which technical areas, tools, or frameworks are involved?
- **Complexity** — What level of experience does success require?
- **Work style** — Solo deep work, collaboration, firefighting, or greenfield?
- **Human side** — What communication, stakeholder, or mentoring demands does it carry?
- **Failure modes** — What goes wrong in this kind of work?

## 3. Emit the Profile

Return the profile in exactly this quoted format:

```
You are a [role title] with [key expertise areas], [secondary capabilities],
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

## 4. Keep It Specific

- Ground the profile in the actual work, not in a generic role.
- Use concrete technical terms from the domain.
- Draw "Learned Lessons" from real pitfalls in this kind of work.
- Aim "First Principles" at decisions this problem space actually forces.
- Match personality traits to what the work demands.
- Hold each "You are..." line to one sentence.

</instructions>
