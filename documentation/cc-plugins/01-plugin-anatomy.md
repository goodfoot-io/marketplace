# Plugin Anatomy - Deep Dive

## Plugin Structure

A Claude Code plugin is a directory structure containing related commands, agents, and configuration. Each plugin follows a standardized format for consistency and interoperability.

### Basic Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json              # Required: Plugin metadata
├── commands/                     # Optional: Slash commands
│   ├── command1.md
│   ├── command2.md
│   └── namespace/
│       └── subcommand.md
├── agents/                       # Optional: Subagents
│   ├── agent1.md
│   └── agent2.md
├── hooks/                        # Optional: Event hooks
│   └── hooks.json
├── mcp-servers/                  # Optional: MCP server configs
│   └── server-config.json
├── shared/                       # Optional: Shared resources
│   ├── templates/
│   └── guides/
└── README.md                     # Recommended: Plugin documentation
```

## plugin.json Manifest

The `plugin.json` file is **required** and provides metadata about your plugin.

### Minimal Example

```json
{
  "name": "my-plugin",
  "description": "Brief description of what this plugin does",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com",
    "url": "https://github.com/yourusername"
  }
}
```

### Full Example with All Fields

```json
{
  "name": "investigation-toolkit",
  "displayName": "Investigation Toolkit",
  "description": "Comprehensive tools for investigating issues, analyzing code, and making informed decisions",
  "version": "1.2.3",
  "author": {
    "name": "Goodfoot",
    "email": "contact@goodfoot.io",
    "url": "https://github.com/goodfoot-io"
  },
  "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/investigation-toolkit",
  "repository": {
    "type": "git",
    "url": "https://github.com/goodfoot-io/cc-plugins.git",
    "directory": "plugins/investigation-toolkit"
  },
  "license": "MIT",
  "keywords": [
    "investigation",
    "analysis",
    "debugging",
    "decision-making"
  ],
  "engines": {
    "claudeCode": ">=0.1.0"
  },
  "dependencies": {
    "otherPlugin": "^1.0.0"
  }
}
```

### Field Descriptions

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | ✅ Yes | string | Unique identifier (lowercase, hyphens only). Used in installation commands. |
| `displayName` | ❌ No | string | Human-readable name shown in UI |
| `description` | ✅ Yes | string | Brief explanation of plugin functionality |
| `version` | ✅ Yes | string | Semantic version (e.g., "1.0.0") |
| `author` | ✅ Yes | object | Author information (name, email, url) |
| `homepage` | ❌ No | string | Plugin documentation or website URL |
| `repository` | ❌ No | object | Source repository information |
| `license` | ❌ No | string | License identifier (e.g., "MIT", "Apache-2.0") |
| `keywords` | ❌ No | array | Searchable keywords for discovery |
| `engines` | ❌ No | object | Minimum Claude Code version requirements |
| `dependencies` | ❌ No | object | Other plugins this plugin depends on |

## Command Files

Commands are Markdown files with optional YAML frontmatter located in the `commands/` directory.

### Command File Format

```markdown
---
description: Brief description shown in /help
allowed-tools: Bash(git:*), Read, Write, Edit
argument-hint: add [tagId] | remove [tagId] | list
---

# Command Instructions

Your command prompt goes here. This can include:

- Regular markdown text
- Code blocks
- File references using @path/to/file.js
- Bash command execution using !`command here`
- Arguments using $ARGUMENTS placeholder

## Dynamic Content

Current git status: !`git status`
Review this file: @src/main.ts

## Task

