/**
 * Reproduction test for non-portable esbuild output when bundling through a
 * symlinked dependency.
 *
 * Scenario: two checkouts at different nesting depths both symlink their
 * `node_modules` to one shared install (e.g. a hoisted install shared across
 * checkouts). The CLI package lives in that shared install; Node's default
 * module resolution dereferences the symlink, so the CLI's `import.meta.url`
 * is the shared install's realpath.
 *
 * That realpath leaks into the compiled output in two ways:
 *
 * 1. **esbuild path resolution** — resolving a dependency through the
 *    symlinked `node_modules` without `preserveSymlinks` dereferences it to
 *    the shared realpath before computing `//` module-boundary comments and
 *    sourcemap `sources` entries relative to the process cwd (the checkout).
 *    Fixed by `preserveSymlinks: true` in `compileHook`'s esbuild options.
 *
 * 2. **The wrapper's own runtime import** — `compileHook` computes the
 *    synthetic entry wrapper's `import { execute } from '<path>'` specifier
 *    as `path.relative(resolveDir, dirname(import.meta.url)/runtime.js)`
 *    against the *realpathed* `import.meta.url` before esbuild ever sees it.
 *    The specifier is embedded verbatim in the wrapper, which esbuild records
 *    as the entry module's `sourcesContent`. The realpath sits outside the
 *    checkout, so the relative specifier grows extra `../` segments the
 *    deeper the checkout is nested — and because the whole runtime module
 *    graph is then resolved through that specifier, its sourcemap entries
 *    inherit the same depth dependence. `preserveSymlinks` cannot help here:
 *    the path was computed by JavaScript, not esbuild.
 *
 * To be faithful, this test does not run the workspace's copy of the CLI
 * (whose `import.meta.url` is a fixed workspace path). Instead it installs a
 * *physical* copy of this package's `src/` into the shared install and
 * invokes that copy through each checkout's symlinked `node_modules`, exactly
 * like a published package consumed from a shared install. The default
 * esbuild cwd is only re-evaluated per OS process, so both checkouts are
 * compiled by genuinely separate CLI child processes — like two real
 * checkouts built independently.
 *
 * The test asserts the compiled `.mjs` outputs are byte-identical, and that
 * the entry wrapper's `sourcesContent` runtime import is identical and
 * anchored inside the checkout (through `node_modules`, not a realpath
 * climb).
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

/** Path to tsx's CLI, used to run the TypeScript CLI entrypoint directly. */
const TSX_CLI_PATH = require.resolve("tsx/cli");

/** This package's real `src/` directory, copied into the shared install. */
const PACKAGE_SRC_DIR = path.join(__dirname, "..", "src");

/** The workspace install providing the copied package's npm dependencies. */
const WORKSPACE_NODE_MODULES = path.resolve(__dirname, "..", "..", "..", "node_modules");

