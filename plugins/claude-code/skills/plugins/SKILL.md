---
name: Plugin Management
description: Create, edit, and configure Claude Code plugins
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

## Core Plugin Concepts

**Claude Code Plugin System**: Plugins are extensions that add slash commands, specialized sub-agents, autonomous skills, and event hooks to Claude Code.

**Component Types**:
- **Slash Commands**: User-invoked markdown files with instructions (e.g., `/commit`, `/analyze`)
- **Sub-Agents**: Specialized AI agents with constrained tools, invoked via Task tool
- **Skills**: Autonomously invoked capabilities that Claude decides when to use
- **Hooks**: Event-triggered scripts executing at specific lifecycle points

**Marketplace Structure**: A marketplace is a git repository containing multiple plugins, each with `.claude-plugin/plugin.json` manifest. Users install via `/plugin install <name>@<marketplace>`.

## Plugin Directory Structure

### Required Structure

```
/workspace/
├── .claude-plugin/
│   └── marketplace.json      # Marketplace metadata (if this is a marketplace)
├── plugin-name/              # Plugin directory at repo root
│   ├── .claude-plugin/
│   │   └── plugin.json       # Required: Plugin metadata
│   ├── commands/             # Optional: Slash commands (auto-discovered)
│   │   └── command-name.md   # Filename (minus .md) = command name
│   ├── agents/               # Optional: Sub-agent definitions (auto-discovered)
│   │   └── agent-name.md
│   ├── skills/               # Optional: Autonomous skills (auto-discovered)
│   │   └── skill-name/       # Skills MUST be subdirectories
│   │       └── SKILL.md      # Required: All caps SKILL.md
│   └── hooks/                # Optional: Event hooks
│       └── hooks.json        # Default hooks configuration
```

### Critical Path Rules

1. Plugin directories must be siblings to `.claude-plugin/` at marketplace root
2. Component directories (`commands/`, `agents/`, `skills/`, `hooks/`) live at plugin root, NOT inside `.claude-plugin/`
3. `.claude-plugin/` contains ONLY `plugin.json` (or `marketplace.json` at repo root)
4. Skills MUST be subdirectories containing `SKILL.md`, not `skills/skill-name.md`
5. Command names come from filename: `analyze-code.md` → `/analyze-code`

### Naming Requirements

**Identifiers** (plugin names, agent names, command filenames without extension):
- **Format**: `[a-z0-9]+(-[a-z0-9]+)*` (lowercase letters, numbers, hyphens only)
- **Examples**: ✅ `git-tools`, `typescript-helper`, `analyze-performance`
- **Invalid**: ❌ `GitTools`, `typescript_helper`, `-start-with-hyphen`

**Display Names** (skill names, descriptions):
- Can include spaces, capitals, and most Unicode characters
- Keep under 100 characters for usability

**Exact File/Directory Names** (case-sensitive, must be exact):
- Directory: `.claude-plugin` (lowercase, with leading dot and hyphen)
- Files: `marketplace.json`, `plugin.json` (lowercase)
- Component directories: `commands`, `agents`, `skills`, `hooks` (lowercase, plural)
- Skill definition: `SKILL.md` (all caps with .md extension)

## plugin.json Format

Location: `/workspace/<plugin-name>/.claude-plugin/plugin.json`

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

### Complete Structure with Optional Fields

```json
{
  "name": "plugin-identifier",
  "description": "Human-readable plugin description",
  "version": "1.0.0",
  "author": {
    "name": "Author Name",
    "email": "author@example.com"
  },
  "homepage": "https://github.com/username/plugin",
  "repository": {
    "type": "git",
    "url": "https://github.com/username/plugin.git"
  },
  "license": "MIT",
  "keywords": ["category1", "category2"]
}
```

### Field Specifications

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | Must match marketplace.json entry exactly |
| `description` | string | Yes | Should match marketplace.json (not validated but recommended) |
| `version` | string | Yes | Semver format (X.Y.Z), must match marketplace.json |
| `author` | object | Yes | Required object with required `name` field |
| `author.name` | string | Yes | Free text |
| `author.email` | string | No | Valid email format if provided; can omit or set to null |
| `homepage` | string | No | URL to plugin homepage or documentation |
| `repository` | object | No | Git repository information |
| `license` | string | No | SPDX license identifier (e.g., "MIT", "Apache-2.0") |
| `keywords` | array | No | Array of strings for categorization |

