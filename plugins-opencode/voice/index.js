// OpenCode plugins are code modules loaded as a default-export factory.
// `opencode plugin <target>` writes only opencode.json's "plugin" key, never
// the disjoint "skills.paths", so a plugin that ships skills has to register
// its own leaf from the `config` hook. This plugin ships none — it carries the
// voice MCP server, not skills — so it establishes only the in-process hook
// transport with an identity no-op, and registers no path.
//
// The manifest declares `main` alongside `exports["."]`, which looks redundant
// and is not: `opencode plugin` detects install targets from the manifest
// alone, never from this module's exports, and rejects a package without one
// with "No plugin targets found". Node still resolves this module through
// `exports`. Deleting `main` therefore breaks installation without breaking
// the runtime, so nothing here would catch it.
export default async function voice() {
  return {
    "tool.execute.after": async () => {},
  };
}
