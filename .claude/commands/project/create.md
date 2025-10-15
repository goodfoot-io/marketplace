---
description: Create project plans with automated quality assessment
---

<user-message>
$ARGUMENTS
</user-message>

<purpose>
Create a structured project plan for the user's request, then assess its quality. If issues exist, revise the plan. Ultrathink.

**Important**: When logging the user's request, you must manually capture everything the user has communicated, not just arguments. This includes:
- The complete original request
- Any clarifications or additional context provided
- Constraints or preferences mentioned
- Examples or references shared
</purpose>

<core-constraints>
1. **YAGNI (You Aren't Gonna Need It)**: Include only what directly solves the problem
2. **No estimates**: Exclude time estimates, phases, or resource allocations  
3. **Mandatory assessment**: You must assess every plan using the Task tool
4. **Append-only logging**: Never edit existing log content. Always append new entries to the project log using the `mcp__file__append` tool function
5. **Version verification**: Always identify and document framework/SDK versions before feature work
6. **Self-contained plans**: Each plan must be a complete, independent document without references to other plan versions
</core-constraints>

<command-reference>
```bash
# Initialize new project
PROJECT_DIR=$(initialize-project "[PROJECT_NAME]")

# To append to project log (never edit existing content), use the mcp__file__append tool function:
# Note: Use $PROJECT_DIR if available from bash context, otherwise use absolute path
mcp__file__append(
  file_path="[ABSOLUTE_PROJECT_PATH]/log.md",  # or "$PROJECT_DIR/log.md" if in bash context
  content="[NEW_LOG_ENTRY]"
)

# Create or update plan (auto-versioned)
create-plan-version "[PROJECT_NAME]" "[PLAN_CONTENT]"
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
1. **Capture Everything**: Include the complete request, not just what was passed as arguments
2. **Preserve Context**: Document any back-and-forth clarifications or additional requirements
3. **State Assumptions**: Make your interpretation explicit so issues can be caught early
4. **Use Specifics**: Include file names, error messages, test names, and other concrete details
5. **Note Urgency**: If the user indicates timeline or blocking issues, document them
</logging-guidelines>

<research-patterns>
### File Path Verification Protocol
**Verify line numbers when referencing existing code for precision.**

For EVERY file path you plan to include, you MUST verify in this exact sequence:

```
# Step 1: Find the file (if unsure of exact path)
Glob(pattern="**/filename.ts")

# Step 2: Get dependency count (for impact assessment) - REQUIRED
mcp__codebase__ask({
  question: "What files depend on packages/website/app/hooks/yjs.ts and what is the impact if it changes?"
})

# Step 3: Read for line numbers (when planning modifications)
Read(file_path="/workspace/packages/website/app/hooks/yjs.ts")
# Only use "new file" for files that don't exist yet
```

#### When to Use Sequential vs Parallel Research
- **Sequential**: When each query depends on previous results or exploring unknown areas
- **Parallel**: When queries are independent (most common case - default to this)

#### Core Research Pattern (Parallel Execution)
When investigating multiple independent aspects, execute codebase analysis in parallel using a single message with multiple tool invocations:

```
# PARALLEL EXECUTION: Send all these tool calls in ONE message for simultaneous analysis
# Note: The tool provides exhaustive results by default - complete code, all occurrences, line numbers

# First investigation - overall architecture  
mcp__codebase__ask({
  question: "How is user authentication implemented in packages/api/src/auth including framework versions, auth flow, and entry points?"
})

# Second investigation - implementation patterns (runs in parallel)
mcp__codebase__ask({
  question: "What authentication and authorization patterns exist in packages/api including middleware functions, route protection, and role-based access?"
})

# Third investigation - dependencies and impact (runs in parallel)
mcp__codebase__ask({
  question: "What would be affected if I change the auth system at packages/api/src/auth/?"
})

# Fourth investigation - testing infrastructure (runs in parallel)
mcp__codebase__ask({
  question: "What auth-related tests exist in packages/api/tests/ and packages/api/src/**/*.test.ts including test database setup and token handling?"
})
```

**Important**: All four investigations above should be sent in a SINGLE message to run in parallel, not sequentially.
</research-patterns>

<assumption-testing-guidelines>
#### When to Use Assumption Testing

**Test these scenarios:**
- Type exports from external libraries
- React hook dependency arrays
- Module resolution across environments
- API response formats not in documentation
- Framework behavior that may differ from docs
- Version-specific features (React 18 vs 19, Next.js App Router, etc.)

**Skip testing for:**
- Well-documented standard library features
- Basic CRUD operations
- Simple data transformations
- Code clearly visible in the codebase

#### Decision Criteria for Assumption Testing

Validate assumptions when dealing with:
- **External Dependencies**: Third-party library exports and APIs
- **Framework Behaviors**: Runtime behavior that differs from documentation
- **Environment Boundaries**: Module resolution, build tools, browser APIs
- **Integration Points**: How different systems actually interact
- **Edge Cases**: Undocumented or ambiguous behavior
- **Version Compatibility**: Features that may vary between versions

#### Basic Testing Format

```
Task(description="Validate [specific assumption]",
     subagent_type="assumption-tester",
     prompt="<project>
     Name: [PROJECT_NAME]
     Directory: @projects/[STATUS]/[PROJECT_NAME]
     Plan: @projects/[STATUS]/[PROJECT_NAME]/[PLAN_FILE]
     Log: @projects/[STATUS]/[PROJECT_NAME]/log.md
     </project>
     
     Validate: [specific technical claim to test]
     Framework versions: [list relevant versions from technology stack]
     Context: [relevant files or system details]
     
     Specifically test if the feature/API is available in the identified versions.
     Create test files in the project's scratchpad/ directory.")
```

#### Common Testing Patterns

##### Type Export Verification
```
Task(description="Verify type exports",
     subagent_type="assumption-tester",
     prompt="<project>
     Name: add-user-auth
     Directory: @projects/new/add-user-auth
     Plan: @projects/new/add-user-auth/plan-v1.md
     Log: @projects/new/add-user-auth/log.md
     </project>
     
     Validate: @tanstack/react-query exports UseQueryResult, QueryClient, and QueryClientProvider types that can be imported and used in TypeScript with strict mode
     Context: packages/website uses these types for data fetching
     
     Create test files in the project's scratchpad/ directory.")
```

##### API Behavior Testing
```
Task(description="Test API responses",
     subagent_type="assumption-tester",
     prompt="<project>
     Name: add-user-auth
     Directory: @projects/new/add-user-auth
     Plan: @projects/new/add-user-auth/plan-v2.md
     Log: @projects/new/add-user-auth/log.md
     </project>
     
     Validate: Supabase auth.signIn returns a session object with user data on successful login and specific error format on failure
     Context: packages/api/src/auth.ts handles authentication responses
     
     Create test files in the project's scratchpad/ directory.")
```

##### Framework Feature Detection
```
Task(description="Test framework support",
     subagent_type="assumption-tester",
     prompt="<project>
     Name: add-form-handling
     Directory: @projects/new/add-form-handling
     Plan: @projects/new/add-form-handling/plan-v3.md
     Log: @projects/new/add-form-handling/log.md
     </project>
     
     Validate: Next.js 14 Server Actions can accept FormData input, perform async operations, and return typed responses with proper type inference
     Context: packages/website/app/actions/form.ts needs server-side form processing
     
     Create test files in the project's scratchpad/ directory.")
```

##### Version-Specific Feature Testing
```
Task(description="Test React version features",
     subagent_type="assumption-tester",
     prompt="<project>
     Name: add-suspense-boundaries
     Directory: @projects/new/add-suspense-boundaries
     Plan: @projects/new/add-suspense-boundaries/plan-v4.md
     Log: @projects/new/add-suspense-boundaries/log.md
     </project>
     
     Validate: React (react@19.0.0) supports use() hook for promises and Server Components with the identified TypeScript version
     Framework versions: react@19.0.0, typescript@5.3.0
     Context: packages/website needs to implement data fetching with Suspense
     
     Create test files in the project's scratchpad/ directory.")
```

#### Processing Test Results

The assumption-tester returns structured results in this format:

```yaml
## Task Completion Summary

status: success
test_results:
  - test_name: "react-query-type-exports"
    question: "Does @tanstack/react-query export required types?"
    result: "YES"
    confidence: "High"
    evidence_summary: "All types imported and compiled successfully"
    
artifacts:
  - path: "projects/new/add-user-auth/scratchpad/react-query-types/findings.md"
  
key_findings:
  - "UseQueryResult accepts generic type parameters"
  - "QueryClient can be instantiated with config options"
  
test_location: "projects/new/add-user-auth/scratchpad/react-query-types/"
```

The agent also creates a `findings.md` file with detailed test implementation and reproduction steps.

#### When to Skip Testing

Do not test assumptions for:
- **Standard library features**: Well-documented Node.js or browser APIs
- **Internal code**: Behavior visible in your codebase
- **Simple operations**: Basic CRUD, data transformations
- **Documented behaviors**: Features clearly specified in official docs

#### Test Environment Commands

The assumption-tester uses these utilities automatically:
- `create-scratchpad-jest-test [project] [test-name]` - For integration tests
- `create-scratchpad-playwright-test [project] [test-name]` - For E2E/browser tests

Tests are created in: `projects/[status]/[project]/scratchpad/[test-name]/`
</assumption-testing-guidelines>

<dependency-analysis-requirements>
#### Finding Dependencies (REQUIRED)
After researching the codebase, identify critical dependencies:

1. **MANDATORY**: Analyze dependencies for high-impact files using:
```
mcp__codebase__ask({
  question: "What are the dependencies for packages/api/src/auth/middleware.ts and what needs updating if the interface changes?"
})
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
Create your plan following the EXACT structure defined in @.claude/shared/project-plan-annotated-example.md

**CRITICAL**: 
- Do not deviate from this structure. The assessor validates against this exact format.
- Each plan must be a complete, self-contained document
- Never reference other plan versions (e.g., "as in v2", "from previous plan", "defer to v3")

Refer to @.claude/shared/project-plan-annotated-example.md for:
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
The assessor provides:
- Structural compliance check
- Overengineering assessment
- Assumption validation review
- **Ready for Implementation: Yes/No/Yes (with suggestions)**
- Specific improvement recommendations

**Assessment Priority Levels:**
- **CRITICAL**: Technical accuracy, missing dependencies, architectural soundness
- **MEDIUM**: Implementation clarity, risk coverage, dependency analysis, missing version information
- **LOW**: Version format variations (v prefix, @ notation), line number precision, style consistency

#### If "Ready for Implementation: Yes" or "Ready for Implementation: Yes (with suggestions)"

1. Output the full assessment result (including any style suggestions)
2. Generate a description for the approved plan, where description-v[N].md correlates to the plan version, i.e. `plan-v2.md` would have `description-v2.md`:
   ```
   Task(description="Describe Plan",
        subagent_type="codebase-explainer",
        prompt="<project>
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
     
     Research the codebase to understand current system behavior and architectural patterns that inform the technical decisions.")
   ```
3. **Check for user feedback** - If user provides corrections or clarifications:
   - Log feedback using the `mcp__file__append` tool function to append to [ABSOLUTE_PROJECT_PATH]/log.md
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
```
# PARALLEL EXECUTION: Address multiple issues simultaneously
# Note: Tool provides complete code and exact counts by default

# Issue 1: Incorrect File Paths (example from assessment: "UserService not found")
mcp__codebase__ask({
  question: "Where is the UserService class located in packages/api/src/ and are there any duplicate classes?"
})

# Issue 2: Missing Dependencies (runs in parallel)
mcp__codebase__ask({
  question: "What are the dependencies for packages/api/src/services/user.service.ts including npm packages and circular dependencies?"
})

# Issue 3: Pattern Examples (runs in parallel)  
mcp__codebase__ask({
  question: "What Repository pattern implementations exist in packages/api/src/ including interface definitions and database connections?"
})

# Issue 4: Integration Points (runs in parallel)
mcp__codebase__ask({
  question: "How do packages/api and packages/web integrate for authentication including endpoints, token handling, and error patterns?"
})
```

**Important**: When addressing multiple revision issues, investigate them in parallel by sending all queries in a single message.

#### For Validating Assumptions
```
Task(description="Verify library behavior",
     subagent_type="assumption-tester",
     prompt="<project>
     Name: [PROJECT_NAME]
     Directory: @projects/[STATUS]/[PROJECT_NAME]
     Plan: @projects/[STATUS]/[PROJECT_NAME]/[PLAN_FILE]
     Log: @projects/[STATUS]/[PROJECT_NAME]/log.md
     </project>
     
     The assessment flagged that we're assuming @supabase/ssr exports a createBrowserClient function.
     
     Create a test to verify:
     1. The function exists and is exported
     2. Its type signature matches our usage: createBrowserClient<Database>(supabaseUrl: string, supabaseKey: string, options?: ClientOptions)
     3. It returns a SupabaseClient instance
     
     Also test if the library provides TypeScript types for these exports.
     Create test files in the project's scratchpad/ directory.")
```

#### For Version Compatibility Issues
```
Task(description="Verify version compatibility",
     subagent_type="assumption-tester",
     prompt="<project>
     Name: [PROJECT_NAME]
     Directory: @projects/[STATUS]/[PROJECT_NAME]
     Plan: @projects/[STATUS]/[PROJECT_NAME]/[PLAN_FILE]
     Log: @projects/[STATUS]/[PROJECT_NAME]/log.md
     </project>
     
     The assessment flagged potential version incompatibility.
     
     Test if React (react@[X.X.X]) supports [specific feature] with TypeScript (typescript@[Y.Y.Y]):
     1. Create a minimal test case using the feature
     2. Verify it compiles with current TypeScript version
     3. Test runtime behavior if applicable
     
     Framework versions to test: react@[X.X.X], typescript@[Y.Y.Y]
     Create test files in the project's scratchpad/ directory.")
```
</revision-research-patterns>


## Phase 1: Requirements Analysis

### Step 1: Parse User Request
If the core intent is unclear, ask specific questions and stop. Otherwise, document your understanding and continue.

### Step 2: Initialize Project Directory

```bash
# Replace "add-user-auth" with your actual project name
# Project name must be kebab-case (lowercase letters, numbers, hyphens only), max 50 characters
PROJECT_DIR=$(initialize-project "add-user-auth") && echo "Project directory: $PROJECT_DIR" && echo "Project name: $(basename "$PROJECT_DIR")"
```

This command will:
- Return existing project path if found in new/pending/active/ready-for-review
- Create new project in `projects/new/` if not found
- Initialize `log.md` file with basic header

Verify initialization succeeded before proceeding.

### Step 3: Log User Request

Immediately append the user's request and your initial understanding to the project log. Capture ALL context, not just the command arguments:

```
mcp__file__append(
  file_path="[ABSOLUTE_PROJECT_PATH]/log.md",
  content="## User Request

\"[Copy the user's exact request verbatim, including all details]\"

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
"
)
```

### Step 4: Research Technical Context (Parallel Analysis)

Execute parallel investigations to understand different aspects of the codebase simultaneously. Send ALL these tool calls in a SINGLE message:

```
# PARALLEL EXECUTION: Send all tool calls together for maximum efficiency

# Investigation 1: Technology and architecture
mcp__codebase__ask({
  question: "What is the technology stack for OAuth authentication in packages/api including current auth framework and strategies?"
})

# Investigation 2: Implementation patterns (parallel)
mcp__codebase__ask({
  question: "What authentication implementations exist in packages/api/src/auth/ including endpoints, middleware, session handling, and password logic?"
})

# Investigation 3: Dependencies and integration (parallel)
mcp__codebase__ask({
  question: "Map dependencies for adding OAuth to packages/api/src/auth/ including files needing modification, web integration, and schema changes"
})

# Investigation 4: Testing and validation (parallel)
mcp__codebase__ask({
  question: "What authentication testing patterns exist in packages/api/tests/ including test files, user creation, database setup, and token handling?"
})
```

**Key Point**: The above investigations are independent and should run in parallel by sending them all in one message, not one at a time.

### Step 5: Validate Assumptions and Version Compatibility (Optional)

Use the assumption-tester agent to verify technical behaviors that cannot be confirmed through code inspection alone, including framework version-specific features.

### Step 6: Analyze Dependencies

After researching the codebase, identify critical dependencies using `print-inverse-dependencies` for EVERY high-impact file.

### Step 7: Log Research Findings

After research, record key discoveries including the technology stack, framework constraints, and any assumption test results:

```
mcp__file__append(
  file_path="[ABSOLUTE_PROJECT_PATH]/log.md",
  content="## Research Findings

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

### Assumption Test Results (if applicable)
Based on the assumption-tester's structured return:
- [test_name]: [result] with [confidence] confidence
  - Evidence: [evidence_summary from return]
  - Version compatibility: [confirmed for X.X.X]
  - Details available in: [artifact path from return]
- Key findings: [key_findings from return]
- Recommendations: [recommendations from return]

### Implementation Impact
- Changes required across [affected areas]
- Must maintain [compatibility requirement]
- Version-specific considerations: [framework features to use/avoid]
- Need to [coordination requirement]
- [How test results affect the approach]
- [Any constraints discovered through testing]
"
)
```

## Phase 2: Plan Creation

### Step 1: Verify Plan Structure
Create your plan following the EXACT structure defined in @.claude/shared/project-plan-annotated-example.md

### Step 2: Pre-Creation Checklist
Before running create-plan-version, verify ALL checklist items in the pre-plan-creation-checklist section above.

### Step 3: Create Plan File

```bash
# This creates plan-v1.md, plan-v2.md, etc. automatically
create-plan-version "add-user-auth" "[PLAN_CONTENT]"
```

[PLAN_CONTENT] must follow the structure defined in @.claude/shared/project-plan-annotated-example.md

## Phase 3: Quality Assessment

### Step 1: Run Plan Assessment

```
Task(description="Assessment - add-user-auth",
     subagent_type="project-plan-assessor",
     prompt="<project>
     Name: add-user-auth
     Directory: @projects/new/add-user-auth
     Plan: @projects/new/add-user-auth/plan-v3.md
     Log: @projects/new/add-user-auth/log.md
     </project>
     
     Assess the project plan.
     Verify it follows the structure from .claude/shared/project-plan-annotated-example.md")
```

### Step 2: Interpret Assessment Results and Take Action
Follow the guidelines in the assessment-interpretation section above.

## Phase 4: Revision Cycle (If Assessment Failed or User Provides Feedback)

### Step 1: Target Research on Issues
Address each issue identified by the assessor or user using the patterns in the revision-research-patterns section above.

### Step 2: Create Revised Plan
Return to Phase 2 and create the next version (plan-v2.md, plan-v3.md, etc.) incorporating your findings. **After creating the revised plan, immediately return to Phase 3 for assessment.**