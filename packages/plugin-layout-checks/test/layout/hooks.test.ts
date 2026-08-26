import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { CLAUDE_TREE, CODEX_TREE, repoPath } from "../helpers.js";

interface HookEntry {
  type?: string;
  command?: string;
}

interface MatcherGroup {
  matcher?: string;
  hooks?: HookEntry[];
}

/** Plugin-root variables each transport is allowed to use. */
const PLUGIN_ROOT_VARS = ["CLAUDE_PLUGIN_ROOT", "PLUGIN_ROOT"].flatMap((name) => [`$${name}`, `\${${name}}`]);

function collectCommands(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectCommands(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.command === "string") out.push(record.command);
    for (const child of Object.values(record)) {
      if (typeof child !== "string") collectCommands(child, out);
    }
  }
  return out;
}

/**
 * Fails closed when any hooks.json references a path that does not resolve
 * inside its own plugin tree: substitute the platform's root variable, take
 * the token that looks like a path, and require it to exist in-tree.
 */
function assertNoDanglingReferences(tree: string): void {
  const treeDir = repoPath(tree);
  const hooksJsonPath = repoPath(tree, "hooks/hooks.json");
  expect(fs.existsSync(hooksJsonPath), `${tree}/hooks/hooks.json missing`).toBe(true);

  const config = JSON.parse(fs.readFileSync(hooksJsonPath, "utf8")) as Record<string, MatcherGroup[]>;
  const commands = collectCommands(config);

  expect(commands.length, `${tree}/hooks/hooks.json declares no hook commands`).toBeGreaterThan(0);

  for (const rawCommand of commands) {
    let substituted = rawCommand;
    for (const varForm of PLUGIN_ROOT_VARS) {
      substituted = substituted.split(varForm).join(treeDir);
    }

    const candidates = substituted
      .split(/\s+/)
      .map((token) => token.replace(/"/g, ""))
      .filter((token) => token.includes("/"));

    expect(candidates.length, `command "${rawCommand}" has no path-like token after substitution`).toBeGreaterThan(0);

    const resolved = candidates.map((token) => path.resolve(token));
    const target = resolved.find((candidate) => candidate.startsWith(treeDir));

    expect(target, `command "${rawCommand}" resolves outside ${tree}`).toBeDefined();
    expect(
      fs.existsSync(target as string),
      `command "${rawCommand}" dangles: ${(target as string).replace(treeDir, tree)} does not exist`,
    ).toBe(true);
  }
}

describe("hooks.json dangling-reference check", () => {
  it("claude tree hook commands resolve in-tree", () => {
    assertNoDanglingReferences(CLAUDE_TREE);
  });

  it("codex tree hook commands resolve in-tree", () => {
    assertNoDanglingReferences(CODEX_TREE);
  });
});
