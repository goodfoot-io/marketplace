---
description: Analyze component chains using extract-inputs-and-outputs command to identify integration incompatibilities
---

Systematically analyze interconnected components to map their inputs and outputs, then compare these to identify format mismatches that cause integration failures.

<user-message>
```xml
<!-- Use write-arguments utility to synchronize user arguments -->
<invoke name="Bash">
<parameter name="command">ESCAPED_ARGUMENTS=$(echo "$ARGUMENTS" | sed 's/@/\\@/g'); echo $(write-arguments "$ESCAPED_ARGUMENTS")

<additional-resources>
- Slash Commands: @documentation/claude-code-slash-commands.md in @.claude/commands
- Subagents: @documentation/claude-code-subagents.md in @.claude/agents
- Local Utilities: @.devcontainer/utilities
- Dev Container Configuration: @.devcontainer
</additional-resources>

<report-file-path>
Save report to: @reports/chain-analysis/[target]-[timestamp].md

Format: kebab-case target, current timestamp: !`date +%Y-%m-%d-%H%M%S`
</report-file-path>

# Task

Analyze integration compatibility between components.

## Phase 1: Map Integration Chain

**Purpose**: Identify all components and their relationships in the integration chain by tracing actual execution flow and explicit references.

Use the Task tool function to invoke a `general-purpose` subagent to map the integration chain.

```xml
<invoke name="Task">
<parameter name="description">Map integration chain components and relationships</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt">Follow the instructions in @.claude/commands/utilities/map-integration-chain.md replacing !`echo '$AR''GUMENTS'` with: "!`wait-for-arguments`"</parameter>
</invoke>
```

## Phase 1.5: Analyze Utility Script Behavior

**Purpose**: Understand how utility scripts transform data and resolve integration gaps that might appear as incompatibilities.

Use the Task tool function to invoke a `general-purpose` subagent to analyze utility script behavior.

```xml
<invoke name="Task">
<parameter name="description">Analyze utility scripts in integration chain</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt">Analyze utility scripts identified in Phase 1:

For each utility script in the integration chain:
1. Read the actual implementation
2. Document input/output transformations
3. Identify file operations (create, move, rename, delete)
4. Map data flow changes the utility makes
5. Note any format conversions or adaptations
6. Identify integration gaps the utility resolves

Focus on: @.devcontainer/utilities directory and any bash utilities invoked in the chain.

Output format:
### Utility: [script-name]
- **Input**: [what it receives]
- **Transformations**: [what it changes]
- **Output**: [what it produces]
- **Integration Impact**: [how it affects producer-consumer relationships]
- **Gap Resolution**: [apparent incompatibilities this utility resolves]</parameter>
</invoke>
```

## Phase 2: Research Producer-Consumer Pairs

**Purpose**: Compare files to determine genuine integration incompatibilities while recognizing Claude Code design patterns.

For each producer-consumer pair identified in Phase 1, use the Task tool function to invoke a `general-purpose` subagent to identify inconsistencies or incompatibilities.

Replace `[PRODUCER_FILE]` with the file path of the producer, `[CONSUMER_FILE]` with the file path of the consumer, and `[RELATIONSHIP]` with a brief description of how the producer interacts with the consumer.

When analyzing multiple pairs, combine all Task tool function calls into a single message to run them in parallel.

```xml
<invoke name="Task">
<parameter name="description">[PRODUCER_FILE] -> [CONSUMER_FILE] (context-aware)</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt">Follow the instructions in @.claude/commands/review/producer-consumer.md replacing !`echo '$AR''GUMENTS'` with: "
  - Producer: @[PRODUCER_FILE]
  - Consumer: @[CONSUMER_FILE]
  - Relationship: [RELATIONSHIP]
  - Analysis Mode: Claude Code Context-Aware

  CRITICAL: Before flagging incompatibilities, verify these are not Claude Code design patterns:

  **Claude Code Pattern Recognition**:
  - Task() calls: Standard Claude processing, not parsing errors
  - @ file references: Intentional context management syntax
  - Agent autonomy: Format/technique selection flexibility is intentional
  - Response-based outputs: Standard agent communication pattern
  - Bash utility integration: May resolve apparent format mismatches

  **Evidence Requirements**:
  - Concrete failure scenario with specific error conditions
  - Verification that no utility scripts resolve the mismatch
  - Proof of actual processing failure, not theoretical format differences
  - Consumer parsing/validation code that would break

  **Multi-Format Check**:
  - Verify if producer supports multiple output formats
  - Check if ANY producer format aligns with consumer expectations
  - Document format selection mechanisms

  **Classification Standards**:
  - Critical: Prevents successful integration with concrete evidence
  - Major: Requires manual intervention with processing impact
  - Minor: Cosmetic differences with no functional impact
  - Design Feature: Intentional pattern that enables flexibility (exclude from incompatibilities)"</parameter>
