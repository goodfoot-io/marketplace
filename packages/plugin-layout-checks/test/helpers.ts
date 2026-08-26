import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: THIS_DIR,
  encoding: "utf8",
}).trim();

export const SKILLS_ROOT = "skills";
export const CLAUDE_TREE = "plugins-claude/goodfoot";
export const CODEX_TREE = "plugins-codex/goodfoot";
export const OPENCODE_TREE = "plugins-opencode/goodfoot";

/** The six goodfoot skills, single-sourced at the repo root. */
export const EXPECTED_SKILLS = [
  "documentation",
  "instructions",
  "marketing",
  "skillify",
  "typescript-metrics",
  "worktree-cleanup",
] as const;

export const EXPECTED_COMMANDS = [
  "ask-me.md",
  "best-person.md",
  "parallel.md",
  "prove-it.md",
  "questions.md",
  "reproduce-then-resolve.md",
  "structured-english.md",
] as const;

export const EXPECTED_AGENTS = ["history.md", "tracer.md"] as const;

/** 13 scripts at bin/ plus the two bash suites under bin/tests/. */
export const EXPECTED_BIN = [
  "analyze-typescript-files",
  "find-claude-pid",
  "initialize-project",
  "print-call-sites.mjs",
  "print-dependencies",
  "print-dependencies.mjs",
  "print-inverse-dependencies",
  "print-inverse-dependencies.mjs",
  "print-type-analysis",
  "print-type-analysis.mjs",
  "typescript-metrics.mjs",
  "wait-for-arguments",
  "write-arguments",
] as const;

export const EXPECTED_BIN_TESTS = ["wait-for-arguments.sh", "write-arguments.sh"] as const;

/**
 * Relative link text for a platform-tree skill entry pointing back at the
 * shared root tree. Identical depth for plugins-claude and plugins-opencode.
 */
export function skillLinkText(skill: string): string {
  return `../../../${SKILLS_ROOT}/${skill}`;
}

/** Runs git against the repo (worktree-aware) and returns stdout. */
export function git(args: string[]): string {
  return execFileSync("git", ["-C", REPO_ROOT, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

export interface IndexEntry {
  mode: string;
  hash: string;
  stage: number;
  path: string;
}

/** Raw `git ls-files -s` entries under a path prefix. */
export function indexEntries(prefix: string): IndexEntry[] {
  const out = git(["ls-files", "-s", "--", prefix]).trim();
  if (!out) return [];
  return out.split("\n").map((line) => {
    const [meta, filePath] = line.split("\t");
    const [mode, hash, stage] = meta.trim().split(/\s+/);
    return { mode, hash, stage: Number(stage), path: filePath };
  });
}

/** True when the path is tracked by git in this worktree. */
export function isTracked(relPath: string): boolean {
  return indexEntries(relPath).length > 0;
}

/** Git index mode for a single tracked path, or null when untracked. */
export function indexMode(relPath: string): string | null {
  const entries = indexEntries(relPath);
  if (entries.length === 0) return null;
  return entries[0].mode;
}

/** Recursively lists relative paths of every file under a directory. */
export function walkFiles(absDir: string, relPrefix = ""): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...walkFiles(path.join(absDir, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results.sort();
}

export function repoPath(...segments: string[]): string {
  return path.join(REPO_ROOT, ...segments);
}

export function readJson<T = unknown>(relPath: string): T {
  return JSON.parse(fs.readFileSync(repoPath(relPath), "utf8")) as T;
}
