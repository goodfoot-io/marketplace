import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  build,
  createHelpers,
  getHelperReferenceModel,
  lint,
  renderHelperReferenceMarkdown,
  renderTemplate,
} from "../src/index.js";

describe("portable helper contract", () => {
  it("derives a stable helper reference from the platform table", () => {
    const model = getHelperReferenceModel();
    expect(model.platforms).toEqual(["claude-code", "codex", "opencode", "antigravity"]);
    const markdown = renderHelperReferenceMarkdown(model);
    expect(markdown).toContain("it.pluginRootVar");
    expect(markdown).toContain(
      "| it.bash | command | Render a block command for execution and output reporting. | native (verified) | unavailable (unavailable)",
    );
    expect(markdown).toContain("unavailable (unavailable)");
  });
  it("renders platform-specific skill references", () => {
    expect(createHelpers("claude-code").skillRef("cards:markdown")).toBe("`cards:markdown`");
    expect(createHelpers("codex").skillRef("cards:markdown")).toBe("`$cards:markdown`");
    expect(createHelpers("opencode").skillRef("cards:markdown")).toBe("`$markdown`");
  });

  it("renders native Claude embedded bash", () => {
    const helpers = createHelpers("claude-code");
    expect(helpers.bash("printf 'hello\\n'")).toBe("```!\nprintf 'hello\\n'\n```");
    expect(helpers.bashInline("date +%Y-%m-%d")).toBe("!`date +%Y-%m-%d`");
  });

  it.each(["codex", "opencode", "antigravity"] as const)(
    "renders inert embedded-bash instructions for %s",
    (platform) => {
      const helpers = createHelpers(platform);
      expect(helpers.bash("printf 'one\\ntwo\\n'")).toBe(
        "Run this command and report its output:\n\n```bash\nprintf 'one\\ntwo\\n'\n```",
      );
      expect(helpers.bashInline("date +%s")).toBe("run `date +%s` and report its output");
    },
  );

  it("preserves multiline block commands and rejects syntax-breaking inline commands", () => {
    const helpers = createHelpers("claude-code");
    expect(helpers.bash("printf '%s\\n' one\nprintf '%s\\n' two")).toBe(
      "```!\nprintf '%s\\n' one\nprintf '%s\\n' two\n```",
    );
    expect(() => helpers.bashInline("printf `date`")).toThrow(/it\.bashInline.*backtick/);
    expect(() => helpers.bashInline("printf one\nprintf two")).toThrow(/it\.bashInline.*single line/);
    expect(() => helpers.bash("printf '```'")).toThrow(/it\.bash.*fence/);
  });

  it("expands aliases and fails closed", () => {
    expect(createHelpers("opencode").variant({ "@codex": "shared", "claude-code": "claude", antigravity: "ag" })).toBe(
      "shared",
    );
    expect(() => createHelpers("antigravity").subagent.dispatch("explorer")).toThrow(/subagent\.dispatch.*antigravity/);
  });

  it("emits stable validated frontmatter", () => {
    expect(createHelpers("codex").frontmatter({ description: "Example", name: "demo" })).toBe(
      "---\nname: demo\ndescription: Example\n---\n",
    );
    expect(() => createHelpers("codex").frontmatter({ version: "1" })).toThrow(/frontmatter.*version/);
  });
});

describe("render, build, and lint", () => {
  it("preserves markdown bytes and strips front-config exactly", async () => {
    const rendered = await renderTemplate({
      platform: "codex",
      root: "/tmp",
      sourcePath: "/tmp/SKILL.md.eta",
      template: "<!-- agent-skills\nplatforms: [codex]\noutputName: OUT.md\n-->\n# <%= it.platform %>\n",
    });
    expect(rendered).toMatchObject({ outputPath: "OUT.md", content: "\n# codex\n" });
  });

  it("renders neutral OpenCode templates without reading unavailable helpers", async () => {
    await expect(
      renderTemplate({ platform: "opencode", root: "/tmp", sourcePath: "/tmp/SKILL.md.eta", template: "# neutral\n" }),
    ).resolves.toMatchObject({ content: "# neutral\n" });
    await expect(
      renderTemplate({
        platform: "opencode",
        root: "/tmp",
        sourcePath: "/tmp/SKILL.md.eta",
        template: "<%= it.pluginRootVar %>",
      }),
    ).rejects.toThrow(/pluginRootVar.*opencode/);
  });

  it("writes repeated targets from one deterministic manifest and removes stale files", async () => {
    const parent = await mkdtemp(join(tmpdir(), "agent-skills-"));
    const root = join(parent, "src");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(root));
    await writeFile(join(root, "SKILL.md.eta"), "# <%= it.platform %>\n");
    const one = join(parent, "out-one");
    const two = join(parent, "out-two");
    const result = await build({
      root,
      patterns: ["SKILL.md.eta"],
      targets: [
        { platform: "codex", outDir: one },
        { platform: "codex", outDir: two },
      ],
    });
    expect(await readFile(join(one, "SKILL.md"), "utf8")).toBe("# codex\n");
    expect(await readFile(join(two, "SKILL.md"), "utf8")).toBe("# codex\n");
    expect(result.manifests.size).toBe(1);
  });

  it("aggregates deterministic lint diagnostics", async () => {
    const parent = await mkdtemp(join(tmpdir(), "agent-skills-lint-"));
    const root = join(parent, "src");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(root));
    await writeFile(
      join(root, "SKILL.md.eta"),
      "---\nname: Bad Name\nversion: 1\n---\nUse $" + "{CLAUDE_PLUGIN_ROOT}.\n",
    );
    const result = await lint({
      root,
      patterns: ["SKILL.md.eta"],
      targets: [{ platform: "opencode", outDir: join(parent, "out") }],
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.rule)).toEqual(
      expect.arrayContaining(["frontmatter-key", "plugin-root-variable", "opencode-name"]),
    );
  });
});
