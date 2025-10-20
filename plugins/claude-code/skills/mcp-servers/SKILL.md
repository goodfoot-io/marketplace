---
name: MCP Server Configuration
description: Configure and manage Model Context Protocol (MCP) servers for Claude Code
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

## What Are MCP Servers?

**Model Context Protocol (MCP) servers** are external integrations that provide additional tools and capabilities to Claude Code beyond the built-in tools (Read, Write, Edit, Bash, etc.).

### Purpose

MCP servers enable Claude Code to:
- Connect to external services (databases, APIs, browsers, cloud platforms)
- Access specialized tools (code analysis, testing frameworks, deployment tools)
- Integrate with third-party systems
- Extend functionality without modifying Claude Code core

### Architecture

```
Claude Code (Client)
       ↓
MCP Protocol (JSON-RPC over stdin/stdout)
       ↓
MCP Server (Node.js, Python, etc.)
       ↓
External Service (Browser, Database, API, etc.)
```

## How MCP Servers Integrate with Claude Code

### Configuration Location

**This skill covers Claude Code CLI configuration.** Configuration locations differ by product:

**Claude Code CLI** (command-line interface):
- **Project-level**: `/workspace/.claude/settings.json` (verified for this repository)
- **User-level**: Location varies by system (typically `~/.config/claude/` on Linux/Mac)

**Claude Desktop** (GUI application - different product):
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

> **Note**: Claude Desktop supports one-click installation via Desktop Extensions (see below). Manual JSON configuration is primarily for Claude Code CLI or custom MCP servers.

### Configuration Format

```json
{
  "mcpServers": {
    "server-name": {
      "command": "executable",
      "args": ["arg1", "arg2"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

**Field Descriptions:**
- `server-name`: Unique identifier for the MCP server (appears in tool names as `mcp__server-name__tool`)
- `command`: Executable to run (e.g., `node`, `python`, `npx`)
- `args`: Array of command-line arguments
- `env`: Optional environment variables for the server process

### Tool Access Pattern

MCP-provided tools are prefixed with `mcp__<server-name>__`:

```
Built-in tools:    Read, Write, Edit, Bash, Glob, Grep
MCP tools:         mcp__browser__prompt
                   mcp__vscode__get_diagnostics
```

## Desktop Extensions (2025+)

**For Claude Desktop users**, the easiest way to install MCP servers is via Desktop Extensions, introduced in 2025:

### One-Click Installation

1. **Open Claude Desktop** (not Claude Code CLI)
2. Navigate to **Settings > Extensions > Browse extensions**
3. Browse Anthropic-reviewed MCP servers
4. Click "Install" for desired integrations
5. No manual JSON configuration required

### Benefits

- **Curated**: Anthropic-reviewed for quality and security
- **Automatic updates**: Extensions update without manual intervention
- **Simple setup**: No command-line configuration needed
- **Discovery**: Browse available integrations in one place

### When to Use Manual Configuration

Use the manual JSON configuration method (described in this skill) when:
- Using **Claude Code CLI** (command-line interface)
- Installing **custom/private MCP servers** not in the extension marketplace
- Developing and testing your own MCP servers
- Requiring specific configuration beyond extension defaults

> **Note**: This skill focuses on manual JSON configuration for Claude Code CLI. For Claude Desktop extension installation, see Settings > Extensions in the Claude Desktop application.

## Plugin-Bundled MCP Servers

Plugins can bundle MCP server configurations in the `mcp-servers/` directory:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── mcp-servers/
│   ├── server-local.json       # Local development config
│   └── server-production.json  # Production config
└── skills/
    └── my-skill/
        └── SKILL.md
```

### Plugin MCP Configuration Example

