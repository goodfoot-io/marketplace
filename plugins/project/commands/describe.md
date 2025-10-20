---
description: Generate comprehensive impact descriptions for project plans
---

<user>
```!
write-arguments "$ARGUMENTS"
```
</user>

# Purpose

Generate a comprehensive impact description document for an existing project plan. The description provides context, visualizes changes, and explains the "why" behind technical decisions to multiple audiences.

<context>
Working directory: !`pwd`
</context>

# Process Overview

1. **Locate Project** → Find the project and its latest plan
2. **Analyze Plan** → Extract key information from the plan
3. **Research Context** → Gather current state and impact analysis
4. **Generate Description** → Create impact document following structured format
5. **Version & Store** → Save with matching version number

# Step 1: Locate Project and Plan

## 1.1 Parse Arguments and Find Project

Use the same bash logic as expand.md to locate the project programmatically:

```!
ARGS=$(wait-for-arguments)

# Extract first line using parameter expansion
if [[ "$ARGS" == *$'\n'* ]]; then
    # Contains newlines - extract first line
    FIRST_LINE="${ARGS%%$'\n'*}"
else
    # Single line
    FIRST_LINE="$ARGS"
fi

# Extract first word as project name using parameter expansion
PROJECT_NAME="${FIRST_LINE%% *}"

# Get remaining arguments from first line if any (plan version)
if [ "$PROJECT_NAME" = "$FIRST_LINE" ]; then
    # No spaces found, so no plan version specified
    PLAN_VERSION=""
else
    # Extract everything after the first space (should be the plan version)
    PLAN_VERSION="${FIRST_LINE#* }"
fi

# Check if project name was provided
if [ -z "$PROJECT_NAME" ]; then
    echo "Error: No project name provided"
    echo "Inform the user to provide a project name and exit."
    exit 0
fi

# Search for the project in all project directories
PROJECT_PATH=""
for status_dir in projects/new projects/pending projects/active projects/ready-for-review projects/complete projects/icebox; do
    if [ -d "$status_dir/$PROJECT_NAME" ]; then
        PROJECT_PATH="$status_dir/$PROJECT_NAME"
        break
    fi
done

# If exact match not found, try to find a partial match
if [ -z "$PROJECT_PATH" ]; then
    for status_dir in projects/new projects/pending projects/active projects/ready-for-review projects/complete projects/icebox; do
        # Check if directory exists and is not empty
        if [ -d "$status_dir" ] && [ "$(ls -A "$status_dir" 2>/dev/null)" ]; then
            for project_dir in "$status_dir"/*; do
                if [ -d "$project_dir" ] && [[ "$(basename "$project_dir")" == *"$PROJECT_NAME"* ]]; then
                    PROJECT_PATH="$project_dir"
                    PROJECT_NAME=$(basename "$project_dir")
                    break 2
                fi
            done
        fi
    done
fi

# Check if project was found
if [ -z "$PROJECT_PATH" ]; then
    echo "Error: Project '$PROJECT_NAME' not found in any project directory"
    exit 0
fi

# Find the plan file to describe
if [ -n "$PLAN_VERSION" ]; then
    PLAN_FILE="$PROJECT_PATH/plan-v${PLAN_VERSION}.md"
else
    # Find latest plan version
    PLAN_FILE=$(ls -1 "$PROJECT_PATH"/plan-v*.md 2>/dev/null | sort -V | tail -1)
    # If no versioned plans, check for plan.md
    if [ -z "$PLAN_FILE" ] && [ -f "$PROJECT_PATH/plan.md" ]; then
        PLAN_FILE="$PROJECT_PATH/plan.md"
        PLAN_VERSION="1"  # Default to v1 for unversioned plans
    fi
fi

if [ ! -f "$PLAN_FILE" ]; then
    echo "Error: No plan file found for project '$PROJECT_NAME'"
    exit 0
fi

# Extract version number for description file
if [ -z "$PLAN_VERSION" ]; then
    PLAN_VERSION=$(echo "$PLAN_FILE" | grep -oE 'v[0-9]+' | grep -oE '[0-9]+')
fi
DESCRIPTION_FILE="$PROJECT_PATH/description-v${PLAN_VERSION}.md"
LOG_FILE="$PROJECT_PATH/log.md"

echo "# Project Located"
echo "- Name: $PROJECT_NAME"
echo "- Path: $PROJECT_PATH"
echo "- Plan: @$PLAN_FILE"
echo "- Description will be: $DESCRIPTION_FILE"
echo "- Log: @$LOG_FILE"
echo ""
```

