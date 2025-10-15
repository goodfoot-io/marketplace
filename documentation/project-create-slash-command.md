# Project Create Slash Command System Documentation

## Overview

The `/project:create` command is a sophisticated slash command in Claude Code that orchestrates project planning through multiple specialized subagents. This document explains the architecture and workflow to facilitate future maintenance and development.

## System Architecture

### Core Components

#### 1. Slash Command (`/project:create`)
- **Location**: `/workspace/.claude/commands/project/create.md`
- **Type**: Project-level slash command with namespace
- **Purpose**: Create structured project plans with automated quality assessment
- **Key Features**:
  - YAML frontmatter configuration (description only)
  - Embedded bash command references
  - File path references to shared resources
  - Complex multi-phase workflow orchestration

#### 2. Subagents
Specialized AI agents invoked via the `Task` tool to handle specific aspects of project planning:

- **codebase-researcher** (`/workspace/.claude/agents/codebase-researcher.md`)
  - Analyzes technology stack, patterns, and integration points
  - Provides evidence-based findings with file:line references
  
- **assumption-tester** (`/workspace/.claude/agents/project/assumption-tester.md`)
  - Validates technical claims through empirical testing
  - Creates test files in project scratchpad directories
  - Returns structured YAML results with confidence levels
  
- **project-plan-assessor** (`/workspace/.claude/agents/project/project-plan-assessor.md`)
  - Evaluates plan quality against structural requirements
  - Provides Ready/Not Ready decisions with prioritized issues
  - Uses Opus model for thorough assessment
  
- **codebase-explainer** (`/workspace/.claude/agents/codebase-explainer.md`)
  - Generates technical explanations with diagrams
  - Creates description files for approved plans
  - Focuses on architectural reasoning

#### 3. Utility Scripts
Bash utilities that handle file operations and analysis:

- **initialize-project**: Creates project directory structure
- **create-plan-version**: Manages versioned plan files (plan-v1.md, plan-v2.md, etc.)
- **print-inverse-dependencies**: Analyzes file import counts for risk assessment
- **create-scratchpad-jest-test**: Sets up Jest test environments
- **create-scratchpad-playwright-test**: Sets up Playwright test environments

#### 4. Shared Resources
- **project-plan-annotated-example.md**: Template defining required plan structure
- **jest-mocking-guide.md**: Testing guidance (referenced but not directly used)

## Workflow Execution

### Phase 1: Requirements Analysis
1. Parse user request and determine if clarification needed
2. Initialize project directory via `initialize-project` utility
3. Append initial request to `log.md` using `mcp__file__append`
4. Research codebase using parallel `Task` invocations to subagents
5. Optionally validate assumptions with `assumption-tester`
6. Analyze dependencies with `print-inverse-dependencies`
7. Log research findings to project log

### Phase 2: Plan Creation
1. Structure plan following `project-plan-annotated-example.md`
2. Create versioned plan file with `create-plan-version`
3. Include all required sections in specific order

### Phase 3: Quality Assessment
1. Invoke `project-plan-assessor` via Task tool
2. Receive assessment report with priority-ranked issues
3. Interpret Ready/Not Ready decision

### Phase 4: Post-Assessment Actions
- **If Ready**: Generate description via `codebase-explainer`
- **If Not Ready**: Research issues and create revised plan version
- Loop back to Phase 3 for reassessment

## Key Design Patterns

### Subagent Invocation
```javascript
Task(description="Tech stack", 
     subagent_type="codebase-researcher",
     prompt="Identify React, Next.js, TypeScript versions...")
```

### Parallel Research
Multiple Task invocations can run simultaneously for efficiency:
- Technology stack research
- Pattern identification  
- Integration analysis
- Test discovery

### Version Management
- Plans are versioned automatically (plan-v1.md, plan-v2.md)
- Each version is self-contained without references to others
- Assessment drives revision cycles

### Logging Strategy
- Append-only logging to maintain history
- Never edit existing log entries
- Use `mcp__file__append` tool for all log operations

## Syntax Reference

### Embedded Bash Command Syntax

Slash commands can execute bash commands before running, with the output included in the command context using the `!` prefix with backticks:

```markdown
# Single command execution
!`git status`

# Command with pipes and options
!`git log --oneline -10`

# Complex command with multiple operations
!`git diff HEAD --name-only | grep -E '\.(ts|tsx)$'`
```

