# Claude Code Plugin and Marketplace Naming Conventions

This document describes the naming conventions for **plugin and marketplace-scoped components only**. It covers how to name plugins, marketplaces, and all components defined within plugins (MCP servers, subagents, skills, commands, and hooks).

**Scope**: This documentation is specifically for plugin and marketplace authors. It does not cover general Claude Code features outside of the plugin system.

## MCP Server Tool Naming

When MCP servers are packaged as Claude Code plugins, their tools follow a specific naming pattern that combines the plugin name, server key, and tool name.

### Naming Pattern

**Format**: `mcp__plugin_<plugin-name>_<server-key>__<tool-name>`

**Components**:
1. `mcp__` - Fixed prefix indicating an MCP tool
2. `plugin_` - Indicates the tool comes from a plugin
3. `<plugin-name>` - The plugin name from `.claude-plugin/plugin.json`
4. `_` - Single underscore separator
5. `<server-key>` - The key used in `.mcp.json` mcpServers object
6. `__` - Double underscore separator before tool name
7. `<tool-name>` - The actual tool name from the MCP server

### Example: Browser Plugin

For the browser plugin:
- **Plugin name** (from `/workspace/plugins/browser/.claude-plugin/plugin.json`): `"browser"`
- **Server key** (from `/workspace/plugins/browser/.mcp.json`): `"browser"` (key in mcpServers object)
- **MCP tool name** (from MCP server code): `"prompt"`
- **Final tool name**: `mcp__plugin_browser_browser__prompt`

### File Structure

```
plugins/browser/
├── .claude-plugin/
│   └── plugin.json          # Contains: { "name": "browser", ... }
├── .mcp.json                # Contains: { "mcpServers": { "browser": { ... } } }
└── skills/
    └── browser/
        └── SKILL.md         # References: mcp__plugin_browser_browser__prompt
```

### Key Insight

The middle portion comes from the **mcpServers key**, NOT the server's internal name:
- Server internal name: `"browser-server"` (defined in packages/mcp/browser/src/browser.ts)
- MCP server key: `"browser"` (defined in .mcp.json)
- **The key is what's used** in the tool naming

### When Plugin Name ≠ Server Key

If a plugin has a different name than its MCP server key, the pattern still applies:

```json
// .claude-plugin/plugin.json
{ "name": "web-automation" }

// .mcp.json
{ "mcpServers": { "browser": { ... } } }

// Resulting tool name
mcp__plugin_web-automation_browser__prompt
```

## MCP Slash Commands (Prompts)

MCP servers can also expose "prompts" which become slash commands in Claude Code.

### Naming Pattern

**Format**: `/mcp__<server-key>__<prompt-name>`

**Components**:
1. `/mcp__` - Fixed prefix for MCP slash commands
2. `<server-key>` - The key from .mcp.json mcpServers object
3. `__` - Double underscore separator
4. `<prompt-name>` - The prompt name from the MCP server (spaces become underscores)

### Example

For a GitHub MCP server with a "list prs" prompt:
```json
// .mcp.json
{ "mcpServers": { "github": { ... } } }

// Resulting slash command
/mcp__github__list_prs
```

**Note**: Server and prompt names are normalized - spaces become underscores.

## Plugin Subagent Naming

Subagents defined in plugins are specialized AI agents invoked explicitly via the Task tool.

### Naming Pattern

**Format**: `<plugin-name>:<AgentName>`

**Components**:
1. `<plugin-name>` - Plugin name in lowercase (from plugin.json)
2. `:` - Colon separator
3. `<AgentName>` - Agent name in PascalCase

**Examples**:
- `"vscode:Analysis"` - Analysis subagent from vscode plugin
- `"project:Implementer"` - Implementer subagent from project plugin

**Usage**:
```javascript
Task({
  subagent_type: "vscode:Analysis",
  description: "Investigate TypeScript error",
  prompt: "Analyze the TS2322 error at src/user.ts:45"
})
```

### Subagent Definition Files

