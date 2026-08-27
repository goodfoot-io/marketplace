import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../helpers.js";

// gmail's and linear's tests/*.ts scripts are invoked manually (verify:gmail,
// verify:linear) rather than through a workspace, so the root tsconfig.json's
// `include` is the only thing that puts them under type-checking at all. This
// asserts they're actually reachable in the program rather than just present
// on disk under a plausible-looking glob.
const EXPECTED_PLUGIN_TEST_FILES = [
  "plugins-claude/gmail/tests/verify-sdk-behavior.ts",
  "plugins-claude/linear/tests/verify-decision-edges.ts",
  "plugins-claude/linear/tests/verify-sdk-behavior.ts",
] as const;

describe("tsconfig.json plugin tests inclusion", () => {
  it("puts each plugin's tests/*.ts file in the TypeScript program", () => {
    const tscBin = path.join(REPO_ROOT, "node_modules/typescript/bin/tsc");
    // --listFiles prints the program membership regardless of whether the
    // program type-checks cleanly; unrelated pre-existing type errors
    // elsewhere in the repo make tsc exit non-zero, so stdout is read off a
    // caught failure rather than asserting the exit code here.
    let output: string;
    try {
      output = execFileSync("node", [tscBin, "-p", "tsconfig.json", "--noEmit", "--listFiles"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      output = (error as { stdout: string }).stdout;
    }
    const listedFiles = new Set(output.split("\n").map((line) => path.relative(REPO_ROOT, line.trim())));

    for (const relPath of EXPECTED_PLUGIN_TEST_FILES) {
      expect(listedFiles.has(relPath), `${relPath} in tsc --listFiles output`).toBe(true);
    }
    // The full-monorepo `tsc --listFiles` program grew past vitest's default
    // 30s timeout once this card's migration added hundreds of files under
    // tsconfig.json's `include`; ~31s standalone on this runner.
  }, 60_000);
});
