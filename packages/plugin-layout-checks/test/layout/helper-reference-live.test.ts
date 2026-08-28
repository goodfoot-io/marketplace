import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getHelperReferenceModel,
  type ListFactKey,
  renderHelperReferenceMarkdown,
  type ScalarFactKey,
} from "../../../agent-skills/src/helper-reference.js";
import { repoPath } from "../helpers.js";
import { PLUGINS } from "../registry.js";

/**
 * I5's smoke check plus the renderer's own correctness contract.
 *
 * The two halves cover different failures and neither subsumes the other.
 * `generated bundle freshness` rebuilds every tree from its templates, so it
 * catches template-to-tree drift but is blind to a template whose generated
 * region was never re-synced — that rebuilds byte-identically forever. The
 * first describe below closes that by making the live
 * `renderHelperReferenceMarkdown()` the reference point rather than any stored
 * copy. But comparing shipped bytes against the same renderer cannot catch a
 * defect the renderer itself produces: when a forced cast flattened
 * `logicalPaths` (a record of facts) into the scalar path, every tree agreed
 * with the renderer while carrying `configured path (undefined)` cells. The
 * second describe asserts the properties the renderer's output must have on
 * its own terms.
 */

const BEGIN = "<!-- BEGIN GENERATED AGENT-SKILLS HELPER REFERENCE -->";
const END = "<!-- END GENERATED AGENT-SKILLS HELPER REFERENCE -->";

const agentSkills = PLUGINS.find((plugin) => plugin.name === "agent-skills");
if (!agentSkills) throw new Error("registry: agent-skills is not a managed plugin");

/**
 * The type-level half of the `[object Object]` gate. `logicalPaths` is a
 * `Readonly<Record<PlatformPathKind, PlatformFact<string>>>`, so it belongs to
 * neither key union and cannot be routed through a scalar or list row. If a
 * future fact of that shape is added and someone widens a union to admit it,
 * these two lines stop compiling — the layout package's `tsc --noEmit` is the
 * gate, which is why the file is in its tsconfig `include`.
 */
type Assert<T extends true> = T;
type RecordFactIsNotScalar = Assert<"logicalPaths" extends ScalarFactKey ? false : true>;
type RecordFactIsNotList = Assert<"logicalPaths" extends ListFactKey ? false : true>;
const _typeLevelGate: [RecordFactIsNotScalar, RecordFactIsNotList] = [true, true];

const STATUSES = new Set(["verified", "provisional", "unavailable"]);

describe("helper reference tracks the live platform model", () => {
  it.each(agentSkills.targets.map((target) => target.path))("%s/agent-skills/reference/helper-reference.md", (targetPath) => {
    const shipped = fs.readFileSync(repoPath(targetPath, "agent-skills/reference/helper-reference.md"), "utf8");
    const begin = shipped.indexOf(BEGIN);
    const end = shipped.indexOf(END);
    expect(begin, "generated-region markers are missing or out of order").toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(begin);

    const region = shipped.slice(begin + BEGIN.length, end).trim();
    expect(region).toBe(renderHelperReferenceMarkdown().trim());
  });
});

