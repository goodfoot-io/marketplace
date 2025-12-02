---
name: spike
description: Conduct empirical technical investigations using isolated subagents to compare alternatives or validate assumptions through prototype testing.
---

Use the `Task()` tool to launch a subagent to perform a technical spike investigation.

## Spike Invocation Templates

### For Comparison Spikes (Testing Multiple Alternatives)

Use when technology has NOT been chosen and you need to compare 2-3 viable approaches.

**Derive these values from your context:**
- `[SPIKE_QUESTION]`: Format as "Which approach ([A] vs [B] vs [C]) best supports [use case] with [constraints]?"
- `[SCRATCHPAD_PATH]`: Format as `scratchpad/[test-name]/` (relative to project directory)
  - `[test-name]`: Use kebab-case like `realtime-comparison` or `socketio-vs-sse`
  - Subagent prompts use absolute path: `[PROJECT_PATH]/scratchpad/[test-name]/`
- `[APPROACHES]`: List 2-3 technologies with versions (e.g., `["Socket.io v4.6.1 (WebSocket)", "EventSource (SSE)", "long-polling"]`)
- `[COMPARISON_CRITERIA]`: Measurable aspects (e.g., `"Developer experience, bidirectional communication, horizontal scaling"`)
- `[SPIKE_CONTEXT]`: XML-formatted technical context with absolute paths (see <subagent-context> section below)
- `[SUBAGENT_INSTRUCTIONS]`: Specific testing steps for prototyping each approach
- `[SUBAGENT_DESCRIPTION]`: Short kebab-case identifier (e.g., `"realtime-comparison-spike"`)

**Always use:** `subagent_type="general-purpose"` and `model="sonnet"`

### For Validation Spikes (Testing Single Approach)

Use when technology IS chosen but specific capability/compatibility needs verification.

**Derive these values from your context:**
- `[SPIKE_QUESTION]`: Format as "Does [Library@version] support [specific capability]?"
- `[SCRATCHPAD_PATH]`: Format as `scratchpad/[test-name]/` (relative to project directory)
  - `[test-name]`: Use kebab-case like `redis-compatibility-check` or `react-query-types-export`
  - Subagent prompts use absolute path: `[PROJECT_PATH]/scratchpad/[test-name]/`
- `[APPROACH]`: Single technology to validate (e.g., `"Socket.io v4.6.1 with @socket.io/redis-adapter"`)
- `[VALIDATION_CRITERIA]`: What needs verification (e.g., `"Redis adapter compatibility for horizontal scaling"`)
- `[SPIKE_CONTEXT]`: XML-formatted technical context with absolute paths (see <subagent-context> section below)
- `[SUBAGENT_INSTRUCTIONS]`: Specific testing steps for validating the capability
- `[SUBAGENT_DESCRIPTION]`: Short kebab-case identifier (e.g., `"redis-compatibility-check"`)

**Always use:** `subagent_type="general-purpose"` and `model="sonnet"`


<subagent-context>
Subagents have no context from this conversation. Provide workspace-relative paths:
- Scratchpad: `[PROJECT_PATH]/scratchpad/[test-name]/`
- Codebase files: `packages/api/src/server.ts` (no prefix needed)

Structure [SUBAGENT_CONTEXT] and [SPIKE_CONTEXT] using semantic XML tags that organize technical details:

**When comparing alternatives**:
```xml
<spike-purpose>
[Why this investigation is needed and what decision depends on it]
</spike-purpose>

<approaches-to-test>
[List of 2-3 specific approaches/technologies to prototype and compare]
</approaches-to-test>

<comparison-criteria>
[Specific criteria for comparison - e.g., developer experience, scaling capability, performance]
</comparison-criteria>

<technical-context>
[Relevant technical constraints, requirements, or existing patterns]
</technical-context>

<scratchpad-path>
[PROJECT_PATH]/scratchpad/[test-name]/
</scratchpad-path>
```