### Validation Checklist

When validating plugin.json:
1. File exists at `/workspace/<plugin>/.claude-plugin/plugin.json`
2. Valid JSON syntax (test with `jq empty <file>`)
3. All required fields present (name, description, version, author with name)
4. Version matches semver pattern `X.Y.Z` where X, Y, Z are integers
5. Name matches marketplace.json declaration exactly (case-sensitive)
6. Email (if present) matches basic email pattern (contains @ and domain)

### Validation Commands

```bash
# Validate JSON syntax
jq empty /workspace/<plugin-name>/.claude-plugin/plugin.json

# Extract and verify required fields
jq -r '.name, .description, .version, .author.name' /workspace/<plugin-name>/.claude-plugin/plugin.json

# Check version format (should output version if valid semver)
jq -r '.version | select(test("^[0-9]+\\.[0-9]+\\.[0-9]+$"))' /workspace/<plugin-name>/.claude-plugin/plugin.json
```

## Creating a New Plugin

### Step 1: Create Plugin Structure

```bash
cd /workspace

# Create plugin directory and metadata directory
mkdir -p <plugin-name>/.claude-plugin

# Create plugin.json
cat > <plugin-name>/.claude-plugin/plugin.json << 'EOF'
{
  "name": "<plugin-name>",
  "description": "Brief description of what this plugin does",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  }
}
EOF

# Create component directories (all are optional)
mkdir -p <plugin-name>/commands
mkdir -p <plugin-name>/agents
mkdir -p <plugin-name>/skills
mkdir -p <plugin-name>/hooks
```

### Step 2: Add Plugin to Marketplace (if applicable)

```bash
cd /workspace

# Add plugin entry to marketplace.json
jq '.plugins += [{
  "name": "<plugin-name>",
  "source": "./<plugin-name>",
  "description": "Brief description of what this plugin does",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  },
  "tags": ["category"],
  "components": {
    "commands": [],
    "agents": [],
    "skills": [],
    "hooks": []
  }
}]' .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp

mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

### Step 3: Validate Plugin Structure

```bash
cd /workspace

# Validate plugin.json syntax
jq empty <plugin-name>/.claude-plugin/plugin.json || echo "ERROR: Invalid plugin.json"

# Check directory structure exists
[ -d "<plugin-name>/.claude-plugin" ] && echo "✓ Plugin metadata directory exists"
[ -f "<plugin-name>/.claude-plugin/plugin.json" ] && echo "✓ plugin.json exists"
```

## Component Creation

### Creating Slash Commands

**Location**: `/workspace/<plugin-name>/commands/<command-name>.md`

**Format**:
```markdown
---
description: Brief description shown in command listings
---

# Command Implementation

Detailed instructions for Claude when command is invoked.

Can include:
- Multi-line instructions
- Code examples in fenced blocks
- References to files using absolute paths like /workspace/...
```

**Creating a command**:
```bash
cd /workspace

# Create command file (filename becomes command name)
cat > <plugin-name>/commands/<command-name>.md << 'EOF'
---
description: What this command does
---

# Command Instructions

Instructions for Claude to follow when user invokes /<command-name>

Use absolute paths like /workspace/packages/api/src/file.ts
EOF

# Add to marketplace.json components (use filename WITHOUT .md)
jq '(.plugins[] | select(.name == "<plugin-name>") | .components.commands) += ["<command-name>"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

### Creating Sub-Agents

**Location**: `/workspace/<plugin-name>/agents/<agent-name>.md`

**Format**:
```markdown
---
name: agent-identifier
description: What this agent does and when main agent should invoke it
tools: Read, Write, Bash, Grep
model: sonnet
---

# Agent System Prompt

You are a specialized agent for [purpose].

## Your Responsibilities
- Responsibility 1
- Responsibility 2

## Process
1. Step one
2. Step two
3. Report results
```

**YAML Frontmatter Fields**:
- `name` (required): Lowercase with hyphens identifier
- `description` (required): Tells main agent when to invoke
- `tools` (optional): Comma-separated string (NOT array); omit for all tools
- `model` (optional): `sonnet`, `opus`, `haiku`, or `inherit` (default: inherit)