**File**: `/workspace/my-plugin/mcp-servers/browser.json`

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": [
        "/workspace/packages/mcp/browser/dist/browser.js",
        "--browserUrl",
        "http://localhost:9222"
      ],
      "env": {
        "MAX_MCP_OUTPUT_TOKENS": "100000"
      }
    }
  }
}
```

**Usage**: Users copy this configuration to their Claude Code settings, or Claude Code may support auto-loading plugin MCP configurations in the future.

## Tool Restrictions and MCP Access

### Unrestricted Access (Default)

When `tools` (agents) or `allowed-tools` (skills) fields are **omitted**, the component gets:
- All built-in tools (Read, Write, Edit, Bash, Glob, Grep, Task, etc.)
- All MCP-provided tools (mcp__browser__prompt, mcp__vscode__get_diagnostics, etc.)

**Example - Unrestricted Agent:**
```yaml
---
name: full-access-agent
description: Agent with complete tool access including MCP servers
---
```

**Example - Unrestricted Skill:**
```yaml
---
name: Full Access Skill
description: Skill with all tools including MCP integrations
---
```

### Restricted Access (Explicit Tools)

When `tools` or `allowed-tools` are **specified**, the component gets:
- **ONLY** the explicitly listed tools
- **NO** MCP-provided tools (unless explicitly listed)

**Example - Restricted Agent (No MCP):**
```yaml
---
name: read-only-agent
description: Agent restricted to reading code
tools: Read, Glob, Grep
---
```

This agent can use `Read`, `Glob`, `Grep` but **CANNOT** use Task tool with "codebase-analysis" subagent or any other MCP tools.

**Example - Restricted Skill (No MCP):**
```yaml
---
name: Safe Editor
description: Skill that only edits files
allowed-tools: Read, Edit
---
```

### Including MCP Tools in Restrictions

To grant access to specific MCP tools, list them explicitly:

```yaml
---
name: browser-tester
description: Tests web applications using browser automation
tools: Read, Grep, mcp__browser__prompt
---
```

**Key Points:**
- MCP tool names include the prefix: `mcp__<server>__<tool>`
- Must specify exact tool name (e.g., `mcp__browser__prompt`, not just `browser`)
- Omitting `tools`/`allowed-tools` field is the easiest way to grant MCP access
- For codebase analysis, use the built-in Task tool with "codebase-analysis" subagent instead of MCP

## Common MCP Server Types

### 1. Codebase Analysis

**Purpose**: Deep code analysis using AST parsing and semantic search

**Example Configuration:**
```json
{
  "mcpServers": {
    "codebase": {
      "command": "node",
      "args": ["/path/to/codebase-mcp-server.js"]
    }
  }
}
```

**Available via Task tool with "codebase-analysis" subagent:**

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Brief description of analysis task",
  prompt: "What specific question to analyze?"
})
</tool-use-template>

**Use Cases:**
- Trace function calls and dependencies
- Find all implementations of an interface
- Analyze code complexity and patterns
- Search for specific code constructs

### 2. Browser Automation

**Purpose**: Control Chrome browser via DevTools Protocol

**Example Configuration:**
```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": [
        "/path/to/browser-mcp-server.js",
        "--browserUrl",
        "http://localhost:9222"
      ],
      "env": {
        "MAX_MCP_OUTPUT_TOKENS": "100000"
      }
    }
  }
}
```

**Available Tools:**
- `mcp__browser__prompt`: Execute browser automation tasks with natural language

**Use Cases:**
- Web scraping and data extraction
- Automated testing of web applications
- Screenshot capture and visual testing
- Form filling and interaction automation

**Prerequisites:**
- Chrome running with remote debugging: `chrome --remote-debugging-port=9222`

### 3. VSCode Integration

**Purpose**: Access VSCode language server features (diagnostics, symbols, references)

**Example Configuration:**
```json
{
  "mcpServers": {
    "vscode": {
      "command": "node",
      "args": ["/path/to/vscode-mcp-bridge.js"]
    }
  }
}
```

**Available Tools:**
- `mcp__vscode__get_diagnostics`: Get TypeScript/ESLint errors
- `mcp__vscode__get_symbol_lsp_info`: Get type information for symbols
- `mcp__vscode__get_references`: Find all references to a symbol
- `mcp__vscode__rename_symbol`: Rename across files safely
- `mcp__vscode__execute_command`: Execute VSCode commands

**Use Cases:**
- Fix type errors and linting issues
- Refactor code with symbol renaming
- Navigate code with reference finding
- Format and auto-fix code

### 4. Database Access

**Purpose**: Query and manage databases

**Example Configuration:**
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION": "postgresql://user:pass@localhost:5432/db"
      }
    }
  }
}
```

**Use Cases:**
- Query database schemas
- Execute SQL queries
- Inspect table structures
- Database migrations

### 5. File System Operations

**Purpose**: Enhanced file system access beyond built-in tools

