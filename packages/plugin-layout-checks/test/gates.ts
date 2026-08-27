import * as fs from "node:fs";
import * as path from "node:path";
import { repoPath, walkFiles } from "./helpers.js";
import type { Platform } from "./registry.js";

/**
 * Gate A and Gate B detectors, separated from their fixtures so each can be
 * exercised against planted content. Both gates start green against goodfoot,
 * so without a self-test a green run could not be told apart from a gate that
 * was never wired up.
 */

/** Directory prefix each platform's own trees live under. */
const PLATFORM_TREE_PREFIX: Record<Platform, string> = {
  "claude-code": "plugins-claude/",
  codex: "plugins-codex/",
  opencode: "plugins-opencode/",
};

const OTHER_TREE_PREFIX = /plugins-(claude|codex|opencode)\//g;

/** Renders a shell/plugin substitution, e.g. `PLUGIN_ROOT` -> `${PLUGIN_ROOT}`. */
const substitution = (name: string) => `\${${name}}`;

/** The Claude Code plugin-root substitution, invalid in a codex or opencode tree. */
export const CLAUDE_ROOT_TOKEN = substitution("CLAUDE_PLUGIN_ROOT");

/** The Codex/OpenCode plugin-root substitution, invalid in a claude-code tree. */
export const CODEX_ROOT_TOKEN = substitution("PLUGIN_ROOT");

export interface Leak {
  file: string;
  line: number;
  token: string;
}

/**
 * Blanks single-backtick inline-code spans, which mark a token as a *mention*
 * rather than a *use*. Applied only outside fenced blocks — scanning inside
 * fences is the entire reason this gate exists, since agent-skills lint
 * structurally cannot see there.
 */
const withoutInlineCode = (line: string) => line.replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length));

/**
 * Scans one file's full text — fenced code blocks included — for tokens
 * belonging to a platform other than the tree it sits in.
 *
 * Two things separate a leak from correct cross-dialect prose, and both are
 * needed. The gate matches the brace-delimited substitution form rather than
 * the bare identifier, and it treats a backticked token as a mention. Both
 * exist for the same sentence, agent-hooks' codex/SKILL.md:300: "Plugin mode
 * emits `${PLUGIN_ROOT}`-relative commands … Codex injects `PLUGIN_ROOT` (and
 * `CLAUDE_PLUGIN_ROOT` for compatibility)". That is correct Codex prose about
 * Codex, it renders into the *Claude* tree because the skill documenting Codex
 * hooks ships to Claude Code readers, and it must survive verbatim. The
 * brace-vs-bare rule alone does not save it — the same sentence carries both
 * forms, and the brace form is the one nobody noticed.
 *
 * A real leak is a *use*: `@${CLAUDE_PLUGIN_ROOT}/skills/…` in a file
 * reference, or a shell substitution inside a fence. Neither is backticked.
 */
export function scanText(platform: Platform, file: string, text: string): Leak[] {
  const leaks: Leak[] = [];
  const ownPrefix = PLATFORM_TREE_PREFIX[platform];
  let fenced = false;

  text.split("\n").forEach((raw, index) => {
    if (/^\s*```/.test(raw)) {
      fenced = !fenced;
      return;
    }
    const line = fenced ? raw : withoutInlineCode(raw);
    const record = (token: string) => leaks.push({ file, line: index + 1, token });

    if (platform !== "claude-code" && /\$\{CLAUDE_PLUGIN_ROOT\}/.test(line)) record(CLAUDE_ROOT_TOKEN);
    if (platform === "claude-code" && /\$\{PLUGIN_ROOT\}/.test(line)) record(CODEX_ROOT_TOKEN);

    for (const match of line.matchAll(OTHER_TREE_PREFIX)) {
      if (match[0] !== ownPrefix) record(match[0]);
    }
  });

  return leaks;
}

/** Gate B over a real generated tree. */
export function scanTree(platform: Platform, treePath: string): Leak[] {
  return walkFiles(repoPath(treePath)).flatMap((relative) => {
    const buffer = fs.readFileSync(repoPath(treePath, relative));
    if (buffer.includes(0)) return []; // binary payload, not prose
    return scanText(platform, path.posix.join(treePath, relative), buffer.toString("utf8"));
  });
}

export interface SkillName {
  /** Registry plugin the skill was shipped by. */
  plugin: string;
  /** OpenCode root it was found under. */
  root: string;
  file: string;
  name: string;
}

/** Reads the frontmatter `name:` a platform tree actually ships. */
export function frontmatterName(text: string): string | null {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return null;
  const match = /^name:[ \t]*(.+?)[ \t]*$/m.exec(text.slice(4, end));
  return match ? match[1] : null;
}

/** Every `name:` shipped under one OpenCode root. */
export function skillNamesUnder(plugin: string, root: string): SkillName[] {
  return walkFiles(repoPath(root))
    .filter((relative) => path.basename(relative) === "SKILL.md")
    .flatMap((relative) => {
      const name = frontmatterName(fs.readFileSync(repoPath(root, relative), "utf8"));
      return name === null ? [] : [{ plugin, root, file: path.posix.join(root, relative), name }];
    });
}

/**
 * Gate A. OpenCode merges every registered skills.path into one flat record
 * keyed by frontmatter `name:` and, on a duplicate, warns without returning —
 * so a collision is last-writer-wins and the losing skill is silently absent
 * at runtime. Per-plugin directories cannot namespace this away: the key is
 * the name, not the path.
 */
export function duplicateNames(entries: SkillName[]): Map<string, SkillName[]> {
  const byName = new Map<string, SkillName[]>();
  for (const entry of entries) {
    const existing = byName.get(entry.name);
    if (existing) existing.push(entry);
    else byName.set(entry.name, [entry]);
  }
  return new Map([...byName].filter(([, group]) => group.length > 1));
}
