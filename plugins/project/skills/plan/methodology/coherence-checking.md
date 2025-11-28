# Coherence Checking

<purpose>
Verify internal consistency across plan sections to prevent conflicting requirements
that cause implementation confusion or rework.
</purpose>

<core-principle>
## The Single-Story Principle

A coherent plan tells one consistent story. Every section should reinforce—never
contradict—the others. A reader should be able to trace any requirement back to
the problem statement and forward to validation criteria.

Source: project-plan-report.md lines 71
> "Poorly written or collaboratively edited plans can sometimes contain requirements
> that conflict with each other or don't form a cohesive narrative."
</core-principle>

<consistency-dimensions>
## Consistency Dimensions

### Numeric Consistency
Cross-reference all quantified values:
- Performance targets (latency, throughput) same across sections
- Capacity limits (users, items, connections) consistent
- Timeouts and intervals aligned

**Common conflict**: Goals section says "100ms response time" but Risks section
discusses mitigations for "500ms acceptable degradation."

### Terminology Consistency
Same concept must use same name throughout:
- If Problem Statement says "Shopping Cart", Technical Approach shouldn't say "Basket"
- Entity names should match codebase conventions
- Avoid synonyms for the same thing

**Common conflict**: Mixing "user", "customer", "account holder" for same entity.

### Scope Consistency
Technical Approach steps must align with Scope boundaries:
- Every Include item should have corresponding technical steps
- No technical steps for Exclude items
- Dependencies should appear in both Dependency Analysis and Technical Approach

**Common conflict**: Scope excludes "email notifications" but Technical Approach
includes "configure SMTP settings."

### Priority Consistency
When multiple requirements could conflict, priorities must be explicit:
- "Simplify UI" vs "Add advanced features" — which wins?
- "Minimize latency" vs "Reduce infrastructure cost" — what's the trade-off?

**Common conflict**: Goals list both simplicity and flexibility without resolution.
</consistency-dimensions>

<verification-process>
## Verification Process

### Step 1: Extract Key Values
Create a reference table of all quantified values, named entities, and scope items.

### Step 2: Cross-Reference
For each value/term, search the document for all occurrences and verify consistency.

### Step 3: Trace Requirements
For each goal, verify:
- It addresses something in the Problem Statement
- It has steps in Technical Approach
- It has criteria in Validation Commands or acceptance criteria

### Step 4: Identify Tensions
List any requirements that could conflict, verify explicit resolution documented.
</verification-process>

<conflict-resolution>
## Conflict Resolution

When conflicts are found:

1. **Identify authoritative source**: Which section reflects the true intent?
2. **Update all occurrences**: Align to the authoritative value
3. **Document the decision**: If trade-off involved, add to Rationale section
4. **Re-verify**: Check that fix didn't introduce new conflicts
</conflict-resolution>
