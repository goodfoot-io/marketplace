# Claude Code Plugin and Marketplace Naming Conventions

This document describes the naming conventions for **plugin and marketplace-scoped components only**. It covers how to name plugins, marketplaces, and all components defined within plugins (MCP servers, subagents, skills, commands, and hooks).

**Scope**: This documentation is specifically for plugin and marketplace authors. It does not cover general Claude Code features outside of the plugin system.

## 📝 Maintenance Reminder

**IMPORTANT**: When making changes to plugins in this workspace, remember to update this documentation:

### When to Update This File

1. **Adding new plugins** - Add examples using the new plugin's structure
2. **Changing plugin structure** - Update file structure examples and patterns
3. **Adding new component types** - Document naming conventions for new features
4. **Discovering new patterns** - Add to best practices or common mistakes sections
5. **Updating marketplace.json** - Ensure examples remain accurate

### What to Update

- **File structure examples** - Keep paths current with actual plugin structure
- **Plugin names in examples** - Reference actual plugins from `/workspace/plugins-claude/`
- **Tool naming examples** - Use real MCP tool names from the codebase
- **Best practices** - Add lessons learned from plugin development

### Coordination with Other Files

This file should stay in sync with:
- `/workspace/.claude-plugin/marketplace.json` - Plugin registry
- Individual plugin `plugin.json` files - Plugin metadata
- Plugin `.mcp.json` files - MCP server configurations

**Last Updated**: 2026-09-02 (Dropped the plugin-layout registry; plugin shape and version surfaces are now convention-driven)

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

### Example: Voice Plugin

For the voice plugin:
- **Plugin name** (from `/workspace/plugins-claude/voice/.claude-plugin/plugin.json`): `"voice"`
- **Server key** (from `/workspace/plugins-claude/voice/.mcp.json`): `"voice"` (key in mcpServers object)
- **MCP tool name** (from MCP server code): `"conversation"`
- **Final tool name**: `mcp__plugin_voice_voice__conversation`

### File Structure

```
plugins-claude/voice/
├── .claude-plugin/
│   └── plugin.json          # Contains: { "name": "voice", ... }
├── .mcp.json                # Contains: { "mcpServers": { "voice": { ... } } }
└── skills/
    └── handbook/
        └── SKILL.md         # References: mcp__plugin_voice_voice__conversation
```

### Key Insight

The middle portion comes from the **mcpServers key**, NOT the server's internal name — the two frequently match (as with `voice` above) but naming the pattern's parts separately still matters:
- Server internal name: whatever the MCP server passes as its own `name` when constructed (defined in the server's own source)
- MCP server key: the key under `mcpServers` in `.mcp.json`
- **The key is what's used** in the tool naming, regardless of what the server calls itself internally

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

Subagents defined in plugins are specialized AI agents invoked explicitly via the Agent tool.

### Naming Pattern

**Format**: `<plugin-name>:<AgentName>`

**Components**:
1. `<plugin-name>` - Plugin name in lowercase (from plugin.json)
2. `:` - Colon separator
3. `<AgentName>` - Agent name in PascalCase

**Examples**:
- `"code-review:Analysis"` - Analysis subagent from code-review plugin
- `"project:Implementer"` - Implementer subagent from project plugin

**Usage**:
```xml
<invoke name="Agent">
<parameter name="subagent_type">code-review:Analysis</parameter>
<parameter name="description">Investigate TypeScript error</parameter>
<parameter name="prompt">Analyze the TS2322 error at src/user.ts:45</parameter>
</invoke>
```

### Subagent Definition Files

Subagents are defined in markdown files within a plugin's `agents/` directory:

```
plugins-claude/code-review/
└── agents/
    └── analysis.md          # Contains: name: Analysis, used as "code-review:Analysis"
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
plugins-claude/my-plugin/
└── skills/
    └── my-skill/            # Directory name is "my-skill"
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

## Embedded Bash in Commands and Skills

Commands and skills can execute bash statements that are evaluated before the content is sent to Claude. This allows dynamic content generation, file reading, and environment variable access.

The raw syntax in this section is Claude Code-specific and remains correct for hand-authored Claude-only content. Portable templates under `skills-src/` must use `it.bash(command)` for block output or `it.bashInline(command)` for inline output; the compiler preserves native Claude syntax and emits deterministic run-and-report instructions for platforms without verified render-time execution.

### Optional: allowed-tools Frontmatter

The `allowed-tools` frontmatter field is **optional** and only needed when you want to **restrict** which tools Claude can access during command execution:

```yaml
---
description: My command description
allowed-tools: Bash(git status:*), Bash(git diff:*)  # Restricts Claude to only these bash commands
---
```

**Use cases for allowed-tools**:
- Limit Claude to specific safe operations (e.g., only read-only git commands)
- Prevent potentially destructive operations in production commands
- Create sandboxed environments for testing

**Patterns**:
- `Bash(command:*)` - Allow specific command with any arguments
- `Bash(*)` - Allow all bash commands
- Omit `allowed-tools` entirely to allow all tools (default behavior)

### Syntax

**Multi-line embedded bash** (for multiple commands or complex operations):
````markdown
```!
echo "Hello from bash"
ls -la
PROJECT_DIR=$(mkdir -p mydir && echo "mydir")
```
````

**Inline embedded bash** (for single values or simple substitutions):
````markdown
The current date is !`date +%Y-%m-%d`.
Current user: !`whoami`
File count: !`ls -1 | wc -l`
````

**File reference with embedded bash** (reading file contents):
````markdown
Review the documentation: @${CLAUDE_PLUGIN_ROOT}/docs/guide.md
````

**When to use each**:
- **Multi-line (```` ```! ````)**: Sequential operations, error handling, complex logic, testing
- **Inline (`!`command``)**: Single value substitution, simple commands, inline context
- **File reference (`@!`command``)**: Reading file contents into the command/skill context

