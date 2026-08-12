/**
 * Reproduction test for non-reproducible esbuild output across install
 * topologies: compiling the same hook sources with the same CLI version and
 * locked deps produces semantically identical but byte-different bundles when
 * the package directory is reached through different path forms.
 *
 * Two topologies, same physical sources, same CLI version, same hook:
 *
 * 1. **Single-path topology (checkoutS)** — the package directory is
 *    physically installed under the checkout's own `node_modules`. The CLI's
 *    `import.meta.url` is checkout-local, so `symlinkVisiblePath` finds a
 *    `node_modules` ancestor whose realpath contains the runtime realpath and
 *    re-roots the runtime import specifier through it. The wrapper imports
 *    `./node_modules/@goodfoot/claude-code-hooks/src/runtime.js`, so the
 *    runtime subtree shares one source identity with the barrel: esbuild
 *    emits the modules contiguously, once each.
 *
 * 2. **Dual-path topology (checkoutD)** — the package directory is a
 *    directory symlink out of the checkout to the same physical copy. Node
 *    dereferences the symlink by default, so the CLI's `import.meta.url` is
 *    the physical copy's realpath, outside the checkout. `symlinkVisiblePath`
 *    walks `resolveDir`'s ancestors for a `node_modules` whose realpath
 *    contains that realpath and finds none (the checkout's own node_modules
 *    is a different directory), so it falls back to the raw absolute
 *    realpath. The wrapper's runtime specifier becomes
 *    `../checkoutS/node_modules/...` — esbuild sees the runtime subtree as a
 *    SEPARATE source identity from the barrel's, so the module graph is
 *    emitted interleaved with duplicated modules (double `env.ts`,
 *    `logger.ts`, `outputs.ts`), with esbuild collision-suffix renames
 *    (`EXIT_CODES` vs `EXIT_CODES2`) and a measurably larger bundle.
 *
 * 3. **Sibling-source-tree topology (checkoutE)** — the package directory is
 *    the checkout's OWN source tree: a physical `packages/claude-code-hooks`
 *    directory, with the checkout's `node_modules/@goodfoot/claude-code-hooks`
 *    a directory symlink back into it (`../../packages/claude-code-hooks`).
 *    This is the workspace-monorepo shape the repo itself uses. Node
 *    dereferences the symlink, so the CLI's `import.meta.url` is again the
 *    physical realpath — but here the runtime's nearest `node_modules`
 *    ancestor does not exist at all (the package lives under `packages/`,
 *    not under any `node_modules`), so both the ancestor walk and the
 *    store-link recognition miss it and the wrapper specifier falls back to
 *    a realpath whose relative form depends on the checkout's nesting depth
 *    below the shared install. The same sources compiled from checkouts at
 *    different depths emit different boundary-comment bytes.
 *
 * The invariant under test: for a fixed CLI version, fixed source tree, and
 * fixed hook, the emitted bundle bytes must be identical regardless of
 * install topology.
 *
 * To be faithful, this test does not run the workspace's copy of the CLI
 * (whose `import.meta.url` is a fixed workspace path). Instead it copies this
 * package's real `src/` into the checkout's `node_modules` and invokes that
 * copy through a genuine CLI child process, exactly like a published package
 * consumed from an install. Both builds bundle byte-identical package
 * content; only the path form differs.
 *
 * The test asserts the compiled `.mjs` outputs are byte-identical, and that
 * the single-path wrapper's `sourcesContent` runtime import is anchored
 * inside the checkout (through `node_modules`, not a realpath climb).
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

/** This package's real `src/` directory, copied into the checkout install. */
const PACKAGE_SRC_DIR = path.join(__dirname, "..", "src");

/** The workspace install providing the copied package's npm dependencies. */
const WORKSPACE_NODE_MODULES = path.resolve(__dirname, "..", "..", "..", "node_modules");

