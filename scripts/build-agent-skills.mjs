#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(
  readFileSync(path.join(repo, "packages/plugin-layout-checks/registry/plugins.json"), "utf8"),
);

execFileSync("yarn", ["workspace", "@goodfoot/typescript-metrics", "build"], {
  cwd: repo,
  stdio: "inherit",
  env: process.env,
});

// Checked here rather than only in the layout suite, because the build runs
// first and independently of it. materializeAll() publishes by renaming the
// whole target directory away, so a target pointed one level too high does not
// corrupt the plugin's hand-maintained siblings — it deletes them, atomically,
// on a build that exits 0. A test that notices afterwards is too late.
const pluginRoots = new Set(
  registry.plugins.flatMap((plugin) => [
    plugin.claudePluginRoot,
    plugin.codexPluginRoot,
    plugin.opencodePluginRoot,
  ]),
);

for (const plugin of registry.plugins) {
  for (const target of plugin.targets) {
    if (pluginRoots.has(target.path)) {
      throw new Error(
        `${plugin.name}: --target ${target.platform}=${target.path} is a plugin root. ` +
          `Publishing would delete that directory's non-skill contents. Use ${target.path}/skills.`,
      );
    }
    if (target.path.startsWith("plugins") && !target.path.endsWith("/skills")) {
      throw new Error(`${plugin.name}: --target ${target.platform}=${target.path} must end in /skills.`);
    }
  }
}

for (const plugin of registry.plugins) {
  const args = [
    "node_modules/tsx/dist/cli.mjs",
    "packages/agent-skills/src/cli.ts",
    "build",
    "--root",
    plugin.skillsSrc,
    ...plugin.targets.flatMap((target) => ["--target", `${target.platform}=${target.path}`]),
    ...plugin.platformDirs.flatMap((flag) => ["--platform-dir", flag]),
    "**/*",
  ];

  // The CLI writes "Warning: publication succeeded; cleanup residue …" to
  // stderr and exits 0, so a driver reading only the exit code treats leaked
  // backup, stage, and lock paths as success. A leaked lock is the sharp one:
  // the next build fails with "Target lock contention" pointing nowhere near
  // the run that leaked it.
  const result = spawnSync(process.execPath, args, {
    cwd: repo,
    stdio: ["ignore", "inherit", "pipe"],
    env: process.env,
    encoding: "utf8",
  });

  const stderr = result.stderr ?? "";
  if (stderr) process.stderr.write(stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(`\nagent-skills build failed for ${plugin.name} (exit ${result.status}).\n`);
    process.exit(result.status ?? 1);
  }

  const residue = stderr.split("\n").filter((line) => line.includes("cleanup residue"));
  if (residue.length > 0) {
    process.stderr.write(`\nRefusing to report success for ${plugin.name}: publication left residue behind.\n`);
    process.exit(1);
  }
}
