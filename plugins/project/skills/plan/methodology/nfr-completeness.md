# Non-Functional Requirements Completeness

<purpose>
Assess whether non-functional requirements (NFRs) are adequately specified
in project plans. NFRs determine whether a functionally correct system
will succeed in production.
</purpose>

<core-principle>
## The Production Reality Principle

A system that is functionally correct but fails NFRs will fail in production.
Performance, reliability, security, and scalability are not optional—they
determine whether users can actually use what was built.

Source: project-plan-report.md lines 27-28
> "Including key non-functional requirements ensures the team doesn't treat them
> as afterthoughts (which can cause product failure even if features functionally work)"
</core-principle>

<nfr-categories>
## NFR Categories

### Performance
- **Latency**: Response time targets (p50, p95, p99)
- **Throughput**: Requests/second, events/second handling
- **Resource usage**: Memory limits, CPU constraints, bandwidth

Questions to ask:
- What latency is acceptable for user-facing operations?
- What throughput must the system handle at peak?
- Are there resource constraints (mobile devices, limited bandwidth)?

### Reliability
- **Availability**: Uptime targets (99.9%, 99.99%)
- **Error handling**: Graceful degradation, retry policies
- **Data durability**: Backup, recovery, consistency guarantees

Questions to ask:
- What uptime is required?
- How should the system behave when dependencies fail?
- What data loss is acceptable?

### Security
- **Authentication**: Identity verification requirements
- **Authorization**: Access control, permissions model
- **Data protection**: Encryption, PII handling, compliance

Questions to ask:
- Who can access what?
- What data needs protection?
- Are there compliance requirements (GDPR, HIPAA)?

### Scalability
- **User capacity**: Concurrent users, total users
- **Data growth**: Storage scaling, query performance at scale
- **Geographic distribution**: Multi-region, latency requirements

Questions to ask:
- How many users must the system support?
- How will data volume grow over time?
- Are there geographic requirements?
</nfr-categories>

<assessment-process>
## Assessment Process

### Step 1: Identify Applicable NFRs
Not all categories apply to every project. Identify which are relevant.

### Step 2: Check for Explicit Coverage
For each applicable category, verify the plan includes:
- Specific, measurable targets
- Validation approach (how will it be tested?)
- Risk acknowledgment if targets are aggressive

### Step 3: Flag Gaps
Common gaps:
- Performance targets missing for user-facing operations
- No error handling strategy for external dependencies
- Security requirements assumed but not documented
- Scalability targets based on hope, not data

### Step 4: Recommend Additions
For each gap, recommend either:
- Add explicit requirement to Goals or Technical Approach
- Document as out-of-scope with rationale (rare for critical NFRs)
- Add as Risk if target is uncertain
</assessment-process>

<assessment-checklist>
## NFR Assessment Checklist

For the project plan, verify:
- [ ] Performance targets specified where applicable (latency, throughput)
- [ ] Reliability approach documented (error handling, availability)
- [ ] Security requirements explicit (auth, data protection)
- [ ] Scalability targets based on evidence (user counts, data projections)
- [ ] NFRs appear in Validation Commands or acceptance criteria
- [ ] Critical NFRs have associated Risks if aggressive
</assessment-checklist>
