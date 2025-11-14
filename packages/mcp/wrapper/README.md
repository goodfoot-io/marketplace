# MCP Wrapper Server

A Model Context Protocol (MCP) server that aggregates multiple MCP servers into a unified interface, exposing their capabilities through a powerful `agent` tool powered by Claude's Agent SDK.

## Features

- **Multi-Server Aggregation** - Combine tools from multiple MCP servers into a single connection
- **Background Agent Execution** - Launch long-running tasks asynchronously and retrieve results later
- **Transcript Persistence** - Automatic conversation history saved in JSONL format
- **Session Resume** - Continue agent execution from previous checkpoints using agent IDs
- **Flexible Transport** - Support for both stdio (local processes) and HTTP (remote endpoints)
- **AI-Powered Discovery** - Intelligent tool descriptions generated using Claude Haiku
- **Progress Notifications** - Real-time updates during agent execution

## Quick Start

### Prerequisites

- Node.js 22.0 or higher
- At least one MCP server to wrap

### Installation

#### Using NPX (Recommended)

```bash
npx -y @goodfoot/mcp-wrapper-server -- \
  server-name -- command arg1 arg2
```

#### From Source

```bash
git clone <repository-url>
cd packages/mcp/wrapper
yarn install
yarn build
node dist/wrapper.js -- server-name -- command arg1 arg2
```

### Basic Configuration

Configure the wrapper in your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "wrapper": {
      "command": "npx",
      "args": [
        "-y",
        "@goodfoot/mcp-wrapper-server",
        "--",
        "filesystem",
        "--",
        "npx",
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Documents",
        "--",
        "github",
        "--transport",
        "http",
        "https://api.github.com/mcp"
      ]
    }
  }
}
```

## Configuration

### Command-Line Syntax

```bash
mcp-wrapper-server -- <server1-config> -- <server2-config> -- ...
```

Each server configuration follows this pattern:

```bash
<server-name> [--transport stdio|http] <transport-args>
```

### Stdio Transport (Default)

For local MCP servers running as subprocesses:

```bash
-- filesystem -- npx -y @modelcontextprotocol/server-filesystem /path/to/dir
```

**Parameters:**

- `server-name` - Unique identifier for this server
- `command` - Executable command (e.g., `npx`, `python`, `node`)
- `args...` - Command arguments

### HTTP Transport

For remote MCP servers with HTTP endpoints:

```bash
-- github --transport http https://api.github.com/mcp -H "Authorization: Bearer token"
```

**Parameters:**

- `server-name` - Unique identifier for this server
- `--transport http` - Specify HTTP transport
- `url` - HTTP/HTTPS endpoint URL
- `-H` or `--header` - HTTP headers (can be specified multiple times)

**Example with multiple headers:**

```bash
-- api --transport http https://example.com/mcp \
  -H "Authorization: Bearer token123" \
  -H "X-API-Version: 2024-01"
