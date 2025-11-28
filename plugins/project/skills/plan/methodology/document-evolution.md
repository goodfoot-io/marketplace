# Document Evolution

<purpose>
Ensure project plans are structured to support healthy iteration as understanding
deepens and requirements evolve during implementation.
</purpose>

<core-principle>
## The Living Document Principle

A plan is not a contract frozen at creation—it's a communication tool that
should evolve with the project. Static plans become fiction; living plans
remain useful references throughout development.

Source: project-plan-report.md lines 82-83
> "The plan is not a one-and-done contract; it's expected to evolve.
> Adopting a mindset that 'products evolve; so should your requirements document' is key."
</core-principle>

<evolution-mechanisms>
## Evolution Mechanisms

### Decision Tracking
Significant decisions are captured in the project log (`log.md`) as Decision Records.

This provides:
- Chronological context (decisions linked to the session that made them)
- Full rationale with alternatives rejected
- Impact tracing to affected components

The project log serves as the authoritative decision history. Plans reference
decisions but don't duplicate them.

### Open Questions Tracking
Explicitly mark uncertainties:

```markdown
## Open Questions

- [ ] **TBD**: Redis cluster sizing — needs load testing by Nov 30
- [x] **RESOLVED**: Payment provider → Stripe (see project log 2025-11-24)
- [ ] **ASSUMPTION**: Users have stable internet — validate with PM
```

**Status markers:**
- `[ ] TBD`: Decision pending, with deadline if applicable
- `[ ] ASSUMPTION`: Believed true but unvalidated
- `[x] RESOLVED`: Answered, Decision Record added to project log
</evolution-mechanisms>

<structure-for-evolution>
## Structuring for Evolution

### Modular Sections
Organize so updates don't cascade:
- Goals can change without rewriting Technical Approach
- Scope changes update one section, not scattered references
- Each section is self-contained with clear boundaries

### Stable Anchors
Some elements should rarely change:
- Problem Statement (the "why" should be stable)
- Success Criteria (the "definition of done")
- Core Constraints (non-negotiables)

Changes to these suggest project scope shift, not iteration.

### Flexible Elements
These are expected to evolve:
- Technical Approach (as implementation reveals better paths)
- Risks & Mitigations (as new risks emerge)
- Dependencies (as integration progresses)
- Open Questions (resolving over time)
</structure-for-evolution>

<anti-drift-practices>
## Anti-Drift Practices

Prevent plans from becoming stale fiction:

### Regular Sync Points
- Review plan at sprint boundaries
- Update after significant implementation learnings
- Reconcile when scope discussions occur

### Change Protocol
1. Propose change in project channel/meeting
2. If accepted, update plan document
3. Add Decision Record to project log documenting the change
4. Communicate update to stakeholders

### Divergence Detection
Red flags that plan has drifted from reality:
- Conversations reference decisions not in plan
- New team members confused by plan vs. implementation
- Code review reveals features not in scope
- Test cases don't trace back to documented requirements

Source: project-plan-report.md lines 69-70
> "A 'write once, file away' PRD that is not updated as decisions change
> will quickly become out-of-date... Team members stop consulting it."
</anti-drift-practices>

<evolution-readiness-checklist>
## Evolution Readiness Checklist

A plan is ready for healthy evolution when:
- [ ] Open questions are explicitly marked, not hidden in prose
- [ ] Sections are modular (changes don't cascade)
- [ ] Decision tracking established via project log
- [ ] Change protocol is understood by team
- [ ] Regular review cadence is established
</evolution-readiness-checklist>
