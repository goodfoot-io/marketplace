The type definitions in this package must precisely match what Claude Code actually sends to hooks. There are three sources of truth, in order of authority:

1. **`@anthropic-ai/claude-code` CLI** (`node_modules/@anthropic-ai/claude-code/cli.js`) - The actual runtime implementation
2. **`@anthropic-ai/claude-agent-sdk` types** (`node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.d.ts`) - TypeScript declarations
3. **Claude Code documentation** (https://code.claude.com/docs/en/hooks) - User-facing docs