describe("compileHook symlinked dependency reproducibility", () => {
  let baseDir: string;
  let sharedNodeModulesDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-symlink-repro-"));
    sharedNodeModulesDir = path.join(baseDir, "shared-node_modules");
    fs.mkdirSync(sharedNodeModulesDir, { recursive: true });
    installCliPackageIntoSharedInstall();
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  /**
   * Installs a physical copy of this package's `src/` into the shared
   * install, like a published package installed into a shared `node_modules`.
   * The copy must be physical, not a symlink: the whole bug rests on the
   * CLI's `import.meta.url` being the shared install's realpath while the
   * checkout only sees it through a symlink.
   */
  function installCliPackageIntoSharedInstall(): void {
    const cliPkgDir = path.join(sharedNodeModulesDir, "@goodfoot", "agent-hooks");
    fs.cpSync(PACKAGE_SRC_DIR, path.join(cliPkgDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(cliPkgDir, "package.json"),
      JSON.stringify({
        name: "@goodfoot/agent-hooks",
        version: "0.0.0-test",
        type: "module",
        // Point the package entry at the copied sources so a hook importing
        // `@goodfoot/agent-hooks` resolves into the shared install.
        exports: { ".": "./src/index.ts", "./claude-code": "./src/agents/claude-code/index.ts" },
      }),
      "utf-8",
    );
    // The shared install carries only this package; its npm dependencies
    // (esbuild, glob, typescript, the SDK) come from the workspace install.
    fs.symlinkSync(WORKSPACE_NODE_MODULES, path.join(cliPkgDir, "node_modules"), "dir");
  }

  /**
   * Creates a "checkout" directory at the given path whose node_modules is a
   * symlink to the shared install, containing a hook source file that imports
   * the CLI package (forcing esbuild to bundle a module resolved through the
   * symlink).
   */
  function createCheckout(checkoutDir: string): string {
    fs.mkdirSync(checkoutDir, { recursive: true });
    fs.symlinkSync(sharedNodeModulesDir, path.join(checkoutDir, "node_modules"), "dir");

    const hookPath = path.join(checkoutDir, "my-hook.ts");
    fs.writeFileSync(
      hookPath,
      [
        `import { stopHook, getProjectDir } from '@goodfoot/agent-hooks/claude-code';`,
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

  /** Compiles the hook in `checkoutDir` by invoking the shared-install CLI through the checkout's symlinked node_modules, and returns the generated .mjs content. */
  function compileViaCli(checkoutDir: string, hookPath: string): string {
    const cliPath = path.join(checkoutDir, "node_modules", "@goodfoot", "agent-hooks", "src", "cli.ts");
    const hooksJsonPath = path.join(checkoutDir, "hooks.json");
    const result = spawnSync(
      process.execPath,
      [TSX_CLI_PATH, cliPath, "--agent", "claude-code", "-i", hookPath, "-o", hooksJsonPath, "--sourcemap"],
      {
        cwd: checkoutDir,
        encoding: "utf-8",
      },
    );
    if (result.status !== 0) {
      throw new Error(`CLI compile failed (exit ${String(result.status)}):\n${result.stdout}\n${result.stderr}`);
    }
    const mjsPath = path.join(checkoutDir, "bin", "my-hook.mjs");
    return fs.readFileSync(mjsPath, "utf-8");
  }

  /**
   * Decodes the inline sourcemap and returns the `sourcesContent` of the
   * synthetic entry wrapper (esbuild's `sourcefile` for the stdin contents,
   * named `${hookBaseName}-entry.ts`).
   */
  function extractEntryWrapperSource(content: string): string {
    const sourcemapMatch = /sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/.exec(content);
    if (sourcemapMatch === null) {
      throw new Error("Could not find inline sourcemap in compiled output");
    }
    const sourcemap = JSON.parse(Buffer.from(sourcemapMatch[1], "base64").toString("utf-8"));
    const entryIndex = sourcemap.sources.findIndex((source: string) => source.endsWith("-entry.ts"));
    if (entryIndex === -1) {
      throw new Error("Could not find entry wrapper source in sourcemap");
    }
    return sourcemap.sourcesContent[entryIndex];
  }

  /**
   * Compiles the same hook from a shallow and a deeply nested checkout that
   * both symlink node_modules to one shared install, and returns the two
   * compiled outputs.
   */
  function compileFromShallowAndDeepCheckouts(): { shallowContent: string; deepContent: string } {
    // A shallow checkout, one level below baseDir.
    const shallowCheckout = path.join(baseDir, "shallow", "checkout");
    // A deeply nested checkout, several levels below baseDir.
    const deepCheckout = path.join(baseDir, "deep", "a", "b", "c", "d", "e", "f", "g", "checkout");

    const shallowContent = compileViaCli(shallowCheckout, createCheckout(shallowCheckout));
    const deepContent = compileViaCli(deepCheckout, createCheckout(deepCheckout));
    return { shallowContent, deepContent };
  }

  it("produces byte-identical compiled output regardless of checkout nesting depth", () => {
    const { shallowContent, deepContent } = compileFromShallowAndDeepCheckouts();

    // Both checkouts compile the same logical hook through a symlinked
    // node_modules pointing at the same shared install; every byte of the
    // compiled output — module-boundary comments, sourcemap `sources`, and
    // `sourcesContent` — must be independent of how deeply the checkout
    // happens to be nested on disk.
    expect(deepContent).toBe(shallowContent);
  }, 60000);

  it("embeds a checkout-depth-independent runtime import in the entry wrapper's sourcesContent", () => {
    const { shallowContent, deepContent } = compileFromShallowAndDeepCheckouts();

    const shallowEntry = extractEntryWrapperSource(shallowContent);
    const deepEntry = extractEntryWrapperSource(deepContent);

    // The wrapper's `import { execute } from '...'` specifier is computed from
    // the realpathed `import.meta.url` of the CLI module; it must not vary
    // with checkout depth.
    expect(deepEntry).toBe(shallowEntry);

    // The specifier must stay anchored inside the checkout through its own
    // node_modules symlink. A realpath-derived specifier would climb out of
    // the checkout with `../` segments whose count varies by nesting depth.
    expect(shallowEntry).toContain(
      `import { execute } from './node_modules/@goodfoot/agent-hooks/src/agents/claude-code/transport`,
    );
  }, 60000);
});
