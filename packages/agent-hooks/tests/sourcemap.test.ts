/**
 * Unit tests for compileHook's inline-sourcemap behavior.
 *
 * The CLI embeds an inline sourcemap in compiled bundles by default so stack
 * traces map back to original TypeScript source. `--no-sourcemap` (threaded
 * through as `CompileHookOptions.sourcemap === false`) skips the second
 * esbuild pass and emits pass-1 (sourcemap-free) output directly.
 *
 * These checks pin down the flag contract:
 * - default output carries the inline `sourceMappingURL` comment;
 * - `sourcemap: false` output carries none;
 * - the content hash is identical in both modes (it is always derived from
 *   pass-1 output);
 * - the sourcemap-free output is byte-identical to the default output with the
 *   trailing `sourceMappingURL` line stripped (the spike result from
 *   notes/sourcemap-build-equivalence.md, guarding against esbuild upgrades).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compileHook } from "../src/cli.js";

describe("compileHook sourcemap behavior", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sourcemap-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /** Writes a minimal self-contained hook (no package imports) into the temp dir. */
  function writeHookFile(): string {
    const filePath = path.join(tempDir, "test-hook.ts");
    fs.writeFileSync(
      filePath,
      [`export default function (input: Record<string, unknown>) {`, `  return { allow: true };`, `}`, ``].join("\n"),
      "utf-8",
    );
    return filePath;
  }

  it("embeds an inline sourcemap in the compiled content by default", async () => {
    const sourcePath = writeHookFile();
    const result = await compileHook({ sourcePath, outputDir: tempDir, loaders: {} });

    expect(result.content).toContain("sourceMappingURL=data:application/json;base64,");
  });

  it("omits the sourceMappingURL comment when sourcemap is false", async () => {
    const sourcePath = writeHookFile();
    const result = await compileHook({ sourcePath, outputDir: tempDir, loaders: {}, sourcemap: false });

    expect(result.content).not.toContain("sourceMappingURL");
  });

  it("derives the same content hash with and without sourcemaps", async () => {
    const sourcePath = writeHookFile();
    const withSourcemap = await compileHook({ sourcePath, outputDir: tempDir, loaders: {} });
    const withoutSourcemap = await compileHook({ sourcePath, outputDir: tempDir, loaders: {}, sourcemap: false });

    expect(withoutSourcemap.contentHash).toBe(withSourcemap.contentHash);
  });

  it("emits pass-1 content identical to default content minus the sourceMappingURL line", async () => {
    const sourcePath = writeHookFile();
    const withSourcemap = await compileHook({ sourcePath, outputDir: tempDir, loaders: {} });
    const withoutSourcemap = await compileHook({ sourcePath, outputDir: tempDir, loaders: {}, sourcemap: false });

    const strippedDefault = withSourcemap.content.replace(
      /\n\/\/# sourceMappingURL=data:application\/json;base64,[^\n]*\n?$/,
      "\n",
    );
    expect(withoutSourcemap.content).toBe(strippedDefault);
  });
});
