import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);

function packageDirectory(name: string, resolveFrom = require): string {
  let directory = dirname(resolveFrom.resolve(name));
  while (!existsSync(join(directory, "package.json"))) directory = dirname(directory);
  return directory;
}

it("loads the server when an incomplete SDK installation has CJS but lacks its advertised ESM entry", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "shell-mcp-sdk-packaging-"));
  try {
    const modules = join(scratch, "node_modules");
    for (const name of ["@modelcontextprotocol/server", "@modelcontextprotocol/node"]) {
      const target = join(modules, name);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(packageDirectory(name), target, { recursive: true });
    }
    const serverRequire = createRequire(join(packageDirectory("@modelcontextprotocol/server"), "package.json"));
    const nodeRequire = createRequire(join(packageDirectory("@modelcontextprotocol/node"), "package.json"));
    for (const [name, resolveFrom] of [
      ["@modelcontextprotocol/core", serverRequire],
      ["@hono/node-server", nodeRequire],
      ["hono", nodeRequire],
      ["zod", serverRequire],
    ] as const) {
      const target = join(modules, name);
      mkdirSync(dirname(target), { recursive: true });
      symlinkSync(packageDirectory(name, resolveFrom), target, "dir");
    }
    const server = join(modules, "@modelcontextprotocol/server");
    const manifest = JSON.parse(readFileSync(join(server, "package.json"), "utf8"));
    // Reproduce an incomplete SDK installation without touching the installed SDK.
    rmSync(join(server, manifest.exports["."].import.default), { force: true });
    expect(existsSync(join(server, manifest.exports["."].require.default))).toBe(true);

    const entry = join(scratch, "serve.mjs");
    await build({
      entryPoints: [fileURLToPath(new URL("../src/serve.ts", import.meta.url))],
      outfile: entry,
      bundle: true,
      packages: "external",
      platform: "node",
      format: "esm",
      logLevel: "silent",
    });
    const result = spawnSync(process.execPath, [entry], { encoding: "utf8", timeout: 10_000 });
    expect(result.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(result.status, result.stderr).toBe(0);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
