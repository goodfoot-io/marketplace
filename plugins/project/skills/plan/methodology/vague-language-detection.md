# Vague Language Detection

<purpose>
Systematic identification of ambiguous language in project plans that could lead to
misaligned implementations or unverifiable requirements.
</purpose>

<core-principle>
## The Clarity Standard

A requirement is sufficiently clear when two independent implementers would build
the same thing, and two independent testers would agree on whether it passes.

Source: project-plan-report.md lines 48-49
> "A practical trick is asking 'How would we test this?' for each requirement.
> If you can't envision a clear test or demo, it likely needs to be more specific."
</core-principle>

<detection-patterns>
## Vague Language Patterns

### Subjective Adjectives
Terms that mean different things to different people:

| Vague | Specific Alternative |
|-------|---------------------|
| "fast" | "responds within 200ms at p95" |
| "user-friendly" | "new users complete onboarding in <5 minutes" |
| "intuitive" | "requires no documentation for basic operations" |
| "scalable" | "handles 10,000 concurrent users" |
| "reliable" | "99.9% uptime over 30-day rolling window" |

### Relative Comparisons Without Baseline
- "improved performance" → improved from what baseline?
- "better error handling" → better than what current state?
- "enhanced security" → enhanced against which threat model?

### Undefined Scope Words
- "all users" → which user segments specifically?
- "complete support" → what defines completeness?
- "full integration" → which integration points?

### Weasel Words (Uncertainty Markers)
- "should", "might", "could", "possibly", "generally"
- These indicate the author is uncertain—resolve before implementation

### Missing Quantification
- "handle high load" → what load number?
- "support many items" → what count threshold?
- "process quickly" → what latency target?
</detection-patterns>

<remediation-process>
## Remediation Process

1. **Identify**: Flag vague terms using patterns above
2. **Question**: "What would we measure to verify this?"
3. **Research**: Check existing system for baseline metrics
4. **Quantify**: Replace with specific, measurable criteria
5. **Validate**: Confirm stakeholders agree on the specific target

### Example Transformation

**Before (vague):**
> "The notification system should be fast and handle high volumes efficiently."

**After (specific):**
> "Notification delivery completes within 500ms (p95) from event trigger to client display.
> System maintains this latency with 1,000 concurrent WebSocket connections and
> 100 notifications/second throughput."
</remediation-process>

<checklist>
## Assessment Checklist

For each requirement, verify:
- [ ] No subjective adjectives without definitions
- [ ] All comparisons have explicit baselines
- [ ] Scope terms are bounded and enumerable
- [ ] No weasel words indicating unresolved uncertainty
- [ ] Numeric thresholds present for performance/scale claims
- [ ] A clear test case can be derived from the requirement
</checklist>

<assessment-example>
## Assessment Workflow Example

**Plan excerpt being assessed:**
> ## Goals & Objectives
> - [ ] Build a fast, reliable notification system
> - [ ] Support many concurrent users efficiently
> - [ ] Improve user engagement through real-time updates

**Assessment process:**

1. **Scan for vague language patterns:**
   - "fast" — subjective adjective (FLAG)
   - "reliable" — subjective adjective (FLAG)
   - "many concurrent users" — undefined quantity (FLAG)
   - "efficiently" — undefined metric (FLAG)
   - "improve user engagement" — relative comparison without baseline (FLAG)

2. **Apply remediation:**
   - "fast" → "delivers notifications within 500ms (p95)"
   - "reliable" → "99.9% message delivery rate"
   - "many concurrent users" → "supports 10,000 concurrent WebSocket connections"
   - "efficiently" → remove or quantify resource usage
   - "improve user engagement" → "increase 7-day notification click-through from 12% to 20%"

3. **Remediated version:**
   > ## Goals & Objectives
   > - [ ] Deliver notifications within 500ms (p95) from event to client display
   > - [ ] Maintain 99.9% message delivery rate under normal operation
   > - [ ] Support 10,000 concurrent WebSocket connections
   > - [ ] Increase 7-day notification click-through from 12% to 20%

See also: `methodology/testability-assessment.md` for verifying remediated requirements are testable.
</assessment-example>