</invoke>
```

## Phase 2.5: Verification and Classification

**Purpose**: Validate identified incompatibilities and classify them by severity and evidence strength before reporting.

Use the Task tool function to verify and classify findings:

```xml
<invoke name="Task">
<parameter name="description">Verify and classify integration issues</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="prompt">Review all incompatibilities identified in Phase 2.

For each reported incompatibility:

**Verification Checklist**:
1. **Design Pattern Check**: Is this a standard Claude Code pattern?
2. **Evidence Validation**: Is there concrete proof of integration failure?
3. **Utility Resolution**: Do any utility scripts resolve this mismatch?
4. **Impact Assessment**: Would this actually prevent successful operation?
5. **Alternative Formats**: Does producer support other formats that align?

**Classification Criteria**:
- **Verified Critical**: Concrete integration blocker with evidence
- **Verified Major**: Workflow impact with processing evidence
- **Verified Minor**: Quality issue with minimal impact
- **Design Feature**: Intentional pattern (remove from report)
- **Insufficient Evidence**: Needs deeper investigation (flag for review)

**Output Requirements**:
- Only include issues that pass verification
- Provide evidence summary for each verified issue
- Document any design patterns discovered
- Note utility scripts that resolve apparent mismatches

Format output as verified issue classifications with evidence summaries.</parameter>
</invoke>
```

## Phase 3: Output Enhanced Report

**Purpose**: Generate comprehensive analysis report with verified findings and evidence documentation.

The report should follow this structure:

<enhanced_report_structure>
### Chain Analysis: [Target] 

### Executive Summary
- Components analyzed: [count and types]
- Verified incompatibilities: [count by severity] 
- Design patterns recognized: [count]
- Integration status: [overall assessment]

### Integration Architecture Analysis
**Claude Code Patterns Identified**:
- Task-mediated integrations: [list]
- Agent autonomy implementations: [list]  
- Context management (@-syntax): [list]
- Utility script transformations: [list]

### Data Flow Analysis
```
1. Input Stage
   - User provides: [format]
   - Processing through: [Claude Code layers]
   
2. Transformation Stage  
   - Utility scripts involved: [list with transformations]
   - Format adaptations: [specific changes]
   
3. Integration Stage
   - Producer output: [verified format]
   - Consumer expectations: [actual requirements] 
   - Integration mechanism: [Task/direct/utility-mediated]
   - Result: [verified success/failure with evidence]
```

### Verified Integration Issues

#### Critical Issues [Evidence: High]
**Only include issues with concrete integration failure proof**
- Issue: [specific problem]
- Evidence: [failure scenario, error conditions, code references]
- Impact: [how it prevents integration]
- Resolution Required: [specific fix needed]

#### Major Issues [Evidence: Medium] 
**Issues with processing impact and supporting evidence**
- [Same format as Critical]

#### Minor Issues [Evidence: Low]
**Quality/consistency issues with minimal impact**
- [Same format but note minimal impact]

### Recognized Design Patterns
**Intentional features that appeared problematic but are working as designed**
- Pattern: [Claude Code architectural pattern]
- Justification: [why it's intentional]
- Benefits: [flexibility/functionality enabled]

### Utility Script Integration Analysis
**Scripts that resolve apparent incompatibilities**
- Script: [name and path]
- Resolution: [how it addresses format/integration gaps]
- Integration Impact: [effect on producer-consumer relationships]
</enhanced_report_structure>

**Do not include a root cause analysis or recommendations in your report.**