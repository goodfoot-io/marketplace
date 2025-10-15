# Test Agent MCP Server

The test-agent MCP server allows you to run custom agents with specific system instructions from files.

## Overview

This server provides a single tool `task` that executes a Claude Code SDK agent with custom system instructions loaded from a file. This is similar to the internal `Task` tool but allows full customization of the agent's behavior through external instruction files.

## Features

- **Custom System Instructions**: Load agent behavior from markdown files
- **Execution Logging**: All agent executions are logged to `reports/.test-agent-logs/` with tool responses
- **Abort Support**: Graceful handling of cancellation requests
- **Full Claude Code SDK Integration**: Supports all Claude Code capabilities
- **Task Tool Restriction**: Like subagents, test agents cannot use the Task tool to prevent recursive agent spawning

## Usage

### 1. Create a System Instructions File

Create a markdown file with your agent's system instructions:

```markdown
# Research Assistant

You are a specialized research agent focused on gathering and analyzing information.

## Primary Objective

Conduct thorough research on topics provided by the user.

## Capabilities

- Search for information using available tools
- Analyze and synthesize findings
- Provide comprehensive summaries
- Identify key insights and patterns

## Research Process

1. Understand the research question
2. Break down into sub-questions if needed
3. Gather information from multiple sources
4. Cross-reference and validate findings
5. Synthesize into a coherent response

## Output Format

- Start with an executive summary
- Present main findings with evidence
- Include relevant code examples or data
- End with conclusions and recommendations
```

### 2. Run the Test Agent Server

```bash
./dist/test-agent-server.js
```

### 3. Call the task Tool

Send a request to execute the agent:

```json
{
  "method": "tools/call",
  "params": {
    "name": "task",
    "arguments": {
      "system_instructions_file": "/path/to/research-assistant.md",
      "description": "Research task",
      "prompt": "Research the latest developments in WebAssembly and provide a summary of key use cases and performance benefits"
    }
  }
}
```

## Example Agent Templates

### Code Review Agent

```markdown
# Code Review Agent

You are a senior engineer conducting code reviews.

## Review Focus Areas

- Code quality and maintainability
- Performance considerations
- Security vulnerabilities
- Best practices adherence
- Test coverage

## Review Process

1. Understand the code's purpose
2. Check for logical errors
3. Evaluate code structure
4. Identify improvement opportunities
5. Provide actionable feedback

## Feedback Style

- Be constructive and specific
- Provide examples of improvements
- Acknowledge good practices
- Prioritize issues by severity
```

### Documentation Agent

```markdown
# Documentation Agent

You are a technical writer specializing in developer documentation.

## Documentation Goals

- Clear and concise explanations
- Comprehensive coverage
- Practical examples
- Consistent formatting

## Documentation Process

1. Analyze the code/feature
2. Identify key concepts
3. Structure information logically
4. Add code examples
5. Include troubleshooting tips

## Output Format

- Overview section
- Prerequisites
- Step-by-step instructions
- Code examples
- Common issues and solutions
```

### Testing Agent

```markdown
# Testing Agent

You are a QA engineer focused on comprehensive testing.

## Testing Strategy

- Unit test coverage
- Integration testing
- Edge case identification
- Performance testing
- Security testing

## Test Creation Process

1. Analyze functionality
2. Identify test scenarios
3. Write test cases
4. Include positive and negative tests
5. Document expected outcomes

## Test Output

- Test descriptions
- Setup requirements
- Test code
- Expected results
- Cleanup procedures
```

## Integration with Claude Code

When integrated with Claude Code, you can use the test-agent server as an MCP server:

```javascript
// In Claude Code configuration
{
  "mcpServers": {
    "test-agent": {
      "type": "stdio",
      "command": "/workspace/packages/mcp-servers/dist/test-agent-server.js"
    }
  }
}
```

Then in Claude Code, you can call:

```
mcp__test-agent__task({
  system_instructions_file: "/workspace/.claude/agents/my-agent.md",
  description: "Custom task",
  prompt: "Perform the specific task..."
})
```

## Logging

All agent executions are logged to `/workspace/reports/.test-agent-logs/` with timestamps and complete transcripts:

```
reports/.test-agent-logs/
├── 2025-01-15_10-30-45-123.md
├── 2025-01-15_11-45-22-456.md
└── ...
```

Each log contains:

- System instructions file path
- Task description
- Original prompt
- Complete execution transcript
- Tool calls and responses

## Best Practices

1. **Specific Instructions**: Make agent instructions clear and specific
2. **Tool Availability**: Ensure agents know what tools they can use
3. **Output Formats**: Define expected output structures
4. **Error Handling**: Include guidance for error scenarios
5. **Testing**: Test agents with various prompts before production use

## Differences from Built-in Task Tool

| Feature             | Built-in Task Tool         | Test-Agent Server           |
| ------------------- | -------------------------- | --------------------------- |
| System Instructions | Pre-defined subagent types | Custom files                |
| Customization       | Limited to available types | Fully customizable          |
| File-based Config   | No                         | Yes                         |
| Logging             | Internal                   | `reports/.test-agent-logs/` |
| Use Case            | Standard tasks             | Custom workflows            |

## Security Considerations

- System instruction files must use absolute paths
- Files are read with Node.js process permissions
- No sandboxing - agents run with full tool access (except Task tool)
- Consider instruction file permissions and access control
- Task tool is disabled to prevent recursive agent spawning

## Troubleshooting

### Agent Not Found Error

Ensure the system instructions file path is absolute and the file exists.

### Execution Timeouts

Agents have a maximum of 100 turns. For longer tasks, break them into smaller subtasks.

### Permission Errors

Ensure the process has read access to instruction files and write access to the logging directory.
