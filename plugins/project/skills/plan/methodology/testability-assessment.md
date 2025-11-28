# Testability Assessment

<purpose>
Verify that each requirement in a project plan can be objectively validated through
concrete tests, demonstrations, or measurements.
</purpose>

<quick-check>
## The Central Question — Apply This First

For every requirement, ask: **"How would we test this?"**

If you cannot envision a clear test or demonstration, the requirement needs more specificity.
This single question catches most testability issues before they become implementation problems.

Apply this quick-check before detailed analysis—it's often sufficient to identify problems.

See also: `methodology/vague-language-detection.md` for clarifying ambiguous language.
</quick-check>

<core-principle>
## The Verification Principle

A requirement that cannot be tested is not a requirement—it's a wish.
Every goal and acceptance criterion must have a clear, demonstrable pass/fail condition.

Source: project-plan-report.md lines 48-49
> "A practical trick is asking 'How would we test this?' for each requirement.
> If you can't envision a clear test or demo, it likely needs to be more specific."
</core-principle>

<detailed-guidance>
## Testability Criteria

### Observable
The requirement describes something that can be seen, measured, or demonstrated:
- User interface state changes
- API response values
- System metrics (latency, throughput)
- Log output

### Measurable
Numeric thresholds or counts are specified:
- "within 500ms" (measurable) vs "quickly" (not measurable)
- "99.9% uptime" (measurable) vs "reliable" (not measurable)
- "handles 1000 users" (measurable) vs "scalable" (not measurable)

### Deterministic
Same inputs produce same pass/fail result:
- "button appears after login" (deterministic)
- "feels responsive" (subjective, not deterministic)

### Isolatable
Can be tested independently of other requirements:
- Clear entry and exit conditions
- Minimal dependencies on other features
</detailed-guidance>

<assessment-process>
## Assessment Process

For each goal/objective in the plan:

### Step 1: Draft Test Scenario
Write a one-sentence test that would verify the requirement:
> "Given [precondition], when [action], then [expected result]."

### Step 2: Identify Measurements
What would you measure or observe to determine pass/fail?

### Step 3: Verify Specificity
Is the expected result specific enough that two testers would agree?

### Example Assessment

**Requirement**: "Notifications display in real-time"

**Test scenario**: "Given user A is viewing the notification center, when user B
mentions user A in a comment, then notification appears in user A's center within 500ms."

**Measurements**:
- Timestamp of mention event
- Timestamp of notification render
- Delta < 500ms = pass

**Verdict**: Testable (after adding 500ms threshold)
</assessment-process>

<common-untestable-patterns>
## Common Untestable Patterns

### Subjective Quality
- "User-friendly interface" → Untestable without definition
- "Clean code" → What metrics define clean?
- "Good performance" → Good compared to what?

### Process Requirements
- "Follow best practices" → Which practices? How verified?
- "Consider security" → What security checks?
- "Optimize where needed" → Who decides where?

### Vague Scope
- "Support all browsers" → Which browsers, which versions?
- "Handle edge cases" → Which edge cases specifically?
- "Proper error handling" → What errors, what handling?

### Remediation
Transform each into specific, measurable criteria:
- "User-friendly" → "New users complete core task in <3 minutes without help"
- "Good performance" → "p95 latency <200ms under 1000 concurrent users"
- "Support all browsers" → "Chrome 90+, Firefox 88+, Safari 14+, Edge 90+"
</common-untestable-patterns>

<verification-checklist>
## Verification Checklist

For each goal/objective, confirm:
- [ ] A concrete test scenario can be written
- [ ] Pass/fail criteria are objective (two testers would agree)
- [ ] Numeric thresholds exist where applicable
- [ ] No subjective adjectives remain undefined
- [ ] Test can be automated or clearly demonstrated
</verification-checklist>
