// OpenCode plugins are code modules loaded as a default-export factory.
// Skills surface declaratively through opencode.json's "skills.paths" instead
// of through this module (OpenCode plugins cannot contribute skills), so this
// factory only establishes the in-process hook transport with an identity
// no-op, matching the Claude/Codex hooks pattern.
export default async function agentHooks() {
  return {
    "tool.execute.after": async () => {},
  };
}