describe("helper reference cells are well-formed", () => {
  const model = getHelperReferenceModel();
  const cases = model.helpers.flatMap((helper) =>
    helper.cells.map((cell) => [`${helper.name} ${helper.inputs}`, cell] as const),
  );

  it.each(cases)("%s carries a real status and a rendered value", (label, cell) => {
    expect(STATUSES.has(cell.status), `${label} / ${cell.platform}: status ${String(cell.status)}`).toBe(true);
  });

  /**
   * Every defect the cast produced was visible in the rendered row rather than
   * the model, so the assertions run against the rendered table: a blank cell,
   * a literal `undefined`, and `[object Object]` are all things a reader would
   * have had to notice by eye.
   */
  it("renders no blank, undefined, or stringified-object cell", () => {
    const rows = renderHelperReferenceMarkdown().trim().split("\n").slice(2);
    expect(rows.length).toBe(model.helpers.length);
    for (const row of rows) {
      const cells = row
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      for (const cell of cells) {
        expect(cell, `blank cell in: ${row}`).not.toBe("");
        expect(cell, `stringified object in: ${row}`).not.toContain("[object Object]");
        expect(cell, `literal undefined in: ${row}`).not.toContain("undefined");
      }
    }
  });

  /**
   * `logicalPaths` is the composite fact, and antigravity is the platform that
   * proves the sub-kinds carry their own statuses: `platforms.ts` marks its
   * `skills`, `conventions`, `agents`, and `plugin` verified from official
   * documentation and positive CLI fixtures while `hooks` remains unavailable.
   * The single flattened row could not say this.
   */
  it.each([
    ["skills", "verified"],
    ["conventions", "verified"],
    ["agents", "verified"],
    ["hooks", "unavailable"],
    ["plugin", "verified"],
  ])("it.platformDir %s reports antigravity as %s", (kind, status) => {
    const row = model.helpers.find(
      (helper) => helper.name === "it.platformDir" && helper.description.includes(`"${kind}"`),
    );
    if (!row) throw new Error(`no it.platformDir row for ${kind}`);
    const cell = row.cells.find((candidate) => candidate.platform === "antigravity");
    expect(cell?.status).toBe(status);
    expect(cell?.value.kind).toBe(status === "unavailable" ? "absent" : "text");
  });

  /**
   * An empty-string value is a real answer — claude-code has no skill sigil and
   * no host identity prefix — and must read differently from the neighbouring
   * `unavailable (unavailable)` cells, which are the table's way of saying
   * there is no value at all.
   */
  it.each([
    ["it.skillRef", "claude-code"],
    ["it.skillRef", "antigravity"],
    ["it.hostIdentity", "claude-code"],
  ])("%s renders %s's empty value as an affirmative marker", (name, platform) => {
    const row = model.helpers.find((helper) => helper.name === name);
    if (!row) throw new Error(`no ${name} row`);
    const cell = row.cells.find((candidate) => candidate.platform === platform);
    expect(cell?.value.kind).toBe("empty");
    expect(renderHelperReferenceMarkdown()).toContain(`empty string (${cell?.status})`);
  });

  /** The list-valued fact still renders, now through a type-checked branch. */
  it("renders the list-valued frontmatterKeys fact as a comma-joined list", () => {
    const row = model.helpers.find((helper) => helper.name === "it.frontmatter");
    const cell = row?.cells.find((candidate) => candidate.platform === "claude-code");
    expect(cell?.value).toEqual({
      kind: "list",
      items: ["name", "description", "allowed-tools", "argument-hint", "model"],
    });
    expect(renderHelperReferenceMarkdown()).toContain(
      "| name,description,allowed-tools,argument-hint,model (verified) |",
    );
  });

  /** Control: the populated and unavailable cells the fix must not disturb. */
  it("leaves it.pluginRootVar's populated and unavailable cells unchanged", () => {
    const row = model.helpers.find((helper) => helper.name === "it.pluginRootVar");
    if (!row) throw new Error("no it.pluginRootVar row");
    expect(row.cells.map((cell) => `${cell.platform}:${cell.status}`)).toEqual([
      "claude-code:verified",
      "codex:verified",
      "opencode:unavailable",
      "antigravity:unavailable",
    ]);
    // Written as a template literal with escaped sigils: the expectation is the
    // literal host syntax the table ships, and a plain string holding `${…}`
    // reads to `noTemplateCurlyInString` as an interpolation someone forgot to
    // enable.
    expect(renderHelperReferenceMarkdown()).toContain(
      `| it.pluginRootVar | none | Render the plugin-root variable. | \`\${CLAUDE_PLUGIN_ROOT}\` (verified) | \`\${PLUGIN_ROOT}\` (verified) | unavailable (unavailable) | unavailable (unavailable) |`,
    );
  });
});
