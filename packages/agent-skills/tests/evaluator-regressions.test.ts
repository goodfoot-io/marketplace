import * as fs from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
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
    readFile: fs.readFile,
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
    readFile: fs.readFile,
    writeFile: fs.writeFile,
    rename: async (...args) => {
      renames += 1;
      if (positions.includes(renames)) throw new Error(`injected rename failure ${renames}`);
      return fs.rename(...args);
    },
  };
}

async function writeLock(lock: string, owner: unknown): Promise<void> {
  await fs.mkdir(lock, { recursive: true });
  await fs.writeFile(join(lock, "owner.json"), typeof owner === "string" ? owner : `${JSON.stringify(owner)}\n`);
}

const owner = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  pid: process.pid,
  host: hostname(),
  processStart: null,
  startedAt: new Date().toISOString(),
  transactionId: "foreign-transaction",
  ...overrides,
});

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
    expect(error.message).toMatch(/injected rename failure 4.*rollback\/cleanup failed.*Recoverable paths/);
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
      readFile: fs.readFile,
      writeFile: async (...args) => {
        const result = await fs.writeFile(...args);
        if (!held && String(args[0]).endsWith("/owner.json")) {
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

  it("atomically reclaims a lock whose local owner is proven dead", async () => {
    const { root, targets } = await fixture();
    const lock = `${targets[0]}.agent-skills.lock`;
    await writeLock(lock, owner({ pid: 2_000_000_000, processStart: "dead" }));
    const result = await build({
      root,
      patterns: ["one/SKILL.md.eta"],
      targets: [{ platform: "codex", outDir: targets[0] }],
    });
    expect(result.residues).toEqual([]);
    await expect(fs.readFile(join(targets[0], "one", "SKILL.md"), "utf8")).resolves.toBe("# codex\n");
    await expect(fs.lstat(lock)).rejects.toThrow();
  });

  it.each([
    ["live", owner()],
    ["foreign", owner({ host: "foreign.example", pid: 2_000_000_000, startedAt: "1970-01-01T00:00:00.000Z" })],
    ["malformed", "not-json"],
  ])("fails safe for %s lock ownership", async (_name, metadata) => {
    const { root, targets } = await fixture();
    const lock = `${targets[0]}.agent-skills.lock`;
    await writeLock(lock, metadata);
    await expect(
      build({ root, patterns: ["one/SKILL.md.eta"], targets: [{ platform: "codex", outDir: targets[0] }] }),
    ).rejects.toThrow(/lock contention/);
    await expect(fs.lstat(lock)).resolves.toBeDefined();
    await expect(fs.readFile(join(targets[0], "old.txt"), "utf8")).resolves.toBe("old\n");
  });

  it("releases its partial sorted lock set without deleting the foreign lock", async () => {
    const { root, targets } = await fixture();
    const foreign = `${targets[1]}.agent-skills.lock`;
    await writeLock(foreign, owner({ host: "foreign.example" }));
    await expect(
      build({
        root,
        patterns: ["one/SKILL.md.eta"],
        targets: [
          { platform: "codex", outDir: targets[0] },
          { platform: "codex", outDir: targets[1] },
        ],
      }),
    ).rejects.toThrow(/lock contention/);
    await expect(fs.lstat(`${targets[0]}.agent-skills.lock`)).rejects.toThrow();
    await expect(fs.lstat(foreign)).resolves.toBeDefined();
  });

  for (const kind of ["backup", "lock"] as const)
    for (const position of [1, 2])
      it(`keeps published targets when ${kind} cleanup ${position} fails`, async () => {
        const { root, targets } = await fixture();
        let seen = 0;
        const adapter: BuildFileSystem = {
          mkdir: fs.mkdir,
          mkdtemp: fs.mkdtemp,
          chmod: fs.chmod,
          lstat: fs.lstat,
          rename: fs.rename,
          writeFile: fs.writeFile,
          readFile: fs.readFile,
          rm: async (path, options) => {
            const matches =
              kind === "backup"
                ? String(path).includes("agent-skills-backup")
                : String(path).endsWith("agent-skills.lock");
            if (matches) {
              seen += 1;
              if (seen === position) throw new Error(`injected ${kind} cleanup`);
            }
            return fs.rm(path, options);
          },
        };
        const result = await build({
          root,
          patterns: ["one/SKILL.md.eta"],
          targets: [
            { platform: "codex", outDir: targets[0] },
            { platform: "opencode", outDir: targets[1] },
          ],
          fileSystem: adapter,
        });
        expect(result.residues).toHaveLength(1);
        expect(result.residues[0]).toMatchObject({ kind });
        await expect(fs.lstat(result.residues[0]?.path ?? "missing")).resolves.toBeDefined();
        await expect(fs.readFile(join(targets[0], "one", "SKILL.md"), "utf8")).resolves.toBe("# codex\n");
        await expect(fs.readFile(join(targets[1], "one", "SKILL.md"), "utf8")).resolves.toBe("# opencode\n");
      });

  it("reports an existing stage residue without changing old targets before commit", async () => {
    const { root, targets } = await fixture();
    let stageWrite = 0;
    const adapter: BuildFileSystem = {
      mkdir: fs.mkdir,
      mkdtemp: fs.mkdtemp,
      chmod: fs.chmod,
      lstat: fs.lstat,
      rename: fs.rename,
      readFile: fs.readFile,
      writeFile: async (path, data) => {
        if (String(path).includes("agent-skills-stage")) {
          stageWrite += 1;
          if (stageWrite === 2) throw new Error("injected staging failure");
        }
        return fs.writeFile(path, data);
      },
      rm: async (path, options) => {
        if (String(path).includes("agent-skills-stage")) throw new Error("injected stage cleanup");
        return fs.rm(path, options);
      },
    };
    const error = (await build({
      root,
      patterns: ["one/SKILL.md.eta"],
      targets: [
        { platform: "codex", outDir: targets[0] },
        { platform: "codex", outDir: targets[1] },
      ],
      fileSystem: adapter,
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    )) as AggregateError;
    expect(error.message).toMatch(/staging failure.*cleanup failed.*Recoverable paths/);
    const stagePath = error.message.split("Recoverable paths: ")[1]?.split(", ")[0];
    expect(stagePath).toBeDefined();
    await expect(fs.lstat(stagePath ?? "missing")).resolves.toBeDefined();
    for (const target of targets) await expect(fs.readFile(join(target, "old.txt"), "utf8")).resolves.toBe("old\n");
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

describe("relative link resolution", () => {
  async function linkFixture(body: string): Promise<{ parent: string; root: string }> {
    const { parent, root } = await fixture();
    await fs.mkdir(join(root, "one", "reference"), { recursive: true });
    await fs.writeFile(join(root, "one", "sibling.md.eta"), "# sibling\n");
    await fs.writeFile(join(root, "one", "reference", "guide.md"), "# guide\n");
    await fs.writeFile(join(root, "one", "SKILL.md.eta"), body);
    return { parent, root };
  }

  it("resolves relative links against the source tree and flags only unresolvable ones", async () => {
    const { parent, root } = await linkFixture(
      "# Links\n\n[sibling](sibling.md)\n[nested](reference/guide.md)\n[broken](reference/missing.md)\n" +
        "[anchor](#section)\n[external](https://example.com/x.md)\n[mail](mailto:someone@example.com)\n" +
        "[protocol](//example.com/x.md)\n[fragment](sibling.md#top)\n[directory](reference)\n" +
        "[templated](" +
        "$" +
        "{webhook.url})\n",
    );
    const result = await lint({
      root,
      patterns: ["one/*.md.eta"],
      targets: [{ platform: "codex", outDir: join(parent, "links") }],
    });
    const broken = result.diagnostics.filter((item) => item.rule === "broken-link");
    expect(broken).toHaveLength(1);
    expect(broken[0]).toMatchObject({ sourcePath: "one/SKILL.md.eta", location: { line: 5 } });
    expect(broken[0]?.message).toContain("reference/missing.md");
    expect(result.ok).toBe(false);
  });

  it("ignores fenced examples and honors rule-scoped suppressions for broken links", async () => {
    const { parent, root } = await linkFixture(
      "<!-- agent-skills\nlintSuppressions:\n  - rule: broken-link\n    lines: [1, 1]\n-->" +
        "[gone](reference/gone.md)\n```\n[fenced](reference/also-gone.md)\n```\n",
    );
    const result = await lint({
      root,
      patterns: ["one/*.md.eta"],
      targets: [{ platform: "codex", outDir: join(parent, "suppressed") }],
    });
    expect(result.diagnostics.filter((item) => item.rule === "broken-link")).toHaveLength(0);
  });
});