**Example Configuration:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    }
  }
}
```

**Use Cases:**
- Advanced file operations
- Directory watching
- Bulk file processing

## Configuration Workflow

### Step 1: Identify Requirements

Determine what external capabilities are needed:
- Code analysis → codebase MCP
- Browser automation → browser MCP
- Language server features → vscode MCP
- Database access → postgres/mysql MCP

### Step 2: Locate Configuration File

Find or create the Claude Code settings file:

```bash
# Project-level (recommended for project-specific MCP servers)
/workspace/.claude/settings.json

# User-level (for global MCP servers)
~/.config/claude/settings.json
```

### Step 3: Add MCP Server Configuration

Read existing settings:

```bash
cat /workspace/.claude/settings.json
```

Add `mcpServers` section or extend existing one:

```json
{
  "mcpServers": {
    "codebase": {
      "command": "node",
      "args": ["/workspace/packages/mcp/codebase/dist/codebase.js"]
    },
    "browser": {
      "command": "node",
      "args": [
        "/workspace/packages/mcp/browser/dist/browser.js",
        "--browserUrl",
        "http://localhost:9222"
      ]
    }
  }
}
```

### Step 4: Validate Configuration

Check JSON syntax:

```bash
jq empty /workspace/.claude/settings.json || echo "ERROR: Invalid JSON"
```

Verify executable paths exist:

```bash
# Check if MCP server file exists
ls -l /workspace/packages/mcp/browser/dist/browser.js

