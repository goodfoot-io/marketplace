---
name: Sub-Agent Management
description: Create and manage Claude Code sub-agents
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

## What Are Sub-Agents?

**Sub-agents** are specialized AI agents with constrained tools and focused system prompts, explicitly invoked by the main agent via the Task tool.

### Key Characteristics

- **File Format**: Markdown files (`.md` extension) in `/workspace/<plugin-name>/agents/` directory
- **Invocation**: Main agent explicitly calls via Task tool, not autonomous
- **Tool Restrictions**: Constrained to specific tools via `tools` frontmatter field
- **System Prompt**: Markdown body becomes the agent's instructions
- **Working Directory**: Inherits parent's working directory (typically `/workspace`)

### Context Management Benefits (October 2025)

Sub-agents provide context isolation and preservation, critical for efficient long-running conversations:

- **Separate Context Windows**: Each sub-agent has its own context, preventing main conversation pollution
- **Early Investigation**: Delegate verification/investigation early to preserve main context for coordination
- **Context Efficiency**: Main agent stays focused on high-level objectives while sub-agents handle details
- **Parallelization**: Multiple sub-agents with independent contexts work simultaneously
- **Deep Dives**: Sub-agents can explore specific areas without consuming main agent's context

**Best Practice**: Use sub-agents for deep dives, investigations, or verification tasks to keep the main conversation focused on coordination and decision-making. This is especially valuable early in conversations or when dealing with complex multi-faceted problems.

**Example**: Instead of having the main agent read 20 files to understand a codebase structure, delegate to an analysis sub-agent. The main agent receives only the summary, preserving its context for the actual task.

### Sub-Agents vs Skills

| Feature | Sub-Agents | Skills |
|---------|-----------|--------|
| **Activation** | Explicitly invoked via Task tool | Autonomous based on description matching |
| **Location** | `agents/*.md` files | `skills/*/SKILL.md` directories |
| **Tool Field** | `tools` (no hyphen) | `allowed-tools` (hyphenated) |
| **Purpose** | Delegate specific work to specialized agent | Add capabilities main agent can choose |
| **Context** | Receives prompt from main agent | Receives full conversation context |

## Sub-Agent File Structure

### Location and Naming

**Path Pattern**: `/workspace/<plugin-name>/agents/<agent-identifier>.md`

**Examples**:
- `/workspace/my-plugin/agents/code-reviewer.md`
- `/workspace/typescript-tools/agents/type-checker.md`
- `/workspace/git-plugin/agents/commit-analyzer.md`

**Critical Rules**:
- Files MUST have `.md` extension (lowercase)
- Filename becomes the agent identifier for marketplace.json
- The `name` field in frontmatter identifies the agent for Task tool invocation
- Use lowercase with hyphens: `code-reviewer`, `test-generator`, `bug-analyzer`

### Complete File Template

```markdown
---
name: agent-identifier
description: What this agent does and when main agent should invoke it
tools: Read, Write, Bash, Grep
model: sonnet
---

# Agent System Prompt

You are a specialized agent for [specific purpose].

When invoked, you operate on the codebase at /workspace and have access to these tools:
[list specific tools from frontmatter]

## Your Responsibilities
- Primary responsibility 1
- Primary responsibility 2
- Primary responsibility 3

## Constraints
- Never do X
- Always do Y before Z
- Limit scope to [specific area]

## Process
1. First step with specific tool usage
2. Second step
3. Third step
4. Report results back to main agent

## Working Directory Context
- Project root: /workspace
- Use absolute paths like /workspace/packages/api/src/file.ts
- Relative paths resolve from /workspace

## Examples

### Example Input
When main agent invokes you with: "Analyze user authentication flow"

### Expected Output
Analysis report with:
- File locations (absolute paths)
- Identified issues or patterns
- Specific recommendations
```

## YAML Frontmatter Fields

### Required Fields

#### `name` (Required)
- **Type**: String
- **Format**: Lowercase letters, numbers, hyphens only (`[a-z0-9]+(-[a-z0-9]+)*`)
- **Purpose**: Unique identifier used in Task tool invocation
- **Examples**: `code-reviewer`, `test-generator`, `type-checker`

```yaml
name: code-reviewer
```

#### `description` (Required)
- **Type**: String
- **Format**: Natural language description
- **Purpose**: Tells main agent when to invoke this sub-agent
- **Best Practice**: Include keywords, capabilities, and trigger conditions

```yaml
description: Reviews code changes for quality, best practices, and potential bugs in /workspace
```

### Optional Fields