```

### Environment Variables

#### Wrapper Configuration

The wrapper server supports these environment variables:

**`MCP_WRAPPER_SERVER_LOGGING`**: Enable detailed logging to stderr (default: `false`)

```bash
MCP_WRAPPER_SERVER_LOGGING=true npx -y @goodfoot/mcp-wrapper-server -- ...
```

**`MCP_WRAPPER_IGNORE_CACHE`**: Bypass cached tool descriptions and force fresh discovery (default: `false`)

```bash
MCP_WRAPPER_IGNORE_CACHE=true npx -y @goodfoot/mcp-wrapper-server -- ...
```

Use this when debugging cache issues or after updating backend servers to force re-discovery of tools.

#### Backend Server Variables

Backend server environment variables can be configured through your MCP client:

```json
{
  "mcpServers": {
    "wrapper": {
      "command": "npx",
      "args": ["-y", "@goodfoot/mcp-wrapper-server", "..."],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxx",
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

### Multi-Server Examples

#### Example 1: Filesystem + GitHub + PostgreSQL

```json
{
  "mcpServers": {
    "wrapper": {
      "command": "npx",
      "args": [
        "-y",
        "@goodfoot/mcp-wrapper-server",
        "--",
        "files",
        "--",
        "npx",
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/workspace",
        "--",
        "github",
        "--",
        "npx",
        "-y",
        "@modelcontextprotocol/server-github",
        "--",
        "db",
        "--",
        "npx",
        "-y",
        "postgresql-mcp-server",
        "postgresql://localhost/mydb"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

#### Example 2: Mixed Transports (stdio + HTTP)

```json
{
  "mcpServers": {
    "wrapper": {
      "command": "node",
      "args": [
        "/path/to/wrapper/dist/wrapper.js",
        "--",
        "local-fs",
        "--",
        "npx",
        "-y",
        "@modelcontextprotocol/server-filesystem",
        ".",
        "--",
        "remote-api",
        "--transport",
        "http",
        "https://mcp.example.com/api",
        "-H",
        "Authorization: Bearer ${API_TOKEN}"
      ]
    }
  }
}
```

## Template Configuration Format

The MCP wrapper supports a structured JSON template format for defining server configurations. This format is designed for tools and utilities that generate or manage wrapper configurations programmatically. The templates defined here are documentation-only examples and are not executable files.

### Template Structure

A template combines server configuration with metadata and optional system prompt settings:

```json
{
  "metadata": {
    "name": "template-name",
    "description": "Human-readable description",
    "version": "1.0.0",
    "author": "Optional author name"
  },
  "name": "server-name",
  "transport": "stdio" | "http",
  "command": "command-for-stdio",
  "args": ["arg1", "arg2"],
  "url": "https://example.com/mcp",
  "headers": {
    "Header-Name": "value"
  },
  "env": {
    "VAR_NAME": "value"
  },
  "systemPrompt": {
    "type": "text" | "file" | "append",
    "content": "...",
    "path": "/absolute/path/to/file"
  }
}
```

### Template Fields

#### Metadata (Required)

| Field         | Type   | Required | Description                         |
| ------------- | ------ | -------- | ----------------------------------- |
| `name`        | string | Yes      | Template identifier                 |
| `description` | string | Yes      | Human-readable template description |
| `version`     | string | Yes      | Semantic version (e.g., "1.0.0")    |
| `author`      | string | No       | Author or organization name         |

#### Server Configuration (Required)

| Field       | Type                   | Required | Description                             |
| ----------- | ---------------------- | -------- | --------------------------------------- |
| `name`      | string                 | Yes      | Unique server identifier                |
| `transport` | "stdio" \| "http"      | Yes      | Communication transport type            |
| `command`   | string                 | Stdio    | Executable command (required for stdio) |
| `args`      | string[]               | No       | Command arguments (stdio only)          |
| `url`       | string                 | HTTP     | Server endpoint URL (required for http) |
| `headers`   | Record<string, string> | No       | HTTP headers (http only)                |
| `env`       | Record<string, string> | No       | Environment variables to pass to server |

#### System Prompt (Optional)

The `systemPrompt` field configures how the wrapper handles system prompts. It uses a discriminated union based on the `type` field:

**Text Prompt:**

```json
{
  "type": "text",
  "content": "Custom system prompt text"
}
```

**File-Based Prompt:**

```json
{
  "type": "file",
  "path": "/absolute/path/to/prompt.txt"
}
```

Note: The `path` must be absolute. Relative paths are not supported.

**Append to Default Prompt:**

```json
{
  "type": "append",
  "content": "Additional instructions to append"
}
```

### Environment Variable Placeholders

Templates support environment variable placeholders using `${VARIABLE}` syntax. These placeholders are resolved by Claude Desktop's configuration system before reaching the wrapper.

**Placeholder Resolution:**

- `${VARIABLE}` - Replaced with environment variable value
- `$$` - Literal dollar sign (if escaping is needed)

**Important:** The wrapper receives already-expanded values via `getEnvironmentAsRecord()`. It does not perform placeholder substitution itself.

**Example with placeholders:**

```json
{
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}",
    "API_KEY": "${MY_API_KEY}"
  },
  "headers": {
    "Authorization": "Bearer ${API_TOKEN}"
  }
}
```

### Complete Template Examples

#### Example 1: GitHub stdio with Token Authentication

```json
{
  "metadata": {
    "name": "github-mcp",
    "description": "GitHub MCP server with personal access token",
    "version": "1.0.0",
    "author": "Example Org"
  },
  "name": "github",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
  },
  "systemPrompt": {
    "type": "append",
    "content": "When working with GitHub, always check rate limits first."
  }
}
```

#### Example 2: HTTP API with Custom Headers

```json
{
  "metadata": {
    "name": "huggingface-api",
    "description": "Hugging Face MCP server via HTTP",
    "version": "2.1.0",
    "author": "ML Team"
  },
  "name": "hugging-face",
  "transport": "http",
  "url": "https://huggingface.co/mcp",
  "headers": {
    "Authorization": "Bearer ${HF_TOKEN}",
    "X-API-Version": "2024-01"
  },
  "systemPrompt": {
    "type": "file",
    "path": "/home/user/.config/mcp/prompts/ml-assistant.txt"
  }
}
```

#### Example 3: Multi-Environment Database Configuration

```json
{
  "metadata": {
    "name": "postgres-dev",
    "description": "PostgreSQL development environment",
    "version": "1.0.0"
  },
  "name": "database",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "postgresql-mcp-server", "${DB_CONNECTION_STRING}"],
  "env": {
    "DATABASE_URL": "${DB_CONNECTION_STRING}",
    "DB_POOL_SIZE": "${DB_POOL_SIZE}",
    "DB_TIMEOUT": "30000"
  }
}
```

#### Example 4: Minimal Required Fields

```json
{
  "metadata": {
    "name": "filesystem",
    "description": "Basic filesystem access",
    "version": "1.0.0"
  },
  "name": "files",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
}
```

### Template Conversion Utilities

The wrapper provides TypeScript utilities for working with templates (defined in `src/types/wrapper.ts`):

**Template Validation:**

```typescript
import { validateWrapperTemplate } from './types/wrapper.js';