### Execution Context

Embedded bash statements:
- Execute in the **workspace root directory** (not the plugin directory)
  - Verified: `$(pwd)` returns the workspace root (e.g., `/workspace`)
  - This means relative paths like `projects/new/` work directly
  - Plugin scripts using workspace-relative paths will work correctly
- Run **before** content is sent to Claude
- Have their output substituted into the content
- Do **not** have access to `CLAUDE_PROJECT_DIR` environment variable
- **All embedded bash blocks run in parallel (simultaneously)** - not sequentially
- **Each embedded bash block executes in its own isolated context** - variables and environment changes do not persist between blocks

### Accessing Plugin Files with `${CLAUDE_PLUGIN_ROOT}`

The `${CLAUDE_PLUGIN_ROOT}` variable provides the path to the plugin's root directory, enabling commands to access plugin-relative files.

**Example - Reading a plugin file**:
````markdown
---
description: My command with reference data
---

Loading configuration from plugin:

```!
cat "${CLAUDE_PLUGIN_ROOT}/config/settings.json"
```
````

**Example - Listing plugin contents**:
````markdown
```!
echo "Plugin directory: ${CLAUDE_PLUGIN_ROOT}"
ls -la "${CLAUDE_PLUGIN_ROOT}"
```
````

**Example - Executing plugin scripts**:
````markdown
```!
"${CLAUDE_PLUGIN_ROOT}/scripts/analyze.sh" --verbose
```
````

### Path Resolution

`${CLAUDE_PLUGIN_ROOT}` can be **either relative or absolute** depending on the execution context:
- **Relative** (from workspace root): `plugins-claude/voice`, `plugins-claude/expansion`
- **Absolute**: `/workspace/plugins-claude/voice`, `/workspace/plugins-claude/expansion`

Both forms work correctly since embedded bash executes from the workspace root. Your code should handle both cases by using `"${CLAUDE_PLUGIN_ROOT}"` directly without assumptions about its format.

**Example - Works with both relative and absolute paths**:
````markdown
```!
# This works whether CLAUDE_PLUGIN_ROOT is relative or absolute
"${CLAUDE_PLUGIN_ROOT}"/bin/my-script.sh
cat "${CLAUDE_PLUGIN_ROOT}/config/settings.json"
```
````

You can use this to read reference files, configuration data, or execute helper scripts packaged with your plugin.

### Using ${CLAUDE_PLUGIN_ROOT} in Documentation and Examples

> **🚨 CRITICAL**: The syntax for using `${CLAUDE_PLUGIN_ROOT}` differs between command files (with embedded bash) and regular documentation files. Using the wrong syntax will result in users seeing literal variable names instead of actual paths.

#### Decision Tree: Which Syntax Should I Use?

