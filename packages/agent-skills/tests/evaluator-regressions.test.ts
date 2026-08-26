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

function renameFailureFileSystem(positions: readonly number[]): BuildFileSystem {
  let renames = 0;
  return {
    mkdir: fs.mkdir,
    mkdtemp: fs.mkdtemp,
    chmod: fs.chmod,
    lstat: fs.lstat,
    rm: fs.rm,
    writeFile: fs.writeFile,
    rename: async (...args) => {
      renames += 1;
      if (positions.includes(renames)) throw new Error(`injected rename failure ${renames}`);
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

  it.each([
    [4, 5],
    [4, 6],
  ])("retains a recoverable backup when swap %i and rollback %i fail", async (swapFailure, rollbackFailure) => {
    const { parent, root, targets } = await fixture();
    const failure = build({
      root,
      patterns: ["one/SKILL.md.eta"],
      targets: [
        { platform: "codex", outDir: targets[0] },
        { platform: "opencode", outDir: targets[1] },
      ],
      fileSystem: renameFailureFileSystem([swapFailure, rollbackFailure]),
    });
    const error = (await failure.then(
      () => undefined,
      (reason: unknown) => reason,
    )) as AggregateError;
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.message).toMatch(/injected rename failure 4.*rollback failed.*Recoverable backup paths/);
    const backups = (await fs.readdir(parent)).filter((name) => name.includes("agent-skills-backup"));
    expect(backups).toHaveLength(1);
    const backup = backups[0];
    expect(backup).toBeDefined();
    await expect(fs.readFile(join(parent, backup ?? "missing", "old.txt"), "utf8")).resolves.toBe("old\n");
    const restored = rollbackFailure === 5 ? targets[0] : targets[1];
    await expect(fs.readFile(join(restored, "old.txt"), "utf8")).resolves.toBe("old\n");
  });

  it("locks the sorted full target set against a concurrent builder", async () => {
    const { parent, root, targets } = await fixture();
    let releaseOwner: (() => void) | undefined;
    const hold = new Promise<void>((resolve) => {
      releaseOwner = resolve;
    });
    let signalOwner: (() => void) | undefined;
    const owned = new Promise<void>((resolve) => {
      signalOwner = resolve;
    });
    let held = false;
    const pausing: BuildFileSystem = {
      mkdir: fs.mkdir,
      mkdtemp: fs.mkdtemp,
      chmod: fs.chmod,
      lstat: fs.lstat,
      rename: fs.rename,
      rm: fs.rm,
      writeFile: async (...args) => {
        const result = await fs.writeFile(...args);
        if (!held && String(args[0]).endsWith("/owner")) {
          held = true;
          signalOwner?.();
          await hold;
        }
        return result;
      },
    };
    const options = {
      root,
      patterns: ["one/SKILL.md.eta"],
      targets: [
        { platform: "codex" as const, outDir: targets[1] },
        { platform: "codex" as const, outDir: targets[0] },
      ],
    };
    const first = build({ ...options, fileSystem: pausing });
    await owned;
    await expect(build(options)).rejects.toThrow(/lock contention/);
    releaseOwner?.();
    await first;
    for (const target of targets) {
      await expect(fs.readFile(join(target, "one", "SKILL.md"), "utf8")).resolves.toBe("# codex\n");
      await expect(fs.lstat(`${target}.agent-skills.lock`)).rejects.toThrow();
    }
    expect((await fs.readdir(parent)).some((name) => name.includes("agent-skills-backup"))).toBe(false);
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

  it("recursively copies root-owned executable assets without selecting nested templates", async () => {
    const { parent, root } = await fixture();
    await fs.writeFile(join(root, "SKILL.md.eta"), "# root\n");
    await fs.mkdir(join(root, "bin"));
    await fs.writeFile(join(root, "bin", "tool"), "#!/bin/sh\n");
    await fs.chmod(join(root, "bin", "tool"), 0o755);
    await fs.mkdir(join(root, "nested"));
    await fs.writeFile(join(root, "nested", "reference.txt"), "nested\n");
    await fs.writeFile(join(root, "nested", "SKILL.md.eta"), "# unselected\n");
    const out = join(parent, "root-out");
    await build({ root, patterns: ["SKILL.md.eta"], targets: [{ platform: "codex", outDir: out }] });
    expect((await fs.stat(join(out, "bin", "tool"))).mode & 0o777).toBe(0o755);
    await expect(fs.readFile(join(out, "nested", "reference.txt"), "utf8")).resolves.toBe("nested\n");
    await expect(fs.lstat(join(out, "nested", "SKILL.md"))).rejects.toThrow();
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

  it("lints operational inline code while excluding fenced illustrations", async () => {
    const { parent, root } = await fixture();
    await fs.writeFile(
      join(root, "one", "SKILL.md.eta"),
      "Use `$cards:notes` and plugins-codex/goodfoot/skills.\nRaw $cards:raw and `plugins-codex/goodfoot/skills`.\n```\nUse `$cards:ignored` and plugins-codex/goodfoot/skills.\n```\n",
    );
    const result = await lint({
      root,
      patterns: ["one/SKILL.md.eta"],
      targets: [{ platform: "opencode", outDir: join(parent, "inline") }],
    });
    expect(result.diagnostics.filter((item) => item.rule === "cross-dialect-reference")).toHaveLength(2);
    expect(result.diagnostics.filter((item) => item.rule === "skill-relative-path")).toHaveLength(2);
    expect(result.diagnostics.filter((item) => item.location?.line === 1).map((item) => item.rule)).toEqual(
      expect.arrayContaining(["cross-dialect-reference", "skill-relative-path"]),
    );
  });
});
