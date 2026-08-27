import { PLATFORM_DEFINITIONS, type PlatformDefinition, type PlatformFact, type Verification } from "./platforms.js";
import { PLATFORMS, type Platform, type PlatformPathKind } from "./types.js";

/**
 * `PlatformDefinition`'s members are three genuinely different shapes: single
 * string-valued facts, one list-valued fact, and `logicalPaths`, which is a
 * *record* of facts rather than a fact. These two key sets are derived from the
 * interface instead of hand-listed, so a fact whose shape is none of the three
 * belongs to neither union and cannot reach a renderer that would stringify it
 * into `[object Object]`. That is the standing gate: it fails at `tsc`, not in
 * the generated table.
 */
export type ScalarFactKey = {
  [K in keyof PlatformDefinition]: PlatformDefinition[K] extends PlatformFact<string> ? K : never;
}[keyof PlatformDefinition];
export type ListFactKey = {
  [K in keyof PlatformDefinition]: PlatformDefinition[K] extends PlatformFact<readonly string[]> ? K : never;
}[keyof PlatformDefinition];
export type BooleanFactKey = {
  [K in keyof PlatformDefinition]: PlatformDefinition[K] extends PlatformFact<boolean> ? K : never;
}[keyof PlatformDefinition];

/**
 * What a cell holds, kept separate from its status because the two answer
 * different questions. `absent` means the platform has no value at all;
 * `empty` means the value is the empty string and that is the correct answer —
 * no sigil, no identity prefix. Rendering both as a blank cell is what made a
 * complete row indistinguishable from a missing one.
 */
export type HelperReferenceValue =
  | { readonly kind: "absent" }
  | { readonly kind: "empty" }
  | { readonly kind: "text"; readonly text: string; readonly code: boolean }
  | { readonly kind: "list"; readonly items: readonly string[] };