const template = validateWrapperTemplate(jsonData);
// Throws if validation fails
```

**Convert Template to ServerConfig:**

```typescript
import { templateToServerConfig } from './types/wrapper.js';

const serverConfig = templateToServerConfig(template);
// Returns: ServerConfig compatible with existing wrapper
```

**Resolve System Prompt:**

```typescript
import { resolveSystemPrompt } from './types/wrapper.js';

if (template.systemPrompt) {
  const options = resolveSystemPrompt(template.systemPrompt);
  // Returns: WrapperOptions with appropriate system prompt fields
}
```

Note: These utilities are designed for future CLI integration. The `templateToServerConfig()` function does NOT perform `${VARIABLE}` substitution (that's handled by Claude Desktop). The `resolveSystemPrompt()` function for 'file' type does NOT load file content (that's handled by `loadSystemPromptFromFile()` in `wrapper.ts`).

### File Path Requirements

When using the `systemPrompt.type: "file"` configuration:

- **Must use absolute paths** - Relative paths will cause validation errors
- **Path validation** - Checked at runtime per `wrapper.ts:32` (`loadSystemPromptFromFile()`)
- **Error handling** - Missing files throw descriptive ENOENT errors

**Valid paths:**

- Linux/macOS: `/home/user/.config/mcp/prompts/assistant.txt`
- Windows: `C:\Users\username\config\prompts\assistant.txt`

**Invalid paths:**

- `./prompts/assistant.txt` (relative)
- `../config/assistant.txt` (relative)
- `prompts/assistant.txt` (relative)

### Notes on Template Usage

1. **Documentation-Only**: The examples shown above are for documentation purposes and are not executable configuration files.

2. **No Placeholder Processing**: The wrapper does NOT process `${VARIABLE}` placeholders. All environment variable substitution happens upstream in Claude Desktop's configuration system.

3. **Future CLI Integration**: These template types and conversion utilities are designed to support future command-line tools for generating and managing wrapper configurations programmatically.

4. **Type Safety**: All template types are validated using Zod schemas at runtime, ensuring configuration correctness before processing.

## API Reference

The wrapper exposes two tools to Claude:

### `agent` Tool

Execute tasks using aggregated tools from all backend MCP servers.

**Parameters:**

| Parameter           | Type    | Required | Description                                                                                    |
| ------------------- | ------- | -------- | ---------------------------------------------------------------------------------------------- |
| `prompt`            | string  | Yes      | Natural language task description for the agent                                                |
| `model`             | string  | No       | Claude model to use: `sonnet`, `opus`, or `haiku` (default: `sonnet`)                          |
| `resume`            | string  | No       | Agent ID from a previous execution to continue from                                            |
| `run_in_background` | boolean | No       | Set to true to run this agent in the background. Use AgentOutputTool to read the output later. |

**Response Formats:**

**Synchronous Execution** (`run_in_background: false` or omitted):

```typescript
{
  status: "completed",
  prompt: string,
  agentId: string,
  content: Array<{type: "text", text: string}>,
  totalToolUseCount: number,
  totalDurationMs: number,
  totalTokens: number,
  usage: {
    inputTokens: number,
    outputTokens: number
  }
}
```

**Background Execution** (`run_in_background: true`):

```typescript
{
  status: "async_launched",
  agentId: string,
  description: string,
  prompt: string
}
```

**Examples:**

**Basic Agent Execution:**

```xml
<invoke name="agent">
<parameter name="prompt">List all TypeScript files in the repository and count them</parameter>
</invoke>
```

**Background Agent with Result Retrieval:**

```xml
<!-- Launch in background -->
<invoke name="agent">
<parameter name="prompt">Analyze all test files for patterns and create a summary report</parameter>
<parameter name="run_in_background">true</parameter>
</invoke>

