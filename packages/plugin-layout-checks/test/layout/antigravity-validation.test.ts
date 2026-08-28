import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { repoPath } from "../helpers.js";
import { PLUGINS } from "../registry.js";

const workflow = fs.readFileSync(repoPath(".github/workflows/plugin-layout.yml"), "utf8");

describe("CI Antigravity plugin validation", () => {
  const sourceApplicability = PLUGINS.map((plugin) => {
    const sourceEntries = fs
      .readdirSync(repoPath(plugin.skillsSrc), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const applicable = sourceEntries.filter((skill) => {
      const pending = [repoPath(plugin.skillsSrc, skill)];
      const files: string[] = [];
      while (pending.length > 0) {
        const current = pending.pop();
        if (current === undefined) break;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const child = `${current}/${entry.name}`;
          if (entry.isDirectory()) pending.push(child);
          else files.push(child);
        }
      }
      return files.some((source) => {
        if (!source.endsWith(".eta")) return true;
        const text = fs.readFileSync(source, "utf8");
        if (!text.startsWith("<!-- agent-skills\n")) return true;
        const end = text.indexOf("-->");
        const config = parseYaml(text.slice("<!-- agent-skills\n".length, end)) as { platforms?: string[] };
        return config.platforms?.includes("antigravity") ?? true;
      });
    });
    return { plugin, applicable };
  });

  it("derives complete applicability from authored source restrictions", () => {
    const applicable = sourceApplicability
      .filter(({ applicable }) => applicable.length > 0)
      .map(({ plugin }) => plugin.name);
    expect(applicable).toEqual([
      "goodfoot",
      "jsdoczoom",
      "claude-code-skill-reader",
      "linear",
      "gmail",
      "agent-hooks",
      "agent-skills",
    ]);
    expect(sourceApplicability.find(({ plugin }) => plugin.name === "voice")?.applicable).toEqual([]);

    for (const { plugin, applicable: skills } of sourceApplicability.filter(
      ({ applicable }) => applicable.length > 0,
    )) {
      const root = plugin.antigravityPluginRoot;
      expect(root, `${plugin.name}: applicable source has no Antigravity root`).toBeTruthy();
      if (root === undefined) continue;
      expect(plugin.targets).toContainEqual({
        platform: "antigravity",
        path: `${root}/skills`,
      });
      expect(fs.readdirSync(repoPath(root, "skills")).sort()).toEqual([...skills].sort());
    }
  });

  it.each(
    PLUGINS.filter((plugin) => plugin.antigravityPluginRoot).map((plugin) => plugin.name),
  )("validates a complete, positively processed %s plugin root", (name) => {
    const plugin = PLUGINS.find((candidate) => candidate.name === name);
    if (plugin === undefined) throw new Error(`${name}: not present in the registry`);
    const root = plugin.antigravityPluginRoot;
    if (root === undefined) throw new Error(`${name}: has no Antigravity plugin root`);
    const manifest = JSON.parse(fs.readFileSync(repoPath(root, "plugin.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys(manifest).sort()).toEqual(["description", "name", "version"]);
    expect(manifest.name).toBe(plugin.name);
    expect(manifest.version).toBe(JSON.parse(fs.readFileSync(repoPath(plugin.versionSurfaces.source), "utf8")).version);
    expect(fs.existsSync(repoPath(root, "hooks"))).toBe(false);
    expect(fs.existsSync(repoPath(root, ".mcp.json"))).toBe(false);
    const output = execFileSync("agy", ["plugin", "validate", root], { cwd: repoPath("."), encoding: "utf8" });
    expect(output).toMatch(/[1-9][0-9]* processed/);
    expect(output).toMatch(/mcpServers\s*: skipped \(not found\)/);
    expect(output).toMatch(/hooks\s*: skipped \(not found\)/);
  });

  it("derives complete plugin roots from Antigravity registry targets", () => {
    expect(workflow).toContain('select(any(.targets[]?; .platform == "antigravity")) | .antigravityPluginRoot');
    expect(workflow).toContain('test -f "$root/plugin.json"');
    expect(workflow).toContain('agy plugin validate "$root"');
  });

  it("requires a positive processed-category result", () => {
    expect(workflow).toContain("skills[[:space:]]*: [1-9][0-9]* processed");
  });

  it("skips cleanly before any Antigravity targets are registered", () => {
    expect(workflow).toContain("registry declares no Antigravity plugin roots; skipping validation");
  });
});
