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

  // The opt-out above is only trustworthy while something actually takes it.
  // With no unregistered tree in the registry the note requirement passes
  // vacuously, and a later opt-out would land on a rule nothing had exercised.
  it("still exercises the unregistered case it makes rules for", () => {
    const unregistered = PLUGINS.flatMap((plugin) =>
      plugin.targets.filter((target) => target.platform === "opencode" && target.opencodeRegistered !== true),
    );
    expect(unregistered.length).toBeGreaterThan(0);
  });
});

/**
 * CI's OpenCode boot smoke derives its roots from the registry in bash, which
 * makes the registry's opencode target list a contract with three readers: this
 * suite, opencode.json, and a jq filter inside the workflow. The first two are
 * pinned to each other above; the third was pinned to neither, so it could
 * iterate a set nobody here had checked.
 *
 * That is not hypothetical. Voice declared OpenCode and Codex targets that
 * rendered zero files, and the smoke's own `no SKILL.md found` guard was the
 * check it broke — a failure no build could cure, because the tree it wanted
 * could not be committed in the first place.
 */
describe("CI OpenCode boot smoke agrees with the registry", () => {
  const workflow = fs.readFileSync(repoPath(".github/workflows/plugin-layout.yml"), "utf8");

  it("still derives its roots from the registry rather than a written list", () => {
    expect(workflow).toContain('select(.platform == "opencode") | .path');
  });

  // The invariant the smoke enforces, checked here against the committed tree
  // so it fails in the suite rather than only on a runner.
  it.each(
    PLUGINS.flatMap((plugin) =>
      plugin.targets.filter((target) => target.platform === "opencode").map((target) => target.path),
    ),
  )("finds at least one SKILL.md under declared root %s", (root) => {
    expect(fs.existsSync(repoPath(root)), `${root} is declared but absent from the checkout`).toBe(true);
    expect(skillNamesUnder("<smoke>", root).length).toBeGreaterThan(0);
  });
});