**Important Notes:**
- Use `!` prefix followed by backticks around the command
- Output is captured and inserted at that location in the prompt
- Commands execute in the workspace directory
- Must include `allowed-tools: Bash(command:*)` in frontmatter
- This is different from regular bash example blocks which use ` ```bash `

### File Reference Syntax (`@`)

The `@` prefix includes file contents directly in the command:

```markdown
# Reference single file
@src/utils/helpers.js

# Reference with full path
@/workspace/projects/new/my-project/plan-v1.md

# Reference multiple files in context
Compare @src/old-version.js with @src/new-version.js

# Reference pattern (expands to file list)
@packages/*/package.json
```

### Variable Substitution

#### In Slash Commands
```markdown
# $ARGUMENTS - User-provided arguments
Fix issue #$ARGUMENTS following our coding standards

# Usage: /fix-issue 123
# Becomes: Fix issue #123 following our coding standards
```

#### In Bash Commands (create.md)
```bash
# Shell variable assignment and usage
PROJECT_DIR=$(initialize-project "[PROJECT_NAME]")
echo "Project directory: $PROJECT_DIR"
echo "Project name: $(basename "$PROJECT_DIR")"
```

#### In Tool Function Calls
```
# Using shell variables in tool functions
mcp__file__append(
  file_path="$PROJECT_DIR/log.md",  # Can use shell variable if in bash context
  content="[NEW_LOG_ENTRY]"
)

# Or with absolute path
mcp__file__append(
  file_path="[ABSOLUTE_PROJECT_PATH]/log.md",
  content="[NEW_LOG_ENTRY]"
)
```

### Tool Invocation Syntax

These are examples of how tools are invoked within the command files (not actual code, but demonstration of the tool call format):

#### Task Tool (Subagent Invocation)
```
Task(description="Short description",
     subagent_type="agent-name",
     prompt="Detailed prompt with context")
```

#### Bash Tool
```
Bash(command="git status")
Bash(command="print-inverse-dependencies path/to/file.ts")
```

#### MCP Tool Functions
```
mcp__file__append(
  file_path="[ABSOLUTE_PATH]/log.md",
  content="Content to append"
)
```

**Note:** These are conceptual representations of tool usage within the command's instructions, not actual JavaScript or Python code.

### Markdown Code Block Patterns

#### In create.md - Different Block Types

**Bash Example Blocks** (for showing bash commands):
````markdown
```bash
# Initialize new project
PROJECT_DIR=$(initialize-project "add-user-auth")
```
````

**Tool Usage Demonstration** (no language specifier):
````markdown
```
Task(description="Tech stack", 
     subagent_type="codebase-researcher",
     prompt="Find versions")
```
````

**Embedded Bash Execution** (actually runs the command):
```markdown
!`git status`
!`git diff HEAD`
```

#### In Plan Files - Required Formats
```markdown
## Framework & Technology Stack
- Node.js: v20.11.0          # Must have 'v' prefix
- React: react@18.2.0        # Must use package@version format
- TypeScript: typescript@5.3.3  # Exact versions only
```

### YAML Frontmatter Syntax

#### Slash Commands
```yaml
---
allowed-tools: Bash(git:*), Read, Write  # Tool restrictions
description: Brief command description     # Shows in /help
argument-hint: <file-path> [options]      # Autocomplete hint
---
```

#### Subagents
```yaml
---
name: agent-name           # Kebab-case identifier
description: When to use    # Natural language trigger
tools: Read, Write, Bash   # Comma-separated or omit for all
model: sonnet              # sonnet or opus
color: blue                # UI color indicator
---
```

#### Project Plans (Optional)
```yaml
---
dependencies: 
  - other-project-name     # Blocking dependencies
preventAutoProgress: true  # Require user review
---
```

### Special Formatting Conventions

#### Line Number References
```markdown
# Existing file with specific line
packages/web/src/stores/notification-store.ts:12

# Approximate line reference
packages/api/src/services/auth.ts:around line 78

# New file indicator
packages/web/src/new-component.tsx (new file)
```

#### Import Count Notation
```markdown
## Dependency Analysis
- packages/shared/src/types/events.ts (743 imports)
- packages/web/src/hooks/use-websocket.ts (521 imports)
```

#### Checkbox Format for Goals
```markdown
## Goals & Objectives
- [ ] Create notification queue
- [ ] Implement WebSocket delivery
- [x] Completed goal (if tracking progress)
```

### Path Reference Patterns

#### Project Status Paths
```
projects/new/[project-name]/        # New projects
projects/pending/[project-name]/    # Awaiting dependencies
projects/active/[project-name]/     # In progress
projects/ready-for-review/[project-name]/  # Complete
```

#### Scratchpad Test Paths
```
projects/[status]/[project]/scratchpad/[test-name]/
projects/[status]/[project]/scratchpad/[test-name]/findings.md
```

### Conditional Logic in Commands

#### Assessment Interpretation
```markdown
#### If "Ready for Implementation: Yes"
1. Output assessment result
2. Generate description
3. Check for user feedback
4. If no feedback, HALT

#### If "Ready for Implementation: No"
**Only revise for CRITICAL or HIGH issues**
**Continue to Step 4**
```

## Configuration Details

### Slash Command Configuration
Full slash command structure with all features:

```markdown
---
allowed-tools: Bash(git:*), Read, Write, Task
description: Create project plans with assessment
argument-hint: <project-description>
---

## Context
- Current status: !`git status`
- Project structure: @.claude/shared/project-plan-annotated-example.md

## Task
Create a plan for: $ARGUMENTS
```

### Subagent Configuration
```yaml
---
name: agent-name
description: When to use this agent
tools: tool1, tool2  # Optional - inherits all if omitted
model: sonnet  # Optional model specification
color: blue  # Optional UI color
---

System prompt content here...
```

### Tool Access Control
- Subagents can be restricted to specific tools
- Omitting `tools` field inherits all available tools
- MCP tools are included when inherited

## Critical Constraints

1. **YAGNI Principle**: Include only what directly solves the problem
2. **No Time Estimates**: Exclude phases and resource allocations
3. **Mandatory Assessment**: Every plan must be assessed
4. **Append-Only Logging**: Never edit existing log content
5. **Version Verification**: Document framework/SDK versions
6. **Self-Contained Plans**: Each version stands alone

## File Path Conventions

- Project directories: `/workspace/projects/[status]/[project-name]/`
- Status types: new, pending, active, ready-for-review, complete, icebox
- Plan files: `plan-v[N].md` 
- Description files: `description-v[N].md`
- Test directories: `scratchpad/[test-name]/`
- Findings: `scratchpad/[test-name]/findings.md`

## Integration Points

### Producer-Consumer Relationships
1. `create-plan-version` → `project-plan-assessor` (plan validation)
2. `project-plan-annotated-example.md` → `create.md` (structure template)
3. `assumption-tester` → `create.md` (test results)
4. `codebase-researcher` → `create.md` (technology findings)
5. `project-plan-assessor` → `create.md` (revision decisions)

### Data Flow
```
User Request → create.md → Multiple Subagents (parallel)
                ↓
            Research Findings
                ↓
            Plan Creation
                ↓
            Assessment
                ↓
        Ready? → Description Generation
        Not Ready? → Revision Cycle
```

## Best Practices for Maintenance

### When Modifying create.md
1. Preserve the four-phase structure
2. Maintain parallel research patterns
3. Keep assessment as mandatory step
4. Ensure logging remains append-only
5. Test with both new and existing projects

### When Adding Subagents
1. Define clear, single responsibilities
2. Specify appropriate model (sonnet/opus)
3. Limit tool access to necessary ones
4. Include structured return formats
5. Document in agent description when to use

### When Updating Plan Structure
1. Modify `project-plan-annotated-example.md`
2. Update assessor's structural requirements
3. Ensure backward compatibility considerations
4. Test assessment of existing plans

## Common Issues and Solutions

### Issue: Plan repeatedly fails assessment
- Check if using exact version formats (package@version)
- Verify Node.js has 'v' prefix
- Ensure both Include and Exclude in Scope
- Confirm all required sections present

### Issue: Subagent not being invoked
- Verify subagent file exists in correct location
- Check description field matches use case
- Ensure Task invocation syntax is correct
- Confirm subagent has required tools

### Issue: Circular revision cycles
- Only revise for CRITICAL/HIGH issues
- Skip LOW priority style suggestions
- Ensure clear revision triggers
- Verify assessment interpretation logic

## Future Enhancement Considerations

When extending this system:
1. Maintain separation of concerns between phases
2. Preserve the parallel research capability
3. Keep assessment independent from creation
4. Ensure version management stays automatic
5. Maintain the append-only log pattern
6. Consider adding new specialized subagents rather than overloading existing ones
7. Test thoroughly with various project types and edge cases

## Summary

The `/project:create` command exemplifies Claude Code's sophisticated orchestration capabilities, combining slash commands, specialized subagents, utility scripts, and structured templates into a cohesive project planning system. Its multi-phase approach with quality gates ensures consistent, high-quality project plans while maintaining flexibility for various project types and iterative refinement.