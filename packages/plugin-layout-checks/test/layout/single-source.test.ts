import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath, walkFiles } from "../helpers.js";
import { PLUGINS, skillsInTarget } from "../registry.js";

/** Every declared output tree, as `<plugin>: <path>` cases. */
const trees = PLUGINS.flatMap((plugin) =>
  plugin.targets.map((target) => [plugin.name, target.path, target.platform] as const),
);

describe("generated skill surfaces", () => {
  it("holds exactly the registry's authored source roots under skills-src", () => {
    const declared = PLUGINS.map((plugin) => {
      const [parent, ...rest] = plugin.skillsSrc.split("/");
      expect(parent, `${plugin.name}: skillsSrc must live under skills-src/`).toBe("skills-src");
      expect(rest, `${plugin.name}: skillsSrc must be exactly one level deep`).toHaveLength(1);
      return rest[0];
    });
    expect(fs.readdirSync(repoPath("skills-src")).sort()).toEqual([...declared].sort());
  });

  it.each(PLUGINS.map((plugin) => plugin.name))("keeps %s Markdown authored only as Eta templates", (name) => {
    const plugin = PLUGINS.find((candidate) => candidate.name === name);
    if (!plugin) throw new Error(`unreachable: ${name}`);
    const files = walkFiles(repoPath(plugin.skillsSrc));
    expect(files.filter((file) => file.endsWith(".md.eta")).length).toBeGreaterThan(0);
    expect(files.filter((file) => file.endsWith(".md"))).toEqual([]);
  });

  it.each(trees)("contains a complete regular-file tree at %s -> %s", (name, output, platform) => {
    const plugin = PLUGINS.find((candidate) => candidate.name === name);
    if (!plugin) throw new Error(`unreachable: ${name}`);
    expect(fs.readdirSync(repoPath(output)).sort()).toEqual([...skillsInTarget(plugin, platform)].sort());
    for (const file of walkFiles(repoPath(output))) {
      const stat = fs.lstatSync(path.join(repoPath(output), file));
      expect(stat.isSymbolicLink(), `${output}/${file}`).toBe(false);
      expect(stat.isFile(), `${output}/${file}`).toBe(true);
    }
  });

  it("contains no symlink anywhere in a generated skill tree", () => {
    for (const [, output] of trees) {
      const pending = [repoPath(output)];
      while (pending.length > 0) {
        const current = pending.pop();
        if (!current) continue;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const absolute = path.join(current, entry.name);
          expect(fs.lstatSync(absolute).isSymbolicLink(), absolute).toBe(false);
          if (entry.isDirectory()) pending.push(absolute);
        }
      }
    }
  });
});