# Step 2: Analyze Existing Plan

Read the plan file and extract key sections for the impact description.

## 2.1 Extract Plan Components

Parse the plan to identify:
- Problem statement
- Goals and objectives
- Scope (Include/Exclude)
- Technical approach
- Dependencies
- Risks

## 2.2 Identify Affected Systems

From the Technical Approach and Dependency Analysis sections, identify:
- Files that will be modified
- Systems that will be impacted
- Integration points
- High-dependency components

# Step 3: Research Current State (Parallel Analysis)

Execute comprehensive research through parallel investigations. Send ALL queries in ONE message:

<tool-use-template>
# PARALLEL EXECUTION: Analyze architecture and impact simultaneously

# Example: Assuming plan mentions modifying UserService and AuthMiddleware

# Note: Task with codebase-analysis subagent provides exhaustive results by default:
# - Complete code listings (not summaries)
# - All occurrences (not samples)
# - Line numbers and file paths
# - Actual code snippets

# Investigation 1: Current Architecture
Task({
  subagent_type: "codebase-analysis",
  description: "UserService and AuthMiddleware architecture",
  prompt: "Map the architecture for UserService at packages/api/src/services/user.service.ts and AuthMiddleware at packages/api/src/middleware/auth.ts including their interactions, usage patterns, data flow, and database queries"
})

# Investigation 2: Impact Analysis (runs in parallel)
Task({
  subagent_type: "codebase-analysis",
  description: "Impact of UserService and AuthMiddleware modifications",
  prompt: "What breaks if I modify UserService.getUserById() at packages/api/src/services/user.service.ts:45 and AuthMiddleware.validateToken() at packages/api/src/middleware/auth.ts:23?"
})

# Investigation 3: Integration Requirements (runs in parallel)
Task({
  subagent_type: "codebase-analysis",
  description: "UserService and auth system integration",
  prompt: "How do UserService at packages/api/src/services/user.service.ts and auth system at packages/api/src/middleware/auth.ts integrate with the application including API contracts, type definitions, data flow, and frontend expectations?"
})

# Investigation 4: Testing Infrastructure (runs in parallel)
Task({
  subagent_type: "codebase-analysis",
  description: "UserService and auth middleware tests",
  prompt: "What tests exist for UserService at packages/api/src/services/user.service.ts and auth middleware at packages/api/src/middleware/auth.ts including test database setup and user factory patterns?"
})
</tool-use-template>

**Important**: All four investigations above should be sent together for parallel execution.

## 3.3 Document Research Journey

Include condensed findings from the research phase, showing:
- Alternatives considered
- Constraints discovered
- Why certain approaches were chosen
- Trade-offs made

# Step 4: Generate Impact Description

## 4.1 Description Structure

Create the description following this structure:

```markdown
# Project Impact Description: [Project Title]
*Generated for plan-v[N].md*

## Executive Summary (TL;DR)
[2-3 sentences covering the why, what, and expected outcome]

## Developer Summary
[1 paragraph technical overview for engineering team]

## 1. Context: The Current Landscape

### System Overview
[High-level C4 Context diagram representation in text/ASCII]

### Current State
- **Architecture**: [Describe existing patterns]
- **Data Flow**: [How data moves through the system]
- **Pain Points**: [Specific issues being addressed]

### Design Decisions That Led Us Here
[Brief history of why things are the way they are]

## 2. The Change Story

### Why This Matters
[Connect to business/user needs - the "why" before the "what"]

### Problem in Plain Language
[Explain as if to a developer who joined yesterday]

### Success Looks Like
[Concrete, measurable outcomes from the plan's goals]

## 3. Research & Decision Journey

### Alternatives Explored
1. **Option A**: [Description]
   - Pros: [Benefits]
   - Cons: [Drawbacks]
   - Why rejected: [Reason]

2. **Option B**: [Description]
   - Pros: [Benefits]
   - Cons: [Drawbacks]
   - Why rejected: [Reason]

### Chosen Approach
**Decision**: [Selected approach from plan]
**Rationale**: [Why this approach wins]
**Trade-offs**: [What we're accepting]

## 4. Impact Visualization

### Component Impact Map
```
COMPONENT                  | IMPACT LEVEL | CHANGES REQUIRED
---------------------------|--------------|------------------
[Component A]              | 🔴 HIGH      | Major refactoring
[Component B]              | 🟡 MEDIUM    | Interface updates
[Component C]              | 🟢 LOW       | Config changes only
[Component D]              | ⚪ NONE      | No changes needed
```

### Dependency Chain
```
[ASCII diagram showing which components depend on changed components]
```

### Before/After Sequence
**Current Flow**:
```
User → Component A → Component B → Database
         ↓
      Component C