<!-- Response: {status: "async_launched", agentId: "a3f7b21c", ...} -->

<!-- Retrieve results later -->
<invoke name="output">
<parameter name="agentIds">["a3f7b21c"]</parameter>
</invoke>
```

**Resume Previous Execution:**

```xml
<invoke name="agent">
<parameter name="prompt">Continue with the next phase</parameter>
<parameter name="resume">a3f7b21c</parameter>
</invoke>
```

### `output` Tool

Retrieve results from background agent executions.

**Parameters:**

| Parameter    | Type     | Required | Description                                                            |
| ------------ | -------- | -------- | ---------------------------------------------------------------------- |
| `agentIds`   | string[] | Yes      | Array of agent IDs to retrieve results for                             |
| `block`      | boolean  | No       | Whether to block until results are ready (default: `true`)             |
| `wait_up_to` | number   | No       | Maximum time to wait in seconds (default: `150`, min: `0`, max: `300`) |

**Response Format:**

Returns a text response with results for each requested agent:

```text
Agent a3f7b21c: completed
[Agent output content here]

Agent b8d4e92f: running
Agent is still executing...

Agent c1a9f53e: not_found
No agent found with this ID
```

**Examples:**

**Retrieve Single Agent Result (Blocking):**

```xml
<invoke name="output">
<parameter name="agentIds">["a3f7b21c"]</parameter>
</invoke>
```

**Retrieve Multiple Agents (Non-Blocking):**

```xml
<invoke name="output">
<parameter name="agentIds">["a3f7b21c", "b8d4e92f", "c1a9f53e"]</parameter>
<parameter name="block">false</parameter>
</invoke>
```

**Poll with Custom Timeout:**

```xml
<invoke name="output">
<parameter name="agentIds">["a3f7b21c"]</parameter>
<parameter name="block">true</parameter>
<parameter name="wait_up_to">60</parameter>
</invoke>
```

## How It Works

The MCP wrapper server aggregates multiple MCP servers into a single unified interface by exposing an `agent` tool powered by Claude's Agent SDK. This architecture enables Claude to interact with tools from multiple backend servers through a single connection point.

### Architecture Overview

The wrapper operates as an intermediary layer between Claude and backend MCP servers:

```text
Claude Client
      ║
      ▼
MCP Wrapper Server
├─ Tool Discovery Layer (discovery.ts)
│  └─ Discovers and caches tools from backend servers
├─ Agent Execution Layer (wrapper.ts)
│  ├─ Synchronous execution (blocking)
│  └─ Asynchronous execution (background agents)
├─ Session Management (background-agents.ts, agent-id.ts)
│  └─ In-memory registry for background agent promises
└─ Persistence Layer (transcript-store.ts)
   └─ JSONL transcript files for execution history
      ║
      ▼