**When validating a chosen approach**:
```xml
<spike-purpose>
[Why this validation is needed and what implementation step depends on it]
</spike-purpose>

<approach-to-validate>
[Specific technology, library version, or integration to test]
</approach-to-validate>

<validation-criteria>
[What needs to be verified - specific capability, API behavior, compatibility]
</validation-criteria>

<technical-context>
[Relevant technical constraints, version requirements, or integration points]
</technical-context>

<scratchpad-path>
[PROJECT_PATH]/scratchpad/[test-name]/
</scratchpad-path>
```
</subagent-context>

<spike-result-format>
Instruct the subagent to document findings in a structured format within the scratchpad:

**Comparison Result Template** (when testing multiple approaches):
```markdown
## [Question]

- **Question**: [The technical question being investigated]
- **Approaches Tested**: [Approach 1, Approach 2, Approach 3]
- **Comparison Criteria**: [Criterion 1, Criterion 2, Criterion 3]
- **Result**: [Recommendation with rationale]
- **Evidence**:
  - [Approach 1]: [Specific findings from prototype]
  - [Approach 2]: [Specific findings from prototype]
  - [Approach 3]: [Specific findings from prototype]
- **Artifacts**: `scratchpad/[test-name]/` contains:
  - `approach-[name1]/` - [Description]
  - `approach-[name2]/` - [Description]
  - `approach-[name3]/` - [Description]
  - `comparison.md` - Side-by-side analysis
  - `recommendation.md` - Selection rationale
  - `results.md` - Findings using template format
- **Impact**: [How this result influences the Technical Approach or implementation]
```

**Validation Result Template** (when testing single approach):
```markdown
## [Question]

- **Question**: [The specific capability or compatibility question]
- **Approach Tested**: [Technology/version being validated]
- **Result**: [Pass/Fail or capability confirmation]
- **Evidence**: [Concrete demonstration - working code, API output, test results]
- **Artifacts**: `scratchpad/[test-name]/` contains:
  - `test-implementation/` - [Description]
  - `results.md` - Detailed findings
- **Impact**: [How this result confirms feasibility or influences implementation details]
```
</spike-result-format>

<example>
**Comparison Spike Example**:

User message: "Compare WebSocket (Socket.io), Server-Sent Events (EventSource), and long-polling for real-time notifications. Compare developer experience, bidirectional communication support, and horizontal scaling capability. Use scratchpad path `scratchpad/realtime-comparison/`"

Derived values:
- [SPIKE_QUESTION] = "Which real-time approach (WebSocket, SSE, or long-polling) best supports notification requirements with horizontal scaling?"
- [SCRATCHPAD_PATH] = "scratchpad/realtime-comparison/" (documented in results)
- [PROJECT_SCRATCHPAD] = "[PROJECT_PATH]/scratchpad/realtime-comparison/" (used in subagent prompt)
- [APPROACHES] = ["Socket.io v4.6.1 (WebSocket)", "native EventSource (SSE)", "polling with state management"]
- [COMPARISON_CRITERIA] = ["Developer experience", "Bidirectional communication support", "Horizontal scaling capability"]
- [SUBAGENT_TYPE] = "general-purpose"
- [SUBAGENT_DESCRIPTION] = "realtime-comparison-spike"

[SUBAGENT_INSTRUCTIONS]:
```
Compare three real-time communication approaches for a notification system. Create working prototypes of each approach in the scratchpad and compare them against specific criteria.

Create prototypes in `[PROJECT_PATH]/scratchpad/realtime-comparison/`:
1. `approach-socketio/` - Socket.io v4.6.1 implementation with Redis adapter for horizontal scaling
2. `approach-sse/` - Native EventSource implementation with separate POST endpoint for client→server
3. `approach-polling/` - Long-polling implementation with state management

For each prototype:
- Implement basic notification delivery
- Test bidirectional communication (or document limitation)
- Prototype horizontal scaling approach
- Document developer experience observations

Create comparison documents:
- `comparison.md` - Side-by-side analysis of all three approaches against criteria
- `recommendation.md` - Clear recommendation with rationale

Document findings using the Comparison Result Template in `results.md`.
```

