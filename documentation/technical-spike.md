# Technical Spikes in Project Planning

## Overview

Technical spikes are **time-boxed research activities** that help teams make better technical decisions and reduce risk through empirical investigation. Originally from Extreme Programming (XP), spikes are exploratory activities that include research, prototyping, architecture exploration, and comparative analysis.

**Key Characteristics:**
- **Time-boxed**: Typically hours to 1-2 days maximum
- **Empirical**: Based on working code, not speculation
- **Decision-enabling**: Produce actionable insights that inform planning
- **Risk-reducing**: Address uncertainty that could derail implementation

## Types of Technical Spikes

### 1. **Strategic Spikes** (Comparing Alternatives)

Used when you need to **choose between multiple viable approaches** before committing to one.

**When to Use:**
- Technology selection (WebSocket vs SSE vs long-polling)
- Library/framework comparison (Zustand vs Jotai vs Redux)
- Architecture pattern evaluation (REST vs GraphQL, monorepo vs polyrepo)
- Build tool selection (Vite vs Webpack vs Turbopack)

**Characteristics:**
- Multiple prototypes or approaches tested
- Comparative analysis with selection criteria
- Time-box: 2-4 hours to 1 day maximum
- Output: Clear recommendation with rationale

**Example:** "Should we use WebSocket (Socket.io), Server-Sent Events (EventSource), or long-polling for real-time notifications? Compare developer experience, bidirectional support, and horizontal scaling capability."

### 2. **Tactical Spikes** (Validating Chosen Approach)

Used when an approach has been chosen and you need to **validate it works as expected**.

**When to Use:**
- Version compatibility validation
- API/export verification
- Framework behavior testing
- Integration compatibility
- Performance feasibility

**Characteristics:**
- Single approach tested
- Pass/fail or capability verification
- Time-box: 30 minutes to 2-3 hours
- Output: Concrete evidence of capability

**Example:** "Does Socket.io v4.6.1 support Redis adapter for cross-instance messaging?"

## When to Use Technical Spikes

### ✅ Appropriate Use Cases

#### Strategic Spikes

**1. Technology Selection**
- Comparing real-time communication approaches
- Evaluating state management libraries
- Assessing build tools or bundlers
- Choosing between API paradigms

**Example:** "Compare Socket.io v4.6.1, native EventSource, and polling strategy for real-time notifications. Test: bidirectional support, scaling with Redis, developer experience."

**2. Architecture Pattern Evaluation**
- Testing different integration patterns
- Comparing data flow approaches
- Evaluating deployment strategies

**Example:** "Should notification state be server-driven (WebSocket push) or client-driven (polling with local state)?"

**3. Unfamiliar Technology Assessment**
- Prototyping with new frameworks
- Testing emerging standards
- Exploring alternative approaches

**Example:** "Does the Web Push API provide sufficient reliability for our notification requirements compared to WebSocket?"

#### Tactical Spikes

**1. Version Compatibility Validation**
- Does library version X support feature Y?
- Is framework version N compatible with version M?
- Will this syntax work with TypeScript version Z?

**Example:** "Does Socket.io v4.6.1 support Redis adapter for cross-instance messaging?"

**2. API/Export Verification**
- Does this library export the type/function we need?
- Can we import X from package Y?
- Does this API accept the parameters we plan to use?

**Example:** "Can Zustand v4.5.0 stores use TypeScript 5.3.3's satisfies operator?"

**3. Framework Behavior Testing**
- Does Next.js support X in this version?
- Can React do Y with this hook?
- Will this pattern work with our build configuration?

**Example:** "Does react-window v1.8.10 work with React 18.2.0 concurrent rendering?"

**4. Integration Compatibility**
- Can library A work with library B in our setup?
- Does this pattern cause memory leaks?
- Will this approach integrate with our TypeScript config?

**Example:** "Can Socket.io WebSocket upgrades work in Next.js 14 API routes?"

**5. Performance Feasibility (Lightweight)**
- Can this approach handle N items without lag? (modest N, tested locally)
- Does this cause rendering issues? (tested with dev tools)
- Is this fast enough for user interaction? (qualitative assessment)

**Example:** "Does virtual scrolling maintain 60fps with 1000+ notification items?"

### ❌ Inappropriate Use Cases

Technical spikes should **NOT** be used for:

**1. Production-Scale Performance Optimization**
- ❌ "What's the p95 latency with 10K concurrent users?"
- ❌ "How do we optimize for production traffic patterns?"
- ✅ Instead: Do this during implementation/testing with proper infrastructure

**2. Excessive Alternative Comparison**
- ❌ "Compare 6+ different approaches with comprehensive benchmarks"
- ❌ "Build production-quality implementations of all alternatives"
- ✅ Instead: Narrow to 2-3 most viable options, use lightweight prototypes

