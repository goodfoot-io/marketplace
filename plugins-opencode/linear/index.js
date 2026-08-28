// OpenCode plugins are code modules loaded as a default-export factory.
// Skills surface declaratively through opencode.json's "skills.paths" instead
// of through this module (OpenCode plugins cannot contribute skills), so this
// factory only establishes the in-process hook transport with an identity
// no-op, matching the Claude/Codex hooks pattern.
//
// The manifest declares `main` alongside `exports["."]`, which looks redundant
// and is not: `opencode plugin` detects install targets from the manifest
// alone, never from this module's exports, and rejects a package without one
// with "No plugin targets found". Node still resolves this module through
// `exports`. Deleting `main` therefore breaks installation without breaking
// the runtime, so nothing here would catch it.
export default async function linear() {
  return {
    "tool.execute.after": async () => {},
  };
}