# Check if command is available
which node
```

### Step 5: Restart Claude Code

MCP servers are loaded when Claude Code starts. Restart the session to load new configurations.

### Step 6: Test MCP Connection

Try using an MCP tool to verify it's working:

<tool-use-template>
# For codebase analysis via Task tool
Task({
  subagent_type: "vscode:Analysis",
  description: "List TypeScript files",
  prompt: "List all TypeScript files in src/"
})

# For browser MCP (requires Chrome running)
mcp__browser__prompt({ prompt: "Navigate to example.com" })
</tool-use-template>

## Troubleshooting MCP Server Issues

### Issue: MCP Tool Not Available

**Symptoms:**
- Tool name not recognized: `Tool mcp__browser__prompt not found`
- MCP tools missing from available tools list

**Solutions:**

1. **Check Configuration Syntax:**
   ```bash
   jq '.mcpServers' /workspace/.claude/settings.json
   ```

2. **Verify Server Name:**
   - Server name in config must match tool prefix
   - `mcpServers.codebase` → tools prefixed with `mcp__codebase__`

3. **Check File Paths:**
   ```bash
   # Verify command executable exists
   which node

   # Verify MCP server file exists
   ls -l /workspace/packages/mcp/codebase/dist/codebase.js
   ```

4. **Check Tool Restrictions:**
   - If using `tools` or `allowed-tools`, MCP tools must be explicitly listed
   - Or omit the field entirely to grant all tools

5. **Restart Claude Code:**
   - MCP servers only load at startup
   - Restart required after configuration changes

### Issue: MCP Server Fails to Start

**Symptoms:**
- Error messages about server startup failure
- Connection timeout errors

**Solutions:**

1. **Check Command Execution:**
   ```bash
   # Test if command runs manually
   node /workspace/packages/mcp/browser/dist/browser.js --browserUrl http://localhost:9222
   ```

2. **Verify Dependencies:**
   ```bash
   # For Node.js MCP servers
   cd /workspace/packages/mcp/browser
   yarn install
   yarn build
   ```

3. **Check Environment Variables:**
   ```json
   {
     "mcpServers": {
       "server": {
         "command": "node",
         "args": ["server.js"],
         "env": {
           "REQUIRED_VAR": "value"
         }
       }
     }
   }
   ```

4. **Review Server Logs:**
   - Check Claude Code logs for MCP server stderr output
   - Look for initialization errors or missing dependencies

### Issue: MCP Tool Returns Errors

**Symptoms:**
- Tool executes but returns error responses
- "Connection refused" or similar errors

**Solutions:**

1. **For Browser MCP - Check Chrome:**
   ```bash
   # Verify Chrome is running with remote debugging
   curl http://localhost:9222/json

   # Start Chrome if needed
   google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
   ```

2. **For Database MCP - Check Connection:**
   ```bash
   # Test database connection
   psql postgresql://user:pass@localhost:5432/db -c "SELECT 1"
   ```

3. **For VSCode MCP - Check VSCode Bridge:**
   ```bash
   # Verify VSCode extension is running
   # Check VSCode output panel for MCP Bridge logs
   ```

4. **Check MCP Server Arguments:**
   - Verify all required arguments are provided
   - Check argument format matches server expectations

### Issue: Performance Problems

**Symptoms:**
- MCP tool calls are slow
- Timeout errors
- Large output causing token limit issues

**Solutions:**

1. **Increase Output Token Limit:**
   ```json
   {
     "mcpServers": {
       "browser": {
         "command": "node",
         "args": ["browser.js"],
         "env": {
           "MAX_MCP_OUTPUT_TOKENS": "100000"
         }
       }
     }
   }
   ```

2. **Optimize Query Scope:**
   - For codebase queries, narrow down file patterns
   - For browser automation, reduce snapshot frequency

3. **Use Session Management:**
   - Browser MCP supports sessionId for continuity
   - Reuse sessions to maintain context

## Best Practices

### Security

1. **Protect Sensitive Data:**
   - Use environment variables for credentials
   - Never hardcode passwords in configuration files
   - Use `.gitignore` to exclude settings with secrets

2. **Restrict Access:**
   - Use tool restrictions to limit MCP access when appropriate
   - Grant MCP tools only to components that need them

3. **Validate Inputs:**
   - MCP servers should validate all inputs
   - Sanitize user-provided data before executing

### Configuration Management

1. **Use Project-Level Settings:**
   ```
   /workspace/.claude/settings.json  ← Project-specific MCP servers
   ```

2. **Version Control:**
   - Commit `settings.json` template without secrets
   - Document required environment variables in README
   - Provide example configurations in plugin `mcp-servers/` directory

3. **Separate Development and Production:**
   ```
   mcp-servers/
   ├── browser-local.json        # Local development (workspace paths)
   └── browser-production.json   # Production (npm packages)
   ```

### Plugin Integration

1. **Bundle Configuration Templates:**
   - Include MCP configs in `mcp-servers/` directory
   - Provide both local and production variants
   - Document in plugin README

2. **Document Prerequisites:**
   - List external service requirements (Chrome, databases, etc.)
   - Provide setup instructions
   - Include troubleshooting section

3. **Skill Tool Access:**
   - Omit `allowed-tools` to grant MCP access automatically
   - Or explicitly list MCP tools if restricted access needed

## Example Configurations

### Complete Settings File

```json
{
  "permissions": {
    "allow": [],
    "deny": [],
    "defaultMode": "askUser"
  },
  "env": {
    "MAX_MCP_OUTPUT_TOKENS": "100000"
  },
  "mcpServers": {
    "codebase": {
      "command": "node",
      "args": ["/workspace/packages/mcp/codebase/dist/codebase.js"]
    },
    "browser": {
      "command": "node",
      "args": [
        "/workspace/packages/mcp/browser/dist/browser.js",
        "--browserUrl",
        "http://localhost:9222"
      ],
      "env": {
        "MAX_MCP_OUTPUT_TOKENS": "100000"
      }
    },
    "vscode": {
      "command": "node",
      "args": ["/path/to/vscode-mcp-bridge.js"]
    }
  },
  "hooks": {
    "PreToolUse": [],
    "PostToolUse": []
  }
}
```

### Plugin MCP Configuration Template

**File**: `/workspace/my-plugin/mcp-servers/my-server.json`

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": [
        "/workspace/packages/mcp/my-server/dist/server.js",
        "--option",
        "value"
      ],
      "env": {
        "REQUIRED_ENV_VAR": "value"
      }
    }
  }
}
```

**Plugin README Documentation:**

```markdown
## MCP Server Configuration

This plugin requires the `my-server` MCP server to be configured.

### Installation

1. Copy the MCP configuration from `mcp-servers/my-server.json`
2. Add it to your Claude Code settings at `/workspace/.claude/settings.json`
3. Set required environment variables:
   - `REQUIRED_ENV_VAR`: Description of what this variable does

### Verification

Test the MCP server is working:

\`\`\`
mcp__my-server__test_tool({ test: "value" })
\`\`\`

You should see a successful response.
```

## Integration with Plugin Components

### Skills with MCP Access

**Option 1: Unrestricted (Recommended):**

```yaml
---
name: Browser Tester
description: Tests web applications using browser automation
---
```

By omitting `allowed-tools`, this skill automatically gets all MCP tools and built-in tools.

**Option 2: Explicit Tools:**

