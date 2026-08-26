import { describe, expect, it } from "vitest";
import { parseArgs, validateArgs } from "../src/cli.js";

describe("CLI contract", () => {
  it("parses repeated targets, platforms, and positional patterns", () => {
    const parsed = parseArgs(["build", "--root", "src", "--target", "codex=out", "--platform", "codex", "**/*.md.eta"]);
    expect(validateArgs(parsed)).toMatchObject({
      command: "build",
      root: "src",
      platforms: ["codex"],
      patterns: ["**/*.md.eta"],
    });
  });

  it("rejects missing targets and malformed platforms", () => {
    expect(() => validateArgs(parseArgs(["build", "x.md.eta"]))).toThrow(/target/);
    expect(() => validateArgs(parseArgs(["lint", "--target", "claude=out", "x.md.eta"]))).toThrow(/platform/);
  });
});
