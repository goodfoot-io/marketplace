---
description: Create project plans with automated quality assessment
---

```!
mkdir -p projects/new projects/pending projects/active projects/ready-for-review projects/complete projects/icebox
```

<user-message>
$ARGUMENTS
</user-message>

Create a structured project plan for the user's request, then assess its quality. If issues exist, revise the plan. Ultrathink. 

Review the plan skill immediately to access plan structure and requirements: @!`echo "${CLAUDE_PLUGIN_ROOT}"`/skills/plan/SKILL.md

<core-constraints>
1. **YAGNI (You Aren't Gonna Need It)**: Include only what directly solves the problem
2. **No estimates**: Exclude time estimates, phases, or resource allocations
3. **Mandatory assessment**: You must assess every plan using the Task tool
4. **Append-only logging**: Never edit existing log content. Always append new entries to the project log using the Bash tool with heredoc formatting
5. **Version verification**: Always identify and document framework/SDK versions before feature work
6. **Self-contained plans**: Each plan must be a complete, independent document without references to other plan versions
</core-constraints>

<command-reference>
```bash
# Initialize new project (using plugin binary)
PROJECT_DIR=$(!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/initialize-project "[PROJECT_NAME]")

# To append to project log (never edit existing content), use the Bash tool with heredoc:
# Note: Use $PROJECT_DIR if available from bash context, otherwise use absolute path
cat >> "[ABSOLUTE_PROJECT_PATH]/log.md" <<'EOF'
[NEW_LOG_ENTRY]
EOF

# Create or update plan (auto-versioned, using plugin binary)
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/create-plan-version "[PROJECT_NAME]" "[PLAN_CONTENT]"
```
</command-reference>

---

<request-parsing-guidelines>
Understand the user's intent and ensure the request is actionable.

### Extract Key Information
- **What**: The specific problem to solve or feature to build
- **Why**: The goal or value this delivers
- **Scope**: What's included and what's explicitly out of bounds
- **Success**: How we'll know it's working correctly

### When to Ask for Clarification

Stop and ask for clarification if:
- The desired outcome is undefined ("make it better")
- Multiple valid interpretations exist with significantly different implications
- Critical technical details are missing (e.g., which API version, what performance target)
- Requirements contradict each other

Proceed with documented assumptions if the ambiguity only affects implementation details, not the core goal.

**Action**: If the core intent is unclear, ask specific questions and stop. Otherwise, document your understanding and continue.
</request-parsing-guidelines>

<logging-guidelines>
1. **Capture Everything**: Manually capture everything the user has communicated, not just arguments. This includes:
   - The complete original request
   - Any clarifications or additional context provided
   - Constraints or preferences mentioned
   - Examples or references shared
2. **Preserve Context**: Document any back-and-forth clarifications or additional requirements
3. **State Assumptions**: Make your interpretation explicit so issues can be caught early
4. **Use Specifics**: Include file names, error messages, test names, and other concrete details
5. **Note Urgency**: If the user indicates timeline or blocking issues, document them
6. **Log Decisions**: For significant technical decisions, append a Decision Record to the project log:
   ```bash
   cat >> "[ABSOLUTE_PROJECT_PATH]/log.md" <<'EOF'
   ## Decision Record - [timestamp]

   ### Decision
   [What was decided]

   ### Context
   [What triggered this decision]

   ### Rationale
   [Why this choice was made]

   ### Alternatives Considered
   | Alternative | Rejected Because |
   |-------------|------------------|
   | [Option] | [Reason] |

   ### Impact
   - Affects: [components]
   - Plan sections: [affected sections]
   EOF
   ```
</logging-guidelines>

<research-patterns>
### File Path Verification Protocol
**Verify line numbers when referencing existing code for precision.**

For EVERY file path you plan to include, you MUST verify in this exact sequence:

```xml
<!-- Step 1: Find the file (if unsure of exact path) -->
<invoke name="Glob">
<parameter name="pattern">**/filename.ts</parameter>
</invoke>

<!-- Step 2: Get dependency count (for impact assessment) - REQUIRED -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What files depend on packages/website/app/hooks/yjs.ts and what is the impact if it changes?</parameter>
</invoke>

<!-- Step 3: Read for line numbers (when planning modifications) -->
<invoke name="Read">
<parameter name="file_path">/workspace/packages/website/app/hooks/yjs.ts</parameter>
</invoke>
<!-- Only use "new file" for files that don't exist yet -->
```

#### When to Use Sequential vs Parallel Research
- **Sequential**: When each query depends on previous results or exploring unknown areas
- **Parallel**: When queries are independent (most common case - default to this)

#### Core Research Pattern (Parallel Execution)
When investigating multiple independent aspects, execute codebase analysis in parallel using a single message with multiple tool invocations:

```xml
<!-- PARALLEL EXECUTION: Send all these tool calls in ONE message for simultaneous analysis -->
<!-- Note: The tool provides exhaustive results by default - complete code, all occurrences, line numbers -->

<!-- First investigation - overall architecture -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">How is user authentication implemented in packages/api/src/auth including framework versions, auth flow, and entry points?</parameter>
</invoke>

<!-- Second investigation - implementation patterns (runs in parallel) -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What authentication and authorization patterns exist in packages/api including middleware functions, route protection, and role-based access?</parameter>
</invoke>

<!-- Third investigation - dependencies and impact (runs in parallel) -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What would be affected if I change the auth system at packages/api/src/auth/?</parameter>
</invoke>

<!-- Fourth investigation - testing infrastructure (runs in parallel) -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What auth-related tests exist in packages/api/tests/ and packages/api/src/**/*.test.ts including test database setup and token handling?</parameter>
</invoke>
```

**Important**: All four investigations above should be sent in a SINGLE message to run in parallel, not sequentially.
</research-patterns>

<technical-spike-guidelines>
#### When to Conduct Technical Spikes

Use technical spikes to resolve critical technical uncertainties through empirical testing. The key decision is whether the technology/approach has been chosen:

**Technology NOT chosen** → Compare alternatives (e.g., WebSocket vs SSE vs polling, React Query vs SWR vs Apollo)
- Multiple viable approaches exist (2-3 alternatives)
- Prototyping would reveal material differences
- Decision significantly impacts architecture

**Technology already chosen** → Validate it works (e.g., Does Socket.io v4.6.1 support Redis adapter?)
- Specific capability or compatibility uncertain
- Version-specific behavior needs verification
- Integration between libraries needs validation

For detailed spike methodology, result formats, and quality criteria, use the Technical Spike skill (see "Spike Invocation Pattern" section below).

##### When to Skip Spikes

Skip technical spikes for:
- **Well-documented standard features**: Official documentation clearly confirms capability with working examples
- **Existing codebase patterns**: Your project already uses the pattern successfully
- **Standard operations**: Known JavaScript/TypeScript features (Array methods, Promise API, etc.)
- **Premature investigation**: Technology selection hasn't been considered yet (research codebase first)

#### Spike Invocation Pattern

When conducting technical spikes, use the Technical Spike skill to orchestrate the investigation:

```xml
<invoke name="Skill">
<parameter name="skill">project:spike</parameter>
</invoke>
```

Then provide the spike details in your message to the skill:

**For Comparison Spikes** (testing multiple approaches):
```
Compare [Approach A], [Approach B], and [Approach C] for [use case].
Compare [criterion 1], [criterion 2], and [criterion 3].
Use scratchpad path `scratchpad/[test-name]/`
```

**For Validation Spikes** (testing single approach):
```
Verify [Library@version] supports [specific capability/feature].
Use scratchpad path `scratchpad/[test-name]/`
```

The spike skill will handle:
- Structuring the appropriate context for the subagent
- Launching the investigation with proper isolation
- Validating result quality
- Guiding incorporation of findings into the plan

The spike skill provides detailed guidance on:
- Reviewing spike artifacts and validating result quality
- Checking for quality issues and requesting revisions if needed
- Incorporating findings into the plan's Technical Spike Results and Technical Approach sections
</technical-spike-guidelines>

<dependency-analysis-requirements>
#### Finding Dependencies (REQUIRED)
After researching the codebase, identify critical dependencies:

1. **MANDATORY**: Analyze dependencies for high-impact files using:
```xml
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What are the dependencies for packages/api/src/auth/middleware.ts and what needs updating if the interface changes?</parameter>
</invoke>
```

2. **MANDATORY**: Include the exact count in parentheses: "file.ts (23 imports)"
3. Note external libraries needed (check if already in package.json)

**Include import counts to assess change impact and risk.**

#### Impact Assessment
Use these thresholds to assess risk:
- 100+ imports: Very high risk, changes affect large portions of codebase
- 50-99 imports: High risk, careful testing needed
- 20-49 imports: Moderate risk, worth noting
- 5-19 imports: Include if it's a critical integration point
</dependency-analysis-requirements>

<plan-structure-requirements>
Create your plan following the EXACT structure defined in @!`echo "${CLAUDE_PLUGIN_ROOT}"`/skills/plan/SKILL.md, which provides:
- Complete section structure and order
- Required subsections (especially Scope's Include/Exclude)
- Formatting requirements for each section
- Examples of properly formatted content
</plan-structure-requirements>

<format-flexibility>
## Version Format Flexibility

Version formats are flexible. Focus on having specific versions documented.
Common variations are all acceptable - the assessor recognizes multiple formats:
- Node.js: v20.11.0 or 20.11.0
- React: react@18.2.0 or 18.2.0
- Exact versions preferred over ranges for reproducibility
</format-flexibility>

<assessment-interpretation>
The assessor uses the Quality Assessment section of the `project:plan` skill for detailed quality methodology.
Quality dimensions evaluated include:
- Requirement clarity (vague language detection)
- Internal coherence (cross-section consistency)
- Rationale presence (decision documentation)
- Scope integrity (YAGNI compliance)
- Testability (verifiable criteria)
- Evolution readiness (living document structure)

The assessor provides:
- Structural compliance check
- Overengineering assessment
- Technical spike validation review
- **Ready for Implementation: Yes/No/Yes (with suggestions)**
- Specific improvement recommendations

**Assessment Priority Levels:**
- **CRITICAL**: Technical accuracy, missing dependencies, architectural soundness
- **MEDIUM**: Implementation clarity, risk coverage, dependency analysis, missing version information
- **LOW**: Version format variations (v prefix, @ notation), line number precision, style consistency

#### If "Ready for Implementation: Yes" or "Ready for Implementation: Yes (with suggestions)"

1. Output the full assessment result (including any style suggestions)
2. Generate a description for the approved plan, where description-v[N].md correlates to the plan version, i.e. `plan-v2.md` would have `description-v2.md`:
   ```xml
   <invoke name="Task">
   <parameter name="description">Describe Plan</parameter>
   <parameter name="subagent_type">project:codebase-explainer</parameter>
   <parameter name="prompt"><project>
Name: [PROJECT_NAME]
Directory: @projects/[STATUS]/[PROJECT_NAME]
Plan: @projects/[STATUS]/[PROJECT_NAME]/[PLAN_FILE]
Log: @projects/[STATUS]/[PROJECT_NAME]/log.md
</project>

Create a technical project explanation and output to `projects/[STATUS]/[PROJECT_NAME]/description-v[N].md`

Create a concise narrative technical explanation with these constraints:

**Length Limits:**
- Target: 2x the word count of plan.md
- Maximum 5 main sections (including the 3 required sections below)
- No subsections deeper than one level (## sections only, avoid ###)

**Required Structure:**
1. **Current State**: How existing systems work today and what will change
2. **Desired State**: How systems will work after implementation
3. **Technical Approach**: What will be changed and the new functionality

**Include Visualizations For:**
- Data flows between multiple components
- Integration points and system boundaries
- Observer patterns and event subscriptions
- Sequential processes with decision points
- System architectures with clear component relationships
- Decision trees for conditional logic
- State transitions and process changes

**Visual Integration Requirements:**
- Embed diagrams directly without ```text code blocks
- Include specific file paths to ground technical explanations
- Vary diagram types for visual texture and clarity
- Verify accuracy of statements about current user workflows

**Exclude These Length-Adding Elements:**
- Future evolution or enhancement sections
- Performance speculation without measurements
- Security considerations unless directly relevant to architectural decisions
- Multiple "Why X over Y" comparison sections
- Conclusion or summary sections that restate content

Focus on technical precision and architectural reasoning. Avoid marketing language.

Research the codebase to understand current system behavior and architectural patterns that inform the technical decisions.</parameter>
   </invoke>
   ```
3. **Check for user feedback** - If user provides corrections or clarifications:
   - Log feedback using the Bash tool with heredoc to append to [ABSOLUTE_PROJECT_PATH]/log.md
   - Proceed to Step 4 to address the feedback
4. If no user feedback, HALT - the plan is complete

**Do not implement the project plan.**

#### If "Ready for Implementation: No"
**Only revise plans for CRITICAL or HIGH priority issues. Do not revise for style suggestions.**
**Continue to Step 4.**
</assessment-interpretation>

<revision-research-patterns>
Address issues identified by the assessor or user. Execute multiple investigations in PARALLEL when addressing multiple issues:

#### Parallel Revision Research (send all in ONE message)
```xml
<!-- PARALLEL EXECUTION: Address multiple issues simultaneously -->
<!-- Note: Tool provides complete code and exact counts by default -->

<!-- Issue 1: Incorrect File Paths (example from assessment: "UserService not found") -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">Where is the UserService class located in packages/api/src/ and are there any duplicate classes?</parameter>
</invoke>

<!-- Issue 2: Missing Dependencies (runs in parallel) -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What are the dependencies for packages/api/src/services/user.service.ts including npm packages and circular dependencies?</parameter>
</invoke>

<!-- Issue 3: Pattern Examples (runs in parallel) -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What Repository pattern implementations exist in packages/api/src/ including interface definitions and database connections?</parameter>
</invoke>

<!-- Issue 4: Integration Points (runs in parallel) -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">How do packages/api and packages/web integrate for authentication including endpoints, token handling, and error patterns?</parameter>
</invoke>
```

**Important**: When addressing multiple revision issues, investigate them in parallel by sending all queries in a single message.

#### For Validating Technical Claims

When the assessor flags unvalidated assumptions, conduct technical spikes following the methodology in the <technical-spike-guidelines> section above.

</revision-research-patterns>


## Phase 1: Requirements Analysis

### Step 1: Parse User Request
If the core intent is unclear, ask specific questions and stop. Otherwise, document your understanding and continue.

### Step 2: Initialize Project Directory

```bash
# Replace "add-user-auth" with your actual project name
# Project name must be kebab-case (lowercase letters, numbers, hyphens only), max 50 characters
PROJECT_DIR=$(!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/initialize-project "add-user-auth") && echo "Project directory: $PROJECT_DIR" && echo "Project name: $(basename "$PROJECT_DIR")"
```

This command will:
- Return existing project path if found in new/pending/active/ready-for-review
- Create new project in `projects/new/` if not found
- Initialize `log.md` file with basic header

Verify initialization succeeded before proceeding.

### Step 3: Log User Request

Immediately append the user's request and your initial understanding to the project log. Capture ALL context, not just the command arguments:

```bash
cat >> "[ABSOLUTE_PROJECT_PATH]/log.md" <<'EOF'
## User Request

"[Copy the user's exact request verbatim, including all details]"

Additional context from the conversation:
- [Any clarifications the user provided]
- [Constraints or preferences mentioned]
- [Specific examples or references shared]
- [Related issues or background discussed]

## Initial Understanding

The user wants me to [concise summary of the goal and expected outcome].

Key aspects of this request:
- [Main requirement or problem to solve]
- [Scope or boundaries of the solution]
- [Technical constraints or requirements]
- [Any assumptions about unstated requirements]
EOF
```

### Step 4: Research Technical Context and Determine Spike Needs

Execute parallel investigations to understand different aspects of the codebase simultaneously. Send ALL these tool calls in a SINGLE message:

```xml
<!-- PARALLEL EXECUTION: Send all tool calls together for maximum efficiency -->

<!-- Investigation 1: Technology and architecture -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What is the technology stack for OAuth authentication in packages/api including current auth framework and strategies?</parameter>
</invoke>

<!-- Investigation 2: Implementation patterns (parallel) -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What authentication implementations exist in packages/api/src/auth/ including endpoints, middleware, session handling, and password logic?</parameter>
</invoke>

<!-- Investigation 3: Dependencies and integration (parallel) -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">Map dependencies for adding OAuth to packages/api/src/auth/ including files needing modification, web integration, and schema changes</parameter>
</invoke>

<!-- Investigation 4: Testing and validation (parallel) -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What authentication testing patterns exist in packages/api/tests/ including test files, user creation, database setup, and token handling?</parameter>
</invoke>
```

**Key Point**: The above investigations are independent and should run in parallel by sending them all in one message, not one at a time.

### Step 4.5: Non-Functional Requirements Check

Before proceeding to plan creation, verify coverage of non-functional requirements:

- [ ] **Performance**: Latency targets, throughput requirements
- [ ] **Reliability**: Uptime expectations, error handling approach
- [ ] **Security**: Authentication, authorization, data protection needs
- [ ] **Scalability**: Concurrent user targets, data growth projections

If any NFR is critical to acceptance, ensure it appears in Goals or Validation Commands.

**After research, determine spike needs:**

1. **If existing pattern identified**:
   - Technology/approach already chosen by codebase
   - Proceed to Step 5 for tactical spike if capability/compatibility uncertain
   - Skip Step 5 if pattern is well-established

2. **If no clear pattern OR greenfield feature**:
   - Consider strategic spike (Step 5) if multiple viable alternatives exist
   - Make architectural decision if alternatives are limited
   - Then proceed to tactical spike to validate chosen approach

3. **If well-documented standard feature**:
   - Skip spikes entirely
   - Proceed to Step 6 (dependency analysis)

### Step 5: Conduct Technical Spikes (When Needed)

Based on Step 4 determination, conduct spikes to resolve critical technical unknowns:

**Strategic Spikes** (when technology/approach not chosen):
- Compare 2-3 viable alternatives through lightweight prototypes
- Document comparison criteria and selection rationale
- Output: Clear recommendation with evidence

**Tactical Spikes** (when approach chosen, capability uncertain):
- Test specific capability or compatibility
- Verify version-specific behavior or undocumented features
- Output: Pass/fail or capability confirmation

Follow the patterns in the <technical-spike-guidelines> section above. Use general-purpose subagents with scratchpad isolation for all spikes.

### Step 6: Analyze Dependencies

After researching the codebase, identify critical dependencies using `print-inverse-dependencies` for EVERY high-impact file.

### Step 7: Log Research Findings

After research, record key discoveries including the technology stack, framework constraints, and any test results from isolated validation:

```bash
cat >> "[ABSOLUTE_PROJECT_PATH]/log.md" <<'EOF'
## Research Findings

I discovered several important aspects that will shape our approach:

### Technology Stack
Based on package.json analysis:
- Node.js: [version]
- React: [version]
- React Router: [version]
- Next.js: [version]
- TypeScript: [version]
- Jest: [version]
- Playwright: [version]
- Testing Library: [version]
- Vite: [version]
- [Other dependencies with versions]

These versions will be considered as constraints for the implementation.

### Key Findings
- [Component] spans [N] packages:
  - packages/[package]/src/[path]/: [Description]
  - packages/[package]/src/[file].ts: [Description]
  - packages/[package]/src/[path]/[Component].tsx: [Description]

### Framework Version Constraints
Based on the identified versions:
- React [version]: [Available features/limitations]
- Testing with Jest [version]: [Available matchers/setup]
- Node.js [version]: [Available APIs/syntax]
- TypeScript [version]: [Specific type features]
- [Framework] [version]: [Specific considerations]

### Isolated Test Results (if applicable)
If technical validation was performed:
- [test_name]: [result summary]
  - Evidence: [key findings from investigation]
  - Version compatibility: [confirmed for X.X.X]
  - Location: scratchpad/[test-name]/
- [How test results affect the approach]
- [Any constraints discovered through testing]

### Implementation Impact
- Changes required across [affected areas]
- Must maintain [compatibility requirement]
- Version-specific considerations: [framework features to use/avoid]
- Need to [coordination requirement]
EOF
```

## Phase 2: Plan Creation

### Step 1: Verify Plan Structure
Create your plan following the EXACT structure defined in @!`echo "${CLAUDE_PLUGIN_ROOT}"`/skills/plan/SKILL.md 

### Step 2: Pre-Creation Checklist
Before running create-plan-version, verify ALL checklist items in the pre-plan-creation-checklist section above.

### Step 3: Create Plan File

```bash
# This creates plan-v1.md, plan-v2.md, etc. automatically
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/create-plan-version "add-user-auth" "[PLAN_CONTENT]"
```

[PLAN_CONTENT] must follow the structure defined in @!`echo "${CLAUDE_PLUGIN_ROOT}"`/skills/plan/SKILL.md

## Phase 3: Quality Assessment

### Step 1: Run Plan Assessment

```xml
<invoke name="Task">
<parameter name="description">Assessment - add-user-auth</parameter>
<parameter name="subagent_type">project:plan-assessor</parameter>
<parameter name="prompt"><project>
Name: add-user-auth
Directory: @projects/new/add-user-auth
Plan: @projects/new/add-user-auth/plan-v3.md
Log: @projects/new/add-user-auth/log.md
</project>

Assess the project plan.
Verify it follows the structure from the project:plan skill</parameter>
</invoke>
```

### Step 2: Interpret Assessment Results and Take Action
Follow the guidelines in the assessment-interpretation section above.

## Phase 4: Revision Cycle (If Assessment Failed or User Provides Feedback)

### Step 1: Target Research on Issues
Address each issue identified by the assessor or user using the patterns in the revision-research-patterns section above.

### Step 2: Create Revised Plan
Return to Phase 2 and create the next version (plan-v2.md, plan-v3.md, etc.) incorporating your findings. **After creating the revised plan, immediately return to Phase 3 for assessment.**