```yaml
---
name: Browser Tester
description: Tests web applications using browser automation
allowed-tools: Read, Grep, mcp__browser__prompt
---
```

**Note**: For codebase analysis, use the built-in Task tool with "codebase-analysis" subagent:

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Analyze authentication flow",
  prompt: "How does the authentication system handle user login?"
})
</tool-use-template>

### Agents with MCP Access

**Option 1: Unrestricted (Recommended):**

```yaml
---
name: browser-automator
description: Automates browser interactions for testing and scraping
---
```

**Option 2: Explicit Tools:**

```yaml
---
name: browser-automator
description: Automates browser interactions for testing and scraping
tools: Read, Write, mcp__browser__prompt
---
```

## Process for Configuring MCP Servers

When user requests MCP server configuration:

1. **Understand Requirements:**
   - What external capability is needed?
   - Which MCP server provides it?
   - Are there prerequisites (Chrome, database, etc.)?

2. **Check Existing Configuration:**
   ```bash
   cat /workspace/.claude/settings.json | jq '.mcpServers'
   ```

3. **Determine Server Details:**
   - Command: `node`, `python`, `npx`, etc.
   - Arguments: Server path, options, connection details
   - Environment variables: API keys, connection strings, limits

4. **Update Configuration:**
   - Use Edit tool to add/update `mcpServers` section
   - Validate JSON syntax with `jq`
   - Preserve existing settings and hooks

5. **Verify Setup:**
   - Check file paths exist
   - Test command execution manually if possible
   - Document any external dependencies

6. **Document for User:**
   - Explain what was configured
   - List any prerequisites to set up
   - Provide test commands to verify it works
   - Note that Claude Code restart is required

## Additional Resources

**Note**: This skill is based on information extracted from local documentation. For comprehensive MCP server documentation, refer to:

- Official Claude Code MCP documentation: https://docs.claude.com/en/docs/claude-code/
- Model Context Protocol specification: https://modelcontextprotocol.io/
- Available MCP servers: https://github.com/modelcontextprotocol/servers

**Key Topics Not Fully Covered Here** (refer to official docs):
- MCP protocol details (JSON-RPC over stdio)
- Creating custom MCP servers
- MCP server authentication mechanisms
- Advanced MCP server features (resources, prompts)
- MCP server security best practices
- MCP protocol versioning and compatibility

## Summary

MCP servers extend Claude Code's capabilities by connecting to external services and tools. Key points:

- **Configuration**: Add to `.claude/settings.json` under `mcpServers`
- **Tool Access**: Omit `tools`/`allowed-tools` for automatic MCP access
- **Tool Names**: Prefixed with `mcp__<server>__<tool>`
- **Restart Required**: MCP servers load at Claude Code startup
- **Plugin Bundling**: Include config templates in `mcp-servers/` directory
- **Troubleshooting**: Check paths, commands, prerequisites, and logs

When in doubt, omit tool restrictions to grant full MCP access, and always validate configuration syntax with `jq`.

## Official Documentation

For the latest information and updates, refer to the official Claude Code documentation:

- **MCP Documentation**: https://docs.claude.com/en/docs/claude-code/mcp
- **Model Context Protocol Specification**: https://modelcontextprotocol.io/
- **Plugins Documentation**: https://docs.claude.com/en/docs/claude-code/plugins

## See Also

**Related Skills** (in this plugin):
- **Plugin Management**: Plugin-bundled MCP server configurations
- **Sub-Agent Management**: Sub-agents can use MCP tools if unrestricted
- **Skill Management**: Skills can use MCP tools if unrestricted
- **Plugin Marketplace Management**: Distributing MCP configurations via plugins

**Key Concepts**:
- **Desktop Extensions**: One-click installation for Claude Desktop (2025+)
- **Manual Configuration**: JSON-based setup for Claude Code CLI and custom servers
- **Tool Access**: MCP tools prefixed with `mcp__<server>__<tool>`
- **Tool Restrictions**: Omitting `tools`/`allowed-tools` grants MCP access

**Configuration Locations**:
- **Claude Code CLI**: `/workspace/.claude/settings.json` (project), `~/.config/claude/` (user)
- **Claude Desktop**: Platform-specific paths (see Configuration Location section)

**Related Topics**:
- Plugin-bundled MCP server configurations
- MCP output token limits (10K warning, 25K default max)
- Tool restriction security implications
- VSCode MCP Bridge integration

---

*Last Updated: October 2025*
