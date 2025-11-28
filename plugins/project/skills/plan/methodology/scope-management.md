# Scope Management

<purpose>
Maintain clear project boundaries to prevent scope creep and ensure focused delivery
of the core problem solution.
</purpose>

<core-principle>
## The YAGNI Philosophy

YAGNI (You Aren't Gonna Need It) is the foundational principle for scope management.
Building capabilities before they're needed incurs multiple hidden costs:

1. **Cost of building**: Time spent on speculative features delays actual value
2. **Cost of delay**: Core features ship later while non-essential work proceeds
3. **Cost of carry**: Extra code requires maintenance, testing, documentation
4. **Cost of repair**: Wrong guesses about future needs create technical debt

Source: project-plan-report.md lines 44-45
> "Resist the temptation to add features 'for future use' or because 'we might
> need this later.' Such presumptive features often never pay off."

A plan's Exclude section is its first line of defense against scope creep.
Every feature not explicitly excluded is implicitly negotiable. Strong plans
make non-goals as explicit as goals.

Source: project-plan-report.md lines 17, 67-68
> "Plans bound the project's scope and prevent feature creep... By explicitly
> stating what the product will and won't do, the plan acts as a compass."
</core-principle>

<yagni-assessment>
## YAGNI Assessment

For each proposed feature, apply the YAGNI (You Aren't Gonna Need It) check:

### Red Flag Phrases
Features introduced with these phrases are scope creep candidates:
- "In case we need..."
- "For future flexibility..."
- "While we're at it..."
- "It might be useful to..."
- "Just in case..."

### Assessment Questions
1. **Problem alignment**: Does this directly solve the stated problem?
2. **Current necessity**: Is this needed for the CURRENT release?
3. **Evidence basis**: Is there evidence users want this, or is it speculation?
4. **Dependency**: Do other features depend on this, or is it standalone?

### Decision Framework

| Question | Yes | No |
|----------|-----|-----|
| Directly solves stated problem? | Keep | Flag |
| Needed for current release? | Keep | Defer |
| Evidence users want it? | Keep | Flag |
| Other features depend on it? | Keep | Review |

If any answer is "Flag" or "Defer", move to Exclude section with rationale.

Source: project-plan-report.md lines 44-45
> "Resist the temptation to add features 'for future use' or because 'we might
> need this later.' Such presumptive features often never pay off."
</yagni-assessment>

<scope-defense-protocol>
## Scope Defense Protocol

When stakeholders request additions during planning:

### Step 1: Acknowledge
"That's an interesting idea. Let me check how it fits the current scope."

### Step 2: Assess
Apply YAGNI questions above.

### Step 3: Classify
- **Core**: Directly solves problem → Add to Include
- **Related**: Useful but not essential → Add to Exclude with "Future consideration"
- **Unrelated**: Different problem → Suggest separate project

### Step 4: Document
If deferring, capture in the plan:
```markdown
### Exclude
- Email notifications — Future consideration pending SMTP infrastructure (Q2)
- Bulk notification management — Related but separate project scope
```

### Step 5: Communicate
"I've noted this for future consideration. For this release, we're focused on
[core problem]. This helps us deliver faster and learn from real usage."
</scope-defense-protocol>

<exclude-section-quality>
## Exclude Section Quality Criteria

A strong Exclude section:
- [ ] Is longer than or equal to Include section (more boundaries = more focus)
- [ ] Includes obvious adjacent features users might expect
- [ ] Provides brief rationale for each exclusion
- [ ] Distinguishes "not this release" from "not ever"
- [ ] Includes features stakeholders have mentioned but were deferred

### Anti-pattern: Sparse Exclude Section
```markdown
### Exclude
- N/A
```
This is a red flag—it suggests insufficient boundary thinking.

### Good Example
```markdown
### Exclude
- Email notification delivery — No SMTP infrastructure, revisit Q2
- Push notifications to mobile — Requires native app integration
- Notification scheduling — Adds complexity, wait for user feedback
- Rich media attachments — Focus on text-based notifications first
- Analytics/tracking — Separate instrumentation project
```
</exclude-section-quality>
