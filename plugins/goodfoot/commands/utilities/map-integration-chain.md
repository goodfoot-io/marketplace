---
description: Map integration chain from entry point by tracing invocations
allowed-tools: LS, Read
---

Map the integration chain for the file specified in: $ARGUMENTS

# Instructions

Starting from the entry point file, trace forward through all components it invokes to build a complete picture of the integration chain.

**Important**: Do not `Search` for files during this process. You may use the `LS` tool.

1. Begin with the specified file as your entry point
2. Read the file and identify all invocations it makes:
   - Task(...subagent_type=...) calls to subagents
   - Bash(...command=...) calls to utilities
   - @path/to/file references to included files
   - Embedded bash commands (! prefix)
3. For each component found, repeat the process recursively
4. Track the relationships between components - who invokes whom
5. Document the data flow and dependencies

# Constraints
- Only trace forward from the entry point (don't look for what calls it from outside)
- Only include components discovered through direct invocation
- Focus on actual execution flow, not just references


# Output Format (as message)

```
## Integration Chain Components

### Component: [name]
- **File**: [exact path]
- **Invokes**: [list what it calls with invocation method]
- **Invoked by**: [component in the discovered chain that calls it]
- **Produces**: [what output it generates]
- **Consumes**: [what input it expects]

### Data Flow Diagram
[Show the actual execution flow with arrows]

### Files to Analyze
List all files that need detailed structural analysis:
- [file1.md]
- [file2.md]
- [file3.md]

### Producer-Consumer Pairs
List pairs that need comparison:
1. Producer: [file] → Consumer: [file]
2. Producer: [file] → Consumer: [file]
```