[SPIKE_CONTEXT]:
```xml
<spike-purpose>
Notification system requires real-time delivery with horizontal scaling. Multiple approaches exist but no clear winner without empirical testing. This spike will inform the Technical Approach section by selecting the optimal technology.
</spike-purpose>

<approaches-to-test>
1. Socket.io v4.6.1 (WebSocket) - bidirectional, requires Redis adapter for scaling
2. Native EventSource (SSE) - server→client only, simpler protocol
3. Long-polling - fallback approach, works everywhere
</approaches-to-test>

<comparison-criteria>
- Developer experience: setup complexity, debugging, ecosystem support
- Bidirectional communication: can clients send data without separate endpoint?
- Horizontal scaling: can scale across multiple server instances?
</comparison-criteria>

<technical-context>
Existing system uses Express.js v4.18.2 in `packages/api/src/server.ts`. Production runs 5 instances behind load balancer. Redis v7.0 available for pub/sub if needed.
</technical-context>

<scratchpad-path>
[PROJECT_PATH]/scratchpad/realtime-comparison/
</scratchpad-path>
```

Use the `Task()` tool to launch the spike investigation:

```xml
<invoke name="Task">
<parameter name="description">realtime-comparison-spike</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">sonnet</parameter>
<parameter name="prompt">
<spike-purpose>
Notification system requires real-time delivery with horizontal scaling. Multiple approaches exist but no clear winner without empirical testing. This spike will inform the Technical Approach section by selecting the optimal technology.
</spike-purpose>

<approaches-to-test>
1. Socket.io v4.6.1 (WebSocket) - bidirectional, requires Redis adapter for scaling
2. Native EventSource (SSE) - server→client only, simpler protocol
3. Long-polling - fallback approach, works everywhere
</approaches-to-test>

<comparison-criteria>
- Developer experience: setup complexity, debugging, ecosystem support
- Bidirectional communication: can clients send data without separate endpoint?
- Horizontal scaling: can scale across multiple server instances?
</comparison-criteria>

<technical-context>
Existing system uses Express.js v4.18.2 in `packages/api/src/server.ts`. Production runs 5 instances behind load balancer. Redis v7.0 available for pub/sub if needed.
</technical-context>

<scratchpad-path>
[PROJECT_PATH]/scratchpad/realtime-comparison/
</scratchpad-path>

<instructions>
Compare three real-time communication approaches for a notification system. Create working prototypes of each approach in the scratchpad and compare them against specific criteria.

Create prototypes in `[PROJECT_PATH]/scratchpad/realtime-comparison/`:
1. `approach-socketio/` - Socket.io v4.6.1 implementation with Redis adapter for horizontal scaling
2. `approach-sse/` - Native EventSource implementation with separate POST endpoint for client→server
3. `approach-polling/` - Long-polling implementation with state management

For each prototype:
- Implement basic notification delivery
- Test bidirectional communication (or document limitation)
- Prototype horizontal scaling approach
- Document developer experience observations

Create comparison documents:
- `comparison.md` - Side-by-side analysis of all three approaches against criteria
- `recommendation.md` - Clear recommendation with rationale

Document findings using the Comparison Result Template in `results.md`.
</instructions>
</parameter>
</invoke>
```
</example>

<example>
**Validation Spike Example**:

User message: "Verify Socket.io v4.6.1 supports Redis adapter for horizontal scaling. Use scratchpad path `scratchpad/redis-compatibility/`"

Derived values:
- [SPIKE_QUESTION] = "Does Socket.io v4.6.1 support Redis adapter for horizontal scaling?"
- [SCRATCHPAD_PATH] = "scratchpad/redis-compatibility/" (documented in results)
- [PROJECT_SCRATCHPAD] = "[PROJECT_PATH]/scratchpad/redis-compatibility/" (used in subagent prompt)
- [APPROACHES] = ["Socket.io v4.6.1 with Redis adapter"]
- [SUBAGENT_TYPE] = "general-purpose"
- [SUBAGENT_DESCRIPTION] = "redis-compatibility-check"

