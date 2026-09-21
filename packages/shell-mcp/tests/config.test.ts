import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigError, DEFAULT_PORT, parseArgs, USAGE, UsageRequested } from "../src/config.js";

describe("configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("resolves SHELL_MCP_LOG from the launch directory, not --workdir", () => {
    vi.stubEnv("SHELL_MCP_LOG", "./diagnostics.jsonl");
    expect(parseArgs(["--workdir=/tmp"]).logFile).toBe(resolve("./diagnostics.jsonl"));
    vi.stubEnv("SHELL_MCP_LOG", "");
    expect(parseArgs([]).logFile).toBeUndefined();
    vi.stubEnv("SHELL_MCP_LOG", undefined);
    expect(parseArgs([]).logFile).toBeUndefined();
  });

  it("defaults to a loopback server with no external identity", () => {
    expect(parseArgs([])).toMatchObject({
      port: DEFAULT_PORT,
      bash: "/bin/bash",
      disablePty: false,
      limits: { operationIds: 64 },
    });
  });

  it("rejects the retired public-identity options", () => {
    expect(() => parseArgs(["--mode=public"])).toThrow(ConfigError);
    expect(() => parseArgs(["--mode=local"])).toThrow(ConfigError);
    expect(() => parseArgs(["--url=https://shell.example.net"])).toThrow(ConfigError);
  });

  it("accepts and resolves each documented option", () => {
    const config = parseArgs([
      "--port=0",
      "--ready-file=./ready.json",
      "--bash=/bin/sh",
      "--workdir=./work",
      "--spool-dir=./spool",
      "--disable-pty",
    ]);
    expect(config).toMatchObject({
      port: 0,
      readyFile: resolve("./ready.json"),
      bash: "/bin/sh",
      workdir: resolve("./work"),
      spoolRoot: resolve("./spool"),
      disablePty: true,
    });
  });

  it("documents every flag it accepts", () => {
    for (const flag of [
      "--port",
      "--ready-file",
      "--bash",
      "--workdir",
      "--spool-dir",
      "--max-wait-ms",
      "--disable-pty",
      "--help",
    ])
      expect(USAGE, flag).toContain(flag);
  });

  it("rejects unknown, repeated, malformed, and out-of-range options", () => {
    expect(() => parseArgs(["--max-wait-ms=60000"])).toThrow(ConfigError);
    expect(() => parseArgs(["--port=70000"])).toThrow(ConfigError);
    expect(() => parseArgs(["--port=three"])).toThrow(ConfigError);
    expect(() => parseArgs(["--ready-file="])).toThrow(ConfigError);
    expect(() => parseArgs(["--bash="])).toThrow(ConfigError);
    expect(() => parseArgs(["--port=1", "--port=2"])).toThrow(ConfigError);
    expect(() => parseArgs(["positional"])).toThrow(ConfigError);
  });

  it("carries a caller-supplied observation wait into the limits", () => {
    expect(parseArgs(["--max-wait-ms=0"]).limits?.maxWaitMs).toBe(0);
    expect(parseArgs([]).limits?.maxWaitMs).toBe(20_000);
  });

  it("treats --help as a request for usage rather than an error", () => {
    expect(() => parseArgs(["--help"])).toThrow(UsageRequested);
  });
});
