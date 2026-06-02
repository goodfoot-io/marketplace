---
name: skillify
description: This skill should be used when the user asks to "skillify this", "turn this into a skill", "make a skill out of what we just did", "generalize this task into a reusable skill", or otherwise wants to capture a just-completed session task as a new skill or fold it into an existing one.
disable-model-invocation: true
---

<instructions>

Convert a task just completed in the current session into a reusable skill — either a new skill or an edit to an existing one. Every skill produced is written for Claude as its sole reader: capture only what a capable Claude could not already infer, generalized so the skill works in any repository.

## 1. Confirm the Task Is Worth Capturing

Identify the just-completed task from the conversation history. Decline rather than manufacture a low-value skill:
- **One-off or non-repeatable work**: Say so and stop; suggest a note instead.
- **Trivially inferable workflow**: A capable Claude would already do it correctly — stop.
- **Already covered by an existing skill**: Point to it and offer to edit it rather than create a duplicate.
- **Knowledge, not procedure**: Prefer a memory or doc over a skill.
- **The relevant work is not in context** (compacted, or from a prior session): Ask the user to re-run the task here or paste the key steps, then proceed.

When the session holds several distinct tasks, skillify one per invocation; confirm which.

## 2. Interview to Reach Shared Understanding

Interview the user until the design is settled, walking the tree below in order; each branch depends on the ones before it. Ask one question at a time through `AskUserQuestion`, recommending an answer with the recommended option first. Resolve anything discoverable by inspecting the session or codebase instead of asking. **Do not over-ask**: skip a branch whose answer is obvious, and hold a simple one- or two-step task to one or two questions.

- **Scope** — The task or workflow to capture.
- **Name and triggers** — The skill's name and the literal phrases the user would say to invoke it.
- **Location** — Project, personal, or plugin; see Step 3: Choose Name and Location.
- **Generalization boundary** — Which details are incidental versus load-bearing, and which values to discover at runtime versus fix as stated assumptions.
- **Inclusions** — The non-obvious insights to keep versus the steps Claude would already perform correctly.
- **Resources** — Whether a single `SKILL.md` suffices or bundled files are warranted.

## 3. Choose Name and Location

Name the skill in kebab-case as a short verb or noun phrase for the task (e.g., `prune-merged-worktrees`). The directory name and the frontmatter `name` must match.

| Placement | Path | Use when |
|-----------|------|----------|
| Project (shared) | `<repo>/.claude/skills/<name>/SKILL.md` | Committed to the repo and shared with the team |
| Personal (global) | `~/.claude/skills/<name>/SKILL.md` | Available across all of your projects, not committed |
| Plugin | `<plugin-root>/skills/<name>/SKILL.md` | Distributed inside a plugin, whose root holds `.claude-plugin/plugin.json` |

Route by what occupies the target:
- **Nothing exists there**: Create — proceed to Step 4: Distill the Generalizable Core.
- **The same skill exists**: Edit — read it in full first, then proceed to Step 4: Distill the Generalizable Core.
- **A different skill owns this name or triggers**: Choose a distinct name and re-check; never overwrite an unrelated skill.

## 4. Distill the Generalizable Core

Work from the conversation history, not a transcript file.

- Capture the path that worked and the points where the user corrected you — those corrections are the non-obvious lessons. Drop the chronological trial and error.
- **Omit** what a capable Claude with no memory of this session would already do correctly. **Keep** what it would not: non-obvious decision logic, ordering that matters, safety gates, and failure modes discovered during the work.
- Strip *incidental* specifics — branch names, paths, IDs — replacing them with runtime discovery. Keep *load-bearing* specifics — a required command, a non-obvious flag, an API shape — as stated assumptions; do not generalize these away, as they are often the skill's whole value.
- Note how Claude will know each consequential step succeeded, and flag any irreversible action for a human checkpoint.

For example, a skill for pruning merged worktrees omits that `git worktree list` enumerates worktrees, and keeps that `git branch --merged` and `git rev-list main..HEAD` miss squash- and rebase-merges, so `git cherry` detects the patch-equivalence they miss.

## 5. Draft, Confirm, then Write

Draft the complete `SKILL.md` from the settled design and present it in full in your reply.

**STOP** — Confirm the draft with the user via `AskUserQuestion` before writing the file. A concrete draft is easier to correct than abstract questions.

After confirmation:
- **Create mode**: Write the new `SKILL.md`.
- **Edit mode**: Rewrite the affected sections in place. Replace or restate existing instructions rather than appending beside them — appending stacks stale, contradictory guidance and bloats the file. The result must read as if authored fresh with the current understanding.

Frontmatter requires `name` and a third-person `description` naming the literal trigger phrases. When the generated skill takes inputs, declare them in a `<placeholder-variables>` section. Add `references/` (docs loaded on demand), `scripts/` (deterministic, repeatedly-rewritten code), or `assets/` (files used in output) only on a clear, repeated need, and keep each generalizable too.

Skill metadata is always loaded and the body loads on trigger, so keep the body lean — well under ~2,000 words. Follow these conventions in the body:

| Element | Convention |
|---------|------------|
| Body wrapper | Wrap all instructions in `<instructions>` … `</instructions>` |
| Headers | Numbered `## N. Title`; no `#` h1 inside the instructions |
| Voice | Imperative and verb-first ("Run X", not "You should run X"); third person only in the `description` |
| Conditionals | Bolded-prefix bullets — `- **Condition**: action`; never if/else buried in prose or table cells |
| Tables | Reference data and static classification only — never decision logic |
| Placeholders | `[UPPERCASE_UNDERSCORE]` for inputs and `$VAR` for shell runtime values; document each as `[NAME] — meaning` |
| Stop markers | `**STOP** — reason` |
| Step references | Number plus title — "Proceed to Step 4: Distill the Generalizable Core" — never a bare number |
| Density | State each directive once; one concept per bullet; keep any identity framing to 1–2 sentences |

## 6. Validate

Confirm before finishing:
- Frontmatter carries `name` in kebab-case matching the directory, and a third-person `description` whose literal trigger phrases would surface this skill for the intended request without colliding with an existing skill.
- The body is wrapped in `<instructions>`, uses numbered headers and imperative voice, and matches the conventions table.
- No incidental detail is hardcoded; load-bearing specifics are kept as stated assumptions and incidental ones are discovered at runtime.
- No instruction restates what Claude would already do, and each consequential step carries a success signal.
- In edit mode, the existing skill was read first, nothing was appended beside an old instruction, and no stale or contradictory guidance remains.

</instructions>
