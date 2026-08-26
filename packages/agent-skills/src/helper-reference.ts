import { PLATFORM_DEFINITIONS, type Verification } from "./platforms.js";
import { PLATFORMS, type Platform } from "./types.js";

export interface HelperReferenceCell {
  readonly platform: Platform;
  readonly status: Verification;
  readonly example?: string;
}

export interface HelperReferenceEntry {
  readonly name: string;
  readonly inputs: string;
  readonly description: string;
  readonly cells: readonly HelperReferenceCell[];
}

export interface HelperReferenceModel {
  readonly platforms: readonly Platform[];
  readonly helpers: readonly HelperReferenceEntry[];
}

export function getHelperReferenceModel(): HelperReferenceModel {
  const rows: readonly [string, string, string, keyof (typeof PLATFORM_DEFINITIONS)[Platform] | "universal"][] = [
    ["it.platform", "none", "Active canonical platform.", "universal"],
    ["it.is", "...Platform", "Test canonical platform membership.", "universal"],
    ["it.variant", "VariantMap<T>", "Select one exhaustive platform branch.", "universal"],
    ["it.skillRef", "skillId", "Render a prose skill reference.", "skillSigil"],
    ["it.skillInvoke", "skillId", "Render a skill activation instruction.", "skillInvoke"],
    ["it.agentRef", "plugin:dir:file", "Render a canonical agent reference.", "agentNaming"],
    ["it.agentSlotVar", "role", "Render an agent model or effort slot.", "agentSlotSuffix"],
    ["it.conventionsFile", "none", "Name the host conventions file.", "conventionsFile"],
    ["it.hostIdentity", "role?", "Render the platform host identity.", "hostIdentity"],
    ["it.pluginRootVar", "none", "Render the plugin-root variable.", "pluginRootVar"],
    ["it.platformDir", "logicalPathKind", "Resolve a configured logical platform path.", "logicalPaths"],
    ["it.frontmatter", "object", "Serialize validated stable frontmatter.", "frontmatterKeys"],
    ["it.subagent.dispatch", "type, options?", "Render a subagent dispatch operation.", "subagents"],
    ["it.subagent.reengage", "{ live? }", "Render live/completed re-engagement.", "subagents"],
    ["it.subagent.resultChannel", "orchestrator?", "Render the result recipient.", "universal"],
    ["it.worktree.enter", "none", "Render worktree entry.", "worktree"],
    ["it.worktree.remove", "none", "Render worktree removal.", "worktree"],
  ];
  return {
    platforms: PLATFORMS,
    helpers: rows.map(([name, inputs, description, key]) => ({
      name,
      inputs,
      description,
      cells: PLATFORMS.map((platform) => {
        const fact =
          key === "universal"
            ? { status: "verified" as const, value: platform }
            : (PLATFORM_DEFINITIONS[platform][key] as { status: Verification; value?: unknown });
        if (key === "logicalPaths")
          return {
            platform,
            status: fact.status,
            example: fact.status === "unavailable" ? undefined : "configured path",
          };
        return { platform, status: fact.status, example: fact.value === undefined ? undefined : String(fact.value) };
      }),
    })),
  };
}

export function renderHelperReferenceMarkdown(_model: HelperReferenceModel = getHelperReferenceModel()): string {
  const model = _model;
  const lines = [
    `| Helper | Inputs | Description | ${model.platforms.join(" | ")} |`,
    `| --- | --- | --- | ${model.platforms.map(() => "---").join(" | ")} |`,
  ];
  for (const helper of model.helpers)
    lines.push(
      `| ${helper.name} | ${helper.inputs} | ${helper.description} | ${helper.cells.map((cell) => (cell.example === undefined ? `unavailable (${cell.status})` : `${cell.example} (${cell.status})`)).join(" | ")} |`,
    );
  return `${lines.join("\n")}\n`;
}