**Creating an agent**:
```bash
cd /workspace

cat > <plugin-name>/agents/<agent-name>.md << 'EOF'
---
name: agent-identifier
description: What this specialized agent does
tools: Read, Grep, Bash
model: sonnet
---

# Agent System Prompt

You are a specialized agent for [purpose] operating on /workspace.

[Detailed instructions...]
EOF

# Add to marketplace.json components (use filename WITHOUT .md)
jq '(.plugins[] | select(.name == "<plugin-name>") | .components.agents) += ["<agent-name>"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

### Creating Skills

**Location**: `/workspace/<plugin-name>/skills/<skill-name>/SKILL.md`

**Format**:
```markdown
---
name: Skill Display Name
description: What this skill does with trigger keywords for autonomous invocation
allowed-tools: Read, Write, Edit
---

# Skill Instructions

## When to Use This Skill
[Specific conditions that indicate this skill should activate]

## Process
1. Step one
2. Step two
3. Deliver result

## Example
[Concrete example]
```

**YAML Frontmatter Fields**:
- `name` (required): Display name (spaces allowed)
- `description` (required): Critical for autonomous invocation; include trigger keywords
- `allowed-tools` (optional): Comma-separated string (NOT array); omit for all tools

**Note**: Field is `allowed-tools` (hyphenated) for skills vs `tools` (no hyphen) for agents

**Creating a skill**:
```bash
cd /workspace

# Create skill directory (MUST be subdirectory)
mkdir -p <plugin-name>/skills/<skill-name>

# Create SKILL.md (MUST be all caps)
cat > <plugin-name>/skills/<skill-name>/SKILL.md << 'EOF'
---
name: Skill Display Name
description: What skill does with keywords like "import errors" "TypeScript" "fix modules"
allowed-tools: Read, Edit, Bash
---

# Skill Instructions

When [trigger condition]:
1. Do step one
2. Do step two
3. Deliver result

Activate when user mentions: [keywords from description]
EOF

# Add to marketplace.json components (use DIRECTORY name, not SKILL.md)
jq '(.plugins[] | select(.name == "<plugin-name>") | .components.skills) += ["<skill-name>"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

**Description Writing for Autonomous Invocation**:
- ✅ "Generates comprehensive JSDoc documentation for TypeScript files"
- ✅ "Debugs memory leaks in Node.js applications using heap snapshots"
- ✅ "Fixes TypeScript import errors in /workspace when module not found"
- ❌ "Helps with documentation" (too vague)
- ❌ "A useful development tool" (no capability statement)

### Creating Hooks

**Location**: `/workspace/<plugin-name>/hooks/hooks.json`

**Format**:
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

**Common Hook Events**:
- `PreToolUse`: Before tool execution (can block)
- `PostToolUse`: After tool execution (cannot block)
- `UserPromptSubmit`: When user submits prompt (can block)
- `Stop`: After main agent finishes
- `SubagentStop`: After sub-agent finishes

**Creating hooks**:
```bash
cd /workspace

cat > <plugin-name>/hooks/hooks.json << 'EOF'
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
  ]
}
EOF

# Add to marketplace.json components (use event type names)
jq '(.plugins[] | select(.name == "<plugin-name>") | .components.hooks) += ["PreToolUse"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

**Hook Input/Output**:
- Hooks receive JSON via stdin with structure varying by event
- Exit code 0 = success, exit code 2 = block execution (PreToolUse/UserPromptSubmit only)
- Working directory is always `/workspace`
- Use absolute paths in hook commands

## marketplace.json Integration

### marketplace.json Structure

**Location**: `/workspace/.claude-plugin/marketplace.json`

```json
{
  "name": "marketplace-identifier",
  "description": "Marketplace description",
  "version": "1.0.0",
  "plugins": [
    {
      "name": "plugin-identifier",
      "source": "./plugin-directory-name",
      "description": "Plugin description",
      "version": "1.0.0",
      "author": {
        "name": "Author Name",
        "email": "author@example.com"
      },
      "tags": ["category1", "category2"],
      "components": {
        "commands": ["command-name"],
        "agents": ["agent-name"],
        "skills": ["skill-directory-name"],
        "hooks": ["PreToolUse", "PostToolUse"]
      }
    }
  ]
}
```

### Component Naming in marketplace.json

**Critical**: Use correct naming format for each component type:
- `commands`: Filename WITHOUT `.md` extension (e.g., file `analyze.md` → `"commands": ["analyze"]`)
- `agents`: Filename WITHOUT `.md` extension (e.g., file `helper.md` → `"agents": ["helper"]`)
- `skills`: Directory name (e.g., directory `fix-imports/` → `"skills": ["fix-imports"]`)
- `hooks`: Event type names (e.g., `"hooks": ["PreToolUse", "PostToolUse"]`)

### Validation Rules

- **Path integrity**: `plugins[].source` must point to directory containing `.claude-plugin/plugin.json`
- **Name consistency**: `plugins[].name` must exactly match plugin.json name
- **Version consistency**: `plugins[].version` must exactly match plugin.json version
- **Component verification**: Each listed component must exist at declared path

### Updating marketplace.json

```bash
cd /workspace

