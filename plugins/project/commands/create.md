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
3. **Dual assessment required**: Every plan must pass BOTH plan-assessor (structural) AND plan-refactor (strategic) assessments, run in parallel
4. **Append-only logging**: Never edit existing log content. Always append new entries to the project log using the Bash tool with heredoc formatting
5. **Version verification**: Always identify and document framework/SDK versions before feature work
6. **Self-contained plans**: Each plan must be a complete, independent document without references to other plan versions
</core-constraints>

<command-reference>
```bash
# Initialize new project (using plugin binary)
PROJECT_DIR=$(!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/initialize-project "[PROJECT_NAME]")

# To append to project log (never edit existing content), use the Bash tool with heredoc:
# Note: Use $PROJECT_DIR if available from bash context, otherwise substitute [PROJECT_PATH]
cat >> "[PROJECT_PATH]/log.md" <<'EOF'
[NEW_LOG_ENTRY]
EOF

# Create or update plan (auto-versioned, using plugin binary)
!`echo "${CLAUDE_PLUGIN_ROOT}"`/bin/create-plan-version "[PROJECT_NAME]" "[PLAN_CONTENT]"
```

**Path Placeholder Convention:**
- `[PROJECT_PATH]` - Placeholder for the project directory path (e.g., `projects/active/my-project`)
- Use `[PROJECT_PATH]/scratchpad/[test-name]/` for all scratchpad references in plans
- Projects move between status directories (`new` → `pending` → `active` → etc.), so never hardcode status in paths
- When executing, substitute `[PROJECT_PATH]` with the actual path from `$PROJECT_DIR` or the known project location
</command-reference>

---

<research-before-asking>
## Research-Before-Asking Protocol

Before asking the user any question—whether during initial parsing, after assessment, or during revision—follow this protocol.

### Step 1: Conduct Research

1. **Search the codebase** for existing patterns, conventions, and constraints
2. **Check package.json** and lock files for version constraints and dependencies
3. **Search the web** for:
   - Package documentation and API references
   - Type definitions and interface contracts
   - Example implementations on GitHub
   - Known issues, migrations, or compatibility notes
4. **Conduct technical spikes** when capability or compatibility is uncertain
5. **Eliminate options** that conflict with architecture, constraints, or documented limitations

**Codebase research tool selection:**

| Query Type | Tool | Why |
|------------|------|-----|
| Simple location queries ("where is X?", "find files matching Y") | `Explore` subagent with `haiku` model | Lightweight, minimal context usage |
| List files in directory, find by pattern | `Glob` or `Explore` subagent | Quick discovery without deep analysis |
| How things work, code flow, dependencies | `mcp__plugin_vscode_codebase__ask` | Deep analysis with LSP integration |
| Impact analysis ("what breaks if I change X?") | `mcp__plugin_vscode_codebase__ask` | Reference tracing, dependency graphs |
| Type definitions, interface contracts | `mcp__plugin_vscode_codebase__ask` | LSP hover/definition information |
| Error root cause ("why does TS2322 occur?") | `mcp__plugin_vscode_codebase__ask` | Type analysis, definition tracing |

**Important**: Neither the Explore agent nor `mcp__plugin_vscode_codebase__ask` have conversation context. Include FULL paths and specific questions in every invocation.

### Step 2: Translate Abstract Questions to Concrete Research

| Abstract Question | Concrete Research |
|-------------------|-------------------|
| "Solving actual problem?" | Find existing code handling this case, search for related bugs/issues |
| "Earn complexity?" | Count usages of proposed abstraction, find simpler alternatives in codebase |
| "Right abstraction level?" | Search for similar patterns, check if over/under-generalized |
| "Implicit assumptions?" | Search for undocumented conventions, grep for magic values |
| "Design for independence?" | Run dependency analysis, check for coupling patterns |
| "Design for change?" | Identify one-way-door decisions, search for migration patterns |
| "Design for reality?" | Search for error handling patterns, find test infrastructure |
| "Technical feasibility?" | Web search for examples, spike if uncertain |

### Step 3: Surface Considerations, Then Decide

After research, surface your thinking visibly, then make a decision:
- State the consideration or question you're weighing
- Share what you discovered and which options remain viable
- Make your recommended decision with rationale
- Document the decision in the plan for user approval

