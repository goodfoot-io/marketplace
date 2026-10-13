import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const exec = promisify(execFile);
const packageRoot = resolve(import.meta.dirname, "..");
const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
const tsconfig = resolve(packageRoot, "tsconfig.json");
const childEnvironment = { ...process.env, NODE_OPTIONS: undefined, ESBUILD_BINARY_PATH: undefined };
const ownedDirectories = new Set<string>();

afterEach(async () => {
  for (const path of ownedDirectories) {
    await rm(path, { recursive: true, force: true });
    ownedDirectories.delete(path);
  }
});

describe("agent-skills CLI", () => {
  it("builds through the TypeScript bin with package-safe imports", async () => {
    const parent = await mkdtemp(join(tmpdir(), "agent-skills-e2e-"));
    ownedDirectories.add(parent);
    const root = join(parent, "src");
    await mkdir(root);
    await writeFile(join(root, "SKILL.md.eta"), "# <%= it.platform %>\n");
    const { stdout, stderr } = await exec(
      "node",
      [
        tsxCli,
        "--tsconfig",
        tsconfig,
        "--no-cache",
        resolve(packageRoot, "src/cli.ts"),
        "build",
        "--root",
        root,
        "--target",
        `codex=${join(parent, "out")}`,
        "SKILL.md.eta",
      ],
      {
        timeout: 4000,
        env: { ...childEnvironment, TMPDIR: parent, TMP: parent, TEMP: parent },
      },
    );
    expect(stderr).toBe("");
    expect(stdout).toContain("codex=");
    expect(await readFile(join(parent, "out", "SKILL.md"), "utf8")).toBe("# codex\n");
  });

  it("executes the documented repository build command", async () => {
    const repo = await mkdtemp(join(tmpdir(), "agent-skills-documented-"));
    ownedDirectories.add(repo);
    const root = join(repo, "skills-src", "goodfoot");
    await mkdir(join(root, "demo"), { recursive: true });
    await writeFile(join(root, "demo", "SKILL.md.eta"), "# <%= it.platform %>\n");
    const args = [
      tsxCli,
      "--tsconfig",
      tsconfig,
      "--no-cache",
      resolve(packageRoot, "src/cli.ts"),
      "build",
      "--root",
      "skills-src/goodfoot",
      "--target",
      "claude-code=plugins-claude/goodfoot/skills",
      "--target",
      "codex=plugins-codex/goodfoot/skills",
      "**/*.md.eta",
    ];
    const { stderr } = await exec("node", args, {
      cwd: repo,
      timeout: 4000,
      env: { ...childEnvironment, TMPDIR: repo, TMP: repo, TEMP: repo },
    });
    expect(stderr).toBe("");
    await expect(readFile(join(repo, "plugins-codex/goodfoot/skills/demo/SKILL.md"), "utf8")).resolves.toBe(
      "# codex\n",
    );
  });
});