# Add new plugin to marketplace
jq '.plugins += [{
  "name": "new-plugin",
  "source": "./new-plugin",
  "description": "New plugin description",
  "version": "1.0.0",
  "author": {"name": "Author"},
  "tags": [],
  "components": {}
}]' .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json

# Update plugin version (plugin and marketplace must match)
jq '(.plugins[] | select(.name == "plugin-name") | .version) = "1.1.0"' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json

# Also update plugin.json to match
jq '.version = "1.1.0"' <plugin-name>/.claude-plugin/plugin.json > <plugin-name>/.claude-plugin/plugin.json.tmp
mv <plugin-name>/.claude-plugin/plugin.json.tmp <plugin-name>/.claude-plugin/plugin.json

# Add component to plugin in marketplace
jq '(.plugins[] | select(.name == "plugin-name") | .components.commands) += ["new-command"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

## YAML Frontmatter Rules

All component markdown files use YAML frontmatter. Follow these rules:

### Structure Requirements

1. **Delimiters**: Exactly `---` on its own line (no leading/trailing whitespace)
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
- ❌ `description: Has: unquoted colon` (breaks YAML parser)
- ❌ Missing closing `---` delimiter
- ❌ Tab indentation instead of spaces

### Tools Field Format

When restricting tool access:

**Format**: Comma-separated list (as string, NOT YAML array)
```yaml
tools: Read, Write, Bash, Grep              # For agents
allowed-tools: Read, Write, Edit            # For skills
```

**NOT** YAML list syntax:
```yaml
# Don't use:
tools: [Read, Write, Bash]
allowed-tools: [Read, Edit]
```

**Field Name Distinction**:
- **Agents**: use `tools` (no hyphen)
- **Skills**: use `allowed-tools` (hyphenated)

> **⚠️ SECURITY WARNING**: Using the wrong field name causes it to be ignored, **granting ALL tools including MCP servers by default**. This is a security risk as the component will have unrestricted access to:
> - All filesystem operations (Read, Write, Edit)
> - Command execution (Bash)
> - Sub-agent invocation (Task)
> - All MCP-provided external integrations
>
> **Always verify the correct field name** for your component type to prevent unintended tool access.

**Omitting field**: Intentionally grants all tools including MCP-provided tools (use only when full access is required)

**Tool Names**: Use exact capitalization: `Read`, `Write`, `Bash`, `Glob`, `Grep`, `Edit`, `Task`

## Versioning Strategy

Use semantic versioning (semver) per https://semver.org/

**Format**: `MAJOR.MINOR.PATCH` (e.g., `2.3.1`)

- **MAJOR**: Breaking changes (removing plugin, changing command interface)
- **MINOR**: New features, backward compatible (adding plugin, new command)
- **PATCH**: Bug fixes, backward compatible (fixing logic, typos)

**When to increment**:
- Add new plugin → Bump marketplace MINOR version
- Update plugin functionality → Bump plugin MINOR version
- Fix plugin bug → Bump plugin PATCH version
- Remove plugin → Bump marketplace MAJOR version
- Change command parameters → Bump plugin MAJOR version

**Version Consistency**: Plugin version in plugin.json MUST match version in marketplace.json entry

## Troubleshooting Common Issues

### Plugin Not Found After Installation

**Symptom**: `/plugin install my-plugin@marketplace` fails

**Fixes**:
1. Check path in marketplace.json matches actual directory name
2. Verify `/workspace/<plugin-name>/.claude-plugin/plugin.json` exists
3. Ensure name in marketplace.json matches name in plugin.json exactly