**3. Product/Business-Level Decisions**
- ❌ "Should we build this feature at all?"
- ❌ "What should our overall product architecture be?"
- ✅ Instead: Make these decisions through product/architecture review

**4. Well-Documented Standard Features**
- ❌ "Does Array.map() iterate over elements?" (known JavaScript behavior)
- ❌ "Can React render components?" (fundamental framework capability)
- ✅ Instead: Reference documentation, only spike for version-specific or undocumented behavior

## Scope and Effort Guidelines

### Time Investment

**Strategic Spikes:**
- **Target**: 2-4 hours for simple comparisons
- **Maximum**: 1-2 days for complex architectural decisions
- **If longer**: Break into smaller investigations or escalate to architecture review

**Tactical Spikes:**
- **Target**: 30 minutes to 2 hours
- **Maximum**: Half a day for complex integrations
- **If longer**: Likely missing prerequisites or scope is too broad

### Investigation Depth

**Strategic Spikes:**
- **Appropriate**: 2-3 lightweight prototypes testing key criteria
- **Appropriate**: Comparative analysis with clear selection rationale
- **Inappropriate**: Production-quality implementations
- **Inappropriate**: Comprehensive load testing or benchmarking

**Tactical Spikes:**
- **Appropriate**: Single test file in scratchpad directory
- **Appropriate**: Quick prototype to verify capability
- **Inappropriate**: Multiple alternative implementations
- **Inappropriate**: Full production-quality code

### Evidence Gathering

**Strategic Spikes:**
- **Appropriate**: Side-by-side comparison with selection criteria
- **Appropriate**: Documented trade-offs and recommendation
- **Appropriate**: Basic performance/capability comparison

**Tactical Spikes:**
- **Appropriate**: Pass/fail result with concrete metrics
- **Appropriate**: "Yes, feature X works with version Y"
- **Appropriate**: Code example demonstrating capability

## Workflow Placement

Technical spikes can occur at different phases:

### Strategic Spikes (Earlier in Workflow)

**Timing**: After requirements gathering, before committing to approach

```
1. Parse user request
2. Initialize project
3. Research technical context (codebase queries)
4. Identify technology patterns from existing code
   ↓
   [If pattern exists] → Proceed to Step 5
   [If no clear pattern OR greenfield] → Strategic Spike
   ↓
5. → CONDUCT TACTICAL SPIKES (validate chosen approach)
6. Analyze dependencies
7. Log research findings
8. Create plan (informed by spike results)
```

### Tactical Spikes (During Planning)

**Timing**: After approach is chosen, before detailed plan creation

**Key Insight**: Strategic spikes help **choose** the approach; tactical spikes **validate** the chosen approach works as expected.

## Decision Framework

### When to Use Strategic vs Tactical Spikes

**Ask yourself:**

**"Has the technology/approach been chosen?"**

├─ **NO** → Consider Strategic Spike
│  ├─ Is there high uncertainty about which approach is best?
│  ├─ Are there 2-3 viable alternatives?
│  └─ Would prototyping help make a better decision?
│
└─ **YES** → Consider Tactical Spike
   ├─ Is there uncertainty about capability/compatibility?
   ├─ Is the behavior version-specific or undocumented?
   └─ Could testing reveal integration issues?

### Example Flows

**Strategic Spike Example:**
1. User: "Add real-time notifications"
2. Research: No real-time infrastructure exists in codebase
3. Strategic Spike: "Compare WebSocket (Socket.io), SSE (EventSource), and polling. Test: bidirectional support, scaling, DX."
4. Result: Socket.io recommended - bidirectional, scales with Redis, better DX
5. Tactical Spike: "Does Socket.io v4.6.1 support Redis adapter?"
6. Plan: "Implement notifications with Socket.io + Redis"

**Tactical Spike Example:**
1. User: "Add notifications"
2. Research: "App uses Socket.io v4.6.1 everywhere"
3. Tactical Spike: "Does v4.6.1 support Redis adapter?" ✅
4. Plan: "Implement notifications with Socket.io + Redis"

## Types of Questions

### Strategic Spike Questions
- "Which approach best meets our requirements: X, Y, or Z?"
- "Should we use library A or library B for this use case?"
- "What's the best pattern for handling X in our architecture?"
- "How do these alternatives compare for our specific needs?"

### Tactical Spike Questions
- "Does this API exist and work as documented?"
- "Can we use feature X with version Y?"
- "Will this pattern work in our setup?"
- "Does this integrate correctly with Z?"

## Evidence and Artifacts

### Strategic Spike Artifacts

