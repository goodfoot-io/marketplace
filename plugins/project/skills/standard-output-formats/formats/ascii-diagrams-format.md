Use this component when:
- Explaining system architecture or component relationships
- Showing data flow through multiple stages
- Illustrating state machines or process flows
- Documenting API request/response cycles
- Creating diagrams that live with code in version control

**Example user message:**
Show me how data flows through our microservices architecture.

## Template

## [System/Flow Name] Architecture

### High-Level System Overview
```text
┌─────────────────────────────────────────────────────┐
│                   [System Name]                      │
│                                                      │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐ │
│  │ [Layer 1]│      │ [Layer 2]│      │ [Layer 3]│ │
│  │          │◄────►│          │◄────►│          │ │
│  └──────────┘      └──────────┘      └──────────┘ │
│        ▲                 ▲                 ▲        │
└────────┼─────────────────┼─────────────────┼────────┘
         │                 │                 │
    [External 1]      [External 2]      [External 3]
```

### Detailed Component Flow
```text
[Actor/Source]
      │
      ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  [Stage 1]  │────►│  [Stage 2]  │────►│  [Stage 3]  │
│   Process   │     │  Transform  │     │    Store    │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   [Error]   │
                    │   Handler   │
                    └─────────────┘
```

### Sequence Diagram
```text
[Client]        [API Gateway]      [Service]        [Database]
   │                  │                │                │
   ├─Request─────────►│                │                │
   │                  ├──Validate─────►│                │
   │                  │                ├──Query────────►│
   │                  │                │◄──Results──────┤
   │                  │◄──Format───────┤                │
   │◄──Response───────┤                │                │
   │                  │                │                │
```

### State Machine Diagram
```text
        ┌─────────┐
        │  START  │
        └────┬────┘
             │ [trigger]
             ▼
        ┌─────────┐      [condition A]     ┌─────────┐
        │ STATE 1 │─────────────────────────►│ STATE 2 │
        └────┬────┘                         └────┬────┘
             │ [condition B]                     │ [always]
             ▼                                   ▼
        ┌─────────┐                         ┌─────────┐
        │ STATE 3 │◄─────────────────────────│  END   │
        └─────────┘     [condition C]       └─────────┘
```

### Decision Tree
```text
                 [Initial Question]
                    /          \
                  Yes           No
                  /              \
          [Question 2]          [Question 3]
            /      \              /      \
          Yes      No           Yes      No
          /         \           /         \
    [Action A]  [Action B]  [Action C]  [Action D]
```
