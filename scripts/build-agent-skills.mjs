#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (args) => execFileSync("yarn", args, { cwd: repo, stdio: "inherit", env: process.env });

run(["workspace", "@goodfoot/typescript-metrics", "build"]);
execFileSync(process.execPath, [
  "node_modules/tsx/dist/cli.mjs", "packages/agent-skills/src/cli.ts", "build", "--root", "skills-src",
  "--target", "claude-code=plugins-claude/goodfoot/skills",
  "--target", "codex=plugins-codex/goodfoot/skills",
  "--target", "opencode=plugins-opencode/goodfoot/skills",
  "--target", "opencode=skills",
  "**/*",
], { cwd: repo, stdio: "inherit", env: process.env });