Process the arguments: $ARGUMENTS
```

### Command Frontmatter Fields

| Field | Description | Example |
|-------|-------------|---------|
| `description` | Shown in `/help` command list | `description: Create a git commit` |
| `allowed-tools` | Tools the command can use | `allowed-tools: Bash(git:*), Read, Write` |
| `argument-hint` | Auto-complete hint for arguments | `argument-hint: <file-path> [options]` |

### Command Naming and Namespacing

- **Filename**: `command-name.md` creates `/command-name`
- **Subdirectories**: `namespace/command.md` creates `/namespace:command`
- **Multiple levels**: `a/b/command.md` creates `/a:b:command`

**Examples:**
```
commands/optimize.md                  → /optimize
commands/git/commit.md                → /git:commit
commands/review/security.md           → /review:security
commands/project/plan/create.md       → /project:plan:create
```

### Dynamic Features in Commands

#### 1. Arguments with $ARGUMENTS

```markdown
Fix issue #$ARGUMENTS following our coding standards
```

Usage: `/fix-issue 123` → "Fix issue #123 following our coding standards"

#### 2. Bash Command Execution with !`command`

```markdown
---
allowed-tools: Bash(git:*)
---

Current branch: !`git branch --show-current`
Recent commits: !`git log --oneline -5`
```

The output of these commands is included when the slash command runs.

#### 3. File References with @

```markdown
Review the implementation in @src/utils/helpers.js
Compare @src/old.js with @src/new.js
```

File contents are included in the command context.

## Agent Files

Agents are specialized AI assistants defined in Markdown files with YAML frontmatter.

### Agent File Format

```markdown
---
name: agent-identifier
description: When to use this agent - shown to Claude Code for delegation decisions
tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
---

# Agent System Prompt

You are a specialized agent with expertise in [domain].

## Your Role

