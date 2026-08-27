import { execFileSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, repoPath, walkFiles } from "../helpers.js";
import { allTargets, PLUGINS, skillsInTarget } from "../registry.js";

const generated = allTargets();

const snapshot = () =>
  generated.flatMap((target) =>
    walkFiles(repoPath(target.path)).map((file) => {
      const absolute = repoPath(target.path, file);
      return {
        path: path.posix.join(target.path, file),
        mode: fs.statSync(absolute).mode & 0o777,
        sha256: crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex"),
      };
    }),
  );

/**
 * Publication residue left beside a target. `build()` returns these and the CLI
 * exits 0 regardless, so a leaked lock turns the *next* build into a hard
 * `Target lock contention` failure whose cause is several commits upstream.
 */
const RESIDUE = /\.agent-skills-backup-|\.agent-skills-stage-|\.agent-skills\.lock$/;

function residueBeside(targetPath: string): string[] {
  const parent = path.dirname(repoPath(targetPath));
  if (!fs.existsSync(parent)) return [];
  return fs
    .readdirSync(parent)
    .filter((entry) => RESIDUE.test(entry))
    .map((entry) => path.join(parent, entry));
}

describe("generated bundle freshness", () => {
  it("rebuilds every registry tree without changing inventory, modes, or bytes", { timeout: 600_000 }, () => {
    const before = snapshot();
    execFileSync(process.execPath, ["scripts/build-agent-skills.mjs"], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 480_000,
      env: { ...process.env },
    });
    expect(snapshot()).toEqual(before);
    for (const plugin of PLUGINS) {
      for (const target of plugin.targets) {
        expect(
          fs.readdirSync(repoPath(target.path)).sort(),
          `${target.path} must not gain a ${plugin.name}/ namespace`,
        ).toEqual([...skillsInTarget(plugin, target.platform)].sort());
        if (!plugin.skills.includes(plugin.name)) {
          expect(
            fs.existsSync(repoPath(target.path, plugin.name)),
            `${target.path}/${plugin.name} must not be generated`,
          ).toBe(false);
        }
      }
    }
  });

  it("leaves no publication residue beside any registry tree", () => {
    const found = generated.flatMap((target) => residueBeside(target.path));
    expect(found, `stale backup, stage, or lock paths:\n${found.join("\n")}`).toEqual([]);
  });
});
