import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_PORT, isLocalOrSpecialHostname, normalizePublicUrl, parseArgs } from "../src/config.js";

describe("configuration", () => {
  it("defaults to loopback-only local mode", () => {
    expect(parseArgs([])).toMatchObject({ mode: "local", port: DEFAULT_PORT, bash: "/bin/bash", disablePty: false });
  });

  it("requires a deliberate public URL", () => {
    expect(parseArgs(["--mode=public", "--url=https://shell.example.net/"])).toMatchObject({
      mode: "public",
      publicUrl: "https://shell.example.net",
    });
    expect(() => parseArgs(["--mode=public"])).toThrow(ConfigError);
    expect(() => parseArgs(["--url=https://shell.example.net"])).toThrow(ConfigError);
  });

  it("rejects local and special-use public identities", () => {
    for (const url of [
      "https://localhost",
      "https://app.localhost",
      "https://127.10.20.30",
      "https://[::1]",
      "https://0.0.0.0",
      "https://10.0.0.1",
      "https://172.16.0.1",
      "https://192.168.0.1",
      "https://169.254.1.2",
      "https://224.0.0.1",
    ])
      expect(() => normalizePublicUrl(url), url).toThrow(ConfigError);
  });

  it("rejects ambiguous URLs and unsupported observation profiles", () => {
    expect(() => normalizePublicUrl("http://shell.example.net")).toThrow(ConfigError);
    expect(() => normalizePublicUrl("https://user@shell.example.net")).toThrow(ConfigError);
    expect(() => normalizePublicUrl("https://shell.example.net/?x=1")).toThrow(ConfigError);
    expect(() => parseArgs(["--max-wait-ms=60000"])).toThrow(ConfigError);
    expect(() => parseArgs(["--port=70000"])).toThrow(ConfigError);
  });

  it("recognizes loopback names and literals", () => {
    expect(isLocalOrSpecialHostname("localhost")).toBe(true);
    expect(isLocalOrSpecialHostname("127.99.1.2")).toBe(true);
    expect(isLocalOrSpecialHostname("[::1]")).toBe(true);
    expect(isLocalOrSpecialHostname("shell.example.net")).toBe(false);
  });

  it("rejects mapped, 6to4, shared, and documentation special-use identities", () => {
    for (const url of [
      "https://[::ffff:127.0.0.1]",
      "https://[::ffff:10.0.0.1]",
      "https://[2002:7f00:1::1]",
      "https://100.64.0.1",
      "https://192.0.2.1",
      "https://198.51.100.1",
      "https://203.0.113.1",
    ])
      expect(() => normalizePublicUrl(url), url).toThrow(ConfigError);
  });
});
