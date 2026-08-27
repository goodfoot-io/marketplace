import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { duplicateNames, frontmatterName, type SkillName, skillNamesUnder } from "../gates.js";
import { readJson, repoPath } from "../helpers.js";
import { PLUGINS, registeredOpencodeRoots } from "../registry.js";

/** Every skill name OpenCode would actually load, across all registered roots. */
function shippedNames(): SkillName[] {
  return PLUGINS.flatMap((plugin) =>
    plugin.targets
      .filter((target) => target.platform === "opencode" && target.opencodeRegistered === true)
      .flatMap((target) => skillNamesUnder(plugin.name, target.path)),
  );
}

describe("Gate A — OpenCode skill-name collisions", () => {
  it("detects a collision across two roots", () => {
    // The gate starts green against goodfoot, so its green must be shown to
    // mean "no collision" rather than "never ran".
    const planted: SkillName[] = [
      { plugin: "jsdoczoom", root: "a", file: "a/cli/SKILL.md", name: "cli" },
      { plugin: "claude-code-skill-reader", root: "b", file: "b/cli/SKILL.md", name: "cli" },
      { plugin: "voice", root: "c", file: "c/handbook/SKILL.md", name: "handbook" },
    ];
    expect([...duplicateNames(planted).keys()]).toEqual(["cli"]);
  });

  it("reads the shipped name rather than the directory name", () => {
    // OpenCode keys its namespace on frontmatter `name:`, so a gate reading
    // directory names would miss a collision between differently-named dirs.
    expect(frontmatterName("---\nname: alpha\ndescription: x\n---\nbody\n")).toBe("alpha");
    expect(frontmatterName("no frontmatter here\n")).toBeNull();
  });

  it("finds skills to check under every registered OpenCode root", () => {
    expect(shippedNames().length).toBeGreaterThan(0);
  });

  it("ships no duplicate skill name across registered OpenCode roots", () => {
    const collisions = [...duplicateNames(shippedNames())].map(
      ([name, group]) => `${name}: ${group.map((entry) => entry.file).join(" vs ")}`,
    );
    expect(collisions, `OpenCode would silently drop all but one of:\n${collisions.join("\n")}`).toEqual([]);
  });
});

describe("opencode.json skills.paths", () => {
  const config = readJson<{ skills?: { paths?: string[] } }>("opencode.json");

  it("lists exactly the registry's registered OpenCode roots", () => {
    expect([...(config.skills?.paths ?? [])].sort()).toEqual([...registeredOpencodeRoots()].sort());
  });

  // A skills.paths entry naming a missing directory produces a log warning and
  // a `continue` — that plugin's skills never load, with nothing failing.
  it.each(config.skills?.paths ?? [])("resolves %s to a real directory", (entry) => {
    expect(fs.existsSync(repoPath(entry)) && fs.statSync(repoPath(entry)).isDirectory()).toBe(true);
  });

  it("gives a reason for every OpenCode tree it deliberately leaves unregistered", () => {
    for (const plugin of PLUGINS) {
      for (const target of plugin.targets) {
        if (target.platform !== "opencode" || target.opencodeRegistered === true) continue;
        expect(target.note?.length ?? 0, `${plugin.name}: unregistered ${target.path} needs a note`).toBeGreaterThan(0);
      }
    }
  });
});
