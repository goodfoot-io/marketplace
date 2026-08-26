import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const exec = promisify(execFile);
const packageRoot = resolve(import.meta.dirname, "..");

describe("agent-skills CLI", () => {
  it("builds through the TypeScript bin with package-safe imports", async () => {
    const parent = await mkdtemp(join(tmpdir(), "agent-skills-e2e-"));
    const root = join(parent, "src");
    await mkdir(root);
    await writeFile(join(root, "SKILL.md.eta"), "# <%= it.platform %>\n");
    const { stdout, stderr } = await exec(process.execPath, [
      resolve(packageRoot, "../../node_modules/tsx/dist/cli.mjs"),
      resolve(packageRoot, "src/cli.ts"),
      "build",
      "--root",
      root,
      "--target",
      `codex=${join(parent, "out")}`,
      "SKILL.md.eta",
    ]);
    expect(stderr).toBe("");
    expect(stdout).toContain("codex=");
    expect(await readFile(join(parent, "out", "SKILL.md"), "utf8")).toBe("# codex\n");
  });
});