**Only ask the user when:**
- **Blocking**: Cannot proceed without their input (e.g., missing credentials, conflicting hard requirements)
- **Intent clarity**: Risk of solving the wrong problem (e.g., "You mentioned X but the codebase suggests Y—which is correct?")

For all other decisions, make your best judgment. The plan is the approval checkpoint.

### Default Stances (Apply Without Asking)

| Situation | Default |
|-----------|---------|
| New package needed | Use latest stable version |
| Existing package in project | Preserve current version unless new features require upgrade |
| Single viable approach after research | Proceed with documented rationale |
| Multiple viable approaches | Choose recommended approach, surface reasoning, document alternatives in plan |
| Process/documentation decisions | Decide based on codebase patterns, surface reasoning |
</research-before-asking>

<request-parsing-guidelines>
Understand the user's intent and ensure the request is actionable.

### Extract Key Information
- **What**: The specific problem to solve or feature to build
- **Why**: The goal or value this delivers
- **Scope**: What's included and what's explicitly out of bounds
- **Success**: How we'll know it's working correctly

### When Clarification is Needed
Follow `<research-before-asking>`. Ask only when:
- The desired outcome is undefined and cannot be inferred from research
- Multiple valid approaches remain after eliminating incompatible options
- Requirements contradict each other
- A technical spike reveals ambiguous results
- The decision involves trade-offs only the user can evaluate
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
   cat >> "[PROJECT_PATH]/log.md" <<'EOF'
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
When investigating multiple independent aspects, execute in parallel using a single message with multiple tool invocations:

```xml
<!-- PARALLEL EXECUTION: Send all these tool calls in ONE message for simultaneous analysis -->

<!-- Deep analysis - use mcp__plugin_vscode_codebase__ask for understanding how things work -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">How is user authentication implemented in packages/api/src/auth including framework versions, auth flow, and entry points?</parameter>
</invoke>

<!-- Deep analysis - impact and dependency analysis -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What would be affected if I change the auth system at packages/api/src/auth/?</parameter>
</invoke>

<!-- Simple location - use Explore agent for finding files by pattern -->
<invoke name="Task">
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">Find all auth-related test files in packages/api/tests/ and packages/api/src/**/*.test.ts</parameter>
</invoke>

<!-- Simple location - find where types are defined -->
<invoke name="Task">
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">Where are the User and AuthUser types defined in packages/api/src/? List all files containing these type definitions.</parameter>
</invoke>

<!-- Simple location - list middleware files -->
<invoke name="Task">
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">List all middleware files in packages/api/src/middleware/ and packages/api/src/**/middleware.ts</parameter>
</invoke>
```

**Important**: All investigations above should be sent in a SINGLE message to run in parallel, not sequentially.
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
Use scratchpad path `[PROJECT_PATH]/scratchpad/[test-name]/`
```

**For Validation Spikes** (testing single approach):
```
Verify [Library@version] supports [specific capability/feature].
Use scratchpad path `[PROJECT_PATH]/scratchpad/[test-name]/`
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
## Dual Assessment System

Plans are evaluated by TWO complementary assessors run in parallel:

### Plan Assessor (Structural & Technical)
Uses the Quality Assessment section of the `project:plan` skill for detailed quality methodology.
Quality dimensions evaluated include:
- Requirement clarity (vague language detection)
- Internal coherence (cross-section consistency)
- Rationale presence (decision documentation)
- Scope integrity (YAGNI compliance)
- Testability (verifiable criteria)
- Evolution readiness (living document structure)

Provides:
- Structural compliance check
- Overengineering assessment
- Technical spike validation review
- **Ready for Implementation: Yes/No/Yes (with suggestions)**
- Specific improvement recommendations

### Plan Refactor (Strategic & Design)
Applies senior engineering judgment through seven evaluation principles:
1. **Solve the Actual Problem** - Are we solving the stated problem or an assumption?
2. **Earn Complexity** - Does every abstraction justify its existence?
3. **Right Abstraction Level** - Not too general, not too specific?
4. **Make Implicit Explicit** - Are assumptions and contracts documented?
5. **Design for Independence** - Can components change without cascading effects?
6. **Design for Change** - How painful is it to fix if we're wrong?
7. **Design for Reality** - Does this handle failure and support testing?

