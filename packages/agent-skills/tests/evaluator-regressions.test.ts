import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { build, createHelpers, lint, renderTemplate } from "../src/index.js";
import type { BuildFileSystem, BuildOptions, Platform } from "../src/types.js";

async function fixture(): Promise<{ parent: string; root: string; targets: readonly [string, string] }> {
  const parent = await fs.mkdtemp(join(tmpdir(), "agent-skills-evaluator-"));
  const root = join(parent, "src");
  await fs.mkdir(join(root, "one"), { recursive: true });
  await fs.writeFile(join(root, "one", "SKILL.md.eta"), "# <%= it.platform %>\n");
  const targets = [join(parent, "out-a"), join(parent, "out-b")] as const;
  for (const target of targets) {
    await fs.mkdir(target);
    await fs.writeFile(join(target, "old.txt"), "old\n");
  }
  return { parent, root, targets };
}

async function inventory(path: string): Promise<string[]> {
  return (await fs.readdir(path, { recursive: true, withFileTypes: true }))
    .map((entry) => `${entry.isDirectory() ? "d" : "f"}:${entry.parentPath.replace(path, "")}/${entry.name}`)
    .sort();
}

function injectedFileSystem(fail: { operation: "rename" | "write"; position: number }): BuildFileSystem {
  let renames = 0;
  let writes = 0;
  return {
    mkdir: fs.mkdir,
    mkdtemp: fs.mkdtemp,
    chmod: fs.chmod,
    lstat: fs.lstat,
    rm: fs.rm,
    writeFile: async (...args) => {
      writes += 1;
      if (fail.operation === "write" && writes === fail.position) throw new Error("injected preparation failure");
      return fs.writeFile(...args);
    },
    rename: async (...args) => {
      renames += 1;
      if (fail.operation === "rename" && renames === fail.position) throw new Error("injected rename failure");
      return fs.rename(...args);
    },
  };
}

describe("coordinated target transaction", () => {
  for (const position of [1, 2, 3, 4])
    it(`rolls back rename failure ${position}`, async () => {
      const { root, targets } = await fixture();
      const before = await Promise.all(targets.map(inventory));
      await expect(
        build({
          root,
          patterns: ["one/SKILL.md.eta"],
          targets: [
            { platform: "codex", outDir: targets[0] },
            { platform: "opencode", outDir: targets[1] },
          ],
          fileSystem: injectedFileSystem({ operation: "rename", position }),
        }),
      ).rejects.toThrow("injected rename failure");
      expect(await Promise.all(targets.map(inventory))).toEqual(before);
      for (const target of targets) expect(await fs.readFile(join(target, "old.txt"), "utf8")).toBe("old\n");
    });

  it("does not mutate targets when staging fails", async () => {
    const { root, targets } = await fixture();
    const before = await Promise.all(targets.map(inventory));
    await expect(
      build({
        root,
        patterns: ["one/SKILL.md.eta"],
        targets: [
          { platform: "codex", outDir: targets[0] },
          { platform: "codex", outDir: targets[1] },
        ],
        fileSystem: injectedFileSystem({ operation: "write", position: 2 }),
      }),
    ).rejects.toThrow("injected preparation failure");
    expect(await Promise.all(targets.map(inventory))).toEqual(before);
  });
});