[SUBAGENT_INSTRUCTIONS]:
```
Verify Socket.io v4.6.1 supports Redis adapter for horizontal scaling.

Create test implementation in `[PROJECT_PATH]/scratchpad/redis-compatibility/`:
1. `test-implementation/` - Socket.io v4.6.1 with Redis adapter configuration
2. Install required packages: socket.io@4.6.1, @socket.io/redis-adapter
3. Test multi-instance communication through Redis
4. Document configuration steps and any compatibility issues

Create results document:
- `results.md` - Pass/fail result with concrete evidence

Document findings using the Validation Result Template.
```

[SPIKE_CONTEXT]:
```xml
<spike-purpose>
Plan proposes Socket.io for real-time notifications with Redis adapter for horizontal scaling. Must verify this specific version supports the adapter before committing to implementation.
</spike-purpose>

<approach-to-validate>
Socket.io v4.6.1 with @socket.io/redis-adapter - configuration and multi-instance communication
</approach-to-validate>

<validation-criteria>
- Can install and configure Redis adapter with Socket.io v4.6.1
- Messages propagate correctly across multiple Socket.io instances
- No version compatibility issues or breaking changes
</validation-criteria>

<technical-context>
Production environment uses Redis v7.0. Target deployment has 5 Node.js instances behind load balancer. Existing stack uses Express.js v4.18.2 in `packages/api/src/server.ts`.
</technical-context>

<scratchpad-path>
[PROJECT_PATH]/scratchpad/redis-compatibility/
</scratchpad-path>
```

Use the `Task()` tool to launch the spike investigation:

```xml
<invoke name="Task">
<parameter name="description">redis-compatibility-check</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">sonnet</parameter>
<parameter name="prompt">
<spike-purpose>
Plan proposes Socket.io for real-time notifications with Redis adapter for horizontal scaling. Must verify this specific version supports the adapter before committing to implementation.
</spike-purpose>

<approach-to-validate>
Socket.io v4.6.1 with @socket.io/redis-adapter - configuration and multi-instance communication
</approach-to-validate>

<validation-criteria>
- Can install and configure Redis adapter with Socket.io v4.6.1
- Messages propagate correctly across multiple Socket.io instances
- No version compatibility issues or breaking changes
</validation-criteria>

<technical-context>
Production environment uses Redis v7.0. Target deployment has 5 Node.js instances behind load balancer. Existing stack uses Express.js v4.18.2 in `packages/api/src/server.ts`.
</technical-context>

<scratchpad-path>
[PROJECT_PATH]/scratchpad/redis-compatibility/
</scratchpad-path>

<instructions>
Verify Socket.io v4.6.1 supports Redis adapter for horizontal scaling.

Create test implementation in `[PROJECT_PATH]/scratchpad/redis-compatibility/`:
1. `test-implementation/` - Socket.io v4.6.1 with Redis adapter configuration
2. Install required packages: socket.io@4.6.1, @socket.io/redis-adapter
3. Test multi-instance communication through Redis
4. Document configuration steps and any compatibility issues

Create results document:
- `results.md` - Pass/fail result with concrete evidence

Document findings using the Validation Result Template.
</instructions>
</parameter>
</invoke>
```
</example>

<behavioral-guidelines>
### Spike Execution Principles

1. **Always use scratchpad isolation**: All spike artifacts must be in the specified scratchpad path, never in main codebase
2. **Require empirical evidence**: Spikes must produce working code or concrete test results, not documentation research
3. **Focus on the question**: Stay narrowly focused on answering the specific technical uncertainty
4. **Document for decisions**: Results must clearly inform implementation decisions with actionable recommendations

### Running Multiple Spikes

When multiple independent spike questions need investigation, launch all spikes in parallel by combining all `Task()` calls into a single message:

