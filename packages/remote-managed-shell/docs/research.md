# Primary-source research

Reviewed 2026-09-16. Source observations are separated here from the decisions in `architecture-decisions.md`.

## OpenAI Codex

Revision `50d77959bf927293c4b5ddcca81d05331ae582ea` from `openai/codex` was the inspected `main` head. The current unified-exec handler keeps a process manager outside individual tool calls, returns a resumable process identity, and separates initial yield from later input/observation. The exec-server protocol exposes start, buffered read with a byte budget and wait, raw input, and termination as distinct operations. These are observations, not a claim that every Codex transport has identical disconnect behavior.

- https://github.com/openai/codex/blob/50d77959bf927293c4b5ddcca81d05331ae582ea/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs
- https://github.com/openai/codex/blob/50d77959bf927293c4b5ddcca81d05331ae582ea/codex-rs/exec-server/README.md

## localmcpcoder

Revision `6d8c0f939d93bfdf903ba31e50fc7460327e2433` was the inspected head. It demonstrates a loopback Streamable HTTP MCP server, finite tool responses, OAuth discovery, and a console consent secret. Its tunnel lifecycle, persistent `.env` passphrase, dynamic registration, direct bearer compatibility, broad tool suite, and execution engine are deliberately not adopted.

- https://github.com/JuanseGZZ/localmcpcoder/tree/6d8c0f939d93bfdf903ba31e50fc7460327e2433

## MCP and OAuth

The implementation follows the MCP authorization profile dated 2025-11-25 plus the installed 2.0.0 SDK behavior. The profile requires OAuth protected-resource metadata and a `WWW-Authenticate` discovery challenge, recommends Client ID Metadata Documents, and requires OAuth 2.1 protections for public clients. The current draft also keeps `offline_access` out of protected-resource metadata and challenges.

- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://modelcontextprotocol.io/specification/draft/basic/authorization

The installed `@modelcontextprotocol/server@2.0.0` source was treated as authoritative for integration details. `requireBearerAuth` validates bearer shape, expiry, and required scope but leaves audience/resource validation to the verifier. `createMcpHandler` supports finite JSON through `responseMode: "json"`. `oauthMetadataResponse` serves root and path-aware discovery documents. All access tokens therefore carry an explicit expiry, and the local verifier checks the configured resource on every call.

## Target client and deployment

OpenAI's API documentation represents a remote MCP server as a server URL with an OAuth access token. The operator supplies and operates the public HTTPS route; this process only binds loopback and advertises the canonical URL passed at startup.

- https://platform.openai.com/docs/guides/tools-remote-mcp

Package and protocol versions used by the delivery are recorded in `dependencies.md` and `validation.md`; mutable documentation pages are not treated as release pins.