Provides:
- Per-principle assessment (SOUND / CONCERNS / RECONSIDER)
- Key questions for plan author
- **Overall Assessment: READY / DISCUSS / RECONSIDER**

### Combined Assessment Priority Levels
- **CRITICAL/RECONSIDER**: Must be addressed before implementation
- **HIGH/CONCERNS**: Should be addressed or explicitly accepted
- **MEDIUM**: Implementation clarity, risk coverage, dependency analysis
- **LOW**: Style suggestions, format variations

### Interpreting Combined Results

| Plan Assessor | Plan Refactor | Action |
|---------------|---------------|--------|
| Ready: Yes | READY | Proceed to description generation |
| Ready: Yes | DISCUSS | Proceed, but document accepted concerns |
| Ready: Yes | RECONSIDER | Treat as "Not Ready" - address strategic issues |
| Ready: Yes (suggestions) | READY/DISCUSS | Proceed with awareness of suggestions |
| Ready: No | Any | Address structural issues first |
| Any | RECONSIDER | Address strategic issues before proceeding |

#### After Both Assessments Complete (Always)

1. **Resolve questions through research** following `<research-before-asking>`
2. **Surface considerations visibly** as you work through them
3. **Track subjective decisions**: Collect design choices and judgment calls (not factual resolutions like "Is X compatible with Y?") for inclusion in the final summary. These help reviewers know where to focus.
4. **Make decisions** for non-blocking issues and document them in the plan revision
5. **Only ask the user** for blocking issues or intent clarity
6. **Determine next action** based on combined results (see table above)

#### If Both Assessments Pass (Ready: Yes + READY/DISCUSS)

1. If Plan Refactor returned DISCUSS, log accepted concerns:
   ```bash
   cat >> "[PROJECT_PATH]/log.md" <<'EOF'
   ## Accepted Concerns - [timestamp]

   The following strategic concerns were noted but accepted:
   - [Concern from plan-refactor evaluation]
   - [Rationale for accepting]
   EOF
   ```
2. Generate a description for the approved plan, where description-v[N].md correlates to the plan version, i.e. `plan-v2.md` would have `description-v2.md`:
   ```xml
   <invoke name="Task">
   <parameter name="description">Describe Plan</parameter>
   <parameter name="subagent_type">project:codebase-explainer</parameter>
   <parameter name="prompt"><project>
Name: [PROJECT_NAME]
Directory: @[PROJECT_PATH]
Plan: @[PROJECT_PATH]/[PLAN_FILE]
Log: @[PROJECT_PATH]/log.md
</project>

Create a technical project explanation and output to `[PROJECT_PATH]/description-v[N].md`

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
3. **Present summary to user** including:
   - Plan location and version
   - **Subjective decisions made**: List design choices and judgment calls with brief reasoning (e.g., "Chose server-side rendering for initial load performance"). Omit factual resolutions.
   - Any accepted concerns from DISCUSS assessment
   - Prompt for feedback
4. **Check for user feedback** - If user provides corrections or clarifications:
   - Log feedback using the Bash tool with heredoc to append to [PROJECT_PATH]/log.md
   - Proceed to Phase 4 to address the feedback
5. If no user feedback, HALT - the plan is complete. Do not implement the plan. This command is planning only.

#### If Either Assessment Fails (Ready: No OR RECONSIDER)
**Revise plans for CRITICAL/RECONSIDER or HIGH/CONCERNS issues. Do not revise for style suggestions.**
**Continue to Phase 4.**
</assessment-interpretation>

<revision-research-patterns>
Address issues identified by BOTH assessors (plan-assessor and plan-refactor) or user. Execute multiple investigations in PARALLEL when addressing multiple issues:

#### Parallel Revision Research (send all in ONE message)
```xml
<!-- PARALLEL EXECUTION: Address multiple issues simultaneously -->

<!-- Simple location - find where a class is defined -->
<invoke name="Task">
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">Where is the UserService class located in packages/api/src/? Are there any duplicate classes with that name?</parameter>
</invoke>

<!-- Simple location - find repository implementations -->
<invoke name="Task">
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">Find all files containing "Repository" in packages/api/src/repositories/ and packages/api/src/**/*repository*.ts</parameter>
</invoke>

<!-- Deep analysis - dependency tracing requires codebase tool -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What are the dependencies for packages/api/src/services/user.service.ts including npm packages and circular dependencies?</parameter>
</invoke>