### Invalid YAML in Component

**Symptom**: Command/agent/skill doesn't load or shows parsing error

**Fixes**:
1. Replace all tabs with spaces (YAML prohibits tabs)
2. Add closing `---` after YAML block
3. Quote strings with special characters: `description: "Contains: colons"`
4. Use comma-separated string for tools, not array: `tools: Read, Write`

### Hook Command Fails Silently

**Symptom**: Hook configured but doesn't execute

**Fixes**:
1. Make script executable: `chmod +x /workspace/scripts/hook-script.py`
2. Use absolute paths in hook commands: `/workspace/...`
3. Ensure script reads JSON from stdin: `data = json.load(sys.stdin)`
4. Use correct exit code: `sys.exit(2)` to block, `sys.exit(0)` for success

### Skill Never Activates

**Symptom**: Skill exists but Claude never uses it

**Fixes**:
1. Add specific trigger keywords to description: "Fixes TypeScript import errors when module not found"
2. Use subdirectory structure: `skills/<skill-name>/SKILL.md` not `skills/<skill-name>.md`
3. Add skill directory name to marketplace.json components array
4. Ensure description clearly states capability and context

### Component Path Validation Errors

**Symptom**: Validation reports "component not found"

**Fixes**:
1. Remove `.md` extension from commands/agents in marketplace.json: `["command-name"]` not `["command-name.md"]`
2. Use directory name for skills: `["skill-dir"]` not `["SKILL.md"]`
3. Move component directories to plugin root, not inside `.claude-plugin/`

## Complete Plugin Creation Example

Here's a complete workflow creating a new plugin with all component types:

```bash
cd /workspace

# 1. Create plugin structure
PLUGIN_NAME="example-tools"
mkdir -p ${PLUGIN_NAME}/{.claude-plugin,commands,agents,skills,hooks}

# 2. Create plugin.json
cat > ${PLUGIN_NAME}/.claude-plugin/plugin.json << 'EOF'
{
  "name": "example-tools",
  "description": "Example plugin demonstrating all component types",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "license": "MIT"
}
EOF

# 3. Create a command
cat > ${PLUGIN_NAME}/commands/analyze.md << 'EOF'
---
description: Analyze code quality in /workspace
---

# Code Analysis Command

When user invokes /analyze:
1. Run linting from /workspace
2. Check for common issues
3. Report findings with absolute paths
EOF

# 4. Create an agent
cat > ${PLUGIN_NAME}/agents/reviewer.md << 'EOF'
---
name: reviewer
description: Reviews code changes for quality and best practices
tools: Read, Grep, Bash
model: sonnet
---

# Code Review Agent

You are a code review agent for /workspace.

Review code changes and report quality issues.
EOF

# 5. Create a skill
mkdir -p ${PLUGIN_NAME}/skills/fix-imports
cat > ${PLUGIN_NAME}/skills/fix-imports/SKILL.md << 'EOF'
---
name: Fix TypeScript Imports
description: Fixes TypeScript import errors in /workspace when module not found errors occur
allowed-tools: Read, Edit, Bash
---

# Import Fixing Skill

Activate when import errors are detected.

Fix incorrect import paths in TypeScript files.
EOF

# 6. Create hooks
cat > ${PLUGIN_NAME}/hooks/hooks.json << 'EOF'
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "command": "echo 'Validating write operation' >&2"
        }
      ]
    }
  ]
}
EOF

# 7. Add to marketplace.json
jq '.plugins += [{
  "name": "example-tools",
  "source": "./example-tools",
  "description": "Example plugin demonstrating all component types",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "tags": ["example", "demo"],
  "components": {
    "commands": ["analyze"],
    "agents": ["reviewer"],
    "skills": ["fix-imports"],
    "hooks": ["PreToolUse"]
  }
}]' .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json

# 8. Validate
jq empty ${PLUGIN_NAME}/.claude-plugin/plugin.json && echo "✓ Valid plugin.json"
jq empty .claude-plugin/marketplace.json && echo "✓ Valid marketplace.json"
```

## Quick Reference Commands