#### `tools` (Optional)
- **Type**: Comma-separated string (NOT YAML array)
- **Format**: `ToolName, ToolName, ToolName`
- **Purpose**: Restricts which tools the sub-agent can use
- **Default**: All tools including MCP-provided tools if field is omitted

**Correct Format**:
```yaml
tools: Read, Write, Bash, Grep
```

**WRONG - Do NOT use**:
```yaml
# Don't use YAML array syntax:
tools: [Read, Write, Bash]

# Don't use allowed-tools (that's for skills):
allowed-tools: Read, Write, Edit
```

**Critical Note**: Using `allowed-tools` instead of `tools` in an agent will cause the field to be ignored, granting all tools by default.

**Why Different Field Names?**
- **Sub-agents**: Use `tools` field (no hyphen) - historical/architectural design in Claude Code
- **Skills**: Use `allowed-tools` field (hyphenated) - different component system
- **Slash Commands**: Use `allowed-tools` field (hyphenated) - shares convention with skills
- The distinction is intentional in Claude Code's architecture to differentiate component types

**Available Tool Names** (exact capitalization required):
- `Read` - Read files
- `Write` - Write/overwrite files
- `Edit` - Edit existing files
- `Bash` - Execute shell commands
- `Glob` - File pattern matching
- `Grep` - Content search
- `Task` - Invoke other sub-agents
- `WebFetch` - Fetch web content
- `WebSearch` - Search the web
- `TodoWrite` - Manage task lists
- Plus MCP-provided tools (e.g., `mcp__vscode__*`)
  - **Individual MCP tool grants**: You can specify individual MCP tools in the `tools` field
  - Example: `tools: Read, mcp__vscode__get_diagnostics`
  - **All MCP tools**: Omitting the `tools` field grants ALL currently available MCP tools
  - **Best Practice**: Explicitly list required MCP tools rather than granting all to follow principle of least privilege