```
Are you writing code that will execute?
├─ YES, in a ```! block
│  └─ Use: "${CLAUDE_PLUGIN_ROOT}" directly
│     Example: RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/tool)
│
└─ NO, showing examples to users?
   ├─ In a command/skill file (commands/*.md or skills/*.md)
   │  └─ Use: ${CLAUDE_PLUGIN_ROOT}
   │     Example: ${CLAUDE_PLUGIN_ROOT}/bin/tool
   │
   └─ In a regular documentation file (README.md, etc.)
      └─ Use: "${CLAUDE_PLUGIN_ROOT}" (literal)
         Example: "${CLAUDE_PLUGIN_ROOT}"/bin/tool
```

#### Quick Reference

| Context | Syntax | Result |
|---------|--------|--------|
| Embedded bash block (````!`) | `"${CLAUDE_PLUGIN_ROOT}"/bin/tool` | Variable expanded at runtime ✓ |
| Command file docs (````bash`) | `"${CLAUDE_PLUGIN_ROOT}"/bin/tool` | Shows literal string ✗ |
| Command file docs (````bash`) | `${CLAUDE_PLUGIN_ROOT}`/bin/tool` | Shows expanded path ✓ |
| Regular files (README.md) | `"${CLAUDE_PLUGIN_ROOT}"/bin/tool` | Shows what users type ✓ |
| File reference | `@${CLAUDE_PLUGIN_ROOT}`/file.md` | Reads file at expanded path ✓ |

#### In Embedded Bash Blocks (Executes Code) ✓

Use `"${CLAUDE_PLUGIN_ROOT}"` directly - the variable will be expanded at runtime:

````markdown
```!
# This executes and ${CLAUDE_PLUGIN_ROOT} is expanded
PROJECT_DIR=$("${CLAUDE_PLUGIN_ROOT}"/bin/initialize-project "my-project")
"${CLAUDE_PLUGIN_ROOT}"/bin/my-script.sh
```
````

#### In Command Files - Documentation Code Blocks (Shows Examples)

Use `${CLAUDE_PLUGIN_ROOT}` syntax - this expands the path when rendered so users see the actual path:

**✓ Correct - Shows actual path to users**:
````markdown
**Usage:**
```bash
# Users will see "plugins-claude/voice/bin/voice-mcp-server.mjs" (actual path)
${CLAUDE_PLUGIN_ROOT}/bin/voice-mcp-server.mjs
${CLAUDE_PLUGIN_ROOT}/bin/my-script.sh
```
````

**✗ Incorrect - Shows literal variable name**:
````markdown
**Usage:**
```bash
# Users will see literal "${CLAUDE_PLUGIN_ROOT}" - not helpful!
PROJECT_DIR=$("${CLAUDE_PLUGIN_ROOT}"/bin/initialize-project "my-project")
```
````

**Why this matters**:
- Regular markdown code blocks (````bash`) in command files don't execute - they're just formatted text
- If you use `"${CLAUDE_PLUGIN_ROOT}"` in command documentation, users will see the literal string instead of the actual path
- The `${CLAUDE_PLUGIN_ROOT}` syntax runs the echo command and substitutes the result when the documentation is rendered
- **IMPORTANT**: This only works in command/skill files (`.md` files in `commands/` or `skills/` directories)

#### In Regular Documentation Files (README.md, etc.) ✓

Regular markdown files like `README.md` do NOT have embedded bash processing. Use the literal `"${CLAUDE_PLUGIN_ROOT}"` syntax to show users what they should type:

````markdown
**Usage:**
```bash
# This is what users will actually type in their terminal
PROJECT_DIR=$("${CLAUDE_PLUGIN_ROOT}"/bin/initialize-project "my-project")
```
````

#### Detailed Examples

**✓ Correct - Embedded bash (executes)**:
````markdown
```!
RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/process-data)
```
````

**✗ Incorrect - Documentation without expansion**:
````markdown
**Usage:**
```bash
# Users will see literal "${CLAUDE_PLUGIN_ROOT}" which won't help them
RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/process-data)
```
````

**✓ Correct - Command file documentation with expansion**:
````markdown
**Usage:**
```bash
# Users will see "plugins-claude/voice/bin/process-data" or the actual path
RESULT=$(${CLAUDE_PLUGIN_ROOT}/bin/process-data)
```
````

**✓ Correct - README.md (regular file)**:
````markdown
**Usage:**
```bash
# This is what users actually type - shows literal syntax
RESULT=$("${CLAUDE_PLUGIN_ROOT}"/bin/process-data)
```
````

#### Common Mistakes

**❌ Mistake #1: Using variable directly in documentation blocks**
```bash
# In a command file's ```bash block
# Problem: Users see literal "${CLAUDE_PLUGIN_ROOT}" - unhelpful!
"${CLAUDE_PLUGIN_ROOT}"/bin/my-tool
```

**✓ Fix: Use embedded bash expansion**
```bash
# In a command file's ```bash block
# Users see actual path like "plugins-claude/voice/bin/my-tool" - helpful!
${CLAUDE_PLUGIN_ROOT}/bin/my-tool
```

**❌ Mistake #2: Using embedded bash in README.md files**
```bash
# In README.md (regular documentation file)
# Problem: Won't expand - README files don't process embedded bash
${CLAUDE_PLUGIN_ROOT}/bin/my-tool
```

**✓ Fix: Use literal syntax in regular docs**
```bash
# In README.md
# Shows users what they should type
"${CLAUDE_PLUGIN_ROOT}"/bin/my-tool
```

**❌ Mistake #3: Forgetting backticks in embedded bash**
```bash
# In a command file's ```bash block
# Problem: Missing backticks - won't expand
!echo "${CLAUDE_PLUGIN_ROOT}"/bin/my-tool
```

**✓ Fix: Include backticks around the command**
```bash
# Correct syntax with backticks
${CLAUDE_PLUGIN_ROOT}/bin/my-tool
```

### Skills vs Commands

**Skills** get automatic base directory context in their prompt:
```
Base directory for this skill: /path/to/plugin/skills/skill-name

[skill content]
```

**Commands** do not receive base directory automatically, but can use `${CLAUDE_PLUGIN_ROOT}` in embedded bash to access plugin files.

### Common Use Cases

1. **Reading reference documentation**:
   ````markdown
   ```!
   cat "${CLAUDE_PLUGIN_ROOT}/docs/api-reference.md"
   ```
   ````

2. **Loading templates**:
   ````markdown
   ```!
   cat "${CLAUDE_PLUGIN_ROOT}/templates/component.tsx"
   ```
   ````

3. **Checking plugin version**:
   ````markdown
   Plugin version: !`cat "${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json" | grep version`
   ````

4. **Conditional content based on file existence**:
   ````markdown
   ```!
   if [ -f "${CLAUDE_PLUGIN_ROOT}/config.json" ]; then
     echo "Configuration found:"
     cat "${CLAUDE_PLUGIN_ROOT}/config.json"
   else
     echo "No configuration file found"
   fi
   ```
   ````

### Limitations

- Embedded bash runs with the same permissions as Claude Code
- Output is substituted as plain text into the markdown
- Errors in bash commands will cause the command/skill to fail
- Cannot access `CLAUDE_PROJECT_DIR` (use `pwd` or workspace-relative paths instead)
- **Context isolation**: Each embedded bash block runs in a separate shell instance. Variables, exports, and `cd` commands do not carry over between blocks

### Parallel Execution and Context Isolation

**CRITICAL**: All embedded bash blocks run **simultaneously** (in parallel), not sequentially. For sequential operations, use a single block.

This **WILL NOT WORK** (blocks run in parallel, race condition):
````markdown
```!
# Block 1: Create directory
mkdir -p mydir
```

```!
# Block 2: Write file (may run BEFORE Block 1!)
echo "test" > mydir/file.txt
```
````

This **WILL WORK** (single block, sequential execution):
````markdown
```!
# All commands in one block run sequentially
mkdir -p mydir
echo "test" > mydir/file.txt
```
````

Variables also don't persist between blocks:
````markdown
```!
export MY_VAR="hello"
```

```!
echo "$MY_VAR"  # Empty - different shell instance
```
````

Inline substitution works for single values:
````markdown
The value is !`MY_VAR="hello"; echo "$MY_VAR"`
````

**Best Practice for Plugin Binaries**: Use `${CLAUDE_PLUGIN_ROOT}` directly in commands within a single block for sequential operations:

````markdown
```!
# All operations in one block ensure sequential execution
# Step 1: Initialize
PROJECT_DIR=$("${CLAUDE_PLUGIN_ROOT}"/bin/initialize-project "my-project")

# Step 2: Create plan (depends on Step 1 completing)
PLAN_FILE=$("${CLAUDE_PLUGIN_ROOT}"/bin/create-plan "my-project" "content")

# Step 3: Verify (depends on Step 2 completing)
if [ -f "$PLAN_FILE" ]; then
  echo "✓ Plan created successfully"
  cat "$PLAN_FILE"
fi
```
````

**Incorrect** - Trying to set PATH in separate block:
````markdown
# DON'T DO THIS - PATH won't persist to next block
```!
export PATH="${CLAUDE_PLUGIN_ROOT}/bin:$PATH"
```

```!
PROJECT_DIR=$(initialize-project "project-name")  # Won't find the binary
```
````

### Testing Commands with Dependencies

When creating test commands that verify plugin functionality, use a **single embedded bash block** to ensure tests run sequentially:

````markdown
---
description: Test my plugin binaries
---

```!
echo "=== Running Tests ==="

# Test 1: Setup
echo "Test 1: Creating resources..."
RESOURCE=$("${CLAUDE_PLUGIN_ROOT}"/bin/create-resource "test-resource")
if [ $? -ne 0 ]; then
  echo "✗ Test 1 failed"
  exit 1
fi
echo "✓ Test 1 passed"

# Test 2: Verify (depends on Test 1)
echo "Test 2: Verifying resource..."
if [ -f "$RESOURCE" ]; then
  echo "✓ Test 2 passed"
else
  echo "✗ Test 2 failed"
  exit 1
fi

# Test 3: Cleanup
echo "Test 3: Cleaning up..."
rm -f "$RESOURCE"
echo "✓ All tests passed!"
```
````

**Key testing patterns**:
- Use single block for all tests to ensure sequential execution
- Capture exit codes and check for errors after each operation
- Use `exit 1` to stop on first failure
- Provide clear pass/fail indicators (✓/✗)
- Include cleanup instructions or automatic cleanup at the end

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

```xml
<!-- Wrong - missing plugin prefix -->
<invoke name="Agent">
<parameter name="subagent_type">Analysis</parameter>
...
</invoke>

<!-- Correct -->
<invoke name="Agent">
<parameter name="subagent_type">code-review:Analysis</parameter>
...
</invoke>
```

### ❌ Skill File Location

```
// Wrong - skill as a file
plugins-claude/my-plugin/skills/fix-imports.md

// Correct - skill as directory with SKILL.md
plugins-claude/my-plugin/skills/fix-imports/SKILL.md
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

## Convention-driven portable plugin layout

Portable skills are authored once as Eta templates under `skills-src/<plugin>/`. There is no declared registry of plugin build targets, platform directories, or release identities anywhere in the repository — a plugin's shape is computed from where it sits on disk. Every directory under `skills-src/` is a plugin, and `yarn build:agent-skills` renders it into all four standard platform roots:

```text
skills-src/<plugin>/<skill>/SKILL.md.eta
plugins-claude/<plugin>/skills/<skill>/SKILL.md
plugins-codex/<plugin>/skills/<skill>/SKILL.md
plugins-opencode/<plugin>/skills/<skill>/SKILL.md
plugins-antigravity/<plugin>/skills/<skill>/SKILL.md
```

A skill file can still gate itself to a subset of platforms with a `platforms:` front-config declaration (e.g. `plugins-claude/voice`'s `handbook` skill declares `platforms: [claude-code]`, since the MCP server it documents doesn't run anywhere else) — but the plugin's directory, and its version-carrying manifest, exists at all four standard roots regardless, with no per-plugin opt-out.

`plugins-claude/typescript-hooks` and `plugins-claude/expansion` have no `skills-src/` sibling and remain hand-maintained, Claude-only plugins outside this build.

### Generated ownership and validation

Edit `skills-src/`, not generated `SKILL.md` files. Build and validate with the repository entry points:

```bash
yarn build:agent-skills
yarn build:agent-skills --check-targets
yarn lint:agent-skills
./scripts/sync-plugin-versions.sh --check
```

Antigravity plugins use a bare `plugin.json` at `plugins-antigravity/<plugin>/` with applicable generated skills below `skills/`. Official Antigravity layout uses a root `hooks.json`; this repository does not publish Antigravity hooks or MCP server payloads until `agy plugin validate` reports a positive processed category rather than only a successful exit status.

### Version surfaces

A plugin with a `skills-src/<name>` sibling has exactly one canonical version file: `plugins-claude/<name>/.claude-plugin/plugin.json`. Committing a change to a plugin bumps that file's patch version, with no changelog-entry requirement gating the commit, and `./scripts/sync-plugin-versions.sh` propagates it to the Codex manifest, the OpenCode package, the Antigravity manifest, and the Claude marketplace entry — the same script CI runs with `--check`, so a bump the pre-commit hook makes and the surface CI verifies can never disagree about what a plugin's surfaces are. The Codex marketplace catalog (`.agents/plugins/marketplace.json`) carries its own top-level version, independent of the Claude catalog's, and advances whenever a plugin it lists is bumped.

Hand-maintained, Claude-only plugins (`typescript-hooks`, `expansion`) bump only their own manifest and the Claude marketplace entry.

A plugin's npm package (`packages/<name>`), where one exists, is a separate release line with its own version, read from — never written to — by `scripts/release-package.sh` and `scripts/update-package-changelog.sh`. A maintainer bumps `packages/<name>/package.json` by hand before releasing; nothing propagates a plugin version bump into it.

### Skill-owned assets

Opaque assets such as `bin/` belong inside the authored skill directory under `skills-src/<plugin>/<skill>/`. The compiler carries selected assets into each applicable generated target alongside `SKILL.md`; there is no manual synchronization step.
