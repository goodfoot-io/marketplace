# Rationale Capture

<purpose>
Ensure project plans document the reasoning behind decisions, enabling future
maintainers to understand intent and make informed modifications.
</purpose>

<core-principle>
## The "Why" Preservation Principle

Code shows WHAT was built. Plans should show WHY it was built that way.
Without rationale, future teams cannot distinguish intentional decisions from
accidents, leading to either cargo-cult preservation or accidental breakage.

Source: project-plan-report.md lines 72-73
> "Requirements without rationale... can lead to pushback or confusion...
> an implementation that meets the letter of the requirement but not the spirit."
</core-principle>

<rationale-types>
## Types of Rationale to Capture

### Technology Selection Rationale
Why was this library/framework/approach chosen?
- What alternatives were considered?
- What criteria drove the selection?
- What trade-offs were accepted?

**Example:**
> "Selected Socket.io over native WebSocket because: (1) built-in reconnection
> handling reduces implementation complexity, (2) Redis adapter enables horizontal
> scaling, (3) team has prior experience. Trade-off: larger bundle size (~45KB)."

### Constraint Rationale
Why does this limit exist?
- Is it technical (system limitation)?
- Business (compliance, cost)?
- Temporal (deadline pressure)?

**Example:**
> "Limited to 1000 notifications/user because IndexedDB performance degrades
> beyond this threshold on mobile Safari. Validated via spike in scratchpad/indexeddb-perf/."

### Exclusion Rationale
Why is this out of scope?
- Deferred to future version?
- Not valuable enough?
- Too complex for current timeline?

**Example:**
> "Email notifications excluded: requires SMTP infrastructure not currently
> provisioned, and user research shows 90% prefer in-app notifications.
> Revisit in Q2 when email service is available."

### Trade-off Rationale
When conflicting requirements exist, which was prioritized and why?

**Example:**
> "Prioritized real-time responsiveness over offline support because user research
> indicated <5% of usage occurs offline. Offline mode deferred to v2."
</rationale-types>

<capture-patterns>
## Capture Patterns

### Inline Rationale
For simple decisions, add rationale inline:
```markdown
- WebSocket: socket.io@4.6.1 - Chosen for Redis adapter support enabling horizontal scaling
```

### Dedicated Section
For significant decisions, use a Rationale & Context section:
```markdown
## Rationale & Context

### Technology Decisions
- **Real-time transport**: Socket.io selected over SSE because bidirectional
  communication needed for typing indicators. SSE is server→client only.

### Trade-offs Accepted
- **Bundle size vs. features**: Accepted 45KB Socket.io overhead for reconnection
  handling and room support rather than implementing from scratch.
```

### Decision Records in Project Log
For evolving projects, capture decisions in the project log as they happen.

Append a Decision Record to `[PROJECT_PATH]/log.md` whenever:
- A technology selection is made
- Scope is changed (features added or removed)
- Trade-offs are resolved
- Assumptions are validated or disproven

This captures decisions chronologically with full context, rather than as a summary table.
See `commands/create.md` logging guidelines for the Decision Record format.
</capture-patterns>

<assessment-criteria>
## Assessment Criteria

A plan has sufficient rationale when:
- [ ] Every technology choice includes selection reasoning
- [ ] Scope exclusions explain why items were deferred
- [ ] Trade-offs are documented when conflicting requirements exist
- [ ] Constraints include their origin (technical, business, temporal)
- [ ] A new team member could understand "why this way" without asking
</assessment-criteria>
