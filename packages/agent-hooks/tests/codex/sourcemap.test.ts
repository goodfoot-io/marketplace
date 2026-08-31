import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileCodexHook as compileHook } from "../../src/agents/codex/cli-support.js";
import { DEFAULT_ESBUILD_LOADERS } from "../../src/agents/codex/constants.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createHookFile(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-hooks-sourcemap-"));
  tempDirs.push(directory);
  const sourcePath = path.join(directory, "session-start.ts");
  fs.writeFileSync(sourcePath, `export default { hookEventName: "SessionStart" };\n`, "utf-8");
  return sourcePath;
}

describe("compileHook sourcemap behavior", () => {
  it("emits no inline sourcemap by default", async () => {
    const { content } = await compileHook(createHookFile(), DEFAULT_ESBUILD_LOADERS);
    expect(content).not.toContain("sourceMappingURL");
  });

  it("emits a sourcemap when enabled", async () => {
    const { content } = await compileHook(createHookFile(), DEFAULT_ESBUILD_LOADERS, true);
    expect(content).toContain("sourceMappingURL=data:application/json;base64,");
  });

  it("derives a different content hash without a sourcemap", async () => {
    const sourcePath = createHookFile();
    const withSourcemap = await compileHook(sourcePath, DEFAULT_ESBUILD_LOADERS, true);
    const withoutSourcemap = await compileHook(sourcePath, DEFAULT_ESBUILD_LOADERS, false);
    expect(withoutSourcemap.contentHash).not.toBe(withSourcemap.contentHash);
  });

  it("sourcemap-free output equals default output minus the trailing sourceMappingURL line", async () => {
    const sourcePath = createHookFile();
    const withSourcemap = await compileHook(sourcePath, DEFAULT_ESBUILD_LOADERS, true);
    const withoutSourcemap = await compileHook(sourcePath, DEFAULT_ESBUILD_LOADERS, false);
    const stripped = withSourcemap.content.replace(/^\/\/# sourceMappingURL=data:application\/json;base64,.+\n?$/m, "");
    expect(withoutSourcemap.content).toBe(stripped);
  });
});