describe("compileHook install-topology reproducibility", () => {
  let baseDir: string;
  let checkoutS: string;
  let checkoutD: string;
  let checkoutE: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-topology-repro-"));
    checkoutS = path.join(baseDir, "checkoutS");
    checkoutD = path.join(baseDir, "checkoutD");
    checkoutE = path.join(baseDir, "checkoutE");

    // checkoutS: the package directory is a physical copy under the
    // checkout's own node_modules — the single-path topology.
    fs.mkdirSync(path.join(checkoutS, "node_modules", "@goodfoot"), { recursive: true });
    installPhysicalCliPackage(path.join(checkoutS, "node_modules", "@goodfoot", "claude-code-hooks"));

    // checkoutD: an identical checkout, but the package directory is a
    // directory symlink to the same physical copy — the dual-path topology.
    // Both builds bundle byte-identical package content; only the path form
    // differs.
    fs.mkdirSync(path.join(checkoutD, "node_modules", "@goodfoot"), { recursive: true });
    fs.symlinkSync(
      path.join(checkoutS, "node_modules", "@goodfoot", "claude-code-hooks"),
      path.join(checkoutD, "node_modules", "@goodfoot", "claude-code-hooks"),
      "dir",
    );

    // checkoutE: the package directory is the checkout's own source tree —
    // a physical `packages/claude-code-hooks` copy, with the checkout's
    // node_modules entry a directory symlink back into it. The sibling-
    // source-tree topology (the workspace-monorepo shape the repo itself
    // uses): the runtime's realpath is inside the checkout, yet under no
    // node_modules at all.
    fs.mkdirSync(path.join(checkoutE, "node_modules", "@goodfoot"), { recursive: true });
    installPhysicalCliPackage(path.join(checkoutE, "packages", "claude-code-hooks"));
    fs.symlinkSync(
      path.join("..", "..", "packages", "claude-code-hooks"),
      path.join(checkoutE, "node_modules", "@goodfoot", "claude-code-hooks"),
      "dir",
    );
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  /**
   * Installs a physical copy of this package's `src/` at the given package
   * directory, like a published package installed locally. The copy must be
   * physical, not a symlink: the whole bug rests on the CLI's
   * `import.meta.url` being the physical copy's realpath when the package
   * directory is symlinked out of the checkout.
   */
  function installPhysicalCliPackage(cliPkgDir: string): void {
    fs.cpSync(PACKAGE_SRC_DIR, path.join(cliPkgDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(cliPkgDir, "package.json"),
      JSON.stringify({
        name: "@goodfoot/claude-code-hooks",
        version: "0.0.0-test",
        type: "module",
        // Point the package entry at the copied sources so a hook importing
        // `@goodfoot/claude-code-hooks` resolves into the checkout install.
        exports: { ".": "./src/index.ts" },
      }),
      "utf-8",
    );
    // The checkout install carries only this package; its npm dependencies
    // (esbuild, glob, typescript, the SDK) come from the workspace install.
    fs.symlinkSync(WORKSPACE_NODE_MODULES, path.join(cliPkgDir, "node_modules"), "dir");
  }

  /**
   * Creates a "checkout" directory at the given path containing a hook source
   * file that imports the CLI package (forcing esbuild to bundle a module
   * resolved through the checkout's node_modules), and returns the hook path.
   */
  function createHookFile(checkoutDir: string): string {
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

  /**
   * Compiles the hook in `checkoutDir` by invoking the installed CLI through
   * the checkout's own node_modules, and returns the generated .mjs content.
   */
  function compileViaCli(checkoutDir: string, hookPath: string): string {
    const cliPath = path.join(checkoutDir, "node_modules", "@goodfoot", "claude-code-hooks", "src", "cli.ts");
    const hooksJsonPath = path.join(checkoutDir, "hooks.json");
    const result = spawnSync(process.execPath, [TSX_CLI_PATH, cliPath, "-i", hookPath, "-o", hooksJsonPath], {
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
   * Compiles the same hook from every checkout — single-path (physical
   * package install), dual-path (package directory symlinked out of the
   * checkout), and sibling-source-tree (package directory symlinked out of
   * node_modules into the checkout's own source tree) — and returns the
   * compiled outputs.
   */
  function compileFromEveryTopology(): {
    checkoutSContent: string;
    checkoutDContent: string;
    checkoutEContent: string;
  } {
    return {
      checkoutSContent: compileViaCli(checkoutS, createHookFile(checkoutS)),
      checkoutDContent: compileViaCli(checkoutD, createHookFile(checkoutD)),
      checkoutEContent: compileViaCli(checkoutE, createHookFile(checkoutE)),
    };
  }

  it("produces byte-identical compiled output regardless of install topology", () => {
    const { checkoutSContent, checkoutDContent } = compileFromEveryTopology();

    // Both checkouts compile the same hook from the same physical package
    // sources with the same CLI version and the same locked deps; only the
    // path form of the install differs. Every byte of the compiled output —
    // module order, collision suffixes, module-boundary comments, and
    // sourcesContent — must be independent of install topology.
    expect(checkoutDContent).toBe(checkoutSContent);
  }, 60000);

  it("produces byte-identical output when the package is symlinked out of node_modules into the checkout's own source tree", () => {
    const { checkoutSContent, checkoutEContent } = compileFromEveryTopology();

    // The sibling-source-tree topology: the package directory is the
    // checkout's own `packages/claude-code-hooks` physical copy and the
    // checkout's node_modules entry is a symlink back into it (the shape the
    // repo itself uses). The runtime's realpath is under no node_modules at
    // all, so a realpath fallback would make the wrapper specifier — and the
    // module-boundary comments of the runtime subtree — depend on how deeply
    // the checkout is nested. The output must match the single-path topology
    // byte for byte.
    expect(checkoutEContent).toBe(checkoutSContent);
  }, 60000);

  it("anchors the single-path wrapper's runtime import inside the checkout's node_modules", () => {
    const { checkoutSContent } = compileFromEveryTopology();

    const entryWrapper = extractEntryWrapperSource(checkoutSContent);

    // In the single-path topology `symlinkVisiblePath` re-roots the runtime
    // through the checkout's own node_modules, so the wrapper's specifier is
    // `./node_modules/@goodfoot/claude-code-hooks/src/runtime.js` — anchored
    // inside the checkout, not a realpath climb. This is the mechanism whose
    // failure in the dual-path topology makes the bundle bytes diverge.
    expect(entryWrapper).toContain(`import { execute } from './node_modules/@goodfoot/claude-code-hooks/src/runtime`);
  }, 60000);
});
