/**
 * Root-export surface lint (plan step 1.5), in two parts:
 *
 * (a) `src/index.ts` may only re-export from `./core*` — per-agent entry
 *     points live behind their own exports-map subpaths in later steps.
 * (b) the package `exports` map must be a closed list with no `./*` wildcard
 *     subpath, ever — a wildcard would make every internal module
 *     independently importable and silently defeat part (a).
 *
 * Both checks ship with fail-case fixtures: a green check that has never been
 * shown red is not evidence.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Extracts every static `from "<specifier>"` module specifier in a source
 * text. Export-lint granularity is deliberately source-level: it fails on any
 * import/export specifier outside the allowed prefix set.
 */
function extractModuleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /from\s+["']([^"']+)["']/g;
  let match = pattern.exec(source);
  while (match !== null) {
    specifiers.push(match[1] ?? "");
    match = pattern.exec(source);
  }
  return specifiers;
}

function assertOnlyCoreImports(source: string, filePath: string): void {
  const offenders = extractModuleSpecifiers(source).filter((specifier) => !specifier.startsWith("./core/"));
  if (offenders.length > 0) {
    throw new Error(
      `${filePath} imports outside ./core/: ${offenders.join(", ")} — the root export may expose core symbols only`,
    );
  }
}

interface PackageExportsFixture {
  exports: Record<string, unknown>;
}

function assertClosedExportMap(exportsMap: PackageExportsFixture["exports"]): void {
  const keys = Object.keys(exportsMap);
  if (!keys.includes(".")) {
    throw new Error(`exports map must declare "." — found: ${keys.join(", ")}`);
  }
  const wildcards = keys.filter((key) => key.includes("*"));
  if (wildcards.length > 0) {
    throw new Error(`exports map must be a closed list without wildcard subpaths — found: ${wildcards.join(", ")}`);
  }
}

describe("root-export lint", () => {
  it("src/index.ts imports from ./core/ modules only", () => {
    const source = readFileSync(resolve(PACKAGE_ROOT, "src/index.ts"), "utf-8");
    expect(() => assertOnlyCoreImports(source, "src/index.ts")).not.toThrow();
  });

  it("the index-import check rejects non-core specifiers (fail-case fixture)", () => {
    const offending = 'export { preToolUseHook } from "./agents/claude-code/hooks.js";\n';
    expect(() => assertOnlyCoreImports(offending, "fixture/index.ts")).toThrow(/outside \.\/core\//);
  });

  it("package.json exports declares exactly the closed entry list with no wildcard", () => {
    const pkg = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf-8")) as PackageExportsFixture;
    // Step 1 ships "." (core only); steps 2.3/3.8 add explicit per-agent
    // subpaths in the same steps their target files first exist. The list
    // stays closed — no "./*" wildcard, ever.
    expect(Object.keys(pkg.exports)).toStrictEqual([".", "./claude-code", "./codex", "./opencode"]);
    expect(pkg.exports["."]).toStrictEqual({
      import: "./dist/index.js",
      types: "./types/index.d.ts",
    });
    expect(pkg.exports["./claude-code"]).toStrictEqual({
      import: "./dist/agents/claude-code/index.js",
      types: "./types/agents/claude-code/index.d.ts",
    });
    expect(pkg.exports["./codex"]).toStrictEqual({
      import: "./dist/agents/codex/index.js",
      types: "./types/agents/codex/index.d.ts",
    });
    expect(pkg.exports["./opencode"]).toStrictEqual({
      import: "./dist/agents/opencode/index.js",
      types: "./types/agents/opencode/index.d.ts",
    });
    expect(() => assertClosedExportMap(pkg.exports)).not.toThrow();
  });

  it("the exports check rejects a temp ./* wildcard entry (fail-case fixture)", () => {
    const pkg = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf-8")) as PackageExportsFixture;
    const leaky = { ...pkg.exports, "./*": { import: "./dist/*.js", types: "./types/*.d.ts" } };
    expect(() => assertClosedExportMap(leaky)).toThrow(/wildcard/);
  });
});