export interface HelperReferenceCell {
  readonly platform: Platform;
  readonly status: Verification;
  readonly value: HelperReferenceValue;
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

/**
 * Where a row's per-platform facts come from. `path` carries a
 * `PlatformPathKind` rather than a key because `logicalPaths` holds one fact
 * per kind, each with its own status — antigravity's `skills` is provisional
 * while its `agents` is unavailable, a distinction the single-row rendering
 * could not express.
 */
type RowSource =
  | { readonly from: "platform" }
  | { readonly from: "scalar"; readonly key: ScalarFactKey }
  | { readonly from: "boolean"; readonly key: BooleanFactKey }
  | { readonly from: "list"; readonly key: ListFactKey }
  | { readonly from: "path"; readonly kind: PlatformPathKind };

interface RowSpec {
  readonly name: string;
  readonly inputs: string;
  readonly description: string;
  readonly source: RowSource;
}

/**
 * Scalar facts whose values are literal host syntax rather than descriptive
 * words, so they render as Markdown code spans. That is the correct markup for
 * a variable name or a sigil regardless, and it is also what distinguishes this
 * table's necessary mention of every platform's root variable from an actual
 * wrong-platform token in a generated tree.
 */
const CODE_VALUED_KEYS = new Set<ScalarFactKey>(["pluginRootVar", "skillSigil"]);

const PATH_KINDS: readonly PlatformPathKind[] = ["skills", "agents", "hooks", "plugin", "conventions"];

const ROWS: readonly RowSpec[] = [
  { name: "it.platform", inputs: "none", description: "Active canonical platform.", source: { from: "platform" } },
  {
    name: "it.is",
    inputs: "...Platform",
    description: "Test canonical platform membership.",
    source: { from: "platform" },
  },
  {
    name: "it.variant",
    inputs: "VariantMap<T>",
    description: "Select one exhaustive platform branch.",
    source: { from: "platform" },
  },
  {
    name: "it.bash",
    inputs: "command",
    description: "Render a block command for execution and output reporting.",
    source: { from: "boolean", key: "embeddedBash" },
  },
  {
    name: "it.bashInline",
    inputs: "command",
    description: "Render an inline command for execution and output reporting.",
    source: { from: "boolean", key: "embeddedBash" },
  },
  {
    name: "it.skillRef",
    inputs: "skillId",
    description: "Render a prose skill reference.",
    source: { from: "scalar", key: "skillSigil" },
  },
  {
    name: "it.skillInvoke",
    inputs: "skillId",
    description: "Render a skill activation instruction.",
    source: { from: "scalar", key: "skillInvoke" },
  },
  {
    name: "it.agentRef",
    inputs: "plugin:dir:file",
    description: "Render a canonical agent reference.",
    source: { from: "scalar", key: "agentNaming" },
  },
  {
    name: "it.agentSlotVar",
    inputs: "role",
    description: "Render an agent model or effort slot.",
    source: { from: "scalar", key: "agentSlotSuffix" },
  },
  {
    name: "it.conventionsFile",
    inputs: "none",
    description: "Name the host conventions file.",
    source: { from: "scalar", key: "conventionsFile" },
  },
  {
    name: "it.hostIdentity",
    inputs: "role?",
    description: "Render the platform host identity.",
    source: { from: "scalar", key: "hostIdentity" },
  },
  {
    name: "it.pluginRootVar",
    inputs: "none",
    description: "Render the plugin-root variable.",
    source: { from: "scalar", key: "pluginRootVar" },
  },
  // The kind is quoted inside the description rather than left bare: the
  // `skill-relative-path` rule matches a whitespace-preceded `skills`, so an
  // unquoted "the skills path" in this table's own prose would trip it and buy
  // a suppression for a row that is simply naming its argument.
  ...PATH_KINDS.map(
    (kind): RowSpec => ({
      name: "it.platformDir",
      inputs: "logicalPathKind",
      description: `Resolve the configured "${kind}" path.`,
      source: { from: "path", kind },
    }),
  ),
  {
    name: "it.frontmatter",
    inputs: "object",
    description: "Serialize validated stable frontmatter.",
    source: { from: "list", key: "frontmatterKeys" },
  },
  {
    name: "it.subagent.dispatch",
    inputs: "type, options?",
    description: "Render a subagent dispatch operation.",
    source: { from: "scalar", key: "subagents" },
  },
  {
    name: "it.subagent.reengage",
    inputs: "{ live? }",
    description: "Render live/completed re-engagement.",
    source: { from: "scalar", key: "subagents" },
  },
  {
    name: "it.subagent.resultChannel",
    inputs: "orchestrator?",
    description: "Render the result recipient.",
    source: { from: "platform" },
  },
  {
    name: "it.worktree.enter",
    inputs: "none",
    description: "Render worktree entry.",
    source: { from: "scalar", key: "worktree" },
  },
  {
    name: "it.worktree.remove",
    inputs: "none",
    description: "Render worktree removal.",
    source: { from: "scalar", key: "worktree" },
  },
];

const scalarValue = (fact: PlatformFact<string>, code: boolean): HelperReferenceValue => {
  if (fact.value === undefined) return { kind: "absent" };
  return fact.value === "" ? { kind: "empty" } : { kind: "text", text: fact.value, code };
};

function cellFor(platform: Platform, source: RowSource): HelperReferenceCell {
  const definition = PLATFORM_DEFINITIONS[platform];
  switch (source.from) {
    case "platform":
      return { platform, status: "verified", value: { kind: "text", text: platform, code: false } };
    case "scalar": {
      const fact: PlatformFact<string> = definition[source.key];
      return { platform, status: fact.status, value: scalarValue(fact, CODE_VALUED_KEYS.has(source.key)) };
    }
    case "boolean": {
      const fact: PlatformFact<boolean> = definition[source.key];
      return {
        platform,
        status: fact.status,
        value:
          fact.value === undefined
            ? { kind: "absent" }
            : { kind: "text", text: fact.value ? "native" : "instructions", code: false },
      };
    }
    case "list": {
      const fact: PlatformFact<readonly string[]> = definition[source.key];
      return {
        platform,
        status: fact.status,
        value: fact.value === undefined ? { kind: "absent" } : { kind: "list", items: fact.value },
      };
    }
    case "path": {
      const fact: PlatformFact<string> = definition.logicalPaths[source.kind];
      return {
        platform,
        status: fact.status,
        value: fact.value === undefined ? { kind: "absent" } : { kind: "text", text: "configured path", code: false },
      };
    }
  }
}

export function getHelperReferenceModel(): HelperReferenceModel {
  return {
    platforms: PLATFORMS,
    helpers: ROWS.map((row) => ({
      name: row.name,
      inputs: row.inputs,
      description: row.description,
      cells: PLATFORMS.map((platform) => cellFor(platform, row.source)),
    })),
  };
}

function renderCell(cell: HelperReferenceCell): string {
  switch (cell.value.kind) {
    case "absent":
      return `unavailable (${cell.status})`;
    case "empty":
      return `empty string (${cell.status})`;
    case "list":
      return `${cell.value.items.join(",")} (${cell.status})`;
    case "text": {
      const text = cell.value.code ? `\`${cell.value.text}\`` : cell.value.text;
      return `${text} (${cell.status})`;
    }
  }
}

export function renderHelperReferenceMarkdown(model: HelperReferenceModel = getHelperReferenceModel()): string {
  const lines = [
    `| Helper | Inputs | Description | ${model.platforms.join(" | ")} |`,
    `| --- | --- | --- | ${model.platforms.map(() => "---").join(" | ")} |`,
  ];
  for (const helper of model.helpers)
    lines.push(
      `| ${helper.name} | ${helper.inputs} | ${helper.description} | ${helper.cells.map(renderCell).join(" | ")} |`,
    );
  return `${lines.join("\n")}\n`;
}
