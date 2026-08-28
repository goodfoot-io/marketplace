// OpenCode plugins are code modules loaded as a default-export factory.
// `opencode plugin <target>` writes only opencode.json's "plugin" key, never
// the disjoint "skills.paths", so installing this package does not by itself
// surface its skills. The Hooks interface's `config` hook runs against the
// resolved config before use, so this factory registers its own bundled
// skills/ leaf there: the path derives from import.meta.url to resolve
// wherever the package is installed, and is appended only when already absent
// so a config that lists it does not gain a duplicate.
//
// The manifest declares `main` alongside `exports["."]`, which looks redundant
// and is not: `opencode plugin` detects install targets from the manifest
// alone, never from this module's exports, and rejects a package without one
// with "No plugin targets found". Node still resolves this module through
// `exports`. Deleting `main` therefore breaks installation without breaking
// the runtime, so nothing here would catch it.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const own = join(dirname(fileURLToPath(import.meta.url)), "skills");

export default async function agentSkills() {
  return {
    config: async (config) => {
      config.skills = config.skills ?? {};
      config.skills.paths = config.skills.paths ?? [];
      if (!config.skills.paths.includes(own)) config.skills.paths.push(own);
    },
    "tool.execute.after": async () => {},
  };
}
