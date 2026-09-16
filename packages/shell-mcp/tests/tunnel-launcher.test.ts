import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { findPackageRoot, isTunnelCommand, tunnelArguments } from "../src/tunnel-launcher.js";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(sourceDirectory);

describe("the openai subcommand", () => {
  it("claims a leading openai word and nothing else", () => {
    expect(isTunnelCommand(["openai"])).toBe(true);
    expect(isTunnelCommand(["openai", "--port=38147"])).toBe(true);
    expect(isTunnelCommand([])).toBe(false);
    expect(isTunnelCommand(["--port=38147"])).toBe(false);
    expect(isTunnelCommand(["--help"])).toBe(false);
    expect(isTunnelCommand(["OPENAI"])).toBe(false);
  });

  it("passes every remaining argument to the launcher untouched", () => {
    expect(tunnelArguments(["openai"])).toEqual([]);
    expect(tunnelArguments(["openai", "--port=38147", "--", "--workdir=/srv"])).toEqual([
      "--port=38147",
      "--",
      "--workdir=/srv",
    ]);
  });
});

describe("package root discovery", () => {
  const scratch = mkdtempSync(join(tmpdir(), "shell-mcp-root-"));

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it("finds the installed package from a directory inside it", () => {
    expect(findPackageRoot(sourceDirectory)).toBe(packageRoot);
    expect(findPackageRoot(join(sourceDirectory, "fixtures"))).toBe(packageRoot);
  });

  it("holds the launcher that the openai subcommand runs", () => {
    expect(existsSync(join(findPackageRoot(sourceDirectory), "scripts", "start-tunnel.mjs"))).toBe(true);
  });

  it("walks past a manifest that is not this package", () => {
    const foreign = join(scratch, "foreign", "nested");
    mkdirSync(foreign, { recursive: true });
    writeFileSync(join(scratch, "foreign", "package.json"), '{"name":"@goodfoot/other"}\n');
    expect(() => findPackageRoot(foreign)).toThrow("no @goodfoot/shell-mcp package.json above");
  });

  it("refuses a manifest it cannot read", () => {
    const broken = join(scratch, "broken");
    mkdirSync(broken, { recursive: true });
    writeFileSync(join(broken, "package.json"), "{ not json");
    expect(() => findPackageRoot(broken)).toThrow(join(broken, "package.json"));
  });
});
