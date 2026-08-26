#!/usr/bin/env node
/**
 * E2E/unit parity checker (plan step 2.6).
 *
 * Maps every unit/e2e test file of the source package (`packages/claude-code-hooks`)
 * to its ported counterpart in this package and fails when either:
 *  - a counterpart file is missing, or
 *  - the counterpart has FEWER `it()`/`test()` block declarations than the
 *    source file (a same-named copy that quietly dropped cases).
 *
 * Filenames are kept identical by the port, except that source `e2e/*.test.ts`
 * lands under `e2e/claude-code/`. Fixture files must exist on both sides;
 * assertion counting applies to test files only.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageDir, "..", "..");
const sourceRoot = path.join(repoRoot, "packages", "claude-code-hooks");
const targetRoot = packageDir;

/** Counts `it(`/`test(` block declarations in a TypeScript source text. */
function countTestBlocks(source) {
  const matches = source.match(/\b(?:it|test)\s*(?:\.\w+)?\s*\(/g);
  return matches === null ? 0 : matches.length;
}

function listFilesRecursive(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...listFilesRecursive(full));
    } else if (entry.name.endsWith(".ts")) {
      entries.push(full);
    }
  }
  return entries;
}

/** Source-relative path → counterpart-relative path within agent-hooks. */
function counterpartFor(relativePath) {
  // The whole source e2e tree lands one level down, under e2e/claude-code/.
  if (relativePath.startsWith("e2e/")) {
    return path.join("e2e", "claude-code", relativePath.slice("e2e/".length));
  }
  // Unit tests keep their subpath: tests/<name>.test.ts, tests/types/<name>.ts
  return relativePath;
}

const failures = [];
let mappedFiles = 0;

/**
 * Codex-hooks mapping: unit tests land under tests/codex/ (filenames
 * preserved), the single e2e file under e2e/codex/, and the snapshot script
 * under scripts/ (existence-only — it is not a test file).
 */
function codexCounterpartFor(relativePath) {
  if (relativePath.startsWith("tests/")) {
    return path.join("tests", "codex", relativePath.slice("tests/".length));
  }
  if (relativePath === "e2e/runtime-and-build.test.ts") {
    return path.join("e2e", "codex", "runtime-and-build.test.ts");
  }
  if (relativePath.startsWith("scripts/") && relativePath.endsWith(".ts")) {
    return path.join("scripts", relativePath.slice("scripts/".length));
  }
  return undefined;
}

for (const relative of ["tests", "e2e"]) {
  for (const sourceFile of listFilesRecursive(path.join(sourceRoot, relative))) {
    const relFromSourceRoot = path.relative(sourceRoot, sourceFile);
    const targetRel = counterpartFor(relFromSourceRoot);
    const targetFile = path.join(targetRoot, targetRel);
    mappedFiles++;

    if (!existsSync(targetFile)) {
      failures.push(`MISSING counterpart: ${relFromSourceRoot} -> ${targetRel}`);
      continue;
    }

    if (relFromSourceRoot.endsWith(".test.ts") || path.basename(path.dirname(relFromSourceRoot)) === "types") {
      const sourceCount = countTestBlocks(readFileSync(sourceFile, "utf-8"));
      const targetCount = countTestBlocks(readFileSync(targetFile, "utf-8"));
      if (targetCount < sourceCount) {
        failures.push(`LOWER assertion count: ${relFromSourceRoot} (${sourceCount}) -> ${targetRel} (${targetCount})`);
      }
    }
  }
}

// Codex-hooks parity (plan step 3.2): same assertion-count rule.
{
  const codexSourceRoot = path.join(repoRoot, "packages", "codex-hooks");
  for (const relative of ["tests", "e2e", "scripts"]) {
    for (const sourceFile of listFilesRecursive(path.join(codexSourceRoot, relative))) {
      const relFromSourceRoot = path.relative(codexSourceRoot, sourceFile);
      const targetRel = codexCounterpartFor(relFromSourceRoot);
      if (targetRel === undefined) {
        continue;
      }
      const targetFile = path.join(targetRoot, targetRel);
      mappedFiles++;

      if (!existsSync(targetFile)) {
        failures.push(`MISSING counterpart: ${relFromSourceRoot} -> ${targetRel}`);
        continue;
      }

      if (relFromSourceRoot.endsWith(".test.ts")) {
        const sourceCount = countTestBlocks(readFileSync(sourceFile, "utf-8"));
        const targetCount = countTestBlocks(readFileSync(targetFile, "utf-8"));
        if (targetCount < sourceCount) {
          failures.push(
            `LOWER assertion count: ${relFromSourceRoot} (${sourceCount}) -> ${targetRel} (${targetCount})`,
          );
        }
      }
    }
  }
}

if (mappedFiles === 0) {
  failures.push("No source files discovered — mapping is empty, the check proves nothing.");
}
if (!existsSync(path.join(targetRoot, "e2e", "claude-code"))) {
  failures.push("e2e/claude-code/ directory absent — the ported suite is missing entirely.");
}
if (!existsSync(path.join(targetRoot, "e2e", "codex"))) {
  failures.push("e2e/codex/ directory absent — the ported Codex suite is missing entirely.");
}

if (failures.length > 0) {
  process.stderr.write(`check-e2e-parity: ${failures.length} failure(s)\n`);
  for (const failure of failures) {
    process.stderr.write(`  - ${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `check-e2e-parity: OK (${mappedFiles} source files mapped, all counterparts present with >= assertions)\n`,
);
