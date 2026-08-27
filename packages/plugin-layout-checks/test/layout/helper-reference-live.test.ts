import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { renderHelperReferenceMarkdown } from "../../../agent-skills/src/helper-reference.js";
import { repoPath } from "../helpers.js";
import { PLUGINS } from "../registry.js";

/**
 * I5's smoke check. generated-fresh.test.ts rebuilds every tree from its
 * templates, so it catches template-to-tree drift but is blind to the layer
 * above it: a template whose generated region was never re-synced rebuilds
 * byte-identically forever. The reference point here is therefore the live
 * `renderHelperReferenceMarkdown()` rather than any stored copy — adding a
 * helper to the platform model turns this red until the template is synced
 * and the trees rebuilt.
 */

const BEGIN = "<!-- BEGIN GENERATED AGENT-SKILLS HELPER REFERENCE -->";
const END = "<!-- END GENERATED AGENT-SKILLS HELPER REFERENCE -->";

const agentSkills = PLUGINS.find((plugin) => plugin.name === "agent-skills");
if (!agentSkills) throw new Error("registry: agent-skills is not a managed plugin");

describe("helper reference tracks the live platform model", () => {
  it.each(agentSkills.targets.map((target) => target.path))("%s/reference/helper-reference.md", (targetPath) => {
    const shipped = fs.readFileSync(repoPath(targetPath, "reference/helper-reference.md"), "utf8");
    const begin = shipped.indexOf(BEGIN);
    const end = shipped.indexOf(END);
    expect(begin, "generated-region markers are missing or out of order").toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(begin);

    const region = shipped.slice(begin + BEGIN.length, end).trim();
    expect(region).toBe(renderHelperReferenceMarkdown().trim());
  });
});
