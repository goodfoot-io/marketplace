import { stringify } from "yaml";
import { PLATFORM_DEFINITIONS, type PlatformFact } from "./platforms.js";
import type { HelperFactoryOptions, Platform, PlatformHelpers, PlatformPathKind, VariantMap } from "./types.js";

const SKILL_ID = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*:)?[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AGENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;

function value<T>(helper: string, platform: Platform, fact: PlatformFact<T>): T {
  if (fact.value === undefined) throw new Error(`${helper} is unavailable for platform ${platform}`);
  return fact.value;
}
function skillId(id: string): string {
  if (!SKILL_ID.test(id) || id.startsWith("$")) throw new Error(`Invalid skill id: ${id}`);
  return id;
}
function role(value: string): string {
  if (!/^[a-z][a-z0-9-]*$/.test(value)) throw new Error(`Invalid role: ${value}`);
  return value.toUpperCase().replaceAll("-", "_");
}

export function createHelpers(platform: Platform, options: HelperFactoryOptions = {}): PlatformHelpers {
  const definition = PLATFORM_DEFINITIONS[platform];
  const nativeSkill = (id: string): string => {
    const valid = skillId(id);
    const namespace = value("skillRef", platform, definition.skillNamespace);
    return namespace === "strip" ? (valid.split(":").at(-1) ?? valid) : valid;
  };
  const helpers: PlatformHelpers = {
    platform,
    is: (...platforms) => platforms.includes(platform),
    variant: <T>(variants: VariantMap<T>): T => {
      const alias = variants["@codex"];
      if (alias !== undefined && (variants.codex !== undefined || variants.opencode !== undefined)) {
        throw new Error("variant has overlapping @codex and canonical branches");
      }
      const expanded =
        platform === "codex" || platform === "opencode" ? (variants[platform] ?? alias) : variants[platform];
      if (expanded === undefined) throw new Error(`variant is missing platform ${platform}`);
      const allowed = new Set(["claude-code", "codex", "opencode", "antigravity", "@codex"]);
      for (const key of Object.keys(variants))
        if (!allowed.has(key)) throw new Error(`variant has unknown branch ${key}`);
      for (const candidate of ["claude-code", "codex", "opencode", "antigravity"] as const) {
        if (
          variants[candidate] === undefined &&
          !((candidate === "codex" || candidate === "opencode") && alias !== undefined)
        ) {
          throw new Error(`variant is missing platform ${candidate}`);
        }
      }
      return expanded;
    },
    skillRef: (id) => `\`${value("skillRef", platform, definition.skillSigil)}${nativeSkill(id)}\``,
    skillInvoke: (id) => {
      const name = nativeSkill(id);
      const kind = value("skillInvoke", platform, definition.skillInvoke);
      if (kind === "tool-block") return `<skill>\n<name>${name}</name>\n</skill>`;
      if (kind === "mention") return `Use $${name}.`;
      return `Use the ${name} skill.`;
    },
    agentRef: (id) => {
      if (!AGENT_ID.test(id)) throw new Error(`Invalid agent id: ${id}`);
      const naming = value("agentRef", platform, definition.agentNaming);
      return naming === "colon" ? `\`${id}\`` : `\`$${id.split(":").slice(1).join("-")}\``;
    },
    agentSlotVar: (name) => `[${role(name)}_${value("agentSlotVar", platform, definition.agentSlotSuffix)}]`,
    conventionsFile: value("conventionsFile", platform, definition.conventionsFile),
    hostIdentity: (name) => {
      const identity = value("hostIdentity", platform, definition.hostIdentity);
      return name && identity ? `${identity} serving as ${name}` : identity;
    },
    get pluginRootVar() {
      return value("pluginRootVar", platform, definition.pluginRootVar);
    },
    platformDir: (kind: PlatformPathKind) => {
      const configured = options.platformDirs?.[kind];
      const path = configured ?? value("platformDir", platform, definition.logicalPaths[kind]);
      if (path.startsWith("/") || path.split(/[\\/]/).includes(".."))
        throw new Error(`platformDir ${kind} escapes its root`);
      return path.replaceAll("\\", "/");
    },
    frontmatter: (input) => {
      const allowed = value("frontmatter", platform, definition.frontmatterKeys);
      const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
      if (unknown.length) throw new Error(`frontmatter contains unsupported key ${unknown.join(", ")} for ${platform}`);
      const ordered = Object.fromEntries(allowed.filter((key) => key in input).map((key) => [key, input[key]]));
      return `---\n${stringify(ordered).trimEnd()}\n---\n`;
    },
    subagent: {
      dispatch: (type, opts = {}) => {
        const dialect = value("subagent.dispatch", platform, definition.subagents);
        if (dialect === "claude")
          return `Spawn \`${type[0]?.toUpperCase()}${type.slice(1)}\` subagents${opts.parallel ? " in parallel" : ""}${opts.background ? " with `run_in_background: true`" : ""}`;
        return `Spawn \`${type}\` sub-agents${opts.parallel ? " in parallel" : ""} (\`spawn_agent\` with \`agent_type: ${type}\`)`;
      },
      reengage: () =>
        value("subagent.reengage", platform, definition.subagents) === "claude"
          ? "wake it with a DM"
          : "re-engage it (`send_message` if live, `resume_agent` if completed)",
      resultChannel: (orchestrator = true) => (orchestrator ? "to me, the orchestrator" : "to `team-lead`"),
    },
    worktree: {
      enter: () =>
        value("worktree.enter", platform, definition.worktree) === "tools"
          ? "Use the `EnterWorktree` tool."
          : "Run `create-worktree`.",
      remove: () =>
        value("worktree.remove", platform, definition.worktree) === "tools"
          ? "Use the `ExitWorktree` tool."
          : "Run `remove-worktree`.",
    },
  };
  return helpers;
}
