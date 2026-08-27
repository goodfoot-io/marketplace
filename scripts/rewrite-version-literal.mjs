#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Rewrites a version number embedded in source code, identified by a regex the
 * registry declares.
 *
 * A version that lives in a string literal rather than a JSON field cannot be
 * synced with jq, and hand-maintaining it is how `agent-skills --version` came
 * to report a number the package had not published. The declared pattern must
 * match exactly once and must capture the version: matching zero times means
 * the anchor has rotted, and matching twice means the pattern is not naming a
 * single site. Either way the answer is to fail, not to guess which occurrence
 * was meant.
 *
 * Usage: rewrite-version-literal.mjs <file> <pattern> <version> [--check]
 * Exit 1 on drift in --check mode, or on any ambiguity in either mode.
 */

const [file, pattern, version, ...rest] = process.argv.slice(2);
if (!file || !pattern || !version) {
  process.stderr.write("Usage: rewrite-version-literal.mjs <file> <pattern> <version> [--check]\n");
  process.exit(1);
}
const checkOnly = rest.includes("--check");

const text = readFileSync(file, "utf8");
const matches = [...text.matchAll(new RegExp(pattern, "g"))];

if (matches.length !== 1) {
  process.stderr.write(`${file}: version pattern matched ${matches.length} sites, expected exactly 1: ${pattern}\n`);
  process.exit(1);
}

const [whole, captured] = matches[0];
if (captured === undefined) {
  process.stderr.write(`${file}: version pattern must capture the version: ${pattern}\n`);
  process.exit(1);
}
if (captured === version) process.exit(0);

if (checkOnly) {
  process.stderr.write(`  drift: ${file} (${captured} != ${version})\n`);
  process.exit(1);
}

const replaced = whole.replace(captured, version);
writeFileSync(file, text.slice(0, matches[0].index) + replaced + text.slice(matches[0].index + whole.length));
process.stdout.write(`  updated ${file} (${captured} -> ${version})\n`);
