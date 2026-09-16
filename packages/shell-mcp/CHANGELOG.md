# @goodfoot/shell-mcp npm package changelog

## 1.0.1
- Added a Bash-like console: command output now renders with working-directory prompts, unlabeled stdout/stderr, partial output shown as it arrives, and explicit failure markers (`[exit 1]`, signal, `[timed out]`) instead of log records
- Added optional diagnostic logging via `SHELL_MCP_LOG`, writing append-only JSONL records to an owner-only file; command, stdin, and output bodies are never duplicated there
- Improved console cleanliness by keeping the tunnel's startup authentication probe — which previously printed a spurious rejection notice on every tunnel start — out of the console
- Fixed the version advertised in the MCP handshake to derive from the package manifest, so the server no longer reports a stale version

## 1.0.0
- Added the initial release of the remote-managed Bash MCP server, exposing shell execution over Streamable HTTP through an OpenAI Secure MCP Tunnel
- Added `npx` support so the server can be started without a global install
- Renamed the package to `@goodfoot/shell-mcp` (previously `remote-managed-shell`) and the `start:tunnel` script to `start:openai`