### Validation
```bash
# Validate plugin.json
jq empty /workspace/<plugin>/.claude-plugin/plugin.json

# Validate marketplace.json
jq empty /workspace/.claude-plugin/marketplace.json

# Check version consistency
PLUGIN="plugin-name"
MARKET_VER=$(jq -r ".plugins[] | select(.name == \"$PLUGIN\") | .version" .claude-plugin/marketplace.json)
PLUGIN_VER=$(jq -r '.version' $PLUGIN/.claude-plugin/plugin.json)
[ "$MARKET_VER" = "$PLUGIN_VER" ] && echo "✓ Versions match" || echo "✗ Version mismatch"
```

### Component Operations
```bash
# List all commands in plugin
ls -1 /workspace/<plugin>/commands/*.md | xargs -n1 basename -s .md

# List all skills in plugin
ls -1d /workspace/<plugin>/skills/*/ | xargs -n1 basename

# Check if SKILL.md exists for skill
[ -f "/workspace/<plugin>/skills/<skill-name>/SKILL.md" ] && echo "✓ SKILL.md exists"
```

### Updating Versions
```bash
# Update plugin version (must update both files)
NEW_VERSION="1.2.0"
PLUGIN="plugin-name"

# Update plugin.json
jq ".version = \"$NEW_VERSION\"" $PLUGIN/.claude-plugin/plugin.json > $PLUGIN/.claude-plugin/plugin.json.tmp
mv $PLUGIN/.claude-plugin/plugin.json.tmp $PLUGIN/.claude-plugin/plugin.json

# Update marketplace.json
jq "(.plugins[] | select(.name == \"$PLUGIN\") | .version) = \"$NEW_VERSION\"" \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

## Path Resolution Guidelines

- **Absolute paths** (starting with `/`): Always use for:
  - Command markdown bodies
  - Agent system prompts
  - Hook command strings
  - References across the project
  - Example: `/workspace/packages/api/src/file.ts`

- **Relative paths** (no leading `/`): Only use in:
  - Skill markdown when referencing skill's own support files
  - Example: `scripts/helper.py` when skill is in `/workspace/plugin/skills/skill-name/`

- **Hook working directory**: Always `/workspace` - use absolute paths in hooks

## Best Practices

### Plugin Organization
- Group related functionality in one plugin (e.g., all git commands in `git-tools`)
- Separate unrelated features into different plugins
- Use descriptive, lowercase-with-hyphens names

### Documentation
- Include README.md in plugin directory explaining components
- Add clear descriptions to all components
- Document any /workspace-specific requirements

### Testing
1. Validate JSON syntax: `jq empty <file>`
2. Check path resolution for all components
3. Test command invocation: `/command-name`
4. Verify skill activation with trigger keywords
5. Test hooks with relevant tool usage

### Version Management
- Keep plugin.json and marketplace.json versions in sync
- Follow semver conventions strictly
- Document breaking changes in MAJOR version bumps

## Summary

This skill enables comprehensive plugin management including:
- Creating plugin directory structures with proper naming
- Writing and validating plugin.json configuration
- Creating all component types (commands, agents, skills, hooks)
- Integrating plugins with marketplace.json
- Following YAML frontmatter conventions
- Troubleshooting common plugin issues
- Maintaining version consistency

Always use absolute paths starting with `/workspace/` when referencing files across the project, and ensure all naming follows the lowercase-with-hyphens convention for identifiers.

## Official Documentation

For the latest information and updates, refer to the official Claude Code documentation:

- **General Plugins Documentation**: https://docs.claude.com/en/docs/claude-code/plugins
- **Plugins Reference**: https://docs.claude.com/en/docs/claude-code/plugins-reference  
- **Plugin Marketplaces**: https://docs.claude.com/en/docs/claude-code/plugin-marketplaces
- **Hooks Documentation**: https://docs.claude.com/en/docs/claude-code/hooks

## See Also

**Related Skills** (in this plugin):
- **Plugin Marketplace Management**: Registering plugins in marketplaces
- **Sub-Agent Management**: Creating specialized agents (component type)
- **Slash Command Management**: Creating user-invoked commands (component type)
- **Skill Management**: Creating autonomous capabilities (component type)
- **MCP Server Configuration**: Plugin-bundled MCP server setup

**Related Topics**:
- Tool restrictions and security implications
- Component auto-discovery patterns  
- YAML frontmatter conventions
- plugin.json and marketplace.json synchronization

---

*Last Updated: October 2025*
