import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseArgs, run } from "../../src/bin/expansion.js";

let tempDir: string;
let storePath: string;
let mockHomeDir = "";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: () => mockHomeDir,
  };
});

beforeEach(() => {
  tempDir = join(tmpdir(), `expansion-bin-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  storePath = join(tempDir, ".expansion.json");
  mockHomeDir = tempDir;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("parseArgs", () => {
  it("--list parses to list action", () => {
    expect(parseArgs(["--list"])).toEqual({ action: "list" });
  });

  it("single key parses to view action", () => {
    expect(parseArgs(["my-term"])).toEqual({ action: "view", key: "my-term" });
  });

  it("key with -d parses to remove action", () => {
    expect(parseArgs(["my-term", "-d"])).toEqual({ action: "remove", key: "my-term" });
  });

  it("key with facts parses to add action", () => {
    expect(parseArgs(["my-term", "fact1", "fact2"])).toEqual({
      action: "add",
      key: "my-term",
      facts: ["fact1", "fact2"],
    });
  });

  it("no args parses to usage action", () => {
    expect(parseArgs([])).toEqual({ action: "usage" });
  });
});

describe("run", () => {
  it("--list with empty store prints empty string", () => {
    const result = run({ action: "list" });
    expect(result).toBe("");
  });

  it("--list with keys prints comma-separated list", () => {
    writeFileSync(storePath, JSON.stringify({ "term-b": ["fact"], "term-a": ["fact"] }));
    const result = run({ action: "list" });
    expect(result).toBe("term-a,term-b");
  });

  it("view key with existing term prints formatted markdown", () => {
    writeFileSync(storePath, JSON.stringify({ "my-term": ["Fact one", "Fact two"] }));
    const result = run({ action: "view", key: "my-term" });
    expect(result).toBe("**my-term**:\n- Fact one\n- Fact two");
  });

  it("view key with missing term exits non-zero", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(() => run({ action: "view", key: "missing-term" })).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("key fact1 fact2 stores facts", () => {
    const result = run({ action: "add", key: "my-term", facts: ["Fact one", "Fact two"] });
    expect(result).toBe("");
    const stored = JSON.parse(readFileSync(storePath, "utf-8")) as Record<string, string[]>;
    expect(stored["my-term"]).toEqual(["Fact one", "Fact two"]);
  });

  it("key -d removes key", () => {
    writeFileSync(storePath, JSON.stringify({ "my-term": ["fact"] }));
    const result = run({ action: "remove", key: "my-term" });
    expect(result).toBe("");
  });

  it("key -d on missing key exits non-zero", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(() => run({ action: "remove", key: "missing-term" })).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("no args prints usage to stderr", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(() => run({ action: "usage" })).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