```xml
<invoke name="Task">
<parameter name="description">spike-question-1</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">sonnet</parameter>
<parameter name="prompt">
[SPIKE_CONTEXT for question 1]

<instructions>
[SUBAGENT_INSTRUCTIONS for question 1]
</instructions>
</parameter>
</invoke>

<invoke name="Task">
<parameter name="description">spike-question-2</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">sonnet</parameter>
<parameter name="prompt">
[SPIKE_CONTEXT for question 2]

<instructions>
[SUBAGENT_INSTRUCTIONS for question 2]
</instructions>
</parameter>
</invoke>

<invoke name="Task">
<parameter name="description">spike-question-3</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">sonnet</parameter>
<parameter name="prompt">
[SPIKE_CONTEXT for question 3]

<instructions>
[SUBAGENT_INSTRUCTIONS for question 3]
</instructions>
</parameter>
</invoke>
```

**Important**: All `Task()` invocations must be in a SINGLE message to execute simultaneously. This maximizes efficiency when investigating multiple independent technical questions.
</behavioral-guidelines>

<processing-spike-results>
## After Spike Completion

### 1. Review Spike Artifacts

The subagent will create artifacts in the scratchpad directory. Review these to ensure quality:

**For Comparison Spikes** (testing multiple approaches):
- Multiple prototype directories exist (one per approach)
- `comparison.md` provides side-by-side analysis
- `recommendation.md` contains clear selection rationale
- `results.md` follows the Comparison Result Template

**For Validation Spikes** (testing single approach):
- `test-implementation/` directory contains working test code
- `results.md` contains pass/fail determination with evidence
- Results follow the Validation Result Template

### 2. Validate Result Quality

Check that spike results meet quality criteria:

**Comparison Spikes Should Have:**
- Question format showing uncertainty between alternatives
- 2-3 approaches tested (not 1, not 5+)
- Comparative analysis with clear selection criteria
- Recommendation with rationale
- Evidence from actual prototypes (not speculation)
- Impact statement selecting specific technology for Technical Approach

**Validation Spikes Should Have:**
- Question format showing capability/compatibility concern
- Single approach tested
- Pass/fail or capability verification result
- Concrete evidence (version-specific behavior, API demonstration)
- Impact statement confirming feasibility for Technical Approach

**Quality Criteria (Both Types):**
- Scratchpad artifacts exist at specified paths
- Evidence is empirical (working code, not "should work" or "probably supports")
- Impact statement clearly influences Technical Approach section
- Question is answerable within isolated spike environment
- Results directly address the stated uncertainty

### 3. Flag Quality Issues

If spike results have these problems, request revision:

- **Comparison spike with single approach**: Should be validation or decision needs justification
- **Validation spike comparing alternatives**: Misclassified, should be comparison
- **Excessive alternatives**: Comparison spike testing 4+ approaches (narrow scope)
- **Speculative evidence**: Results based on documentation reading, not testing
- **Unclear impact**: Spike results don't inform Technical Approach
- **Missing artifacts**: No scratchpad path provided or artifacts don't match description

### 4. Incorporate Findings into Plans

After validating spike quality, incorporate findings:

1. **Add to Technical Spike Results section** (if plan has this section):
   - Copy the formatted result (Question, Approaches Tested, Evidence, etc.)
   - Include the scratchpad path reference
   - Preserve the Impact statement

2. **Update Technical Approach section**:
   - Incorporate the spike's recommendation or validation
   - Reference specific versions/technologies confirmed by testing
   - Adjust implementation steps based on findings

3. **Update Technology Stack** (if needed):
   - Add any libraries/frameworks selected by comparison spikes
   - Include specific versions validated by the spike

### 5. Report to User

Summarize findings in conversational language:
- State the question that was investigated
- Briefly describe what was tested
- Share the key finding or recommendation
- Explain how this impacts the implementation plan

**Example**: "I tested three real-time communication approaches in the scratchpad. Socket.io with Redis adapter provided the best combination of bidirectional support and horizontal scaling. The prototypes confirmed it works with our Express.js setup, so I've updated the Technical Approach to use Socket.io v4.6.1."
</processing-spike-results>
