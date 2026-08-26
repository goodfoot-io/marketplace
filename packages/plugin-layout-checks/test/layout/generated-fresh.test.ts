import { execFileSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAUDE_TREE,
  CODEX_TREE,
  EXPECTED_SKILLS,
  OPENCODE_TREE,
  REPO_ROOT,
  repoPath,
  SKILLS_ROOT,
  walkFiles,
} from "../helpers.js";

const generated = [SKILLS_ROOT, `${CLAUDE_TREE}/skills`, `${CODEX_TREE}/skills`, `${OPENCODE_TREE}/skills`];
const snapshot = () =>
  generated.flatMap((root) =>
    walkFiles(repoPath(root)).map((file) => {
      const absolute = repoPath(root, file);
      return {
        path: path.posix.join(root, file),
        mode: fs.statSync(absolute).mode & 0o777,
        sha256: crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex"),
      };
    }),
  );

describe("generated bundle freshness", () => {
  it(
    "rebuilds typescript-metrics before all skill trees without changing inventory, modes, or bytes",
    { timeout: 600_000 },
    () => {
      const before = snapshot();
      execFileSync(process.execPath, ["scripts/build-agent-skills.mjs"], {
        cwd: REPO_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 480_000,
        env: { ...process.env },
      });
      expect(snapshot()).toEqual(before);
      for (const root of generated) {
        expect(fs.readdirSync(repoPath(root)).sort(), `${root} must not gain a goodfoot/ namespace`).toEqual(
          [...EXPECTED_SKILLS].sort(),
        );
        expect(fs.existsSync(repoPath(root, "goodfoot")), `${root}/goodfoot must not be generated`).toBe(false);
      }
    },
  );
});