Backend MCP Servers
├─ stdio transport (local processes)
└─ http transport (remote endpoints)
```

The wrapper exposes exactly two tools to Claude: `agent` (for executing tasks using backend tools) and `output` (for retrieving results from background agents). All backend tool complexity is abstracted behind this simple interface.

### Request Flow

When Claude invokes the `agent` tool, the request flows through these stages:

**1. Tool Discovery and Caching** (`discovery.ts:217-270`)

The wrapper generates an MD5 hash from server configurations and checks the cache at `~/.mcp-wrapper-server/descriptions/{hash}.json`. On cache miss, it connects to each backend server using the appropriate transport (stdio or HTTP), calls `listTools()`, and aggregates the results. An AI-powered description is generated using Claude Haiku to summarise the combined capabilities. This aggregated tool list is cached to avoid repeated discovery on subsequent runs.

**2. Request Validation** (`wrapper.ts:475-487`)

The `agent` tool validates incoming arguments using Zod schemas, ensuring the `prompt` parameter is present and all optional parameters (`model`, `resume`, `run_in_background`) conform to expected types. Invalid arguments trigger an `InvalidParams` MCP error immediately.

**3. Agent ID Generation** (`agent-id.ts:14-16`)

Each agent execution receives a unique 8-character hexadecimal identifier generated from 4 random bytes. This ID serves as the primary key for transcript persistence and background agent tracking throughout the execution lifecycle.

**4. Transcript Resume** (`wrapper.ts:496-503`)

When a `resume` parameter contains an agent ID from a previous execution, the wrapper loads the historical transcript from `agent-{agentId}.jsonl`. The transcript contains JSONL-formatted messages with `type`, `content`, `timestamp`, and `session_id` fields. These messages are passed to the Claude SDK to continue the conversation from where it previously stopped.

**5. Query Execution** (`wrapper.ts:556-690`)

The wrapper constructs an MCP server configuration object mapping each backend server to its connection details. It then invokes the Claude SDK's `query()` function, which handles the multi-turn conversation loop. As the agent executes, the wrapper:

- Captures all messages (user, assistant, result) from the query stream
- Writes each message to the transcript file for persistence
- Monitors tool use content blocks to send progress notifications
- Tracks execution metrics including tool call count, duration, and token usage
- Formats tool execution progress messages showing parameter values

**6. Response Handling**

For synchronous execution, the wrapper returns a `CompletedResponse` containing the agent's final output, execution metrics, and the agent ID for potential resume. For background execution, it returns an `AsyncLaunchedResponse` immediately with the agent ID, allowing the client to continue working whilst the agent runs.

### Tool Discovery

Tool discovery happens at server initialisation and uses a caching strategy to minimise overhead:

**Discovery Process** (`discovery.ts:22-118`)

For each configured backend server, the wrapper creates a temporary MCP client with a 10-second timeout. It establishes the appropriate transport (stdio launches a subprocess; HTTP creates a streaming connection), connects to the server, and calls `listTools()` to retrieve the tool schema. Tools are prefixed with their server name to create unique identifiers across all backends.

**Cache Management** (`cache.ts:22-117`)

The configuration hash is computed from the JSON serialisation of all server configs, ensuring any change in server names, URLs, commands, or arguments invalidates the cache. Cache files are stored in `~/.mcp-wrapper-server/descriptions/` with versioning to support future format migrations. The cache contains the discovered tools, allowed tool names, and the AI-generated description.

**AI-Powered Descriptions** (`discovery.ts:123-212`)

Rather than using template-based descriptions, the wrapper invokes Claude Haiku with a prompt containing all discovered tool names and descriptions. Haiku generates a concise, actionable description explaining when to use these capabilities, similar to built-in Claude Code tool descriptions. This creates context-appropriate descriptions that help Claude understand the combined functionality. If AI generation fails, the system falls back to template-based descriptions showing server names and tool counts.

### Agent Execution

The wrapper supports two execution modes with distinct characteristics:

**Synchronous Execution** (`wrapper.ts:716-728`)

When `run_in_background` is false or omitted, the agent executes inline. The wrapper awaits the complete execution promise and returns the full `CompletedResponse` only after the agent finishes all turns and produces a result. This blocks the MCP request until completion, suitable for quick tasks where immediate results are needed.

**Background Execution** (`wrapper.ts:693-715`)

When `run_in_background` is true, the wrapper registers the execution promise in the in-memory agent registry and returns an `AsyncLaunchedResponse` immediately. The agent continues executing in the background whilst Claude proceeds with other work. The client can later use the `output` tool with the returned agent ID to check status and retrieve results.

**Progress Notifications** (`wrapper.ts:623-665`)

During execution, the wrapper monitors assistant messages for tool use content blocks. For each tool invocation, it increments the tool call counter and sends an MCP progress notification containing the tool name and key parameter values. Common parameters like `prompt`, `url`, `path`, and `query` are formatted for readability, truncating long values to 80 characters for clean display in the client interface.

**Error Handling** (`wrapper.ts:686-689`)

Execution failures are caught and wrapped in an `InternalError` MCP error that includes the original error message and the number of tool calls successfully executed before failure. This provides debugging context whilst maintaining clean error propagation through the MCP protocol.

### Transcript Persistence

The wrapper maintains execution history through JSONL transcript files:

**Write Operations** (`transcript-store.ts:29-52`)

Each message from the Claude SDK query stream is written to `agent-{agentId}.jsonl` in the current working directory. The wrapper serialises the message type, content, timestamp, and session ID as a single JSON object followed by a newline. File append operations are atomic through Node.js `fs/promises.appendFile`, ensuring concurrent writes from multiple agents don't corrupt the file. Write failures are logged but don't interrupt execution.

**Read Operations** (`transcript-store.ts:64-104`)

Loading a transcript reads the entire JSONL file, parses each line individually, and collects valid messages into an array. Malformed lines are logged as warnings and skipped to maintain resilience. If the transcript file doesn't exist (ENOENT error), the function returns an empty array rather than throwing, allowing graceful handling of new or missing agent IDs.

**Transcript Structure** (`transcript-store.ts:12-17`)

Each message contains a `type` field ('user', 'assistant', or 'result'), the full message `content` as stringified JSON, an ISO-8601 `timestamp`, and the `session_id` from the Claude SDK. This structure preserves complete conversation history including all tool uses, results, and agent reasoning.

### Session Management

Agent sessions are tracked through two complementary systems:

**Agent ID Generation** (`agent-id.ts:14-16`)

The `generateAgentId()` function creates cryptographically random 8-character hexadecimal identifiers using `crypto.randomBytes(4)`. This short format balances uniqueness (4.3 billion possible values) with usability in command-line interfaces and API calls.

**Background Agent Registry** (`background-agents.ts:27-153`)

The in-memory registry maps agent IDs to execution promises using a JavaScript `Map`. When an agent launches in background mode, its promise is stored via `registerAgent()`. The `getAgentStatus()` function uses `Promise.race()` with a sentinel rejection to check if the promise has settled without blocking. Status can be 'running' (pending promise), 'completed' (resolved promise), 'failed' (rejected promise), or 'not_found' (no registry entry).

**Result Retrieval** (`background-agents.ts:80-107`)

The `getAgentResult()` function first checks the in-memory registry for recently launched agents. For completed agents, it returns the promise's resolved value. If the agent ID isn't in memory, the function falls back to loading the transcript from disk, enabling retrieval of historical agent executions even after server restarts. The transcript is parsed into a `CompletedResponse` format with the session ID and combined message content.

**Resume Functionality** (`wrapper.ts:496-503`)

When resuming from a previous agent ID, the wrapper loads the transcript and passes it to the Claude SDK through the `resume` parameter in query options. The SDK uses this transcript to reconstruct the conversation state, allowing the agent to continue from where it previously stopped. This enables long-running workflows that can be interrupted and resumed across multiple tool invocations.

### Configuration and Startup

The wrapper server initialises through a command-line interface:

**Argument Parsing** (`wrapper.ts:34-206`)

The CLI accepts multiple server definitions separated by `--` markers. Each server requires a name, optional transport type (defaulting to stdio), and transport-specific arguments. Stdio servers specify a command and arguments, whilst HTTP servers specify a URL and optional headers via `-H` flags. The parser validates each configuration, checking for required fields and proper formatting.

**Server Initialisation** (`wrapper.ts:297-733`)

During initialisation, the wrapper discovers tools from all configured backends, creates the MCP server instance with tool handlers, and establishes stdio transport. The server registers handlers for `ListToolsRequestSchema` (returning the `agent` and `output` tool definitions) and `CallToolRequestSchema` (routing to agent execution logic). Graceful shutdown handlers ensure clean server closure on SIGTERM and SIGINT signals.

## Troubleshooting

### Common Issues

#### Tool Discovery Failures

**Symptom:** Wrapper starts but reports no tools available

**Solution:**

1. Verify backend server configurations are correct
2. Test each backend server independently before wrapping
3. Check the discovery cache at `~/.mcp-wrapper-server/descriptions/`
4. Review wrapper logs for connection errors
5. Ensure backend servers support MCP protocol correctly

**Example debugging:**

```bash
# Clear cache and retry
rm -rf ~/.mcp-wrapper-server/descriptions/
npx -y @goodfoot/mcp-wrapper-server -- server-name -- command args
```

#### Force Cache Refresh

**When to use:** After updating backend servers, when debugging stale tool descriptions, or when cache appears corrupted

**Solution:**

Use the `MCP_WRAPPER_IGNORE_CACHE` environment variable to bypass the cache and force fresh discovery:

```bash
MCP_WRAPPER_IGNORE_CACHE=true npx -y @goodfoot/mcp-wrapper-server -- \
  server-name -- command args
