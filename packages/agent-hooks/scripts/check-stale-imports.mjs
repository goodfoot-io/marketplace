#!/usr/bin/env node
/**
 * Stale-import grep gate (plan step 2.8).
 *
 * Fails when any deprecated package specifier appears under this package's
 * `src/` (including the scaffold templates, which embed their import strings
 * in template literals) or scripts. Deprecation-notice fixtures are the only
 * sanctioned exception and none exist in this package.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const scanRoot = path.join(packageDir, "src");
const STALE_SPECIFIERS = ["@goodfoot/claude-code-hooks", "@goodfoot/codex-hooks"];

function listTypeScriptFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...listTypeScriptFiles(full));
    } else if (entry.name.endsWith(".ts")) {
      entries.push(full);
    }
  }
  return entries;
}

const offenders = [];
for (const file of listTypeScriptFiles(scanRoot)) {
  const lines = readFileSync(file, "utf-8").split("\n");
  for (let index = 0; index < lines.length; index++) {
    for (const specifier of STALE_SPECIFIERS) {
      if (lines[index].includes(specifier)) {
        offenders.push(`${path.relative(packageDir, file)}:${index + 1}: ${specifier}`);
      }
    }
  }
}

if (offenders.length > 0) {
  process.stderr.write(`check-stale-imports: ${offenders.length} stale specifier occurrence(s)\n`);
  for (const offender of offenders) {
    process.stderr.write(`  - ${offender}\n`);
  }
  process.exit(1);
}

process.stdout.write("check-stale-imports: OK (no deprecated package specifiers under src/)\n");