Subagents are defined in markdown files within a plugin's `agents/` directory:

```
plugins/vscode/
└── agents/
    └── analysis.md          # Contains: name: Analysis, used as "vscode:Analysis"
```

The frontmatter `name` field (not filename) determines the agent identifier.

## Plugin Skill Naming

Skills defined in plugins are capabilities that Claude autonomously invokes based on context matching.

### Directory and File Structure

**Format**: `skills/<skill-directory-name>/SKILL.md`

**Rules**:
1. Skills MUST be in a subdirectory under `skills/`
2. The definition file MUST be exactly `SKILL.md` (all caps)
3. The directory name becomes the skill identifier

**Example**:
```
plugins/browser/
└── skills/
    └── browser/             # Directory name is "browser"
        └── SKILL.md         # Required filename
```

### Skill Frontmatter Name

The `name` field in SKILL.md frontmatter is the **display name** (can include spaces, capitals):

```yaml
---
name: browser                # Display name (spaces allowed)
description: Automate browser tasks including navigation...
---
```

### Skill Description Examples

The `description` field is critical for skill activation - it determines when Claude autonomously invokes the skill. Below are real-world examples from production skills showing effective description patterns.

**Key patterns in effective descriptions**:
- State the capability clearly and specifically
- Include trigger keywords that signal relevance
- Specify the context or use case
- Mention specific technologies, file types, or domains

#### Document Processing Skills

**docx (Word Documents)**:
```yaml
description: "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. When Claude needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"
```

**pdf (PDF Documents)**:
```yaml
description: Comprehensive PDF manipulation toolkit for extracting text and tables, creating new PDFs, merging/splitting documents, and handling forms. When Claude needs to fill in a PDF form or programmatically process, generate, or analyze PDF documents at scale.
```

**pptx (Presentations)**:
```yaml
description: "Presentation creation, editing, and analysis. When Claude needs to work with presentations (.pptx files) for: (1) Creating new presentations, (2) Modifying or editing content, (3) Working with layouts, (4) Adding comments or speaker notes, or any other presentation tasks"
```

**xlsx (Spreadsheets)**:
```yaml
description: "Comprehensive spreadsheet creation, editing, and analysis with support for formulas, formatting, data analysis, and visualization. When Claude needs to work with spreadsheets (.xlsx, .xlsm, .csv, .tsv, etc) for: (1) Creating new spreadsheets with formulas and formatting, (2) Reading or analyzing data, (3) Modify existing spreadsheets while preserving formulas, (4) Data analysis and visualization in spreadsheets, or (5) Recalculating formulas"
```

#### Creative and Design Skills

**algorithmic-art**:
```yaml
description: Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create original algorithmic art rather than copying existing artists' work to avoid copyright violations.
```

**canvas-design**:
```yaml
description: Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs, never copying existing artists' work to avoid copyright violations.
```

**slack-gif-creator**:
```yaml
description: Toolkit for creating animated GIFs optimized for Slack, with validators for size constraints and composable animation primitives. This skill applies when users request animated GIFs or emoji animations for Slack from descriptions like "make me a GIF for Slack of X doing Y".
```

**theme-factory**:
```yaml
description: Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc. There are 10 pre-set themes with colors/fonts that you can apply to any artifact that has been creating, or can generate a new theme on-the-fly.
```

#### Development and Technical Skills

**artifacts-builder**:
```yaml
description: Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologies (React, Tailwind CSS, shadcn/ui). Use for complex artifacts requiring state management, routing, or shadcn/ui components - not for simple single-file HTML/JSX artifacts.
```

**mcp-builder**:
```yaml
description: Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).
```

**skill-creator**:
```yaml
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.
```

**webapp-testing**:
```yaml
description: Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.
```

#### Brand and Communication Skills

**brand-guidelines**:
```yaml
description: Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.
```

**internal-comms**:
```yaml
description: A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports, leadership updates, 3P updates, company newsletters, FAQs, incident reports, project updates, etc.).
```