```

This performs fresh tool discovery from all backend servers whilst still writing results to cache for future use. The cache will be updated with the newly discovered tools.

**Note:** This is faster and safer than manually deleting cache files, as it ensures atomic cache updates.

#### Background Agents Not Completing

**Symptom:** `output` reports agents stuck in 'running' state

**Solution:**

1. Check if backend servers have timed out or crashed
2. Review transcript files in current directory for error messages
3. Verify the agent isn't waiting for unavailable tools
4. Increase `wait_up_to` timeout for long-running operations

**Note:** Background agents are ephemeral across server restarts. After wrapper restart, use transcript files to examine execution history but cannot retrieve running agents.

#### Resume Failures

**Symptom:** Agent fails to resume from previous agent ID

**Cause:** Missing or corrupted transcript file

**Solution:**

1. Verify `agent-{agentId}.jsonl` exists in current working directory
2. Check file permissions (must be readable)
3. Validate JSONL format (each line must be valid JSON)
4. Review transcript for malformed entries

#### HTTP Transport Connection Errors

**Symptom:** "Connection refused" or timeout errors for HTTP servers

**Solution:**

1. Verify the URL is accessible: `curl https://example.com/mcp`
2. Check authentication headers are correct
3. Ensure server supports streaming HTTP (not just request/response)
4. Review firewall and network policies
5. Test with `--transport stdio` locally first