```

**New Flow**:
```
User → Component A → New Service → Component B → Database
         ↓              ↓
      Component C    Component D
```

## 5. Implementation Roadmap

### Phase 1: Foundation
[First set of changes from Technical Approach]
- Estimated complexity: [Low/Medium/High]
- Key files: [List with line counts]
- Migration needs: [Any data/config migrations]

### Phase 2: Core Changes
[Main implementation from Technical Approach]
- Estimated complexity: [Low/Medium/High]
- Key files: [List with line counts]
- Testing requirements: [Test coverage needed]

### Phase 3: Integration
[Final integration steps]
- Estimated complexity: [Low/Medium/High]
- Rollout strategy: [How to deploy safely]

## 6. Migration & Transition Guide

### For Existing Code
**Before** (current pattern):
```[language]
// Current implementation
[code example]
```

**After** (new pattern):
```[language]
// Updated implementation
[code example with comments explaining changes]
```

### Migration Checklist
- [ ] Update configuration files
- [ ] Migrate existing data
- [ ] Update dependent services
- [ ] Update documentation
- [ ] Notify downstream teams

## 7. Risk Management

### Watch Out For
[Extracted from Risks & Mitigations in plan, with additional context]

1. **[Risk Name]**
   - Likelihood: [High/Medium/Low]
   - Impact: [High/Medium/Low]
   - Mitigation: [Specific steps]
   - Early warning signs: [What to monitor]

## 8. Success Metrics

### Technical Metrics
- [ ] [Metric from plan goals]
- [ ] [Performance indicator]
- [ ] [Quality measure]

### Business Metrics
- [ ] [User-facing improvement]
- [ ] [Operational efficiency gain]

## 9. Broader Context

### Relationship to Other Initiatives
- **Depends on**: [Other projects that must complete first]
- **Enables**: [Future work this unblocks]
- **Related to**: [Parallel efforts]

### Long-term Vision
[How this fits into the technical strategy - is this step 1 of 5?]

## Appendices

### A. Detailed Technical Notes
[Deep-dive information for implementers]

### B. Testing Strategy
[Comprehensive test plan]

### C. Rollback Plan
[How to revert if needed]

---
*Reading time: ~5 minutes (main sections), ~15 minutes (with examples and appendices)*
```

## 4.2 Incorporate Plan Information

Map plan sections to description sections:
- Problem Statement → The Change Story
- Goals & Objectives → Success Metrics
- Technical Approach → Implementation Roadmap
- Risks & Mitigations → Risk Management
- Dependencies → Broader Context

## 4.3 Add Visual Elements

Include ASCII diagrams and tables to visualize:
- Component relationships
- Data flow changes
- Impact heat maps
- Migration sequences

# Step 5: Write Description File

## 5.1 Create Description

Write the generated description to the versioned file:

```!
# The description content will be generated based on the plan analysis
# and research results, then written to the description file
echo "[Generated description will be written to $DESCRIPTION_FILE]"
```

# Key Principles

1. **Context First**: Always establish the current state before describing changes
2. **Multiple Audiences**: Layer content for different reader needs
3. **Visual When Possible**: Use diagrams and tables for clarity
4. **Practical Guidance**: Include concrete migration steps
5. **Connect to Strategy**: Show how this fits the bigger picture
6. **Measurable Success**: Define clear metrics for completion

# Output Requirements

The generated description must:
- Match the plan version number
- Include all nine main sections
- Provide before/after comparisons
- Include migration guidance
- Define success metrics
- Estimate reading time
- Use visual elements (tables, ASCII diagrams)
- Connect technical changes to business value