#### Anti-Patterns to Avoid

The template skill shows what NOT to do:
```yaml
description: Replace with description of the skill and when Claude should use it.
```

**Why this is ineffective**:
- ❌ No capability statement
- ❌ No trigger keywords
- ❌ Generic placeholder text
- ❌ No context or specificity

**Effective alternatives** would include:
- ✅ Specific capabilities ("creates", "analyzes", "generates")
- ✅ Technology mentions ("React", "PDF", "Playwright")
- ✅ Use case triggers ("when users request", "for documents that")
- ✅ File type specifications (".docx", ".pdf", ".xlsx")

## Plugin Slash Command Naming

Slash commands defined in plugins are user-invoked instructions in markdown files within a plugin's `commands/` directory.

### Naming Pattern

**Format**: `/command-name` (derived from filename)

**Rules**:
1. Filename (minus `.md`) becomes the command name
2. Must use kebab-case (lowercase with hyphens)
3. Subdirectories create namespaces with colons

**Examples** (from a plugin's `commands/` directory):
```
commands/analyze.md                  → /analyze
commands/git/commit.md               → /git:commit
commands/review/security.md          → /review:security
commands/project/plan/create.md      → /project:plan:create
```

## Plugin Hook Event Naming

Hooks defined in plugins are event-triggered shell commands that execute at specific lifecycle points. They are configured in a plugin's `hooks/hooks.json` file.

### Event Names

Hook events use PascalCase:

**Available Events**:
- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool execution
- `UserPromptSubmit` - When user submits a prompt
- `Notification` - When Claude requests permissions
- `Stop` - After main agent finishes
- `SubagentStop` - After subagent finishes
- `PreCompact` - Before context compaction
- `SessionStart` - Session begins
- `SessionEnd` - Session terminates

**Example**:
```json
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [...]
    }
  ]
}
```

## Plugin and Marketplace Naming

### Plugin Names

**Format**: `lowercase-with-hyphens`

**Source**: `.claude-plugin/plugin.json` → `"name"` field

**Rules**:
- Must match `[a-z0-9]+(-[a-z0-9]+)*` pattern
- No underscores, spaces, or capitals
- Used in installation: `/plugin install <name>@<marketplace>`

**Examples**:
- ✅ `browser`
- ✅ `git-tools`
- ✅ `typescript-helper`
- ❌ `GitTools` (capitals)
- ❌ `browser_plugin` (underscore)

### Marketplace Names

**Format**: Same as plugin names - `lowercase-with-hyphens`

**Source**: `.claude-plugin/marketplace.json` → `"name"` field

## Path and Server Key Naming

### MCP Server Keys

The server key in `.mcp.json` determines tool naming:

```json
{
  "mcpServers": {
    "browser": {              // This key is used in mcp__plugin_X_browser__Y
      "command": "npx",
      "args": ["-y", "@goodfoot/browser-mcp-server"]
    }
  }
}
```

**Rules**:
- Typically lowercase, may include hyphens
- Used in tool names and slash command prefixes
- Should be concise (contributes to 64-character tool name limit)

### File and Directory Names

**Component directories**: Must be lowercase, plural:
- `commands/` not `Commands/`
- `agents/` not `Agents/`
- `skills/` not `Skills/`
- `hooks/` not `Hooks/`

**Skill definition**: Must be exactly `SKILL.md` (all caps)

**Plugin metadata directory**: Must be exactly `.claude-plugin/` (lowercase, leading dot)

**Metadata files**: Must be lowercase:
- `plugin.json` not `Plugin.json`
- `marketplace.json` not `Marketplace.json`
- `hooks.json` not `Hooks.json`

## Character Limits and Constraints

### Tool Name Length

MCP tool names have a **64-character limit** imposed by Claude Code.

**Breakdown**:
```
mcp__plugin_browser_browser__prompt
├─ mcp__plugin_ = 11 chars
├─ browser_     = 8 chars
├─ browser__    = 9 chars
└─ prompt       = 6 chars
                  ──────
Total:            34 chars (well under 64-char limit)
```

**Consideration**: When designing plugin names and MCP server keys, account for this prefix overhead.

**Bad example** (would exceed limit):
```
mcp__plugin_very-long-plugin-name_also-very-long-server-key__extremely-verbose-tool-name
```

### Identifier Constraints

**Kebab-case identifiers** (plugins, agents, commands):
- Pattern: `[a-z0-9]+(-[a-z0-9]+)*`
- Examples: ✅ `git-tools`, `analyze-performance`, `helper-2`
- Invalid: ❌ `-starts-with-hyphen`, `Uses_Underscores`, `HasCapitals`

## Summary Table

| Component | Pattern | Example | Source |
|-----------|---------|---------|--------|
| MCP Tool (plugin) | `mcp__plugin_<plugin>_<server>__<tool>` | `mcp__plugin_browser_browser__prompt` | plugin.json + .mcp.json + server |
| MCP Slash Command (plugin) | `/mcp__<server>__<prompt>` | `/mcp__github__list_prs` | .mcp.json + server prompts |
| Plugin Subagent | `<plugin>:<Agent>` | `"vscode:Analysis"` | plugin.json + agent name |
| Plugin Skill Directory | `skills/<name>/SKILL.md` | `skills/browser/SKILL.md` | Directory structure |
| Plugin Slash Command | `/command-name` | `/analyze` | commands/analyze.md |
| Plugin Hook Event | `PascalCase` | `PreToolUse` | hooks.json |
| Plugin Name | `kebab-case` | `browser` | plugin.json |
| Marketplace Name | `kebab-case` | `workspace-marketplace` | marketplace.json |
| Server Key | `kebab-case` | `browser` | .mcp.json |

## Normalization Rules

### Space to Underscore

When spaces appear in names, they are normalized to underscores:
- MCP prompt "list prs" → `/mcp__github__list_prs`
- This applies to both server names and prompt names in the MCP system

### Case Preservation

Most identifiers require specific casing:
- Plugin names: lowercase only
- Subagent names (plugin-scoped): PascalCase for agent name portion
- Hook events: PascalCase
- MCP tool names: all lowercase with underscores
- Slash commands: lowercase with hyphens (or colons for namespaces)

## Common Mistakes

### ❌ Incorrect MCP Tool Reference

```javascript
// Wrong - missing plugin_ prefix and duplicate server key
mcp__browser__prompt()

// Correct
mcp__plugin_browser_browser__prompt()
```

### ❌ Wrong Subagent Type

```javascript
// Wrong - missing plugin prefix
Task({ subagent_type: "Analysis", ... })

// Correct
Task({ subagent_type: "vscode:Analysis", ... })
```

### ❌ Skill File Location

```
// Wrong - skill as a file
plugins/my-plugin/skills/fix-imports.md

// Correct - skill as directory with SKILL.md
plugins/my-plugin/skills/fix-imports/SKILL.md
```

### ❌ Plugin Name Format

```json
// Wrong - capitals and underscores
{ "name": "Browser_Plugin" }

// Correct
{ "name": "browser-plugin" }
```

## Best Practices

1. **Keep names short**: Tool names contribute to the 64-character limit
2. **Use consistent casing**: Follow the patterns for each component type
3. **Avoid redundancy**: Don't repeat the plugin name in server keys if they're the same
4. **Document references**: Update SKILL.md and README files when tool names change
5. **Verify naming**: Test plugin installation to ensure names resolve correctly

## References

- Official Claude Code Plugins: https://docs.claude.com/en/docs/claude-code/plugins
- Official MCP Documentation: https://docs.claude.com/en/docs/claude-code/mcp
- Official Subagents Guide: https://docs.claude.com/en/docs/claude-code/subagents

---

**Note**: The `mcp__plugin_` prefix pattern is an observed implementation detail and may not be fully documented in official Claude Code documentation as of this writing. This document reflects empirical findings from the actual codebase and tool names.
