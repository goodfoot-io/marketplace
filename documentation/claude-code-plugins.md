# Claude Code Plugin Marketplace Implementation Guide

This guide provides technical specifications for creating and validating Claude Code plugin marketplaces in `/workspace`. For general plugin concepts, see the [official plugins documentation](https://docs.claude.com/en/docs/claude-code/plugins.md).

<system-overview>

## Claude Code Plugin System

**Core Concept**: Claude Code plugins are extensions that add custom slash commands, specialized sub-agents, autonomous skills, and event hooks to Claude Code's functionality.

**Component Types**:
- **Slash Commands**: User-invoked markdown files with instructions (e.g., `/commit`, `/analyze`)
- **Sub-Agents**: Specialized AI agents with constrained tools and focused prompts invoked via Task tool
- **Skills**: Autonomously invoked capabilities that Claude decides when to use based on context
- **Hooks**: Event-triggered scripts that execute at specific points in the Claude Code lifecycle

**Marketplace Structure**: A marketplace is a git repository containing multiple plugins, each with a `.claude-plugin/plugin.json` manifest. Users install plugins via `/plugin install <name>@<marketplace>`.

**Component Loading**: Claude Code automatically discovers components in default directories (`commands/`, `agents/`, `skills/`, `hooks/`) at plugin root. See [plugins reference](https://docs.claude.com/en/docs/claude-code/plugins-reference.md) for complete loading behavior.

**Key Distinction**:
- **Sub-agents**: Explicitly invoked by main agent via Task tool; restricted tool access; focused system prompt
- **Skills**: Autonomously invoked by Claude based on description matching context; optional tool restrictions

**Validation & Loading**: Claude Code validates plugin structure on installation (via `/plugin install`). Components are loaded immediately after successful installation and become available for use. Name/version mismatches between marketplace.json and plugin.json prevent installation.

**Component Name Collisions**: If multiple installed plugins have components with the same name (e.g., two plugins both have `/analyze` command), the most recently installed plugin's component takes precedence. Avoid collisions by using descriptive, unique names.

</system-overview>

<for-claude>

## For Claude: Your Role in This System

**You are the main agent** reading this guide. Understanding your role is critical for successful marketplace implementation:

### Invoking Sub-Agents

When you need to delegate work to a specialized sub-agent, use the Task tool:

```
Task(
  description="short-task-name",
  subagent_type="general-purpose",
  prompt="Detailed task instructions for the sub-agent..."
)
```

The sub-agent receives the prompt as its instructions and has no knowledge of this conversation. Include all necessary context (file paths, requirements, etc.) in the prompt.

### Skills Autonomous Activation

**You decide** when to activate skills by matching skill descriptions to the current conversation context:

1. Skills are loaded automatically when plugins are installed
2. Each skill has a `description` field with trigger keywords
3. **You read these descriptions** and match them against:
   - User's current request
   - Conversation context and topic
   - Keywords and capability statements
4. When you determine a skill is relevant, **you activate it by loading its SKILL.md instructions**
5. The skill's markdown body becomes additional instructions for you to follow

**Example**: If a skill has `description: "Fixes TypeScript import errors in /workspace when module not found errors occur"`, you should activate it when:
- User mentions "import error" or "cannot find module"
- TypeScript compiler output shows import-related errors
- You're working with TypeScript files and encounter import issues

### Tool Restrictions Enforcement

When using tools in agents or skills with restricted tool access:

**Claude Code enforces tool restrictions automatically.** If you attempt to use a non-allowed tool:
- The tool call **fails with an error**
- You receive an error message: "Tool [ToolName] not allowed in this context"
- You cannot bypass restrictions

**Example**: If an agent has `tools: Read, Grep` and you try to use Write:
```
Attempted: Write(file_path="/workspace/file.txt", content="...")
Result: Error - "Tool Write not allowed for agent 'read-only-agent'"
```

### Working Directory Context

Your working directory determines how relative paths resolve:

- **Default (main agent, hooks)**: `/workspace` (project root)
- **During skill execution**: `/workspace/<plugin-name>/skills/<skill-name>/` (skill directory)
- **Sub-agents**: Inherit parent's working directory unless changed by the sub-agent

**Path Resolution Rules**:
- Absolute paths (starting with `/`): Resolve from filesystem root
  - `/workspace/file.txt` always refers to that exact location
- Relative paths (no leading `/`): Resolve from current working directory
  - `scripts/helper.py` resolves differently depending on where you execute

**Best Practice**: Use absolute paths (starting with `/workspace/`) in:
- Command markdown bodies
- Agent system prompts
- Hook command strings
- When referencing files across the project

Use relative paths in:
- Skill markdown when referencing skill's own support files
  - `scripts/helper.py` when skill is in `/workspace/plugin/skills/skill-name/`

### Slash Command Injection

When a user types `/command-name`:

1. Claude Code finds the corresponding command markdown file
2. **The markdown body is injected into our conversation** as system instructions
3. You receive these instructions and follow them as if they were part of your system prompt
4. The user sees your response to their command

Commands do NOT receive arguments. The command name itself (like `/analyze`) triggers the instruction injection, but `/analyze arg1 arg2` simply injects the same instructions - arguments are not passed separately.

</for-claude>

<shared-conventions>

## Shared Technical Conventions

These rules apply across all component types to ensure consistency.

### Naming Patterns

**Identifiers** (plugin names, agent names, command filenames without extension):
- **Format**: `[a-z0-9]+(-[a-z0-9]+)*` (lowercase letters, numbers, hyphens)
- **Examples**: ✅ `git-tools`, `typescript-helper`, `analyze-performance`
- **Invalid**: ❌ `GitTools`, `typescript_helper`, `-start-with-hyphen`

**Display Names** (skill names, descriptions):
- Can include spaces, capitals, and most Unicode characters
- No hard length limit but keep under 100 characters for usability

### YAML Frontmatter Rules

All component markdown files (commands, agents, skills) use YAML frontmatter. Apply these rules consistently:

**Structure Requirements**:
1. **Delimiters**: Exactly `---` on its own line (no leading/trailing whitespace or content)
2. **Indentation**: Spaces only, never tabs (2 or 4 spaces consistently)
3. **String handling**: Quote strings containing `: " ' | # @ !` characters
4. **Multi-line strings**: Use `|` (preserve newlines) or `>` (fold newlines)

**Example**:
```yaml
---
name: component-identifier
description: Brief description on one line
field-with-special-chars: "Contains: colons and quotes"
multi-line-content: |
  This text spans
  multiple lines
  preserving newlines.
---
```

**Common Errors**:
- ❌ `--- ` (trailing space)
- ❌ `name: value` then tab-indented content
- ❌ `description: Has: unquoted colon` (breaks YAML parser)
- ❌ Missing closing `---` delimiter

### Tools Field Format

When restricting tool access in agents or skills:

**Format**: Comma-separated list of tool names (as string, not YAML array)
```yaml
tools: Read, Write, Bash, Grep              # For agents
allowed-tools: Read, Write, Edit            # For skills
```

**NOT** YAML list syntax:
```yaml
# Don't use this format:
tools: [Read, Write, Bash]
allowed-tools: [Read, Edit]
```

**Field Name Distinction**:
- **Agents** use `tools` (no hyphen) - loaded via Task tool invocation
- **Skills** use `allowed-tools` (hyphenated) - loaded for autonomous activation

**Why different names?** Claude Code loads agents and skills through different mechanisms. Using the wrong field name (e.g., `tools` in a skill or `allowed-tools` in an agent) causes the field to be ignored, granting all tools by default.

**Omitting the field**: Grants all tools including MCP-provided tools (Model Context Protocol external integrations)

**Tool Names**: Use exact capitalization (e.g., `Read`, `Write`, `Bash`, `Glob`, `Grep`, `Edit`, `Task`). Claude has access to its own tool function names at runtime - no external reference needed.

### Bash Command Escaping

When embedding bash in JSON (hooks) or markdown code blocks:

**In JSON strings** (hooks.json):
```json
{
  "command": "bash -c 'cat | jq .output > /tmp/log.txt'"
}
```
- Quote entire command with double quotes
- Use single quotes internally for bash strings
- Escape internal double quotes with `\"` if needed
- Wrap complex pipes in `bash -c '...'`

**In Markdown code blocks** (command/agent/skill markdown):
````markdown
```bash
#!/bin/bash
if [ -f "file.txt" ]; then
  echo "File exists"
fi
```
````
- Use fenced code blocks with `bash` language identifier
- No escaping needed within code blocks
- Use inline code with backticks for inline commands: `` `git status` ``

**Do NOT** put raw bash in YAML frontmatter - it will break parsing.

</shared-conventions>

<marketplace-structure>

## Marketplace Directory Layout

Reference for this repository: `/workspace/.claude-plugin/marketplace.json`

**⚠️ EXACT NAMING REQUIRED**: Directory and file names are case-sensitive and must be exactly as shown:
- Directory: `.claude-plugin` (lowercase, with leading dot and hyphen)
- Files: `marketplace.json`, `plugin.json` (lowercase)
- Component directories: `commands`, `agents`, `skills`, `hooks` (lowercase, plural)
- Skill definition: `SKILL.md` (all caps with .md extension)

Required structure:
```
/workspace/
├── .claude-plugin/
│   └── marketplace.json      # Required: Marketplace metadata and plugin catalog
├── plugin-name-1/             # Individual plugin directories at repo root
│   ├── .claude-plugin/
│   │   └── plugin.json        # Required: Plugin metadata
│   ├── commands/              # Optional: Slash commands (auto-discovered)
│   │   └── command-name.md    # Filename (minus .md) = command name
│   ├── agents/                # Optional: Sub-agent definitions (auto-discovered)
│   │   └── agent-name.md
│   ├── skills/                # Optional: Autonomous skills (auto-discovered)
│   │   └── skill-name/        # Skills require subdirectory
│   │       ├── SKILL.md       # Required: Skill definition
│   │       ├── scripts/       # Optional: Helper scripts
│   │       └── templates/     # Optional: File templates
│   └── hooks/                 # Optional: Event hooks
│       └── hooks.json         # Default location for hook config
├── plugin-name-2/
│   └── ...
└── README.md                  # Recommended: Marketplace documentation
```

**Critical Path Rules**:
1. Plugin directories must be siblings to `.claude-plugin/` at marketplace root
2. Component directories (`commands/`, `agents/`, `skills/`, `hooks/`) live at plugin root, NOT inside `.claude-plugin/`
3. `.claude-plugin/` contains ONLY `plugin.json` (and optionally `marketplace.json` at repo root)
4. Skills MUST be subdirectories containing `SKILL.md`, not `skills/skill-name.md`
5. Command names come from filename: `analyze-code.md` → `/analyze-code`

</marketplace-structure>

<marketplace-metadata>

## marketplace.json Format

Location: `/workspace/.claude-plugin/marketplace.json`

See [plugins reference](https://docs.claude.com/en/docs/claude-code/plugins-reference.md) for complete field specifications.

### Required Structure

```json
{
  "name": "marketplace-identifier",
  "description": "Human-readable marketplace description",
  "version": "1.0.0",
  "plugins": [
    {
      "name": "plugin-identifier",
      "path": "./plugin-directory-name",
      "description": "Plugin description",
      "version": "1.0.0",
      "author": {
        "name": "Author Name",
        "email": "author@example.com"
      },
      "tags": ["category1", "category2"],
      "components": {
        "commands": ["command1", "command2"],
        "agents": ["agent1"],
        "skills": ["skill1"],
        "hooks": ["PreToolUse", "PostToolUse"]
      }
    }
  ]
}
```

### Field Specifications

| Field | Type | Required | Format | Notes |
|-------|------|----------|--------|-------|
| `name` | string | Yes | Lowercase, hyphens only (see Naming Patterns above) | Marketplace unique identifier |
| `description` | string | Yes | Free text | Displayed in marketplace listings |
| `version` | string | Yes | Semver (X.Y.Z) | Marketplace version (see Versioning Strategy) |
| `plugins` | array | Yes | Array of plugin objects | Must contain at least one plugin |
| `plugins[].name` | string | Yes | Lowercase, hyphens only | Must match corresponding plugin.json name exactly |
| `plugins[].path` | string | Yes | Relative path from marketplace root | Must start with `./` prefix |
| `plugins[].version` | string | Yes | Semver (X.Y.Z) | Must match corresponding plugin.json version exactly |
| `plugins[].author` | object | Yes | `{name: string, email?: string}` | Object is required; email field within it is optional |
| `plugins[].tags` | array | No | Array of strings | For categorization/filtering in marketplace UI |
| `plugins[].components` | object | No | Component map (see below) | Lists available features for discovery |

**components Object Format**:
```json
{
  "commands": ["command-file-name"],     // Filename WITHOUT .md extension
  "agents": ["agent-file-name"],         // Filename WITHOUT .md extension
  "skills": ["skill-directory-name"],    // Directory name containing SKILL.md
  "hooks": ["PreToolUse", "PostToolUse"] // Hook event types defined in hooks.json
}
```

**Critical Component Naming**:
- `commands`: Use filename without `.md` extension (e.g., file `analyze.md` → `"commands": ["analyze"]`)
- `agents`: Use filename without `.md` extension (e.g., file `helper.md` → `"agents": ["helper"]`)
- `skills`: Use directory name (e.g., directory `document-code/` → `"skills": ["document-code"]`)
- `hooks`: Use event type names (e.g., `"hooks": ["PreToolUse", "UserPromptSubmit"]`)

### Validation Rules

- **Path integrity**: `plugins[].path` must point to directory containing `.claude-plugin/plugin.json`
- **Name consistency**: `plugins[].name` must exactly match `<plugin-path>/.claude-plugin/plugin.json::name`
- **Version consistency**: `plugins[].version` must exactly match `<plugin-path>/.claude-plugin/plugin.json::version`
- **Component verification**: Each listed component must exist at its declared path using naming rules above

</marketplace-metadata>

<plugin-metadata>

## plugin.json Format

Location: `/workspace/<plugin-name>/.claude-plugin/plugin.json`

See [plugins reference](https://docs.claude.com/en/docs/claude-code/plugins-reference.md) for extended fields (homepage, repository, license, keywords).

### Minimal Required Structure

```json
{
  "name": "plugin-identifier",
  "description": "Plugin description",
  "version": "1.0.0",
  "author": {
    "name": "Author Name"
  }
}
```

### Field Specifications

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | Must exactly match marketplace.json entry |
| `description` | string | Yes | Should match marketplace.json entry (not validated but recommended) |
| `version` | string | Yes | Semver format, must exactly match marketplace.json |
| `author` | object | Yes | Required object with required `name` field |
| `author.name` | string | Yes | Free text |
| `author.email` | string | No | Valid email format if provided; can omit entirely or set to null |

### Validation Checklist

When validating plugin.json:
1. File exists at `/workspace/<plugin>/>.claude-plugin/plugin.json`
2. Valid JSON syntax (parseable with `jq empty`)
3. All required fields present (name, description, version, author object with name field)
4. Version matches semver pattern `X.Y.Z` where X, Y, Z are integers
5. Name matches marketplace.json declaration exactly (case-sensitive)
6. Email (if present) matches basic email pattern (contains @ and domain)

</plugin-metadata>

<slash-commands>

## Slash Command Format

Location: `/workspace/<plugin-name>/commands/<command-name>.md`

**⚠️ EXACT NAMING**: Command files must have `.md` extension (lowercase). The filename (minus `.md`) becomes the command name. Example: `analyze.md` → `/analyze` command.

Slash commands are user-invoked instructions. When user types `/command-name`, Claude receives the markdown body as context.

### File Structure

```markdown
---
description: Brief description of what this command does (required)
---

# Command Implementation

Detailed instructions for Claude to execute when command is invoked.

Can include:
- Multi-line instructions
- Code examples in fenced blocks
- References to files using absolute paths like /workspace/...
- Embedded bash (see Bash Command Escaping in shared conventions)
```

**Frontmatter Requirements**:
- `description`: Required field; brief explanation shown in command listings
- Other fields ignored by Claude Code but permitted for metadata

**Command Invocation**: Filename (minus `.md`) becomes command name:
- `analyze-performance.md` → User invokes with `/analyze-performance`
- `commit.md` → User invokes with `/commit`
- `git-status.md` → User invokes with `/git-status`

### Example Command

File: `/workspace/my-plugin/commands/validate-typescript.md`

```markdown
---
description: Run TypeScript compiler and report type errors with file locations
---

# TypeScript Validation Command

Run the TypeScript compiler in check mode and analyze any errors:

1. Navigate to the project root (currently /workspace)
2. Run `yarn typecheck` (this repository uses Yarn 4.9.2)
3. Parse output for type errors
4. For each error, report:
   - File path (absolute path from /workspace)
   - Line number
   - Error message
5. Suggest fixes for common patterns

Use absolute paths like `/workspace/packages/api/src/file.ts:45` when referencing errors.
```

</slash-commands>

<subagents>

## Sub-Agent Format

Location: `/workspace/<plugin-name>/agents/<agent-name>.md`

**⚠️ EXACT NAMING**: Agent files must have `.md` extension (lowercase). The frontmatter `name` field (not filename) identifies the agent.

Sub-agents are specialized AI agents explicitly invoked by the main agent via the Task tool. They have constrained tool access and focused system prompts.

### File Structure

```markdown
---
name: agent-identifier
description: What this agent does and when main agent should invoke it
tools: Read, Write, Bash, Grep
model: sonnet
---

# Agent System Prompt

You are a specialized agent for [purpose].

When invoked, you have access to the codebase at /workspace and the following tools:
[list tools from frontmatter]

## Your Responsibilities
- Responsibility 1
- Responsibility 2

## Constraints
- Constraint 1
- Constraint 2

## Process
1. Step one
2. Step two
3. Report results back to main agent
```

### YAML Frontmatter Fields

| Field | Required | Format | Purpose | Default if Omitted |
|-------|----------|--------|---------|-------------------|
| `name` | Yes | Lowercase with hyphens | Unique identifier for agent | N/A (error if missing) |
| `description` | Yes | Natural language | Tells main agent when to invoke this sub-agent | N/A (error if missing) |
| `tools` | No | Comma-separated string (see Tools Field Format) | Restricts available tools | All tools including MCP |
| `model` | No | `sonnet`, `opus`, `haiku`, or `inherit` | Model selection | `inherit` (uses main agent's model) |

**Model Field Clarification**:
- Omitting `model` field = same as `model: inherit` (uses parent agent's model)
- `model: sonnet` = Use Claude Sonnet regardless of parent model
- `model: inherit` = Explicitly use parent's model (same as omitting)

### Tool Access Patterns

**Grant all tools** (omit `tools` field):
```yaml
---
name: full-access-agent
description: Agent with complete tool access including MCP servers
---
```

**Restrict to specific tools**:
```yaml
---
name: read-only-agent
description: Agent that analyzes code without modification
tools: Read, Glob, Grep
---
```

**Common combinations** (examples, not exhaustive):
- Read-only analysis: `Read, Glob, Grep`
- File operations: `Read, Write, Edit, Glob`
- Development work: `Read, Write, Edit, Bash, Glob, Grep`
- Orchestration: `Read, Task` (can invoke other agents)

### System Prompt Best Practices

The markdown body becomes the agent's system prompt. Effective prompts:

1. **Define role**: "You are a specialized agent for analyzing TypeScript performance issues"
2. **Specify context**: "You operate on the monorepo at /workspace with packages in /workspace/packages/"
3. **List tools**: "You have access to: Read, Grep, Bash tools"
4. **Provide process**: Step-by-step workflow to follow
5. **Set constraints**: "Never modify files, only analyze and report"
6. **Show examples**: Demonstrate expected output format

**Length guidance**:
- Basic agents: 200-500 words
- Specialized agents: 500-1000 words
- Complex agents: 1000-2000 words (beyond this may impact performance)

</subagents>

<skills>

## Skills Format

Location: `/workspace/<plugin-name>/skills/<skill-name>/SKILL.md`

**⚠️ EXACT NAMING**:
- Skill must be in a subdirectory under `skills/`
- Definition file must be exactly `SKILL.md` (all caps, `.md` extension)
- Directory name becomes the skill identifier for marketplace.json
- Example: `/workspace/my-plugin/skills/fix-imports/SKILL.md` → identifier is `fix-imports`

Skills are capabilities Claude autonomously invokes based on description matching the current context. Unlike sub-agents (explicitly invoked), skills activate when Claude determines they're relevant.

### Directory Structure

```
/workspace/<plugin-name>/skills/
└── skill-directory-name/
    ├── SKILL.md           # Required: Skill definition
    ├── reference.md       # Optional: Additional documentation for Claude to read
    ├── scripts/           # Optional: Helper scripts
    │   └── helper.py
    └── templates/         # Optional: File templates
        └── template.txt
```

**Path Resolution**: When skill is active, paths are relative to `/workspace/<plugin-name>/skills/<skill-name>/`

### SKILL.md Format

```markdown
---
name: Skill Display Name
description: What this skill does and trigger keywords for autonomous invocation
allowed-tools: Read, Write, Edit
---

# Skill Instructions

Detailed instructions for Claude when this skill is active.

## When to Use This Skill
[Specific conditions that indicate this skill should activate]

## Process
1. Step one
2. Step two
3. Deliver result

## Supporting Files
- scripts/helper.py: [What it does]
- templates/template.txt: [What it contains]

## Example
[Concrete example of using this skill]
```

### YAML Frontmatter Requirements

| Field | Required | Format | Purpose |
|-------|----------|--------|---------|
| `name` | Yes | Display name (spaces allowed) | How skill appears in listings |
| `description` | Yes | Natural language with trigger keywords | **Critical**: Determines autonomous invocation |
| `allowed-tools` | No | Comma-separated string (see Tools Field Format) | Restricts tools during skill execution |

**Note**: Field name is `allowed-tools` (hyphenated) for skills vs. `tools` (no hyphen) for agents. See Tools Field Format section for why this distinction exists and consequences of using the wrong field name.

### Description Writing for Autonomous Invocation

The `description` determines when Claude decides to use this skill. Write descriptions that:

1. **State capability clearly**: "Generates comprehensive JSDoc documentation for TypeScript files"
2. **Include trigger keywords**: Words that signal relevance (e.g., "JSDoc", "TypeScript", "documentation")
3. **Specify context**: "When working with TypeScript projects in /workspace/packages/"
4. **Be specific over generic**: "Analyzes React hooks for missing dependencies" vs "Helps with React"

**Effective Examples**:
- ✅ "Writes comprehensive JSDoc documentation for TypeScript functions and classes in /workspace"
- ✅ "Debugs memory leaks in Node.js applications using heap snapshots and the Bash tool"
- ✅ "Generates React components following Material-UI patterns when user requests new components"

**Ineffective Examples**:
- ❌ "Helps with documentation" (no triggers, too vague)
- ❌ "A useful development tool" (no capability statement)
- ❌ "Documentation" (noun instead of capability description)

### Path References Within Skills

Reference supporting files with paths relative to skill directory:

```markdown
To use the helper script:
```bash
python scripts/helper.py --input data.json --output results.txt
```

To apply the template to /workspace:
```bash
cp templates/component.tsx /workspace/packages/ui/src/components/NewComponent.tsx
```
```

When skill executes, working directory is `/workspace/<plugin-name>/skills/<skill-name>/`, so `scripts/helper.py` resolves correctly.

</skills>

<hooks>

## Hooks Format

Location: `/workspace/<plugin-name>/hooks/hooks.json`

**⚠️ EXACT NAMING**: Hooks configuration file must be exactly `hooks.json` (lowercase, in `hooks/` directory).

Hooks are event-triggered shell commands that execute at specific points in Claude Code's lifecycle. See [hooks documentation](https://docs.claude.com/en/docs/claude-code/hooks.md) for complete event details and execution context.

### File Structure

```json
{
  "EventName": [
    {
      "matcher": "ToolName",
      "hooks": [
        {
          "type": "command",
          "command": "python /workspace/scripts/hook-handler.py"
        }
      ]
    }
  ]
}
```

**Execution Context**:
- **Working Directory**: `/workspace` (where Claude Code executes)
- **Environment Variables**:
  - `CLAUDE_PROJECT_DIR`: Absolute path to project root (`/workspace`)
  - `CLAUDE_PLUGIN_ROOT`: Plugin directory path
  - Standard environment variables (PATH, HOME, etc.)
- **Timeout**: 60 seconds default (configurable)
- **Parallelization**: All matching hooks run in parallel
- **Input**: JSON via stdin (structure depends on event type)

### Hook Events

Reference: [hooks documentation](https://docs.claude.com/en/docs/claude-code/hooks.md)

| Event | Timing | Can Block | Common Use Cases |
|-------|--------|-----------|------------------|
| `PreToolUse` | After Claude creates tool parameters, before execution | Yes | Validation, file protection, permission checks |
| `PostToolUse` | After tool completes successfully | No | Logging, notifications, cleanup |
| `UserPromptSubmit` | When user submits prompt, before Claude processes | Yes | Prompt transformation, context injection |
| `Notification` | When Claude requests permissions or after 60s idle | No | Custom notification routing |
| `Stop` | After main Claude agent finishes responding | No | Session logging, metrics collection |
| `SubagentStop` | After sub-agent (Task tool) finishes responding | No | Sub-agent result processing |
| `PreCompact` | Before Claude compacts conversation context | No | State preservation, checkpoint creation |
| `SessionStart` | Session begins or resumes | No | Initialization, environment setup |
| `SessionEnd` | Session terminates | No | Cleanup, final logging |

**Blocking Behavior**: Only `PreToolUse` and `UserPromptSubmit` can block execution with non-zero exit codes. Other events cannot prevent actions.

### Exit Codes and Control Flow

Hooks use exit codes and optional JSON output for control:

| Exit Code | Meaning | Blocking Events | Non-Blocking Events |
|-----------|---------|-----------------|---------------------|
| `0` | Success | Continue execution | Normal completion |
| `2` | Block | Blocks execution; stderr fed to Claude | Logged as error |
| Other non-zero | Error | Blocks execution; stderr shown to user | Logged as error |

**Advanced JSON Output** (optional):
Hooks can print JSON to stdout for fine-grained control:

```json
{
  "continue": true,
  "decision": "allow",
  "message": "Optional message to Claude or user",
  "data": {"key": "value"}
}
```

- `continue`: `false` blocks execution (PreToolUse/UserPromptSubmit only)
- `decision`: `"allow"` | `"deny"` | `"ask"` | `"block"`
- `message`: Context added to Claude's conversation or shown to user

See [hooks documentation](https://docs.claude.com/en/docs/claude-code/hooks.md) for complete JSON output specification.

### Hook Input Format

Hooks receive JSON via stdin. **Structure varies by event type** - note the differences:

#### PreToolUse Input Schema

Received **before** tool execution. Does NOT include tool output:

```json
{
  "session_id": "...",
  "hook_event_name": "PreToolUse",
  "cwd": "/workspace",
  "tool_name": "Write",
  "tool_input": {"file_path": "/workspace/file.txt", "content": "..."}
}
```

**Key fields**:
- `tool_name`: The tool about to execute (e.g., "Write", "Edit", "Bash")
- `tool_input`: Parameters that will be passed to the tool
- **No `tool_response`** - tool hasn't executed yet

#### PostToolUse Input Schema

Received **after** tool execution. INCLUDES tool output:

```json
{
  "session_id": "...",
  "hook_event_name": "PostToolUse",
  "cwd": "/workspace",
  "tool_name": "Bash",
  "tool_input": {"command": "yarn build"},
  "tool_response": "Build completed successfully"
}
```

**Key fields**:
- `tool_name`: The tool that executed
- `tool_input`: Parameters that were passed to the tool
- **`tool_response`**: Output from the tool execution (string or object)

**Critical Difference**: Only PostToolUse includes `tool_response`. PreToolUse hooks should NOT attempt to access this field.

#### UserPromptSubmit Input Schema

Received when user submits a prompt:

```json
{
  "session_id": "...",
  "hook_event_name": "UserPromptSubmit",
  "cwd": "/workspace",
  "prompt": "User's input text"
}
```

**Key fields**:
- `prompt`: The exact text the user submitted
- No tool-related fields

**Processing with Python**:
```python
#!/usr/bin/env python3
import sys
import json

data = json.load(sys.stdin)
event = data.get('hook_event_name')

if event == 'PreToolUse':
    # Before tool execution - can block
    tool_name = data.get('tool_name')
    tool_input = data.get('tool_input', {})
    # No tool_response available yet

    if should_block(tool_name, tool_input):
        print(f"Blocked: {reason}", file=sys.stderr)
        sys.exit(2)  # Blocks execution

elif event == 'PostToolUse':
    # After tool execution - cannot block
    tool_name = data.get('tool_name')
    tool_response = data.get('tool_response')  # Now available

    # Log or process the result
    print(f"Tool {tool_name} completed")

sys.exit(0)  # Success
```

### Matcher Patterns

The `matcher` field filters which tools trigger the hook:

- **Specific tool**: `"matcher": "Write"` - Only Write tool triggers
- **Wildcard**: `"matcher": "*"` - All tools trigger
- **Multiple tools**: Define separate hook objects (matchers cannot be arrays)

```json
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [{"type": "command", "command": "validate-write.sh"}]
    },
    {
      "matcher": "Edit",
      "hooks": [{"type": "command", "command": "validate-write.sh"}]
    }
  ]
}
```

### Example Hook Implementations

**File Protection Hook**:
```json
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "command": "python /workspace/scripts/protect-files.py"
        }
      ]
    }
  ]
}
```

Script at `/workspace/scripts/protect-files.py`:
```python
#!/usr/bin/env python3
import sys
import json

data = json.load(sys.stdin)
file_path = data.get('tool_input', {}).get('file_path', '')

PROTECTED = ['.env', 'package-lock.json', '.git/']
if any(p in file_path for p in PROTECTED):
    print(f"Blocked: {file_path} is protected", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
```

**Build Verification Hook**:
```json
{
  "PostToolUse": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "bash -c 'if [[ \"$(jq -r .tool_name)\" =~ ^(Write|Edit)$ ]]; then cd /workspace && yarn typecheck; fi'"
        }
      ]
    }
  ]
}
```

</hooks>

<validation-procedures>

## Marketplace Validation

Validation scripts for `/workspace` marketplace. These can be adapted to any marketplace location.

### Quick Validation Commands

```bash
# Validate marketplace.json syntax
jq empty /workspace/.claude-plugin/marketplace.json || echo "ERROR: Invalid marketplace.json"

# Validate all plugin.json files
find /workspace -path "*/.claude-plugin/plugin.json" -exec sh -c 'jq empty "$1" || echo "ERROR: Invalid $1"' _ {} \;

# Check component naming consistency
# (commands use filename without .md, skills use directory name)
```

### Complete Validation Script

Script location: `/workspace/scripts/validate-marketplace.sh`

```bash
#!/bin/bash
set -euo pipefail

ERRORS=0
WARNINGS=0
MARKETPLACE_ROOT="/workspace"

echo "Validating Claude Code Marketplace at $MARKETPLACE_ROOT..."

# 1. Check marketplace.json exists
if [ ! -f "$MARKETPLACE_ROOT/.claude-plugin/marketplace.json" ]; then
  echo "ERROR: Missing .claude-plugin/marketplace.json"
  ERRORS=$((ERRORS + 1))
  exit 1
fi

# 2. Validate JSON syntax
if ! jq empty "$MARKETPLACE_ROOT/.claude-plugin/marketplace.json" 2>/dev/null; then
  echo "ERROR: Invalid JSON in marketplace.json"
  ERRORS=$((ERRORS + 1))
  exit 1
fi

# 3. Validate each plugin
jq -r '.plugins[] | "\(.name)|\(.path)"' "$MARKETPLACE_ROOT/.claude-plugin/marketplace.json" | while IFS='|' read -r name path; do
  PLUGIN_PATH="$MARKETPLACE_ROOT/${path#./}"

  echo "Validating plugin: $name at $PLUGIN_PATH"

  # Check plugin.json exists
  if [ ! -f "$PLUGIN_PATH/.claude-plugin/plugin.json" ]; then
    echo "  ERROR: Missing plugin.json for $name"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Validate plugin.json syntax
  if ! jq empty "$PLUGIN_PATH/.claude-plugin/plugin.json" 2>/dev/null; then
    echo "  ERROR: Invalid JSON in $name/plugin.json"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Check name consistency
  PLUGIN_NAME=$(jq -r '.name' "$PLUGIN_PATH/.claude-plugin/plugin.json")
  if [ "$name" != "$PLUGIN_NAME" ]; then
    echo "  ERROR: Name mismatch - marketplace: $name, plugin: $PLUGIN_NAME"
    ERRORS=$((ERRORS + 1))
  fi

  # Check version consistency
  MARKETPLACE_VERSION=$(jq -r ".plugins[] | select(.name == \"$name\") | .version" "$MARKETPLACE_ROOT/.claude-plugin/marketplace.json")
  PLUGIN_VERSION=$(jq -r '.version' "$PLUGIN_PATH/.claude-plugin/plugin.json")
  if [ "$MARKETPLACE_VERSION" != "$PLUGIN_VERSION" ]; then
    echo "  ERROR: Version mismatch - marketplace: $MARKETPLACE_VERSION, plugin: $PLUGIN_VERSION"
    ERRORS=$((ERRORS + 1))
  fi

  # Validate commands (filename without .md)
  if [ -d "$PLUGIN_PATH/commands" ]; then
    for cmd_file in "$PLUGIN_PATH/commands"/*.md; do
      [ -e "$cmd_file" ] || continue
      cmd_name=$(basename "$cmd_file" .md)
      echo "  Found command: $cmd_name"
    done
  fi

  # Validate agents (filename without .md)
  if [ -d "$PLUGIN_PATH/agents" ]; then
    for agent_file in "$PLUGIN_PATH/agents"/*.md; do
      [ -e "$agent_file" ] || continue
      agent_name=$(basename "$agent_file" .md)
      echo "  Found agent: $agent_name"
    done
  fi

  # Validate skills (directory name with SKILL.md)
  if [ -d "$PLUGIN_PATH/skills" ]; then
    for skill_dir in "$PLUGIN_PATH/skills"/*/; do
      [ -d "$skill_dir" ] || continue
      skill_name=$(basename "$skill_dir")
      if [ ! -f "$skill_dir/SKILL.md" ]; then
        echo "  ERROR: Skill $skill_name missing SKILL.md"
        ERRORS=$((ERRORS + 1))
      else
        echo "  Found skill: $skill_name"
      fi
    done
  fi

  # Validate hooks.json if present
  if [ -f "$PLUGIN_PATH/hooks/hooks.json" ]; then
    if ! jq empty "$PLUGIN_PATH/hooks/hooks.json" 2>/dev/null; then
      echo "  ERROR: Invalid JSON in hooks/hooks.json"
      ERRORS=$((ERRORS + 1))
    else
      echo "  Found hooks configuration"
    fi
  fi

  echo "  ✓ Plugin $name validated"
done

# Summary
echo ""
echo "Validation complete: $ERRORS errors, $WARNINGS warnings"
[ $ERRORS -eq 0 ] && exit 0 || exit 1
```

Make executable: `chmod +x /workspace/scripts/validate-marketplace.sh`

</validation-procedures>

<marketplace-creation-workflow>

## Creating a Marketplace in /workspace

Step-by-step workflow for creating a marketplace in this repository.

### Step 1: Initialize Marketplace Structure

```bash
cd /workspace

# Create marketplace metadata directory (if not exists)
mkdir -p .claude-plugin

# Create marketplace.json
cat > .claude-plugin/marketplace.json << 'EOF'
{
  "name": "workspace-marketplace",
  "description": "Claude Code plugins for this workspace",
  "version": "1.0.0",
  "plugins": []
}
EOF

git add .claude-plugin/marketplace.json
git commit -m "Initialize marketplace structure"
```

### Step 2: Create First Plugin

```bash
cd /workspace

# Create plugin directory and metadata
mkdir -p my-plugin/.claude-plugin
cat > my-plugin/.claude-plugin/plugin.json << 'EOF'
{
  "name": "my-plugin",
  "description": "My first plugin for workspace",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  }
}
EOF

# Create component directories
mkdir -p my-plugin/commands
mkdir -p my-plugin/agents
mkdir -p my-plugin/skills
mkdir -p my-plugin/hooks
```

### Step 3: Add Plugin to Marketplace

```bash
cd /workspace

# Add plugin entry to marketplace.json
jq '.plugins += [{
  "name": "my-plugin",
  "path": "./my-plugin",
  "description": "My first plugin for workspace",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  },
  "tags": ["utility"],
  "components": {
    "commands": [],
    "agents": [],
    "skills": [],
    "hooks": []
  }
}]' .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp

mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

### Step 4: Add Components

**Add a Command** (filename becomes command name):
```bash
cd /workspace

cat > my-plugin/commands/analyze.md << 'EOF'
---
description: Analyze TypeScript code in /workspace for common issues
---

# Code Analysis Command

Analyze TypeScript files in /workspace for:
1. Type errors (run yarn typecheck from /workspace)
2. Common patterns that need improvement
3. Files with high complexity

Report findings with absolute paths like /workspace/packages/api/src/file.ts:45
EOF

# Update marketplace.json components (use filename without .md)
jq '(.plugins[] | select(.name == "my-plugin") | .components.commands) += ["analyze"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

**Add a Sub-Agent** (filename becomes agent identifier):
```bash
cd /workspace

cat > my-plugin/agents/code-reviewer.md << 'EOF'
---
name: code-reviewer
description: Reviews code changes for quality and best practices
tools: Read, Grep, Bash
model: sonnet
---

# Code Reviewer Agent

You are a code review agent operating on /workspace.

## Responsibilities
- Review code changes in /workspace for quality issues
- Check adherence to project conventions
- Identify potential bugs or performance issues

## Process
1. Use Read tool to examine files at /workspace/<path>
2. Use Grep to search for patterns
3. Use Bash to run linters/type checkers from /workspace
4. Report findings with specific file locations

## Constraints
- Never modify files, only analyze and report
- Use absolute paths like /workspace/packages/api/src/file.ts
EOF

# Update marketplace.json components (use filename without .md)
jq '(.plugins[] | select(.name == "my-plugin") | .components.agents) += ["code-reviewer"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

**Add a Skill** (directory name becomes skill identifier):
```bash
cd /workspace

mkdir -p my-plugin/skills/fix-imports
cat > my-plugin/skills/fix-imports/SKILL.md << 'EOF'
---
name: Fix TypeScript Imports
description: Automatically fixes incorrect TypeScript imports in /workspace when import errors are detected
allowed-tools: Read, Edit, Bash
---

# Fix Imports Skill

When TypeScript import errors are detected in files under /workspace:

1. Read the file with the import error at /workspace/<path>
2. Analyze the import statement and determine the correct path
3. Use Edit tool to fix the import
4. Verify fix by running yarn typecheck from /workspace

Activate when:
- User mentions import errors
- TypeScript compiler reports "Cannot find module" errors
- Request to "fix imports" or "resolve import paths"
EOF

# Update marketplace.json components (use directory name)
jq '(.plugins[] | select(.name == "my-plugin") | .components.skills) += ["fix-imports"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

**Add Hooks**:
```bash
cd /workspace

cat > my-plugin/hooks/hooks.json << 'EOF'
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "command": "python /workspace/scripts/validate-write.py"
        }
      ]
    }
  ],
  "PostToolUse": [
    {
      "matcher": "Edit",
      "hooks": [
        {
          "type": "command",
          "command": "bash -c 'cd /workspace && yarn typecheck'"
        }
      ]
    }
  ]
}
EOF

# Update marketplace.json components (list hook event types)
jq '(.plugins[] | select(.name == "my-plugin") | .components.hooks) += ["PreToolUse", "PostToolUse"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

### Step 5: Validate and Commit

```bash
cd /workspace

# Run validation script
bash scripts/validate-marketplace.sh

# Commit if validation passes
git add .
git commit -m "Add my-plugin with all components"
```

</marketplace-creation-workflow>

<common-issues>

## Troubleshooting Common Issues

### Issue: Plugin Not Found After Installation

**Symptom**: `/plugin install my-plugin@workspace-marketplace` fails with "plugin not found"

**Causes**:
1. **Path mismatch**: marketplace.json has `"path": "./wrong-name"` but directory is `my-plugin/`
   - Fix: Update path in marketplace.json to match actual directory name

2. **Missing plugin.json**: Directory exists but `/workspace/my-plugin/.claude-plugin/plugin.json` missing
   - Fix: Create plugin.json with required fields (name, description, version, author)

3. **Name mismatch**: marketplace.json lists `"name": "plugin-a"` but plugin.json has `"name": "plugin-b"`
   - Fix: Ensure name fields match exactly (case-sensitive)

### Issue: Invalid YAML in Component Markdown

**Symptom**: Command/agent/skill doesn't load or shows parsing error

**Causes**:
1. **Tabs instead of spaces**: YAML prohibits tabs for indentation
   - Fix: Replace all tabs with spaces (2 or 4 space indentation)

2. **Missing closing delimiter**: Frontmatter has opening `---` but no closing `---`
   - Fix: Add closing `---` after YAML block, before markdown content

3. **Unquoted special characters**: Description contains unquoted `:` or `#`
   - Fix: Quote strings: `description: "Contains: special chars"`

4. **Wrong tools format**: Using `tools: [Read, Write]` (array syntax)
   - Fix: Use comma-separated string: `tools: Read, Write`

### Issue: Hook Command Fails Silently

**Symptom**: Hook is configured but doesn't execute or effect expected

**Causes**:
1. **Script not executable**: Python/bash script lacks execute permissions
   - Fix: `chmod +x /workspace/scripts/hook-script.py`

2. **Wrong working directory**: Hook assumes it runs from plugin directory
   - Fix: Use absolute paths `/workspace/...` in hook commands

3. **Missing stdin handling**: Script doesn't read JSON input from stdin
   - Fix: Add `data = json.load(sys.stdin)` in Python or `cat | jq` in bash

4. **Incorrect exit code**: Hook exits 0 when it should block
   - Fix: Use `sys.exit(2)` or other non-zero code to block execution

### Issue: Skill Never Activates

**Symptom**: Skill exists in `/workspace/my-plugin/skills/skill-name/SKILL.md` but Claude never uses it

**Causes**:
1. **Vague description**: Description is too generic like "Helps with code"
   - Fix: Add specific trigger keywords and capability statement
   - Example: Change "Helps with code" → "Fixes TypeScript import errors in /workspace when module not found errors occur"

2. **Wrong directory structure**: File at `skills/skill-name.md` instead of `skills/skill-name/SKILL.md`
   - Fix: Create subdirectory `skills/skill-name/` and move to `SKILL.md` inside it

3. **Not listed in marketplace.json**: components.skills array doesn't include skill directory name
   - Fix: Add skill directory name (not filename) to components array

### Issue: Component Path Validation Errors

**Symptom**: Validation script reports "component not found"

**Causes**:
1. **Wrong component name in marketplace.json**: Listed as "command-name.md" instead of "command-name"
   - Fix: Remove `.md` extension from commands/agents arrays

2. **Wrong skill name format**: Listed as "SKILL.md" instead of directory name
   - Fix: Use skill directory name: `"skills": ["skill-directory-name"]`

3. **Component in wrong location**: `commands/` directory inside `.claude-plugin/`
   - Fix: Move component directories to plugin root at `/workspace/plugin-name/commands/`

</common-issues>

<best-practices>

## Marketplace Best Practices

### Versioning Strategy

Use semantic versioning (semver) per https://semver.org/

**Format**: `MAJOR.MINOR.PATCH` (e.g., `2.3.1`)

- **MAJOR**: Breaking changes (e.g., removing plugin, changing command interface)
- **MINOR**: New features, backward compatible (e.g., adding plugin, new command)
- **PATCH**: Bug fixes, backward compatible (e.g., fixing command logic, typos)

**When to increment for /workspace marketplace**:
- Add new plugin → Bump marketplace MINOR version
- Update plugin functionality → Bump that plugin's MINOR version
- Fix plugin bug → Bump that plugin's PATCH version
- Remove plugin → Bump marketplace MAJOR version (breaking change)
- Change command parameters → Bump plugin MAJOR version (breaking change)

### Plugin Organization

**Group related functionality**:
- ✅ Group: Git commands (`git-commit`, `git-status`) in `git-tools` plugin
- ✅ Separate: Unrelated features in different plugins (`typescript-helpers`, `docker-tools`)
- ❌ Avoid: Mixing unrelated commands in single plugin

**Naming conventions** (see Naming Patterns in shared conventions):
- Plugins: `git-tools`, `typescript-analyzer`, `deploy-helpers`
- Commands: Verb-based - `analyze`, `format-code`, `deploy-staging`
- Agents: Role-based - `code-reviewer`, `test-generator`, `debugger`
- Skills: Capability-based - `fix-imports`, `generate-docs`, `refactor-duplicates`

### Documentation Standards

**Marketplace README** (`/workspace/README.md`):
- Marketplace description and purpose
- Installation: `/plugin marketplace add /workspace`
- Plugin catalog with descriptions
- Usage examples: `/command-name`, when skills activate
- Contribution guidelines for adding plugins

**Per-plugin documentation** (`/workspace/plugin-name/README.md`):
- Plugin overview and purpose
- List of commands with examples
- Sub-agents and when main agent invokes them
- Skills and trigger conditions
- Hooks and what they protect/automate
- Any /workspace-specific setup requirements

### Testing Before Release

Before committing changes to `/workspace/.claude-plugin/marketplace.json`:

1. **Syntax validation**: `bash /workspace/scripts/validate-marketplace.sh`
2. **Path verification**: Check all component paths resolve correctly
3. **Installation test**:
   ```bash
   /plugin marketplace add /workspace
   /plugin install my-plugin@workspace-marketplace
   ```
4. **Component testing**:
   - Commands: Invoke with `/command-name`
   - Agents: Verify main agent invokes them appropriately
   - Skills: Trigger conditions and verify activation
   - Hooks: Test with relevant tool usage
5. **Integration testing**: Test plugins together for name conflicts

</best-practices>
