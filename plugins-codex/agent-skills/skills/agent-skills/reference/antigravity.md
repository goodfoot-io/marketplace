# Antigravity support

Antigravity plugin roots are generated from the same authored skill sources as the other platforms. Each root has an `agy`-validated `plugin.json` and at least one processed skill — evidence for packaging and skill discovery only, not for hooks, MCP servers, or other host behaviors.

Facts grounded only in public documentation are classified `provisional`. Keep them visibly labeled in generated reference material and diagnostics; they are not permission to claim end-to-end support.

Prose skill invocation and the `AGENTS.md` conventions filename are verified. Related platform identity values remain visibly provisional where the platform table says so. Canonical agent-reference spelling remains unavailable because native agents are invoked by name rather than through a rendered reference.

Native subagent operations are verified and exposed by the helpers:

- Dispatch by delegating to a named subagent with `invoke_subagent`.
- Re-engage by checking state with `manage_subagents`, then using `send_message` when the subagent is live.
- Deliver results to the orchestrator with `send_message`.

Direct worktree operations remain unavailable: Antigravity can request isolation for a subagent, but it has no documented enter/remove pair matching the helper lifecycle. Any other unavailable helper must throw at render time and identify both the helper and `antigravity`.

Do not invent an Antigravity plugin-root variable, agent naming transformation, worktree tool, frontmatter key, or behavioral smoke test. Do not silently use a Codex or OpenCode value because it looks similar. The verified directory convention is a complete plugin root under `plugins-antigravity/<name>` with a populated skill leaf.

When a user needs an unavailable feature, state which helper or convention is unknown and treat the request as platform-contract work.

## Verified `agy` surface

`agy plugin validate <root>` and `agy plugin install <root>` both run unattended. Install takes a local path or a git URL with the in-repo path appended: `agy plugin install https://github.com/<org>/<repo>.git/plugins-antigravity/<name>`.

The `#subdir` fragment form fails with `could not detect plugin structure`. Installed files land in `~/.gemini/config/plugins/<name>/`; `agy plugin list` reports the import and its components.

Behavioral invocation remains unavailable: `agy -p` requires an authenticated session, so structural verification is the ceiling unattended. Report an unauthenticated run as unauthenticated, never as a behavioral pass.
