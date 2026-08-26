import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { CLAUDE_TREE, CODEX_TREE, EXPECTED_SKILL_BIN, indexMode, repoPath, SKILLS_ROOT } from "../helpers.js";

describe("bin executability", () => {
  it("keeps skill-owned bin/ scripts executable at every physical location", () => {
    for (const [skill, files] of Object.entries(EXPECTED_SKILL_BIN)) {
      for (const file of files) {
        for (const abs of [
          repoPath(SKILLS_ROOT, skill, "bin", file),
          repoPath(CLAUDE_TREE, "skills", skill, "bin", file),
          repoPath(CODEX_TREE, "skills", skill, "bin", file),
        ]) {
          fs.accessSync(abs, fs.constants.X_OK);
        }
        expect(indexMode(path.join(SKILLS_ROOT, skill, "bin", file))).toBe("100755");
        expect(indexMode(path.join(CODEX_TREE, "skills", skill, "bin", file))).toBe("100755");
      }
    }
  });
});
