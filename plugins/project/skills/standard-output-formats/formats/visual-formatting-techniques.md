Use this component when:
- Complex system relationships need visual clarification within narrative explanations
- Process flows would benefit from diagram support alongside descriptive text
- Technical reasoning requires visual decision trees or comparison structures
- Architecture concepts need visual anchoring to support written explanation
- Data patterns exist that can be presented without fabricated metrics

**Example user message:**
Show formatting techniques for enhancing technical explanations with visual elements.

## Template

## Visual Formatting Techniques for Narrative Enhancement

### Process Flow Diagrams
```text
# Use to clarify complex system behavior within explanations
User Request
    ↓ (validates input)
Authentication Layer
    ↓ (checks permissions)
Business Logic
    ↓ (processes data)
Database Layer
    ↓ (returns results)
Response Formatter
    ↓ (sends to client)
User Interface

# Decision flow example:
Authentication Check → [Valid?] → Yes → Continue to Business Logic
                                ↓ No
                               Return 401 Error
```

### Architecture Visualization
```text
# Use to show component relationships supporting technical rationale
┌─────────────────────────────────────────────────────┐
│                Frontend Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐│
│  │  React UI    │  │  State Mgmt  │  │ API Client  ││
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘│
└─────────┼──────────────────┼─────────────────┼───────┘
          │                  │                 │
┌─────────┼──────────────────┼─────────────────┼───────┐
│         │     Application Layer              │       │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼──────┐│
│  │   Auth Svc   │  │   Data Svc   │  │  Cache Svc  ││
│  └──────────────┘  └──────────────┘  └─────────────┘│
└─────────────────────────────────────────────────────┘
```

### Decision Flow Charts
```text
# Use to illustrate technical reasoning and trade-offs
                Need to Scale System?
                    /           \
                  Yes            No
                  /               \
        Horizontal Scaling?      Continue Current
           /          \          Architecture
         Yes           No
         /              \
   Add Load         Vertical Scaling
   Balancer         (Upgrade Hardware)
   + Multiple
   Instances
```

### Concept Comparison Tables
```text
# Use for qualitative technical comparisons (no fabricated metrics)
┌─────────────────┬──────────────────┬──────────────────┐
│ Approach        │ Technical Fit    │ Integration      │
├─────────────────┼──────────────────┼──────────────────┤
│ WebRTC Direct   │ Low latency      │ Complex setup    │
│ WebSocket       │ Moderate latency │ Easier migration │
│ REST + Polling  │ Higher latency   │ Simple retrofit  │
└─────────────────┴──────────────────┴──────────────────┘
```

### Status Visualization (Observable States Only)
```text
# Use when you have actual observable system states
Current System Status:
├─ Core Services    ✅ All responding normally
│  ├─ API Gateway   ✅ Routing requests correctly
│  ├─ Auth Service  ✅ Processing logins
│  └─ Database     ⚠️  Slow query alerts present
├─ Background Jobs  ✅ Processing queue normally
└─ Monitoring      ✅ All metrics collecting

# Migration progress (actual counts only):
Database Migration: [═══════════════════░░░] 127/150 tables
Feature Flags:      [████████████████████] 5/5 enabled
```

### Data Flow Visualization
```text
# Use to explain how data moves through system
External API
    ║ (JSON payload)
    ▼
Input Validator ──(rejected)──► Error Handler ──► Client
    ║ (validated)
    ▼
Business Logic ────────────────► Cache Layer
    ║ (processed)                     ▲
    ▼                                 │ (cache miss)
Database ──(results)─────────────────┘
    ║ (formatted)
    ▼
Response Builder ─────────────────────► Client
```

### System State Hierarchies
```text
# Use to show nested system organization
Application Architecture
├─ Presentation Tier
│  ├─ React Components (stateless)
│  └─ Redux Store (state management)
├─ API Tier
│  ├─ GraphQL Gateway (schema stitching)
│  ├─ REST Endpoints (legacy support)
│  └─ WebSocket Handlers (real-time features)
└─ Data Tier
   ├─ PostgreSQL (transactional data)
   ├─ Redis (caching + sessions)
   └─ S3 (file storage)
```

### Usage Guidelines for Narrative Enhancement
**✅ Use Visual Elements When:**
- Complex relationships need clarification alongside written explanation
- Multiple interconnected concepts require visual anchoring
- Process sequences support the technical reasoning
- Architecture decisions benefit from structural visualization
- System states can be observed and documented

**✅ Integrate with Narrative by:**
- Embedding diagrams within flowing explanation paragraphs
- Using visuals to support (not replace) written technical reasoning
- Connecting visual elements to specific points in your narrative
- Maintaining focus on the story while clarifying with visuals

**❌ Avoid:**
- Using visuals as standalone documentation without narrative context
- Creating excessive visual structure that interrupts story flow
- Fabricating metrics or performance data for visual elements
- Over-structuring with bullet points instead of explanatory prose

**🎯 Strategic Visual Integration:**
Place visual elements at key moments in your narrative where they genuinely clarify complex relationships, support technical reasoning, or help readers understand system behavior that would be difficult to grasp through text alone.
