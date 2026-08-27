import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPath } from "../helpers.js";

const workflow = fs.readFileSync(repoPath(".github/workflows/plugin-layout.yml"), "utf8");

describe("CI Antigravity plugin validation", () => {
  it("derives complete plugin roots from Antigravity registry targets", () => {
    expect(workflow).toContain('select(any(.targets[]?; .platform == "antigravity")) | .antigravityPluginRoot');
    expect(workflow).toContain('test -f "$root/plugin.json"');
    expect(workflow).toContain('agy plugin validate "$root"');
  });

  it("requires a positive processed-category result", () => {
    expect(workflow).toContain("[1-9][0-9]* processed");
  });

  it("skips cleanly before any Antigravity targets are registered", () => {
    expect(workflow).toContain("registry declares no Antigravity plugin roots; skipping validation");
  });
});
