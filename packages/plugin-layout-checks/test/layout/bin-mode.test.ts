import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { indexMode, repoPath } from "../helpers.js";
import { PLUGINS } from "../registry.js";

/** Every declared skill-owned bin/ file, at every physical location it lands. */
const locations = PLUGINS.flatMap((plugin) =>
  Object.entries(plugin.skillBin ?? {}).flatMap(([skill, files]) =>
    files.flatMap((file) =>
      [plugin.skillsSrc, ...plugin.targets.map((target) => target.path)].map((root) =>
        path.join(root, skill, "bin", file),
      ),
    ),
  ),
);

describe("bin executability", () => {
  it("declares at least one skill-owned bin/ payload to check", () => {
    // Guards the it.each below against silently iterating an empty set if a
    // registry edit drops skillBin.
    expect(locations.length).toBeGreaterThan(0);
  });

  it.each(locations)("keeps %s executable and mode 100755", (relPath) => {
    fs.accessSync(repoPath(relPath), fs.constants.X_OK);
    expect(indexMode(relPath)).toBe("100755");
  });
});