[Detailed description of the agent's responsibilities]

## When Invoked

1. [First step the agent should take]
2. [Second step]
3. [Continue with workflow]

## Guidelines

- [Important guideline 1]
- [Important guideline 2]
- [Best practices]

## Output Format

[How the agent should structure its responses]
```

### Agent Frontmatter Fields

| Field | Required | Description | Values |
|-------|----------|-------------|--------|
| `name` | ✅ Yes | Unique identifier for the agent | lowercase-with-hyphens |
| `description` | ✅ Yes | When Claude should use this agent | Natural language description |
| `tools` | ❌ No | Comma-separated list of allowed tools | `Read, Write, Bash` or `*` for all |
| `model` | ❌ No | Model selection | `inherit` (default), `opus`, `sonnet` |

### Tool Specification Options

```yaml
# Option 1: Inherit all tools from main conversation
tools: *

# Option 2: Inherit all tools (omit field)
# (No tools field)

# Option 3: Specific tools only
tools: Read, Write, Edit, Grep, Glob, Bash

# Option 4: All tools explicitly
tools: Read, Write, Edit, Bash, Grep, Glob, Task, WebFetch, WebSearch
```

### Agent Naming Best Practices

- Use descriptive, action-oriented names: `code-reviewer`, `test-runner`, `debugger`
- Avoid generic names: ~~`helper`~~, ~~`assistant`~~
- Include domain if specialized: `security-scanner`, `performance-optimizer`
- Use present tense: `code-reviewer` not `code-review`

## Hooks Configuration

Hooks allow you to execute custom logic at specific points in Claude Code's workflow.

### hooks.json Format

```json
{
  "PreToolUse": [
    {
      "matcher": "(Write|Edit)",
      "hooks": [
        {
          "type": "command",
          "command": "/path/to/pre-write-validator.sh",
          "timeout": 10
        }
      ]
    }
  ],
  "PostToolUse": [
    {
      "matcher": "(Write|Edit)",
      "hooks": [
        {
          "type": "command",
          "command": "/path/to/post-write-formatter.sh",
          "timeout": 30
        }
      ]
    }
  ],
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "echo -e '\\a'"
        }
      ]
    }
  ]
}
```

### Hook Types

| Hook | When It Runs | Common Uses |
|------|-------------|-------------|
| `PreToolUse` | Before tool execution | Validation, checks, permissions |
| `PostToolUse` | After tool execution | Formatting, linting, verification |
| `Stop` | When conversation ends | Cleanup, notifications, logging |

### Hook Configuration Fields

| Field | Description |
|-------|-------------|
| `matcher` | Regex pattern matching tool names |
| `type` | Always `"command"` for shell scripts |
| `command` | Path to executable script |
| `timeout` | Max execution time in seconds |

## MCP Server Configuration

MCP (Model Context Protocol) servers integrate external tools and data sources.

### MCP Configuration Example

```json
{
  "mcpServers": {
    "myTool": {
      "command": "node",
      "args": ["/path/to/mcp-server.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

## Shared Resources

The `shared/` directory can contain reusable content:

```
shared/
├── templates/
│   ├── issue-template.md
│   └── pr-template.md
├── guides/
│   ├── coding-standards.md
│   └── best-practices.md
└── prompts/
    └── common-instructions.md
```

These can be referenced from commands and agents using file references:

```markdown
Follow the guidelines in @shared/guides/coding-standards.md
Use the template from @shared/templates/issue-template.md
```

## Complete Plugin Example

Here's a complete, production-ready plugin:

```
code-quality-suite/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── review.md
│   ├── review/
│   │   ├── security.md
│   │   ├── performance.md
│   │   └── accessibility.md
│   └── rewrite/
│       ├── simplify.md
│       └── optimize.md
├── agents/
│   ├── code-reviewer.md
│   ├── security-scanner.md
│   └── refactoring-expert.md
├── shared/
│   ├── coding-standards.md
│   └── review-checklist.md
└── README.md
```

### plugin.json

```json
{
  "name": "code-quality-suite",
  "displayName": "Code Quality Suite",
  "description": "Comprehensive code review, analysis, and improvement tools",
  "version": "1.0.0",
  "author": {
    "name": "Goodfoot",
    "url": "https://github.com/goodfoot-io"
  },
  "keywords": ["review", "quality", "refactoring", "security"],
  "license": "MIT"
}
```

### commands/review.md

```markdown
---
description: Review code for quality, security, and best practices
allowed-tools: Read, Grep, Glob, Bash(git:*)
---

# Code Review

Review the code changes for:

1. **Quality**: Is the code readable, maintainable, and well-structured?
2. **Security**: Are there any security vulnerabilities?
3. **Performance**: Are there performance concerns?
4. **Best Practices**: Does it follow team standards?

## Recent Changes

!`git diff HEAD`

## Standards

Follow these standards: @shared/coding-standards.md
Use this checklist: @shared/review-checklist.md

## Task

Perform a comprehensive code review and provide actionable feedback.
```

### agents/code-reviewer.md

```markdown
---
name: code-reviewer
description: Expert code reviewer for quality, security, and maintainability. Use proactively after code changes.
tools: Read, Grep, Glob, Bash
---

You are a senior code reviewer ensuring high standards.

When invoked:
1. Run `git diff` to see changes
2. Read modified files
3. Check against standards in @shared/coding-standards.md
4. Provide categorized feedback:
   - Critical (must fix)
   - Warnings (should fix)
   - Suggestions (consider)

Focus on:
- Code clarity and simplicity
- Security vulnerabilities
- Performance issues
- Test coverage
- Documentation
```

## Versioning Strategy

Follow semantic versioning (semver) for your plugins:

- **Major (1.0.0 → 2.0.0)**: Breaking changes, removed features
- **Minor (1.0.0 → 1.1.0)**: New features, backward compatible
- **Patch (1.0.0 → 1.0.1)**: Bug fixes, no new features

### Changelog Best Practices

Maintain a CHANGELOG.md in each plugin:

```markdown
# Changelog

## [1.1.0] - 2025-01-15

### Added
- New `/review:performance` command for performance analysis
- Security scanning agent with vulnerability detection

### Changed
- Improved code review agent with better context awareness

### Fixed
- Fixed issue with multi-file reviews timing out

## [1.0.0] - 2025-01-01

### Added
- Initial release with basic code review functionality
```

## Validation Checklist

Before publishing your plugin:

- [ ] `plugin.json` exists with all required fields
- [ ] Version follows semver format
- [ ] All command files have descriptions
- [ ] Agent files have clear, actionable descriptions
- [ ] README.md explains plugin purpose and usage
- [ ] File references use correct paths
- [ ] Tool specifications are appropriate for each component
- [ ] Keywords help with discoverability
- [ ] License is specified
- [ ] Author information is complete
