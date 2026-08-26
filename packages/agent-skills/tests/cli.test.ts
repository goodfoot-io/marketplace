import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatResidueWarnings, parseArgs, run, validateArgs } from "../src/cli.js";
import { build } from "../src/index.js";
import type { BuildFileSystem } from "../src/types.js";

describe("CLI contract", () => {
  it("parses repeated targets, platforms, and positional patterns", () => {
    const parsed = parseArgs(["build", "--root", "src", "--target", "codex=out", "--platform", "codex", "**/*.md.eta"]);
    expect(validateArgs(parsed)).toMatchObject({
      command: "build",
      root: "src",
      platforms: ["codex"],
      patterns: ["**/*.md.eta"],
    });
  });

  it("rejects missing targets and malformed platforms", () => {
    expect(() => validateArgs(parseArgs(["build", "x.md.eta"]))).toThrow(/target/);
    expect(() => validateArgs(parseArgs(["lint", "--target", "claude=out", "x.md.eta"]))).toThrow(/platform/);
  });

  it("warns deterministically for API cleanup residues while retaining exit zero", async () => {
    const parent = await fs.mkdtemp(join(tmpdir(), "agent-skills-cli-residue-"));
    const root = join(parent, "src");
    const out = join(parent, "out");
    await fs.mkdir(root);
    await fs.mkdir(out);
    await fs.writeFile(join(root, "SKILL.md.eta"), "# published\n");
    await fs.writeFile(join(out, "old.txt"), "old\n");
    const fileSystem: BuildFileSystem = {
      mkdir: fs.mkdir,
      mkdtemp: fs.mkdtemp,
      writeFile: fs.writeFile,
      readFile: fs.readFile,
      chmod: fs.chmod,
      lstat: fs.lstat,
      rename: fs.rename,
      rm: async (path, options) => {
        if (String(path).includes("agent-skills-backup") || String(path).endsWith("agent-skills.lock")) {
          throw new Error(`retained ${String(path)}`);
        }
        return fs.rm(path, options);
      },
    };
    const apiResult = await build({
      root,
      patterns: ["SKILL.md.eta"],
      targets: [{ platform: "codex", outDir: out }],
      fileSystem,
    });
    expect(apiResult.residues).toHaveLength(2);
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exit = await run(["build", "--root", root, "--target", `codex=${out}`, "SKILL.md.eta"], {
      build: async () => apiResult,
      lint: async () => {
        throw new Error("lint dependency should not run");
      },
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    });
    expect(exit).toBe(0);
    expect(stderr).toEqual(formatResidueWarnings(apiResult.residues));
    expect(stderr.join("")).toContain("publication succeeded; cleanup residue [backup]");
    expect(stderr.join("")).toContain("publication succeeded; cleanup residue [lock]");
    await expect(fs.readFile(join(out, "SKILL.md"), "utf8")).resolves.toBe("# published\n");
  });
});