### Debugging

#### Enable Logging

Set the `MCP_WRAPPER_SERVER_LOGGING` environment variable:

```bash
MCP_WRAPPER_SERVER_LOGGING=true npx -y @goodfoot/mcp-wrapper-server -- ...
```

This outputs detailed logs to stderr including:

- Tool discovery progress
- Backend server connection status
- Agent execution lifecycle events
- Transcript write operations
- Error stack traces

#### Inspect MCP Communication

Use the MCP Inspector to test the wrapper interactively:

```bash
npx @modelcontextprotocol/inspector npx -y @goodfoot/mcp-wrapper-server -- \
  server-name -- command args
```

This opens a web interface at `http://localhost:5173` where you can:

- View discovered tools and their schemas
- Manually invoke the `agent` tool with test prompts
- Monitor request/response cycles
- Debug tool execution issues

#### Review Transcripts

Examine transcript files for execution history:

```bash
# List all agent transcripts
ls -la agent-*.jsonl

# View specific agent transcript
cat agent-a3f7b21c.jsonl | jq .

# Search transcripts for errors
grep -r '"type":"result"' agent-*.jsonl | grep -i error
```

Each transcript line is a JSON object with `type`, `content`, `timestamp`, and `session_id` fields.

### Performance Optimisation

#### Reduce Discovery Overhead