describe("target and discovery safety", () => {
  it.each([
    ["parent", "parent/child"],
    ["parent/child", "parent"],
  ])("rejects target containment in either order", async (one, two) => {
    const { parent, root } = await fixture();
    await expect(
      build({
        root,
        patterns: ["one/SKILL.md.eta"],
        targets: [
          { platform: "codex", outDir: join(parent, one) },
          { platform: "opencode", outDir: join(parent, two) },
        ],
      }),
    ).rejects.toThrow(/Overlapping targets/);
  });

  it("rejects physical target aliases through a symlinked ancestor", async () => {
    const { parent, root } = await fixture();
    await fs.mkdir(join(parent, "real"));
    await fs.symlink(join(parent, "real"), join(parent, "alias"));
    await expect(
      build({
        root,
        patterns: ["one/SKILL.md.eta"],
        targets: [
          { platform: "codex", outDir: join(parent, "real", "out") },
          { platform: "opencode", outDir: join(parent, "alias", "out") },
        ],
      }),
    ).rejects.toThrow(/Overlapping targets/);
  });

  it("rejects unmatched patterns even when opaque assets exist", async () => {
    const { parent, root } = await fixture();
    await fs.writeFile(join(root, "asset.bin"), "asset");
    const options: BuildOptions = {
      root,
      patterns: ["missing/*.md.eta"],
      targets: [{ platform: "codex", outDir: join(parent, "out") }],
    };
    await expect(build(options)).rejects.toThrow(/No template files matched/);
    await expect(lint(options)).resolves.toMatchObject({ ok: false, diagnostics: [{ rule: "config" }] });
  });

  it("copies opaque assets only from selected top-level skill owners", async () => {
    const { parent, root } = await fixture();
    await fs.writeFile(join(root, "one", "owned.bin"), "yes");
    await fs.mkdir(join(root, "two"));
    await fs.writeFile(join(root, "two", "SKILL.md.eta"), "# two\n");
    await fs.writeFile(join(root, "two", "other.bin"), "no");
    const out = join(parent, "narrow");
    await build({ root, patterns: ["one/SKILL.md.eta"], targets: [{ platform: "codex", outDir: out }] });
    await expect(fs.readFile(join(out, "one", "owned.bin"), "utf8")).resolves.toBe("yes");
    await expect(fs.lstat(join(out, "two", "other.bin"))).rejects.toThrow();
  });
});

describe("helper, mapping, and lint controls", () => {
  it("validates helper inputs with helper and platform context", () => {
    expect(() => createHelpers("codex").is("codeex" as Platform)).toThrow(/it\.is.*codex.*codeex/);
    expect(() => createHelpers("codex").subagent.dispatch("explorer", { taskName: "Bad Name" })).toThrow(
      /subagent\.dispatch.*codex.*taskName/,
    );
    expect(createHelpers("codex").subagent.reengage({ live: true })).toContain("send_message");
    expect(createHelpers("codex").subagent.reengage({ live: false })).toContain("resume_agent");
  });

  it("forwards custom platform directories through render, build, and lint", async () => {
    const { parent, root } = await fixture();
    await fs.writeFile(join(root, "one", "SKILL.md.eta"), "<%= it.platformDir('skills') %>\n");
    const mapping = { codex: { skills: "external/codex" } } as const;
    await expect(
      renderTemplate({
        platform: "codex",
        root,
        sourcePath: join(root, "one", "SKILL.md.eta"),
        template: "<%= it.platformDir('skills') %>\n",
        platformDirs: mapping.codex,
      }),
    ).resolves.toMatchObject({ content: "external/codex\n" });
    const out = join(parent, "mapped");
    const options = {
      root,
      patterns: ["one/SKILL.md.eta"],
      targets: [{ platform: "codex" as const, outDir: out }],
      platformDirs: mapping,
    };
    await build(options);
    await expect(fs.readFile(join(out, "one", "SKILL.md"), "utf8")).resolves.toBe("external/codex\n");
    await expect(lint(options)).resolves.toMatchObject({ ok: true });
  });

  it("bounds rule-specific suppressions and ignores fenced examples", async () => {
    const { parent, root } = await fixture();
    await fs.writeFile(
      join(root, "one", "SKILL.md.eta"),
      "<!-- agent-skills\nlintSuppressions:\n  - rule: plugin-root-variable\n    lines: [1, 1]\n-->$" +
        "{PLUGIN_ROOT}\n$" +
        "{PLUGIN_ROOT}\n```\n$" +
        "{PLUGIN_ROOT}\n```\n",
    );
    const result = await lint({
      root,
      patterns: ["one/SKILL.md.eta"],
      targets: [{ platform: "codex", outDir: join(parent, "lint") }],
    });
    expect(result.diagnostics.filter((item) => item.rule === "plugin-root-variable")).toHaveLength(2);
  });
});
