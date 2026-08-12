/**
 * Reproduction test for topology-dependent (non-reproducible) esbuild output
 * when the hook runtime is reachable through two different paths — the
 * codex-hooks twin of the hand-validated topology repro for
 * `packages/claude-code-hooks`.
 *
 * Scenario: the same hook is compiled twice from two checkouts that contain
 * byte-identical copies of `@goodfoot/codex-hooks` (same version, same source
 * tree, same lockfile) but install it differently:
 *
 * - **Single-path topology** — the package directory is physically copied
 *   under the checkout's own `node_modules`. The CLI's `import.meta.url`, the
 *   hook's import of `@goodfoot/codex-hooks`, and the synthetic entry
 *   wrapper's runtime import all resolve to the same file identity, so esbuild
 *   emits one contiguous copy of the runtime module graph.
 *
 * - **Dual-path topology** — the checkout's `node_modules/@goodfoot/codex-hooks`
 *   is a directory symlink to the physical copy inside the first checkout (an
 *   external install / npx cache reached through a symlink). Node dereferences
 *   the symlink, so the CLI's `import.meta.url` is the *external* realpath, and
 *   `symlinkVisiblePath` in `compileHook` must re-root the runtime through the
 *   checkout's own `node_modules` symlink. The wrapper's runtime import must be
 *   anchored inside the checkout through that symlink form (never a `../`
 *   climb to the external realpath) — otherwise esbuild sees the runtime
 *   subtree under a second, distinct path identity, emitting the whole graph
 *   twice, interleaved, with collision-suffix renames (`EXIT_CODES2`) and a
 *   substantially larger bundle.
 *
 * The invariant under test: for a fixed CLI version, fixed source tree, and
 * fixed hook, the emitted bundle bytes must be identical regardless of install
 * topology. Today they are not — the byte-identity assertion below fails.
 *
 * Like the sibling depth repro, this test runs the CLI as a real child process
 * from each checkout so that `import.meta.url` is genuinely resolved through
 * each topology's path form (Node dereferences symlinks by default). Both
 * checkouts bundle the exact same physical package copy; only the path form
 * differs.
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

/** This package's real `src/` directory, physically copied into the checkouts. */
const PACKAGE_SRC_DIR = path.join(__dirname, "..", "src");

/** The workspace install providing the copied package's npm dependencies. */
const WORKSPACE_NODE_MODULES = path.resolve(__dirname, "..", "..", "..", "node_modules");

describe("compileHook install-topology reproducibility", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-cli-topology-repro-"));
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  /**
   * Single-path topology: the package directory is a physical copy under the
   * checkout's own node_modules, so the CLI's `import.meta.url` is
   * checkout-local. The package's npm dependencies (esbuild, glob,
   * typescript) come from the workspace install through a node_modules
   * symlink rooted inside the package directory — below `resolveDir`, so it
   * never shows up in `symlinkVisiblePath`'s ancestor walk.
   */
  function createSinglePathCheckout(): string {
    const checkoutDir = path.join(baseDir, "checkout-single-path");
    const pkgDir = path.join(checkoutDir, "node_modules", "@goodfoot", "codex-hooks");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.cpSync(PACKAGE_SRC_DIR, path.join(pkgDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({
        name: "@goodfoot/codex-hooks",
        version: "0.0.0-test",
        type: "module",
        // Point the package entry at the copied sources so a hook importing
        // `@goodfoot/codex-hooks` resolves into the physical copy.
        exports: { ".": "./src/index.ts" },
      }),
      "utf-8",
    );
    fs.symlinkSync(WORKSPACE_NODE_MODULES, path.join(pkgDir, "node_modules"), "dir");
    return checkoutDir;
  }

  /**
   * Dual-path topology: identical checkout, but the package directory is a
   * symlink out of the checkout to the single-path physical copy. Both
   * builds bundle byte-identical package content; only the path form differs.
   */
  function createDualPathCheckout(singlePathCheckout: string): string {
    const checkoutDir = path.join(baseDir, "checkout-dual-path");
    fs.mkdirSync(path.join(checkoutDir, "node_modules", "@goodfoot"), { recursive: true });
    fs.symlinkSync(
      path.join(singlePathCheckout, "node_modules", "@goodfoot", "codex-hooks"),
      path.join(checkoutDir, "node_modules", "@goodfoot", "codex-hooks"),
      "dir",
    );
    return checkoutDir;
  }

  /** Writes the same hook source into the given checkout and returns its path. */
  function writeHook(checkoutDir: string): string {
    const hookPath = path.join(checkoutDir, "my-hook.ts");
    fs.writeFileSync(
      hookPath,
      [
        `import { stopHook, PACKAGE_NAME, EXIT_CODES } from '@goodfoot/codex-hooks';`,
        ``,
        `export default stopHook({}, (input) => {`,
        `  return { name: PACKAGE_NAME, exitCode: EXIT_CODES.SUCCESS, input };`,
        `});`,
        ``,
      ].join("\n"),
      "utf-8",
    );
    return hookPath;
  }

  /** Compiles the hook in `checkoutDir` via the checkout's own CLI copy and returns the generated .mjs content. */
  function compileViaCli(checkoutDir: string, hookPath: string): string {
    const cliPath = path.join(checkoutDir, "node_modules", "@goodfoot", "codex-hooks", "src", "cli.ts");
    const hooksJsonPath = path.join(checkoutDir, "hooks.json");
    // --stable-names pins the output filename to my-hook.mjs; without it the
    // standalone context emits a content-hashed filename we could not find.
    const result = spawnSync(
      process.execPath,
      [TSX_CLI_PATH, cliPath, "-i", hookPath, "-o", hooksJsonPath, "--stable-names"],
      { cwd: checkoutDir, encoding: "utf-8" },
    );
    if (result.status !== 0) {
      throw new Error(`CLI compile failed (exit ${String(result.status)}):\n${result.stdout}\n${result.stderr}`);
    }
    const mjsPath = path.join(checkoutDir, "my-hook.mjs");
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

  it("produces byte-identical compiled output regardless of install topology", () => {
    const singlePathCheckout = createSinglePathCheckout();
    const dualPathCheckout = createDualPathCheckout(singlePathCheckout);

    const singlePathContent = compileViaCli(singlePathCheckout, writeHook(singlePathCheckout));
    const dualPathContent = compileViaCli(dualPathCheckout, writeHook(dualPathCheckout));

    // Mechanism pin: in the single-path topology the wrapper's runtime import
    // is anchored inside the checkout through its own node_modules. (codex-hooks'
    // wrapper quotes its specifiers with double quotes via JSON.stringify.)
    const singlePathEntry = extractEntryWrapperSource(singlePathContent);
    expect(singlePathEntry).toContain(`import { execute } from "./node_modules/@goodfoot/codex-hooks/src/runtime`);

    // The dual-path wrapper must anchor inside its own checkout too — the
    // runtime is reached through the checkout's node_modules symlink form, so
    // esbuild records one module identity regardless of install topology.
    const dualPathEntry = extractEntryWrapperSource(dualPathContent);
    expect(dualPathEntry).toContain(`import { execute } from "./node_modules/@goodfoot/codex-hooks/src/runtime`);

    // Both checkouts compile the same logical hook against the same physical
    // package copy; every byte of the compiled output must be independent of
    // whether the package directory sits inside the checkout or is reached
    // through a symlink to an external install.
    expect(dualPathContent).toBe(singlePathContent);
  }, 60000);
});
