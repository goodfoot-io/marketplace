#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { assertSafeTargets, cliArgs, diagnosticSites, loadRegistry, repo } from "./agent-skills-registry.mjs";

/**
 * Runs the bundler's own portability linter over every registry plugin.
 *
 * The linter shipped with the bundler and was never invoked on the templates
 * the repository builds from, so `agent-skills lint` was a capability the card
 * migrated seven plugins onto without ever exercising. Wiring it here means a
 * template that stops being portable fails a check instead of quietly
 * rendering wrong on one platform.
 *
 * Diagnostics are compared against each plugin's declared `lintBaseline`
 * rather than required to be zero. goodfoot's marketing corpus carries
 * frontmatter the linter does not model, and rewriting it is a separate
 * decision from turning the check on. The comparison is an exact set in both
 * directions: a new diagnostic fails, and so does a declared one that no
 * longer occurs, so the baseline cannot quietly outlive what it excuses.
 */

const registry = loadRegistry();
assertSafeTargets(registry);

let failed = false;

for (const plugin of registry.plugins) {
  const baseline = plugin.lintBaseline;
  if (!baseline || !Array.isArray(baseline.diagnostics)) {
    process.stderr.write(`${plugin.name}: registry declares no lintBaseline.\n`);
    failed = true;
    continue;
  }

  const result = spawnSync(process.execPath, cliArgs(plugin, "lint"), {
    cwd: repo,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    encoding: "utf8",
  });
  if (result.error) throw result.error;

  const observed = diagnosticSites(result.stderr ?? "");
  const declared = [...baseline.diagnostics].sort();

  const added = observed.filter((site) => !declared.includes(site));
  const stale = declared.filter((site) => !observed.includes(site));

  if (added.length > 0) {
    process.stderr.write(
      `\n${plugin.name}: ${added.length} lint diagnostic(s) not in the registry baseline:\n` +
        `${added.map((site) => `  ${site}`).join("\n")}\n`,
    );
    failed = true;
  }
  if (stale.length > 0) {
    process.stderr.write(
      `\n${plugin.name}: ${stale.length} baseline entr(y/ies) no longer occur — remove them from the registry:\n` +
        `${stale.map((site) => `  ${site}`).join("\n")}\n`,
    );
    failed = true;
  }

  // A clean plugin must also exit 0, so a linter that silently stopped
  // producing output cannot be mistaken for a codebase that got clean.
  if (declared.length === 0 && result.status !== 0) {
    process.stderr.write(`\n${plugin.name}: lint exited ${result.status} with no reported diagnostics.\n`);
    failed = true;
  }

  if (added.length === 0 && stale.length === 0) {
    const note = declared.length === 0 ? "clean" : `${declared.length} baselined: ${baseline.reason}`;
    process.stdout.write(`${plugin.name}: ${note}\n`);
  }
}

process.exit(failed ? 1 : 0);
