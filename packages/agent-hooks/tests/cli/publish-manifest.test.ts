/** Exercise the publication-only normalization without modifying the checkout. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(root, "scripts/prepare-publish.mjs");
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "agent-hooks-publish-"));
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function prepare(manifest: Record<string, unknown>) {
  const path = join(directory, "package.json");
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8", timeout: 10000 });
  return { result, contents: JSON.parse(readFileSync(path, "utf8")) };
}

describe("publication-only CLI normalization", () => {
  it("normalizes Yarn's string form, preserves metadata, and is idempotent", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(manifest.scripts.prepublishOnly).toBe("node scripts/prepare-publish.mjs");
    const first = prepare(manifest);
    expect(first.result.status, first.result.stderr).toBe(0);
    expect(first.contents).toEqual({ ...manifest, bin: { "agent-hooks": "dist/cli.js" } });
    const second = prepare(first.contents);
    expect(second.result.status, second.result.stderr).toBe(0);
    expect(second.contents).toEqual(first.contents);
  });

  it("preserves additional explicitly declared commands", () => {
    const manifest = { name: "@goodfoot/agent-hooks", bin: { "agent-hooks": "dist/cli.js", helper: "dist/helper.js" } };
    const output = prepare(manifest);
    expect(output.result.status, output.result.stderr).toBe(0);
    expect(output.contents).toEqual(manifest);
  });

  it.each([
    { name: "other-package", bin: "dist/cli.js" },
    { name: "@goodfoot/agent-hooks", bin: "wrong.js" },
    { name: "@goodfoot/agent-hooks", bin: "dist/cli.js", publishConfig: { bin: "wrong.js" } },
  ])("rejects invalid publishing metadata without changing it: %j", (manifest) => {
    const output = prepare(manifest);
    expect(output.result.status).not.toBe(0);
    expect(output.result.stderr).toContain("Refusing to publish");
    expect(output.contents).toEqual(manifest);
  });
});
