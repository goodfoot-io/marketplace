/**
 * Reproduction test for non-portable module-boundary comments when bundling
 * through a symlinked dependency.
 *
 * When the `claude-code-hooks` CLI's esbuild-based `-i <glob> -o <path>`
 * compile step (`compileHook` in packages/claude-code-hooks/src/cli.ts)
 * resolves a dependency through a symlinked `node_modules` (e.g. two
 * checkouts sharing one hoisted/symlinked install at different nesting
 * depths), esbuild's default `preserveSymlinks: false` dereferences the
 * symlink to its realpath before computing the `//` module-boundary
 * comments (and inline sourcemap `sources`/`sourcesContent` entries)
 * relative to `process.cwd()`. Because `absWorkingDir` is never passed to
 * esbuild, this relative path is checkout-depth-dependent: a checkout
 * nested more deeply below the shared realpath produces a longer run of
 * `../` segments than a shallow one, even though both checkouts are
 * semantically identical. This makes the compiled `.mjs` output
 * non-reproducible across checkouts.
 *
 * The default esbuild cwd is only re-evaluated per OS process (it is not
 * reliably re-read after an in-process `process.chdir()` once esbuild's
 * internal build service has started), so this must be reproduced across
 * two genuinely separate CLI invocations - exactly like two real checkouts
 * being built independently. This test follows the same pattern as the
 * existing e2e helpers in `packages/claude-code-hooks/e2e/setup.ts`: it
 * spawns the real CLI entrypoint (`src/cli.ts`, run via `tsx`) as a child
 * process with `cwd` set to each synthetic checkout root.
 *
 * The test builds two synthetic checkouts at different nesting depths that
 * both symlink `node_modules` to one shared directory containing a fake
 * `@goodfoot/claude-code-hooks` package, compiles the same hook source from
 * each checkout by invoking the CLI binary, and asserts the two compiled
 * `.mjs` outputs are byte-identical. It currently fails because the two
 * outputs differ in exactly the symlink-realpath-derived module-boundary
 * comment (and sourcemap) path for the dependency resolved through the
 * symlinked `node_modules`.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/** Path to the real CLI entrypoint under test. */
const CLI_PATH = path.join(__dirname, "..", "src", "cli.ts");

/** Path to tsx's CLI, used to run the TypeScript CLI entrypoint directly, resolved from this package's own install so it works regardless of the synthetic checkout's cwd. */
const TSX_CLI_PATH = require.resolve("tsx/cli");

