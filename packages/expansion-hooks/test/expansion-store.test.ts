import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addExpansion,
  formatExpansion,
  getExpansion,
  listKeys,
  readStore,
  removeExpansion,
  writeStore,
} from "../src/expansion-store.js";

let tempDir: string;
let storePath: string;

// Mock homedir() so tests never touch the real ~/.expansion.json.
// Because node:os is ESM and not reconfigurable via spyOn, we use vi.mock with
// a factory that captures the tempDir value through a mutable closure variable.
let mockHomeDir = "";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: () => mockHomeDir,
  };
});

beforeEach(() => {
  tempDir = join(tmpdir(), `expansion-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  storePath = join(tempDir, ".expansion.json");
  mockHomeDir = tempDir;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("readStore", () => {
  it("reads empty object when file absent", () => {
    const result = readStore();
    expect(result).toEqual({});
  });

  it("reads existing JSON", () => {
    writeFileSync(storePath, JSON.stringify({ "my-key": ["fact1", "fact2"] }));
    const result = readStore();
    expect(result).toEqual({ "my-key": ["fact1", "fact2"] });
  });

  it("readStore returns empty object when file contains malformed JSON", () => {
    writeFileSync(storePath, "not valid json {{");
    const result = readStore();
    expect(result).toEqual({});
  });
});

describe("writeStore", () => {
  it("writes JSON to store path", () => {
    const data = { "my-key": ["fact1"] };
    writeStore(data);
    const result = readStore();
    expect(result).toEqual(data);
  });
});

describe("addExpansion", () => {
  it("addExpansion creates new key", () => {
    addExpansion("new-key", ["fact1", "fact2"]);
    const result = readStore();
    expect(result["new-key"]).toEqual(["fact1", "fact2"]);
  });

  it("addExpansion merges facts with existing key (deduplicates)", () => {
    writeFileSync(storePath, JSON.stringify({ "my-key": ["fact1", "fact2"] }));
    addExpansion("my-key", ["fact2", "fact3"]);
    const result = readStore();
    expect(result["my-key"]).toEqual(["fact1", "fact2", "fact3"]);
  });
});

describe("removeExpansion", () => {
  it("removeExpansion deletes key and returns true", () => {
    writeFileSync(storePath, JSON.stringify({ "my-key": ["fact1"] }));
    const removed = removeExpansion("my-key");
    expect(removed).toBe(true);
    const result = readStore();
    expect(result["my-key"]).toBeUndefined();
  });

  it("removeExpansion returns false for missing key", () => {
    const removed = removeExpansion("nonexistent");
    expect(removed).toBe(false);
  });
});

describe("getExpansion", () => {
  it("getExpansion returns facts array", () => {
    writeFileSync(storePath, JSON.stringify({ "my-key": ["fact1", "fact2"] }));
    const result = getExpansion("my-key");
    expect(result).toEqual(["fact1", "fact2"]);
  });
});

describe("listKeys", () => {
  it("listKeys returns sorted key list", () => {
    writeFileSync(storePath, JSON.stringify({ zebra: ["z"], apple: ["a"], mango: ["m"] }));
    const result = listKeys();
    expect(result).toEqual(["apple", "mango", "zebra"]);
  });
});

describe("formatExpansion", () => {
  it("formatExpansion returns markdown bullet list", () => {
    const result = formatExpansion("my-key", ["fact1", "fact2"]);
    expect(result).toBe("**my-key**:\n- fact1\n- fact2");
  });
});
