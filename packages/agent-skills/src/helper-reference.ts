import { PLATFORM_DEFINITIONS, type Verification } from "./platforms.js";
import { PLATFORMS, type Platform } from "./types.js";

export interface HelperReferenceCell {
  readonly platform: Platform;
  readonly status: Verification;
  readonly example?: string;
}

export interface HelperReferenceEntry {
  readonly name: string;
  readonly description: string;
  readonly cells: readonly HelperReferenceCell[];
}

export interface HelperReferenceModel {
  readonly platforms: readonly Platform[];
  readonly helpers: readonly HelperReferenceEntry[];
}

export function getHelperReferenceModel(): HelperReferenceModel {
  const rows: readonly [string, string, keyof (typeof PLATFORM_DEFINITIONS)[Platform]][] = [
    ["it.skillRef", "Render a prose skill reference.", "skillSigil"],
    ["it.skillInvoke", "Render a skill activation instruction.", "skillInvoke"],
    ["it.agentRef", "Render a canonical agent reference.", "agentNaming"],
    ["it.agentSlotVar", "Render an agent model or effort slot.", "agentSlotSuffix"],
    ["it.conventionsFile", "Name the host conventions file.", "conventionsFile"],
    ["it.hostIdentity", "Render the platform host identity.", "hostIdentity"],
    ["it.pluginRootVar", "Render the plugin-root variable.", "pluginRootVar"],
  ];
  return {
    platforms: PLATFORMS,
    helpers: rows.map(([name, description, key]) => ({
      name,
      description,
      cells: PLATFORMS.map((platform) => {
        const fact = PLATFORM_DEFINITIONS[platform][key] as { status: Verification; value?: unknown };
        return { platform, status: fact.status, example: fact.value === undefined ? undefined : String(fact.value) };
      }),
    })),
  };
}

export function renderHelperReferenceMarkdown(_model: HelperReferenceModel = getHelperReferenceModel()): string {
  const model = _model;
  const lines = [
    `| Helper | Description | ${model.platforms.join(" | ")} |`,
    `| --- | --- | ${model.platforms.map(() => "---").join(" | ")} |`,
  ];
  for (const helper of model.helpers)
    lines.push(
      `| ${helper.name} | ${helper.description} | ${helper.cells.map((cell) => (cell.example === undefined ? `unavailable (${cell.status})` : `${cell.example} (${cell.status})`)).join(" | ")} |`,
    );
  return `${lines.join("\n")}\n`;
}