<!-- Deep analysis - integration flow understanding -->
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

1. Extract the core intent (What, Why, Scope, Success criteria)
2. If ambiguity exists, follow `<research-before-asking>` to narrow possibilities
3. Document your understanding (including any defaults applied) and continue

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
cat >> "[PROJECT_PATH]/log.md" <<'EOF'
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

<!-- Deep analysis - technology stack and architecture understanding -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What is the technology stack for OAuth authentication in packages/api including current auth framework and strategies?</parameter>
</invoke>

<!-- Deep analysis - dependency mapping and impact -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">Map dependencies for adding OAuth to packages/api/src/auth/ including files needing modification, web integration, and schema changes</parameter>
</invoke>

<!-- Simple location - find test files -->
<invoke name="Task">
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">Find all authentication-related test files in packages/api/tests/ and packages/api/src/**/*.test.ts</parameter>
</invoke>

<!-- Simple location - find existing auth implementations -->
<invoke name="Task">
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">List all files in packages/api/src/auth/ including subdirectories. Show the directory structure.</parameter>
</invoke>

<!-- Simple location - find config files -->
<invoke name="Task">
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">Find OAuth or authentication config files in packages/api/ (e.g., oauth.config.ts, auth.config.ts, passport.ts)</parameter>
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
cat >> "[PROJECT_PATH]/log.md" <<'EOF'
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
  - Location: [PROJECT_PATH]/scratchpad/[test-name]/
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

### Step 1: Run Dual Assessment (Parallel)

Run BOTH assessors in parallel by sending both Task invocations in a SINGLE message:

```xml
<!-- PARALLEL EXECUTION: Send both assessments in ONE message -->

<!-- Assessment 1: Structural & Technical (plan-assessor) -->
<invoke name="Task">
<parameter name="description">Structural Assessment - add-user-auth</parameter>
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

<!-- Assessment 2: Strategic & Design (plan-refactor) - runs in parallel -->
<invoke name="Task">
<parameter name="description">Strategic Assessment - add-user-auth</parameter>
<parameter name="subagent_type">project:plan-refactor</parameter>
<parameter name="prompt"><project>
Name: add-user-auth
Directory: @projects/new/add-user-auth
Plan: @projects/new/add-user-auth/plan-v3.md
Log: @projects/new/add-user-auth/log.md
</project>

Evaluate the project plan using the seven evaluation principles.
Focus on strategic "should we build it this way" questions.</parameter>
</invoke>
```

**Important**: Both assessments run simultaneously. Wait for both to complete before interpreting results.

### Step 2: Interpret Combined Assessment Results
Follow the guidelines in the assessment-interpretation section above. Both assessments must pass for the plan to proceed.

## Phase 4: Revision Cycle (If Either Assessment Failed or User Provides Feedback)

### Step 1: Categorize Issues by Source

Organize issues from both assessors before researching:

**From Plan Assessor (Structural/Technical):**
- CRITICAL issues (must fix)
- HIGH issues (should fix)
- MEDIUM issues (consider fixing)

**From Plan Refactor (Strategic/Design):**
- RECONSIDER findings (must address)
- CONCERNS findings (should address or accept with rationale)
- Key questions raised (should answer)

**From User Feedback:**
- Corrections to requirements
- Additional constraints
- Clarifications

### Step 2: Target Research on Issues
Address issues from BOTH assessors using `<revision-research-patterns>`. For strategic questions from plan-refactor, use the question-to-research mapping in `<research-before-asking>`.

### Step 3: Create Revised Plan
Return to Phase 2 and create the next version (plan-v2.md, plan-v3.md, etc.) incorporating findings from BOTH assessors. **After creating the revised plan, immediately return to Phase 3 for dual assessment.**

### Step 4: Log Revision Rationale

After addressing issues, document what changed and why:

```bash
cat >> "[PROJECT_PATH]/log.md" <<'EOF'
## Revision Notes - plan-v[N] to plan-v[N+1]

### Structural Issues Addressed (from plan-assessor)
- [Issue]: [How it was resolved]

### Strategic Issues Addressed (from plan-refactor)
- [Principle violated]: [How the approach was changed]

### Questions Answered
- [Question from assessor]: [Answer with evidence]

### Accepted Trade-offs
- [Concern that was noted but accepted]: [Rationale]
EOF
```
