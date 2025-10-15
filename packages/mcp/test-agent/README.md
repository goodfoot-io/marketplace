# @goodfoot/test-agent-mcp-server

MCP server for launching custom agents with configurable system instructions.

## Features

- **Custom System Instructions**: Load system instructions from markdown files with YAML front matter
- **YAML Configuration**: Configure model, tool restrictions, and metadata via front matter
- **Execution Logging**: Automatic logging of agent execution to `reports/.test-agent-logs/`
- **Tool Restrictions**: Control which tools agents can access via configuration
- **Model Selection**: Override model selection per task
- **Recursion Prevention**: Automatically prevents recursive Task tool calls

## Installation

```bash
yarn add @goodfoot/test-agent-mcp-server
```

## Usage

The server provides a `task` tool for launching custom agents with specific system instructions.

## Development

```bash
# Build
yarn build

# Test
yarn test

# Lint
yarn lint
```