Tool discovery caches results based on configuration hash. To maximise cache hits:

1. Use consistent server names and arguments across sessions
2. Avoid dynamic environment variables in command arguments
3. Pin backend server versions (e.g., `@modelcontextprotocol/server-filesystem@1.0.0`)

#### Minimise Backend Server Count

Each backend server adds latency to discovery and increases tool namespace complexity:

- Combine related functionality into single servers when possible
- Use backend servers with efficient tool enumeration
- Remove unused servers from configuration

#### Background Execution for Long Tasks

Use `run_in_background: true` for tasks that:

- Take longer than 30 seconds to complete
- Perform multiple sequential operations
- Process large datasets or files
- Execute complex workflows

This keeps the MCP connection responsive whilst work proceeds asynchronously.

## Security Considerations

### Credential Management

**Never commit credentials to version control.** Use environment variables or secure secret management:

```json
{
  "mcpServers": {
    "wrapper": {
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

Configure secrets in your system environment or use tools like:

- **macOS/Linux**: `~/.bashrc`, `~/.zshrc`, or system keychain
- **Windows**: System environment variables or credential manager

### Backend Server Isolation

Each backend server runs in its own process with isolated credentials. The wrapper does not have access to backend server authentication tokens—it only forwards requests through the MCP protocol.

### Transcript Data

Transcript files (`agent-{agentId}.jsonl`) contain complete conversation history including:

- User prompts and agent responses
- Tool invocations with parameters
- Tool results and data

**Important:** Review transcripts for sensitive data before sharing or committing to version control.

### Network Security

For HTTP transport:

- Always use HTTPS for remote servers
- Validate SSL certificates (enabled by default)
- Use API tokens with minimum required scopes
- Rotate credentials regularly
- Monitor backend server access logs

## Development

### Building from Source

```bash
# Clone repository
git clone <repository-url>
cd packages/mcp/wrapper

# Install dependencies
yarn install

# Build TypeScript
yarn build

# Run tests
yarn test

# Type checking
yarn typecheck

# Linting
yarn lint
```

### Running Tests

```bash
# All tests
yarn test

# Specific test file
yarn test tests/agent-handler.test.ts

# Watch mode
yarn test --watch

# Coverage
yarn test --coverage
```

### Project Structure

```
packages/mcp/wrapper/
├── src/
│   ├── wrapper.ts              # Main server logic and CLI
│   ├── agent-id.ts             # Agent ID generation utilities
│   ├── background-agents.ts    # In-memory agent registry
│   ├── cache.ts                # Discovery cache management
│   ├── discovery.ts            # Backend tool discovery
│   ├── logger.ts               # Logging utilities
│   ├── transcript-store.ts     # JSONL persistence
│   └── types/
│       └── wrapper.ts          # Type definitions and schemas
├── tests/
│   ├── agent-handler.test.ts   # Agent tool tests
│   ├── agent-id.test.ts        # ID generation tests
│   ├── output-handler.test.ts  # Agent output tests
│   ├── output.test.ts    # Parameter validation tests
│   ├── background-agents.test.ts     # Registry tests
│   ├── cache.test.ts           # Cache management tests
│   ├── discovery.test.ts       # Discovery logic tests
│   ├── transcript-store.test.ts      # Persistence tests
│   ├── types.test.ts           # Type validation tests
│   └── wrapper.test.ts         # CLI parsing tests
└── package.json
```

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass: `yarn test`
2. No TypeScript errors: `yarn typecheck`
3. No linting errors: `yarn lint`
4. Code follows existing patterns
5. New features include comprehensive tests

## Licence

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions:

- GitHub Issues: [Repository Issues](https://github.com/your-org/mcp-wrapper/issues)
- Documentation: [MCP Protocol Specification](https://modelcontextprotocol.io)
- Claude Code: [Official Documentation](https://docs.claude.com/claude-code)