#### `model` (Optional)
- **Type**: String
- **Options**: `sonnet`, `opus`, `haiku`, `inherit`
- **Purpose**: Select which Claude model runs this agent
- **Default**: `inherit` (uses parent agent's model)

```yaml
model: sonnet  # Use Claude Sonnet
```

**Model Selection Guide (Updated October 2025)**:
- `sonnet` - Balanced performance and speed (Claude Sonnet 4.5, September 2025, recommended for complex tasks)
- `opus` - Maximum capability for most demanding tasks (Claude Opus 4.1, August 2025)
- `haiku` - **Fast, cost-effective** for lightweight tasks (Claude Haiku 4.5, October 2025)
  - **Performance**: Delivers 90% of Sonnet 4.5's agentic coding performance
  - **Speed**: 2x faster than Sonnet 4.5
  - **Cost**: 3x more cost-effective than Sonnet 4.5
  - **Recommended for**: Frequently invoked sub-agents with narrow scopes (code review, formatting, simple analysis)
- `inherit` - Use whatever model the main agent is using (default when field omitted)

**Default Behavior**: When the `model` field is omitted, the sub-agent inherits the parent agent's model (equivalent to `model: inherit`). For example, if the main agent uses Sonnet 4.5, the sub-agent will use Sonnet 4.5 unless explicitly overridden.

**Model Comparison Table (October 2025)**:

| Model | Cost (Input/Output per 1M tokens) | Speed | Coding Performance | Best For |
|-------|-----------------------------------|-------|-------------------|----------|
| Haiku 4.5 | ~$1 / ~$5 | 2x faster | 90% of Sonnet | Frequent, lightweight tasks (validation, formatting, simple analysis) |
| Sonnet 4.5 | ~$3 / ~$15 | Baseline | 100% (best) | Complex coding, agentic workflows, multi-step reasoning |
| Opus 4.1 | Higher cost | Slower | Maximum reasoning | Critical architectural decisions, most demanding tasks |

**When to Use Each Model**:
- Use `haiku` for lightweight, frequently-called sub-agents to optimize speed and cost
- Use `sonnet` for complex reasoning, multi-step analysis, or when quality is critical
- Use `opus` only for the most complex tasks requiring maximum capability
- Use `inherit` when the sub-agent's complexity matches the main agent's needs

## Tool Restriction Patterns

> **⚠️ SECURITY WARNING**: Tool restrictions are critical for sub-agent security and reliability. Omitting the `tools` field grants **unrestricted access to ALL tools including MCP servers**:
> - All filesystem operations (Read, Write, Edit)
> - Command execution (Bash) with full shell access
> - Sub-agent invocation (Task) allowing nested delegation
> - All MCP-provided external integrations (databases, APIs, browsers, etc.)
>
> **Best Practice**: Always specify the **minimum tools required** for the sub-agent's specific task. Only omit `tools` when full access is explicitly needed.

**Tool Enforcement Timing**: Claude Code enforces tool restrictions **at runtime**, before tool execution:

1. When a sub-agent attempts to use a non-allowed tool, the tool call is **blocked before execution**
2. No side effects occur (file not written, command not run, API not called)
3. The sub-agent receives an error message: `"Tool [ToolName] not allowed for agent 'agent-name'"`
4. The sub-agent can handle the error and adjust its approach (e.g., request main agent assistance)

This runtime enforcement ensures that improperly configured agents fail safely without causing unintended changes.

### 🔒 Security Best Practices (October 2025)

Follow these guidelines to minimize security risks and limit blast radius in sensitive environments:

**1. Principle of Least Privilege**
- Grant only the minimum tools needed for the specific task
- Review and justify each tool in the `tools` field
- Remove tools that "might be useful" but aren't required

**2. Blast Radius Limitation**
- Restrict tool access to contain potential damage in sensitive environments
- Read-only agents cannot accidentally modify or delete files
- Analysis agents without Bash cannot execute unintended commands

**3. Separation of Concerns**
- **Analysis agents** → Read-only tools (`Read, Grep, Bash` for inspection only)
- **Modification agents** → Add `Write` or `Edit` only when explicitly needed for file changes
- **Orchestrator agents** → `Task` tool only, delegate actual work to specialized sub-agents
- **Testing agents** → `Bash, Read` for running tests without modifying source code

**4. MCP Tool Review**
- Explicitly list required MCP tools rather than granting all: Use Task tool with "codebase-analysis" subagent instead
- Omitting `tools` field grants ALL MCP servers (databases, browsers, APIs, etc.)
- Review MCP tool permissions regularly as new servers are added

**5. Regular Audits**
- Periodically review agent tool grants as requirements evolve
- Remove unused tools from long-running agents
- Document why each tool is required

**Example - Secure Review Agent**:
```yaml
---
name: code-reviewer
tools: Read, Grep, Bash  # No Write/Edit = cannot modify code, only analyze
---
```

**Example - Secure Orchestrator Agent**:
```yaml
---
name: workflow-orchestrator
tools: Task  # Only delegates work, cannot directly modify files or run commands
---
```

### Grant All Tools (Unrestricted)

**Omit the `tools` field entirely** (use with caution):

```yaml
---
name: full-access-agent
description: Agent with complete tool access including MCP servers
model: sonnet
---
```

This grants access to:
- All built-in tools (Read, Write, Edit, Bash, Glob, Grep, Task, etc.)
- All MCP-provided tools (mcp__vscode__*, etc.)
- Task tool for invoking specialized subagents like "codebase-analysis"

**When to use**: Only when the sub-agent truly needs unrestricted access (rare cases)

### Common Tool Combinations

#### Read-Only Analysis Agent
```yaml
---
name: analyzer
description: Analyzes code without making modifications
tools: Read, Glob, Grep
---
```

**Use Case**: Code review, pattern detection, documentation analysis

#### File Operations Agent
```yaml
---
name: file-manager
description: Creates and modifies files based on templates
tools: Read, Write, Edit, Glob
---
```

**Use Case**: Code generation, file reorganization, template application

#### Development Agent
```yaml
---
name: developer
description: Full development workflow including testing
tools: Read, Write, Edit, Bash, Glob, Grep
---
```

**Use Case**: Feature implementation, bug fixing, refactoring

#### Orchestration Agent
```yaml
---
name: orchestrator
description: Coordinates multiple specialized sub-agents
tools: Read, Task
---
```

**Use Case**: Complex workflows requiring delegation to multiple specialized agents

#### Testing Agent
```yaml
---
name: test-runner
description: Executes tests and analyzes results
tools: Read, Bash, Grep
---
```

**Use Case**: Running test suites, parsing test output, identifying failures

## Automatic vs Manual Sub-Agent Invocation (October 2025)

### Automatic Delegation

**New in October 2025**: Claude can automatically select and invoke appropriate sub-agents based on task requirements without explicit Task tool calls from the main agent.

**How it works**:
- Define sub-agents with clear `description` fields explaining their capabilities
- Claude analyzes user requests and automatically routes to appropriate specialist
- No manual Task tool invocation required from main agent
- Similar to how Claude automatically selects tools
- Improves user experience by reducing explicit orchestration needs

**When to use Automatic Delegation**:
- User-facing workflows where Claude should intelligently decide which specialist to use
- Multi-agent systems with clear role separation and well-defined descriptions
- Scenarios where the "best" agent depends on analyzing the user's request
- Applications where explicit orchestration would be cumbersome

**Requirements for Automatic Delegation**:
- Sub-agents must have descriptive `description` fields that clearly explain:
  - What tasks the agent handles
  - When it should be invoked
  - What capabilities it provides
- Descriptions should use keywords and phrases that match likely user requests

### Manual Invocation (via Task Tool)

**When to use Manual Invocation**:
- Explicit control over agent selection is required
- Complex orchestration with specific sequencing or dependencies
- Programmatic workflows where agent choice is deterministic
- Multi-step processes requiring coordination between agents
- When the main agent needs to analyze results before delegating further

**Best Practice**: Use automatic delegation for user-facing features, manual invocation for complex programmatic workflows.

## Invoking Sub-Agents via Task Tool

### Task Tool Syntax

The main agent invokes sub-agents using the Task tool:

```
Task(
  description="short-task-description",
  subagent_type="general-purpose",
  prompt="Detailed instructions for the sub-agent..."
)
```

### Task Tool Parameters

- **`description`**: Short identifier for the task (logging purposes)
- **`subagent_type`**: Usually `"general-purpose"` (determines which agent definition to use)
- **`prompt`**: Complete instructions the sub-agent receives

### Understanding the subagent_type Parameter

The `subagent_type` parameter specifies which type of agent framework to use for the task:

- **`"general-purpose"`**: Standard value for most use cases
  - Tells Claude Code to use the agent matching the description/name in the prompt
  - The agent's `name` field from frontmatter is referenced in the prompt to identify which agent to invoke
  - This is the recommended value for custom sub-agents defined in your plugin

**Other agent types**: Claude Code may support specialized agent types for specific frameworks. Check documentation for available options in your version.

**Best Practice**: Always use `"general-purpose"` unless working with specialized agent frameworks or when documentation specifies otherwise.

### Critical Understanding

**The sub-agent receives ONLY the prompt parameter**:
- Sub-agent has no knowledge of the main conversation
- Sub-agent cannot see previous messages
- All context must be included in the prompt
- File paths, requirements, constraints must be explicit

### Invocation Example

**Main Agent Action**:
```
Task(
  description="analyze-auth-flow",
  subagent_type="general-purpose",
  prompt="You are the code-reviewer agent.

Analyze the authentication flow in /workspace/packages/api/src/auth/.

Specifically examine:
1. /workspace/packages/api/src/auth/login.ts
2. /workspace/packages/api/src/auth/middleware.ts
3. /workspace/packages/api/src/auth/tokens.ts

Check for:
- Security vulnerabilities (SQL injection, XSS, etc.)
- Missing input validation
- Improper error handling
- Token expiration logic

Report findings with:
- Severity (Critical/High/Medium/Low)
- File path and line number
- Description of issue
- Recommended fix"
)
```

**What Sub-Agent Receives**:
The entire `prompt` parameter becomes the sub-agent's instructions, combined with its system prompt from the markdown body.

### Best Practices for Task Invocation

1. **Include all context**: File paths, specific requirements, expected format
2. **Be explicit about scope**: What to analyze, what to ignore
3. **Specify output format**: How to structure the response
4. **Provide examples**: Show expected output format if complex
5. **Reference absolute paths**: Always use `/workspace/...` for file references

## System Prompt Best Practices

The markdown body (everything after `---` closing delimiter) becomes the agent's system prompt.

### Structure Your Prompts

**Essential Sections**:

1. **Role Definition**: "You are a specialized agent for..."
2. **Context**: "You operate on /workspace with..."
3. **Available Tools**: List tools from frontmatter
4. **Responsibilities**: Primary tasks and goals
5. **Constraints**: What not to do, limitations
6. **Process**: Step-by-step workflow
7. **Working Directory**: Path resolution rules
8. **Examples**: Demonstrate expected behavior

### Length Guidance

- **Basic agents** (simple, focused task): 200-500 words
- **Specialized agents** (moderate complexity): 500-1000 words
- **Complex agents** (multi-step workflows): 1000-2000 words

**Warning**: Prompts beyond 2000 words may impact performance and clarity. If your prompt is very long, consider breaking into multiple specialized agents.

### Example: Code Reviewer Agent

```markdown
---
name: code-reviewer
description: Reviews code changes for quality, best practices, and bugs in TypeScript/JavaScript files
tools: Read, Grep, Bash
model: sonnet
---

# Code Reviewer Agent

You are a specialized code review agent operating on the codebase at /workspace.

## Available Tools
- **Read**: Read file contents at absolute paths like /workspace/src/file.ts
- **Grep**: Search for patterns across the codebase
- **Bash**: Execute linters and type checkers from /workspace

## Your Responsibilities

1. **Quality Analysis**: Identify code smells, anti-patterns, and maintainability issues
2. **Best Practices**: Check adherence to TypeScript/JavaScript conventions
3. **Bug Detection**: Find potential runtime errors, type issues, logic bugs
4. **Security Review**: Identify common vulnerabilities (injection, XSS, etc.)

## Constraints

- **Read-only**: Never modify files, only analyze and report
- **TypeScript Focus**: Primarily review .ts and .tsx files
- **Absolute Paths**: Always use /workspace/... in reports
- **No Assumptions**: Base findings on actual code, not hypotheticals

## Review Process

1. **Read Target Files**: Use Read tool with absolute paths
2. **Run Type Checker**: Execute `yarn typecheck` from /workspace if needed
3. **Search Patterns**: Use Grep to find anti-patterns or security issues
4. **Analyze Code**: Evaluate quality, maintainability, correctness
5. **Generate Report**: Structured findings with severity and locations

## Report Format

For each finding:
- **Severity**: Critical | High | Medium | Low
- **Location**: /workspace/path/to/file.ts:45
- **Issue**: Clear description of the problem
- **Impact**: Why this matters
- **Recommendation**: Specific fix or improvement

## Example Review

### Input from Main Agent
"Review /workspace/packages/api/src/controllers/user.ts for security issues"

### Output
#### Finding 1
- **Severity**: High
- **Location**: /workspace/packages/api/src/controllers/user.ts:78
- **Issue**: SQL query uses string concatenation with user input
- **Impact**: SQL injection vulnerability allows attackers to execute arbitrary queries
- **Recommendation**: Use parameterized queries: `db.query('SELECT * FROM users WHERE id = ?', [userId])`

#### Finding 2
- **Severity**: Medium
- **Location**: /workspace/packages/api/src/controllers/user.ts:92
- **Issue**: Password comparison uses === instead of constant-time comparison
- **Impact**: Timing attack could reveal password information
- **Recommendation**: Use bcrypt.compare() or crypto.timingSafeEqual()

## Working Directory
- All Bash commands execute from /workspace
- Use absolute paths: /workspace/packages/api/src/...
- Relative paths resolve from /workspace
```

## Agent Naming Conventions

### Filename vs Frontmatter Name

- **Filename** (without `.md`): Used in marketplace.json components array
- **Frontmatter `name` field**: Used in Task tool invocation

**Example**:
- File: `/workspace/my-plugin/agents/code-reviewer.md`
- Marketplace.json: `"agents": ["code-reviewer"]`
- Frontmatter: `name: code-reviewer`
- Task invocation: Reference in prompt as "code-reviewer agent"

**Best Practice**: Keep filename and frontmatter name identical for clarity.

### Naming Patterns

**Format**: Lowercase letters, numbers, hyphens only

**Role-Based Names** (Recommended):
- `code-reviewer` - Reviews code quality
- `test-generator` - Generates test cases
- `bug-analyzer` - Analyzes bug reports
- `documentation-writer` - Creates documentation
- `refactoring-assistant` - Helps refactor code

**Task-Based Names**:
- `typescript-checker` - Checks TypeScript types
- `dependency-updater` - Updates dependencies
- `migration-helper` - Assists with migrations

**Avoid**:
- ❌ Generic names: `helper`, `agent`, `tool`
- ❌ Vague names: `utils`, `misc`, `general`
- ❌ Uppercase or underscores: `CodeReviewer`, `code_reviewer`

## Working Directory Context

### Default Working Directory

Sub-agents inherit the parent's working directory, typically `/workspace`.

**Path Resolution**:
- **Absolute paths** (starting with `/`): Resolve from filesystem root
  - `/workspace/packages/api/src/file.ts` - Always this exact location
- **Relative paths** (no leading `/`): Resolve from current working directory
  - `packages/api/src/file.ts` - Resolves to `/workspace/packages/api/src/file.ts` when cwd is `/workspace`

### Best Practices for Paths

**In Agent System Prompts**:
```markdown
Always use absolute paths like /workspace/packages/api/src/file.ts

When running bash commands, execute from /workspace:
```bash
cd /workspace && yarn test
```
```

**In Task Invocations**:
```
Task(
  prompt="Analyze /workspace/packages/api/src/auth/login.ts for security issues..."
)
```

**Why Absolute Paths**:
1. Unambiguous - always refers to the same location
2. Portable - works regardless of current directory
3. Debuggable - clear in logs and error messages

## Tool Enforcement Behavior

### How Restrictions Work

**Claude Code enforces tool restrictions automatically**. If a sub-agent attempts to use a non-allowed tool:

1. Tool call **fails immediately** with an error
2. Agent receives error message: `"Tool [ToolName] not allowed for agent 'agent-name'"`
3. Restrictions **cannot be bypassed**

### Example Enforcement

**Agent Definition**:
```yaml
---
name: read-only-analyzer
tools: Read, Grep
---
```

**Attempted Tool Use**:
```
Write(file_path="/workspace/output.txt", content="results")
```

**Result**:
```
Error: Tool Write not allowed for agent 'read-only-analyzer'
Agent has access to: Read, Grep
```

### Designing for Restrictions

When creating tool-restricted agents:

1. **Document available tools** in system prompt
2. **Explain what agent CAN'T do** due to restrictions
3. **Provide workarounds** if needed (e.g., "report findings to main agent for it to write")
4. **Test enforcement** by attempting restricted tool use

## Troubleshooting Agent Invocation

### Issue: Agent Not Found

**Symptom**: Task invocation fails with "agent not found"

**Causes**:
1. Agent file doesn't exist at `/workspace/<plugin>/agents/<name>.md`
2. File has wrong extension (not `.md`)
3. YAML frontmatter is invalid (parsing error)

**Solutions**:
- Verify file exists with `ls /workspace/<plugin>/agents/`
- Check file extension is `.md` (lowercase)
- Validate YAML: ensure `---` delimiters are exact, no tabs

### Issue: Tool Restriction Error

**Symptom**: Agent fails with "Tool [Name] not allowed"

**Causes**:
1. Agent tried to use a tool not in its `tools` list
2. Used `allowed-tools` instead of `tools` (wrong field name for agents)

**Solutions**:
- Check agent frontmatter has `tools: Read, Write, ...` (correct field)
- Verify tool name is in the comma-separated list
- Update system prompt to reflect available tools

### Issue: Invalid YAML Frontmatter

**Symptom**: Agent doesn't load or shows parsing error

**Causes**:
1. Tabs instead of spaces for indentation
2. Missing closing `---` delimiter
3. Unquoted special characters (`:`, `#`, `"`, `'`)
4. Wrong tools format (using array `[Read, Write]` instead of string)

**Solutions**:
```yaml
# Correct:
---
name: agent-name
description: "Contains: special chars, so quoted"
tools: Read, Write, Bash
model: sonnet
---

# Wrong:
---
name: agent-name
description: Contains: unquoted colons  # Breaks parser
tools: [Read, Write]  # Wrong format
model: sonnet
--- # Trailing space breaks delimiter
```

### Issue: Agent Receives No Context

**Symptom**: Agent responds with "I don't have enough information"

**Cause**: Main agent's Task prompt didn't include necessary context

**Solution**: Include all context in the prompt parameter:
```
Task(
  prompt="You are the analyzer agent.

  Working directory: /workspace
  Target files:
  - /workspace/src/auth/login.ts
  - /workspace/src/auth/middleware.ts

  Task: Find security vulnerabilities

  Report format:
  - Severity
  - File:line
  - Issue description
  - Recommendation"
)
```

## Example Workflows

### Workflow 1: Code Review Pipeline

**✅ BEST PRACTICE - Parallel Execution**:

When delegating to specialized review agents, invoke ALL independent sub-agents in a SINGLE message for parallel execution:

```
# Send ONE message with MULTIPLE Task calls
Task(
  description="security-review",
  subagent_type="general-purpose",
  prompt="You are the security-reviewer agent.
  Review /workspace/packages/api/src/auth/ for security issues..."
)

Task(
  description="quality-review",
  subagent_type="general-purpose",
  prompt="You are the code-quality-reviewer agent.
  Review /workspace/packages/api/src/auth/ for code quality..."
)

Task(
  description="performance-review",
  subagent_type="general-purpose",
  prompt="You are the performance-reviewer agent.
  Review /workspace/packages/api/src/auth/ for performance issues..."
)
```

**Benefits**:
- **Faster**: All agents run simultaneously, not sequentially
- **Context preservation**: Uses main context more efficiently
- **Recommended pattern**: October 2025 best practice for independent tasks

**When to use parallel execution**:
- Reviews/analyses that don't depend on each other
- Multiple file transformations
- Independent data gathering tasks

**When NOT to use**: When tasks have dependencies (Task 2 needs Task 1's results)

**❌ ANTI-PATTERN - Sequential Execution** (slower, less efficient):

Avoid splitting independent tasks across multiple messages:

```
# DON'T DO THIS - Two separate messages
Task(
  description="security-review",
  subagent_type="general-purpose",
  prompt="..."
)
# Then later...
Task(
  description="quality-review",
  subagent_type="general-purpose",
  prompt="..."
)
```

**Why this is inefficient**:
- Agents run sequentially instead of in parallel
- Takes 2x-3x longer to complete
- Wastes main agent's context window waiting for sequential results

### Workflow 2: Multi-Stage Processing

**Orchestrator agent** coordinates multiple agents:

```markdown
---
name: orchestrator
description: Coordinates complex multi-stage workflows
tools: Read, Task
---

You coordinate complex tasks by delegating to specialized agents.

Process:
1. Read requirements from main agent prompt
2. Invoke appropriate sub-agents via Task tool
3. Aggregate results
4. Report unified findings
```

### Workflow 3: Read-Only Analysis + Main Agent Writes

**Analyzer agent** (read-only):
```yaml
---
name: analyzer
tools: Read, Grep, Bash
---
```

**Main agent**:
1. Invokes analyzer agent to get findings
2. Analyzer reports issues (can't write)
3. Main agent uses Write tool to create fixes

This pattern ensures separation of concerns: analysis vs. modification.

### Workflow 4: Pipeline Architecture (October 2025 Pattern)

**Multi-stage development pipeline** with separation of concerns and independent verification:

```
# Stage 1: Requirements Analysis
Task(
  description="requirements-analysis",
  subagent_type="general-purpose",
  prompt="You are the product-manager agent.

  Analyze the user request and create structured requirements:
  1. User needs and objectives
  2. Acceptance criteria
  3. Technical constraints
  4. Success metrics

  Read relevant context from /workspace/..."
)

# Stage 2: Architecture Validation
Task(
  description="architecture-review",
  subagent_type="general-purpose",
  prompt="You are the architect agent.

  Review the requirements and validate against system architecture:
  1. Check compatibility with existing design patterns in /workspace/docs/architecture.md
  2. Identify required changes to system architecture
  3. Flag potential conflicts or technical debt
  4. Recommend implementation approach"
)

# Stage 3: Implementation
Task(
  description="implementation",
  subagent_type="general-purpose",
  prompt="You are the developer agent.

  Implement features per validated requirements:
  1. Write code following project conventions
  2. Add tests for new functionality
  3. Update documentation

  Work in /workspace/..."
)

# Stage 4: Quality Assurance
Task(
  description="qa-verification",
  subagent_type="general-purpose",
  prompt="You are the qa agent.

  Verify implementation meets requirements:
  1. Run all tests (unit, integration, e2e)
  2. Check code coverage
  3. Verify acceptance criteria from Stage 1
  4. Test edge cases and error handling"
)
```

**Benefits of Pipeline Architecture**:
- **Clear separation of concerns**: Each agent specializes in one phase
- **Independent verification**: QA agent validates without implementation bias
- **Reduces overfitting**: Separate agents prevent solutions tailored only to pass tests
- **Repeatable process**: Codified workflow ensures consistency
- **Parallel stages**: Stages 1-2 can run in parallel, then stages 3-4 sequentially

### Workflow 5: Test-Driven Development (October 2025)

**Pattern**: Use independent sub-agents to prevent overfitting and ensure robust implementation.

```
# Agent 1: Test Writer (based on requirements)
Task(
  description="test-writer",
  subagent_type="general-purpose",
  prompt="You are the test-writer agent.

  Create comprehensive tests based on requirements:
  1. Read requirements from prompt
  2. Write unit and integration tests
  3. Cover happy paths, edge cases, error conditions
  4. DO NOT look at implementation code

  Write tests to /workspace/tests/..."
)

# Agent 2: Implementation Agent (isolated from test code)
Task(
  description="implementation",
  subagent_type="general-purpose",
  prompt="You are the developer agent.

  Implement functionality to pass the tests:
  1. Read requirements (NOT test code)
  2. Write clean implementation
  3. Run tests to verify correctness
  4. Focus on requirements, not test implementation details"
)

# Agent 3: Verification Agent (independent review)
Task(
  description="verification",
  subagent_type="general-purpose",
  prompt="You are the verification agent.

  Verify implementation doesn't overfit to tests:
  1. Review implementation code in /workspace/src/
  2. Review test code in /workspace/tests/
  3. Check if implementation is overly specific to test cases
  4. Verify solution is general and maintainable
  5. Flag any red flags (hardcoded values, brittle assumptions)"
)
```

**Why this works**:
- **Separate contexts**: Each agent has independent context, reducing bias
- **Prevents overfitting**: Implementation agent doesn't see test internals
- **Independent verification**: Third agent catches overfitting patterns
- **Better code quality**: Results in more robust, maintainable implementations

## Quick Reference

### Agent File Checklist

- [ ] File at `/workspace/<plugin>/agents/<name>.md`
- [ ] YAML frontmatter with `---` delimiters
- [ ] Required: `name` field (lowercase, hyphens)
- [ ] Required: `description` field (natural language)
- [ ] Optional: `tools` field (comma-separated string, NOT array)
- [ ] Optional: `model` field (`sonnet`|`opus`|`haiku`|`inherit`)
- [ ] Markdown body with system prompt
- [ ] Agent name matches filename (without `.md`)
- [ ] Listed in marketplace.json components.agents array

### Task Invocation Checklist

- [ ] Use `Task()` tool from main agent
- [ ] Include `description` parameter (short identifier)
- [ ] Include `subagent_type` parameter (usually `"general-purpose"`)
- [ ] Include `prompt` parameter with complete instructions
- [ ] Prompt contains all necessary context
- [ ] Prompt specifies absolute paths (`/workspace/...`)
- [ ] Prompt defines expected output format
- [ ] Prompt aligns with agent's available tools

### Common Tool Combinations Reference

| Agent Type | Tools | Use Case |
|------------|-------|----------|
| Analyzer | `Read, Grep, Bash` | Read-only analysis |
| File Manager | `Read, Write, Edit, Glob` | File operations |
| Developer | `Read, Write, Edit, Bash, Grep` | Full development |
| Orchestrator | `Read, Task` | Coordinates sub-agents |
| Tester | `Read, Bash, Grep` | Runs tests, analyzes output |
| Generator | `Read, Write, Glob` | Creates new files |
| Reviewer | `Read, Grep` | Code review only |

### YAML Frontmatter Template

```yaml
---
name: agent-identifier
description: Natural language description with keywords for when to invoke
tools: Read, Write, Edit, Bash, Glob, Grep, Task
model: sonnet
---
```

**Field Names**:
- Agents: `tools` (no hyphen)
- Skills: `allowed-tools` (hyphenated)
- Using wrong field name = all tools granted by default

**Model Values**:
- `sonnet` - Balanced (recommended)
- `opus` - Maximum capability
- `haiku` - Fast and lightweight
- `inherit` - Use parent's model (default)

---

## Summary

Sub-agents are powerful tools for delegating specialized work with constrained tool access. Key principles:

1. **Explicit Invocation**: Main agent calls via Task tool
2. **Tool Restrictions**: Use `tools` field (comma-separated string)
3. **Focused Prompts**: System prompt defines role, process, constraints
4. **Context Provision**: Task prompt must include all context
5. **Absolute Paths**: Always use `/workspace/...` for clarity
6. **Proper YAML**: Follow exact format, no tabs, quote special chars

When creating agents:
- Start with clear role definition
- List available tools explicitly
- Define process step-by-step
- Include examples of expected behavior
- Test with actual invocations

## Official Documentation

For the latest information and updates, refer to the official Claude Code documentation:

- **Sub-Agents Documentation**: https://docs.claude.com/en/docs/claude-code/sub-agents
- **Plugins Documentation**: https://docs.claude.com/en/docs/claude-code/plugins
- **Task Tool Reference**: https://docs.claude.com/en/docs/claude-code/cli-reference

## See Also

**Related Skills** (in this plugin):
- **Plugin Management**: Creating plugins that contain sub-agents
- **Slash Command Management**: User-invoked commands (different invocation pattern)
- **Skill Management**: Autonomous capabilities (different from explicit invocation)
- **Plugin Marketplace Management**: Registering agents in marketplace.json

**Key Differences**:
- **Sub-agents vs Skills**: Sub-agents are explicitly invoked via Task tool; skills activate autonomously
- **Sub-agents vs Commands**: Sub-agents are programmatic; commands are user-typed
- **Tool Restrictions**: Both sub-agents and skills support restrictions, but use different field names (`tools` vs `allowed-tools`)

**Related Topics**:
- Model selection (Haiku 4.5 for cost-effective agents, October 2025)
- Parallel execution patterns (best practice for independent tasks)
- Tool restriction security implications
- Working directory inheritance

---

*Last Updated: October 2025*