describe("compileHook symlinked dependency reproducibility", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-symlink-repro-"));
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  /**
   * Writes a minimal, resolvable stub of `@goodfoot/claude-code-hooks` into
   * `nodeModulesDir` so a hook file can `import` from it. It does not need
   * to be the real built package - only something Node's/esbuild's resolver
   * can find, exporting the one hook factory the fixture hook uses.
   */
  function writeFakeLibraryPackage(nodeModulesDir: string): void {
    const pkgDir = path.join(nodeModulesDir, "@goodfoot", "claude-code-hooks");
    const distDir = path.join(pkgDir, "dist");
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({
        name: "@goodfoot/claude-code-hooks",
        version: "0.0.0-test",
        type: "module",
        main: "./dist/env.js",
      }),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(distDir, "env.js"),
      [
        `export function getProjectDir() { return process.cwd(); }`,
        ``,
        `export function stopHook(config, handler) {`,
        `  const fn = (input, context) => handler(input, context);`,
        `  fn.hookEventName = "Stop";`,
        `  fn.matcher = config && config.matcher;`,
        `  fn.timeout = config && config.timeout;`,
        `  return fn;`,
        `}`,
        ``,
      ].join("\n"),
      "utf-8",
    );
  }

  /**
   * Creates a "checkout" directory at the given path whose node_modules is a
   * symlink to `sharedNodeModulesDir`, containing a hook source file that
   * imports the fake library package (forcing esbuild to bundle a module
   * resolved through the symlink).
   */
  function createCheckout(checkoutDir: string, sharedNodeModulesDir: string): string {
    fs.mkdirSync(checkoutDir, { recursive: true });
    fs.symlinkSync(sharedNodeModulesDir, path.join(checkoutDir, "node_modules"), "dir");

    const hookPath = path.join(checkoutDir, "my-hook.ts");
    fs.writeFileSync(
      hookPath,
      [
        `import { stopHook, getProjectDir } from '@goodfoot/claude-code-hooks';`,
        ``,
        `export default stopHook({}, (input) => {`,
        `  return { dir: getProjectDir(), input };`,
        `});`,
        ``,
      ].join("\n"),
      "utf-8",
    );
    return hookPath;
  }

  /** Compiles the hook at `hookPath` by spawning the real CLI with `cwd` set to `checkoutDir`, and returns the generated .mjs content. */
  function compileViaCli(checkoutDir: string, hookPath: string): string {
    const hooksJsonPath = path.join(checkoutDir, "hooks.json");
    const result = spawnSync(process.execPath, [TSX_CLI_PATH, CLI_PATH, "-i", hookPath, "-o", hooksJsonPath], {
      cwd: checkoutDir,
      encoding: "utf-8",
    });
    if (result.status !== 0) {
      throw new Error(`CLI compile failed (exit ${String(result.status)}):\n${result.stdout}\n${result.stderr}`);
    }
    const mjsPath = path.join(checkoutDir, "bin", "my-hook.mjs");
    return fs.readFileSync(mjsPath, "utf-8");
  }

  /**
   * Extracts the esbuild module-boundary comment line for the bundled
   * dependency resolved through the symlinked node_modules (identified by
   * the fake package's `dist/env.js` file), ignoring unrelated lines (e.g.
   * the synthetic entry wrapper's own import of `runtime.js`, whose
   * checkout-depth-dependent relative path stems from a separate,
   * non-esbuild mechanism - Node's own realpath-following resolution of
   * `import.meta.url` for the CLI module itself - and is out of scope for
   * this reproduction, which targets only the esbuild
   * `preserveSymlinks`-controlled pathway).
   */
  function extractDependencyModuleComment(content: string): string {
    const match = /^\/\/ .*claude-code-hooks\/dist\/env\.js$/m.exec(content);
    if (match === null) {
      throw new Error(`Could not find module-boundary comment for the fake dependency in:\n${content}`);
    }
    return match[0];
  }

  it("produces a byte-identical module-boundary comment for the symlinked dependency regardless of checkout nesting depth", () => {
    // One shared physical node_modules directory containing the fake library.
    const sharedNodeModulesDir = path.join(baseDir, "shared-node_modules");
    fs.mkdirSync(sharedNodeModulesDir, { recursive: true });
    writeFakeLibraryPackage(sharedNodeModulesDir);

    // A shallow checkout, one level below baseDir.
    const shallowCheckout = path.join(baseDir, "shallow", "checkout");
    // A deeply nested checkout, several levels below baseDir.
    const deepCheckout = path.join(baseDir, "deep", "a", "b", "c", "d", "e", "f", "g", "checkout");

    const shallowHookPath = createCheckout(shallowCheckout, sharedNodeModulesDir);
    const deepHookPath = createCheckout(deepCheckout, sharedNodeModulesDir);

    const shallowContent = compileViaCli(shallowCheckout, shallowHookPath);
    const deepContent = compileViaCli(deepCheckout, deepHookPath);

    const shallowComment = extractDependencyModuleComment(shallowContent);
    const deepComment = extractDependencyModuleComment(deepContent);

    // Both checkouts compile the same logical hook through a symlinked
    // node_modules pointing at the same shared package; the module-boundary
    // comment esbuild emits for that shared dependency should not depend on
    // how deeply the checkout happens to be nested on disk.
    expect(deepComment).toBe(shallowComment);
  }, 30000);
});
