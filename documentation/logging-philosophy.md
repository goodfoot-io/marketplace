# Shared Logging Philosophy

This document outlines the common logging principles and practices shared across all Claude Code agents.

## Core Principles

### Append-Only Architecture
**Fundamental Rule**: Always append to logs using `echo` commands with quotes. Never edit existing log entries - only append new ones to correct or clarify.

### Purpose
The log serves as collective memory, creating a shared narrative between agents working on the same project. Each entry helps subsequent agents understand the current state, decisions made, and reasoning behind those decisions.

### Standard Location
- Active projects: `projects/active/[PROJECT-NAME]/log.md`
- New projects: `projects/new/[PROJECT-NAME]/log.md`

## Technical Implementation

### Echo Pattern
All agents use this pattern for logging:

```bash
# Multi-line content
echo "
## [Section Title]

[Log content here]" >> projects/[active|new]/[PROJECT-NAME]/log.md

# Single-line content
echo "Log entry" >> projects/[active|new]/[PROJECT-NAME]/log.md
```

### Best Practices
- Use quotes to wrap content
- Opening quote on echo line for multi-line
- Closing quote on last content line
- Use >> for append (not >)

## Writing Style

### Perspective
- **First person** for own work: "I discovered...", "I implemented...", "I found that..."
- **Second person** for handoffs: "You'll need to...", "You should consider..."

### Tone
Write as if briefing a colleague who will continue the work. Be conversational yet professional, focusing on discoveries, decisions, and deviations from expectations.

### Entry Length
- **Simple updates**: A few sentences
- **Complex decisions**: 1-2 paragraphs
- Keep entries focused but complete

## When to Log

### Always Log These Events
- Decisions affecting the approach
- Unexpected discoveries
- Corrections to initial understanding
- Reasoning for choosing one approach over another
- Patterns worth replicating across projects
- Major milestone completions
- Blockers that change project direction
- User feedback received
- Handoffs to the next agent

### Examples of Log-Worthy Moments

**Discovery**:
```
I discovered that the API actually returns arrays, not objects as documented. This changes our parsing approach...
```

**Decision with Reasoning**:
```
I considered using a factory pattern here, but went with a simple function because we only have one use case. If we need more flexibility later...
```

**Pattern Recognition**:
```
The error handling approach used in the auth module is comprehensive and caught several edge cases. This should be our standard pattern...
```

**Course Correction**:
```
I initially thought the performance issue was in the database layer, but profiling showed it was actually in the serialization logic...
```

## When NOT to Log

### Skip These Items
- Routine progress updates ("Completed step 3 of 5")
- Unchanging metrics ("Tests still passing")
- Tool invocations ("Running yarn test")
- Project plan restatements
- Internal implementation details that don't affect subsequent agents

## Log Entry Structure

### Standard Format
1. **Section header**: `## Progress Update`, `## Implementation Progress`, `## Assessment Complete`
2. **Brief statement**: What was done or discovered
3. **Explanation**: Why it matters
4. **Implications**: Any effects on future work

### Quality-Focused Entries
Emphasize logging:
- Test results and coverage metrics
- Integration success or failures
- Blockers and their impact
- Production readiness assessments
- Security vulnerabilities found
- Performance bottlenecks identified

## Shared Narrative Philosophy

The log creates a continuous story across agents:
- Each agent builds on previous work
- Context provides understanding of not just *what* but *why*
- Emphasis on surprises, learnings, and course corrections
- Future agents can trace the evolution of decisions

## Best Practices

1. **Be Specific**: Reference exact files, line numbers, and error messages
2. **Explain Reasoning**: Always include the "why" behind decisions
3. **Think Forward**: Write for the agent who will read this next
4. **Stay Relevant**: Only log information that affects project outcomes
5. **Maintain Continuity**: Read previous logs before starting work

## Common Log Sections by Agent Type

### Project Implementer
- `## Implementation Progress`
- `## Test Results`
- `## Integration Update`

### Implementation Evaluator
- `## Quality Assessment Complete`
- `## Production Readiness Check`
- `## Security Analysis`

### Project Plan Assessor
- `## Assessment Result`
- `## Structural Compliance`
- `## Overengineering Assessment`

## Error Prevention

### Common Mistakes to Avoid
1. **Missing quotes**: Ensure content is properly quoted
2. **Editing previous entries**: Always append, never modify
3. **Overly verbose entries**: Keep focused on what matters
4. **Missing handoff instructions**: Always guide the next agent
5. **Duplicate information**: Don't restate what's in other files

This shared logging philosophy ensures consistency across all agents, maintains project continuity, and creates a comprehensive audit trail of decisions and discoveries throughout the project lifecycle.