**Structure:**
```
scratchpad/[spike-name]/
  ├── approach-A/          # Socket.io prototype
  ├── approach-B/          # SSE prototype
  ├── approach-C/          # Polling prototype
  ├── comparison.md        # Side-by-side analysis
  └── recommendation.md    # Selection rationale
```

**Content:**
- Minimal prototypes demonstrating key capabilities
- Comparison matrix with selection criteria
- Clear recommendation with rationale
- Trade-offs documented

### Tactical Spike Artifacts

**Structure:**
```
scratchpad/[test-name]/
  ├── verify-feature.ts    # Test demonstrating capability
  ├── findings.md          # Results documentation
  └── [supporting files]   # Config, types, etc.
```

**Content:**
- Single test file demonstrating capability
- Pass/fail evidence with concrete metrics
- Minimal supporting code

## Impact on Plan

### How Spike Results Should Appear in Plans

**Strategic Spike Results:**
```markdown
## Technical Spike Results

### Real-Time Communication Approach Selection
- **Question**: Which real-time approach (WebSocket, SSE, long-polling) best supports notification requirements with horizontal scaling?
- **Approaches Tested**: Socket.io v4.6.1 (WebSocket), native EventSource (SSE), polling with state management
- **Result**: Socket.io recommended - provides bidirectional communication, scales with Redis adapter, better developer experience
- **Evidence**: WebSocket: 2-way communication working, <50ms latency, Redis pub/sub tested. SSE: server→client only, requires separate POST endpoint. Polling: functional but 23% higher server CPU
- **Artifacts**: scratchpad/realtime-comparison/ contains all three prototypes with benchmark results
- **Impact**: Selected Socket.io as Technical Approach; enables bidirectional real-time features with horizontal scaling via Redis
```

**Tactical Spike Results:**
```markdown
### Socket.io Redis Adapter Compatibility
- **Question**: Does Socket.io v4.6.1 support Redis adapter for cross-instance message broadcasting?
- **Approach Tested**: Created minimal Socket.io server with @socket.io/redis-adapter, tested multi-instance communication
- **Result**: Confirmed v4.6.1 supports Redis adapter with connection state sharing
- **Evidence**: Successfully broadcast messages across 3 server instances, verified in scratchpad test
- **Artifacts**: scratchpad/socketio-redis-test/ contains server prototype and Redis config
- **Impact**: Can proceed with horizontal scaling approach; no single-server bottleneck
```

### What Impact Looks Like

**Strategic Spike Impact Statements:**
- "Selected WebSocket (Socket.io) over SSE based on bidirectional requirement"
- "Chose Zustand for state management - simpler API, better TypeScript support"
- "Decided on GraphQL approach - reduces over-fetching for complex queries"

**Tactical Spike Impact Statements:**
- "Can proceed with horizontal scaling approach"
- "Can use type-safe patterns without assertions"
- "Confirmed approach meets performance requirements"
- "Must use API routes instead of Server Actions"

## Common Pitfalls

### Pitfall 1: Scope Creep
**Problem**: Spike turns into multi-day investigation or production implementation
**Solution**: Time-box strictly, use minimal prototypes, focus on decision criteria

### Pitfall 2: Premature Optimization
**Problem**: Testing performance at production scale during planning
**Solution**: Validate "good enough" feasibility, defer optimization to implementation

### Pitfall 3: Analysis Paralysis
**Problem**: Comparing too many alternatives or over-analyzing trade-offs
**Solution**: Limit to 2-3 most viable options, use clear selection criteria

### Pitfall 4: Skipping Strategic Spikes When Needed
**Problem**: Choosing technology without validation, leading to costly rework
**Solution**: If genuinely uncertain between alternatives, invest in brief strategic spike

### Pitfall 5: Strategic Spike Disguised as Tactical
**Problem**: "Validating" when you're actually choosing between approaches
**Solution**: Be honest about the investigation type, allocate appropriate time

## Summary

**Technical Spikes Are:**
- Time-boxed research activities (hours to 1-2 days max)
- Empirical investigations using working code
- Decision-enabling tools that reduce risk
- Both strategic (choosing approach) and tactical (validating approach)
- Producing actionable insights with clear evidence

**Technical Spikes Are NOT:**
- Unbounded research or exploration
- Production-quality implementations
- Performance optimization at scale
- Business/product-level decision making
- Substitute for proper planning or implementation

**The Decision Framework:**

```
Is the approach/technology chosen?
├─ NO → Strategic Spike (if high uncertainty and 2-3 alternatives)
└─ YES → Tactical Spike (if capability/compatibility uncertain)
```

**Time Guidelines:**
- Strategic: 2-4 hours to 1 day max
- Tactical: 30 min to half day max

Use technical spikes to make informed decisions (strategic) and validate chosen approaches (tactical).
