import { stringify } from "yaml";
import { PLATFORM_DEFINITIONS, type PlatformFact } from "./platforms.js";
import type { HelperFactoryOptions, Platform, PlatformHelpers, PlatformPathKind, VariantMap } from "./types.js";

const SKILL_ID = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*:)?[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AGENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;

function value<T>(helper: string, platform: Platform, fact: PlatformFact<T>): T {
  if (fact.value === undefined) throw new Error(`${helper} is unavailable for platform ${platform}`);
  return fact.value;
}
function verifiedCapability(fact: PlatformFact<boolean>): boolean {
  return fact.status === "verified" && fact.value === true;
}
function invalid(helper: string, platform: Platform, message: string): never {
  throw new Error(`${helper} on ${platform}: ${message}`);
}
function skillId(helper: string, platform: Platform, id: string): string {
  if (!SKILL_ID.test(id) || id.startsWith("$")) invalid(helper, platform, `invalid skill id ${id}`);
  return id;
}
function role(helper: string, platform: Platform, value: string): string {
  if (!/^[a-z][a-z0-9-]*$/.test(value)) invalid(helper, platform, `invalid role ${value}`);
  return value.toUpperCase().replaceAll("-", "_");
}

export function createHelpers(platform: Platform, options: HelperFactoryOptions = {}): PlatformHelpers {
  const definition = PLATFORM_DEFINITIONS[platform];
  if (!definition) invalid("createHelpers", platform, "unknown platform");
  const nativeSkill = (helper: string, id: string): string => {
    const valid = skillId(helper, platform, id);
    const namespace = value(helper, platform, definition.skillNamespace);
    return namespace === "strip" ? (valid.split(":").at(-1) ?? valid) : valid;
  };
  const helpers: PlatformHelpers = {
    platform,
    is: (...platforms) => {
      for (const candidate of platforms)
        if (!PLATFORM_DEFINITIONS[candidate]) invalid("it.is", platform, `unknown platform ${candidate}`);
      return platforms.includes(platform);
    },
    variant: <T>(variants: VariantMap<T>): T => {
      const alias = variants["@codex"];
      if (alias !== undefined && (variants.codex !== undefined || variants.opencode !== undefined)) {
        invalid("it.variant", platform, "overlapping @codex and canonical branches");
      }
      const expanded =
        platform === "codex" || platform === "opencode" ? (variants[platform] ?? alias) : variants[platform];
      if (expanded === undefined) invalid("it.variant", platform, `missing platform ${platform}`);
      const allowed = new Set(["claude-code", "codex", "opencode", "antigravity", "@codex"]);
      for (const key of Object.keys(variants))
        if (!allowed.has(key)) invalid("it.variant", platform, `unknown branch ${key}`);
      for (const candidate of ["claude-code", "codex", "opencode", "antigravity"] as const) {
        if (
          variants[candidate] === undefined &&
          !((candidate === "codex" || candidate === "opencode") && alias !== undefined)
        ) {
          invalid("it.variant", platform, `missing platform ${candidate}`);
        }
      }
      return expanded;
    },
    bash: (command: string): string => {
      if (command.includes("```")) invalid("it.bash", platform, "command contains a Markdown fence");
      if (verifiedCapability(definition.embeddedBash)) return `\`\`\`!\n${command}\n\`\`\``;
      return `Run this command and report its output:\n\n\`\`\`bash\n${command}\n\`\`\``;
    },
    bashInline: (command: string): string => {
      if (command.includes("\n") || command.includes("\r"))
        invalid("it.bashInline", platform, "command must be a single line");
      if (command.includes("`")) invalid("it.bashInline", platform, "command contains a backtick");
      if (verifiedCapability(definition.embeddedBash)) return `!\`${command}\``;
      return `run \`${command}\` and report its output`;
    },
    skillRef: (id) => `\`${value("skillRef", platform, definition.skillSigil)}${nativeSkill("it.skillRef", id)}\``,
    skillInvoke: (id) => {
      const name = nativeSkill("it.skillInvoke", id);
      const kind = value("skillInvoke", platform, definition.skillInvoke);
      if (kind === "tool-block") return `<skill>\n<name>${name}</name>\n</skill>`;
      if (kind === "mention") return `Use $${name}.`;
      if (kind === "skill-tool") return `Load the \`${name}\` skill with the \`skill\` tool (\`id: ${name}\`).`;
      return `Use the ${name} skill.`;
    },
    agentRef: (id) => {
      if (!AGENT_ID.test(id)) invalid("it.agentRef", platform, `invalid agent id ${id}`);
      const naming = value("agentRef", platform, definition.agentNaming);
      if (naming === "colon") return `\`${id}\``;
      const name = id.split(":").slice(1).join("-");
      return `\`${naming === "flattened" ? "$" : ""}${name}\``;
    },
    agentSlotVar: (name) =>
      `[${role("it.agentSlotVar", platform, name)}_${value("agentSlotVar", platform, definition.agentSlotSuffix)}]`,
    conventionsFile: value("conventionsFile", platform, definition.conventionsFile),
    hostIdentity: (name) => {
      const identity = value("hostIdentity", platform, definition.hostIdentity);
      if (name !== undefined && !/^[a-z][a-z0-9-]*$/.test(name))
        invalid("it.hostIdentity", platform, `invalid role ${name}`);
      if (platform === "opencode" && identity)
        return (
          identity.replace("OpenCode", options.opencodeProductName ?? "OpenCode") + (name ? ` serving as ${name}` : "")
        );
      return name && identity ? `${identity} serving as ${name}` : identity;
    },
    get hostAgentName() {
      const agentName = value("hostAgentName", platform, definition.hostAgentName);
      return platform === "opencode"
        ? agentName.replace("OpenCode", options.opencodeProductName ?? "OpenCode")
        : agentName;
    },
    get pluginRootVar() {
      return value("pluginRootVar", platform, definition.pluginRootVar);
    },
    platformDir: (kind: PlatformPathKind) => {
      if (!(["skills", "agents", "hooks", "plugin", "conventions"] as string[]).includes(kind))
        invalid("it.platformDir", platform, `unknown logical key ${kind}`);
      const configured = options.platformDirs?.[kind];
      const path = configured ?? value("platformDir", platform, definition.logicalPaths[kind]);
      if (path.startsWith("/") || path.split(/[\\/]/).includes(".."))
        invalid("it.platformDir", platform, `${kind} escapes its root`);
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
        if (!/^[a-z][a-z0-9-]*$/.test(type)) invalid("subagent.dispatch", platform, `invalid type ${type}`);
        if (opts.taskName !== undefined && !/^[a-z][a-z0-9_-]*$/.test(opts.taskName))
          invalid("subagent.dispatch", platform, `invalid taskName ${opts.taskName}`);
        const dialect = value("subagent.dispatch", platform, definition.subagents);
        if (dialect === "opencode")
          return `Delegate to the \`${type}\` agent${opts.parallel ? " in parallel" : ""} with the \`subagent\` tool (\`agent: ${type}\`${opts.background ? ", `background: true`" : ""}); provide a short description and complete prompt${opts.taskName ? ` for \`${opts.taskName}\`` : ""}.`;
        if (dialect === "antigravity") return `Delegate to the \`${type}\` subagent with \`invoke_subagent\`.`;
        if (dialect === "claude")
          return `Spawn \`${type[0]?.toUpperCase()}${type.slice(1)}\` subagents${opts.parallel ? " in parallel" : ""}${opts.background ? " with `run_in_background: true`" : ""}${opts.taskName ? ` for \`${opts.taskName}\`` : ""}`;
        return `Spawn \`${type}\` sub-agents${opts.parallel ? " in parallel" : ""} (\`spawn_agent\` with \`agent_type: ${type}\`${opts.taskName ? ` and \`task_name: ${opts.taskName}\`` : ""})`;
      },
      reengage: (opts = {}) => {
        const dialect = value("subagent.reengage", platform, definition.subagents);
        if (dialect === "opencode")
          return "continue the child conversation with the `subagent` tool and its returned `sessionID`";
        if (dialect === "antigravity") {
          if (opts.live === true) return "contact it with `send_message`";
          if (opts.live === false) return "inspect its state with `manage_subagents`";
          return "check its state with `manage_subagents`, then contact it with `send_message` if it is live";
        }
        if (opts.live === true) return dialect === "claude" ? "wake it with a DM" : "re-engage it with `send_message`";
        if (opts.live === false)
          return dialect === "claude" ? "resume it, then wake it with a DM" : "re-engage it with `resume_agent`";
        return dialect === "claude"
          ? "wake it with a DM"
          : "re-engage it (`send_message` if live, `resume_agent` if completed)";
      },
      resultChannel: (orchestrator = true) => {
        if (value("subagent.resultChannel", platform, definition.subagents) === "opencode")
          return "to the parent session in the final response";
        const recipient = orchestrator ? "to me, the orchestrator" : "to `team-lead`";
        return value("subagent.resultChannel", platform, definition.subagents) === "antigravity"
          ? `${recipient}${orchestrator ? "," : ""} with \`send_message\``
          : recipient;
      },
    },
    worktree: {
      enter: () => {
        const dialect = value("worktree.enter", platform, definition.worktree);
        if (dialect === "opencode")
          return "Use `execute` to call `opencode.worktree_create` with a name, then `opencode.session_move` with the returned directory; continue destination-dependent work in a later call.";
        return dialect === "tools" ? "Use the `EnterWorktree` tool." : "Run `create-worktree`.";
      },
      remove: () => {
        const dialect = value("worktree.remove", platform, definition.worktree);
        if (dialect === "opencode")
          return "Use `execute` to call `opencode.worktree_remove` for the recorded worktree directory.";
        return dialect === "tools" ? "Use the `ExitWorktree` tool." : "Run `remove-worktree`.";
      },
    },
  };
  return helpers;
}
