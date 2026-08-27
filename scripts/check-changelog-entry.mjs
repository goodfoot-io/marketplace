#!/usr/bin/env node
import { readFileSync } from "node:fs";

/**
 * Verifies that a CHANGELOG carries a released entry for a version — and never
 * writes one.
 *
 * Every other release surface a bump touches holds a version and nothing else,
 * so propagation can just set the field. A CHANGELOG entry holds a sentence
 * only the author of the change can write, which is why it was left out of the
 * lockstep entirely: the surfaces a script could stamp moved to 1.0.12 while
 * the two files a user actually opens still ended at 1.0.11. Auto-stamping a
 * bare `## 1.0.12` would have closed the gate and left the user with a heading
 * that says nothing, so this refuses instead and names what is missing.
 *
 * Usage: check-changelog-entry.mjs <file> <version>
 */

const [file, version] = process.argv.slice(2);
if (!file || !version) {
	process.stderr.write("usage: check-changelog-entry.mjs <file> <version>\n");
	process.exit(2);
}

const lines = readFileSync(file, "utf8").split("\n");
const headings = lines
	.map((line, index) => ({ index, match: /^## (.+?)\s*$/.exec(line) }))
	.filter((entry) => entry.match !== null);

if (headings.length === 0) {
	process.stderr.write(
		`${file}: no release headings; expected a "## ${version}" entry at the top.\n`,
	);
	process.exit(1);
}

// The newest entry, not merely some entry: a CHANGELOG is read from the top,
// and a version buried below a newer heading is one nobody finds where they
// look for it.
const [latest] = headings;
if (latest.match[1] !== version) {
	process.stderr.write(
		`${file}: newest entry is "## ${latest.match[1]}", but the release being verified is ${version}.\n` +
			`Add a "## ${version}" entry describing what changed. ` +
			`scripts/update-package-changelog.sh writes one from the commits since the last tag.\n`,
	);
	process.exit(1);
}

const nextHeading = headings[1]?.index ?? lines.length;
const body = lines
	.slice(latest.index + 1, nextHeading)
	.filter((line) => line.trim().length > 0);
if (body.length === 0) {
	process.stderr.write(
		`${file}: "## ${version}" has no body. A heading alone tells a user which version they installed ` +
			`and nothing about what it changed.\n`,
	);
	process.exit(1);
}
