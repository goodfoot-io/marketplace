#!/usr/bin/env node
import { execFileSync } from "node:child_process";
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
 * Usage: check-changelog-entry.mjs <file> <version> [versionSource]
 *
 * With a versionSource — the plugin's registry `versionSurfaces.source`, the
 * file whose `.version` field every other surface follows — the whole set of
 * headings is checked against the whole set of versions that file has actually
 * held. Without it only the newest heading is checked, which is what let
 * agent-hooks release 1.0.5 and then document 1.0.6 directly above 1.0.4: the
 * newest heading matched the newest release at every commit, so nothing ever
 * looked below it and the hole was invisible to the gate and to 378 tests.
 */

const [file, version, versionSource] = process.argv.slice(2);
if (!file || !version) {
	process.stderr.write(
		"usage: check-changelog-entry.mjs <file> <version> [versionSource]\n",
	);
	process.exit(2);
}

/**
 * How to write the missing entry, which depends on where the file lives.
 *
 * update-package-changelog.sh only knows the packages tree: it derives the
 * version from `packages/<name>/package.json` and writes beside it. Pointed at
 * a plugin-level CHANGELOG it does not fail — it prepends an entry to the npm
 * package's changelog instead, stamped with the npm version, and reports
 * success. Where that version already heads the file the result is a duplicate
 * heading in a file that was correct, the complaint that started it unaddressed,
 * and nothing that looks wrong on review.
 *
 * The hand-written case points at `git log` on the plugin's own version source,
 * never at `git tag --list '<plugin>-v*'`, which this said once. For agent-hooks
 * and agent-skills that tag namespace tracks the npm package rather than the
 * plugin — at agent-hooks-v1.0.5 the plugin.json is still pinned at 1.0.2 — so
 * it bounds the wrong version line, and for the four plugins with no tags at all
 * it returns nothing, which reads as "there is nothing to cover."
 */
function remediation(path) {
	// Callers pass this path relative (the shell scripts) or absolute (the
	// layout suite), so anchor on the trailing plugins/<name>/ segment rather
	// than the start of the string.
	if (/(^|\/)plugins\/[^/]+\/CHANGELOG\.md$/.test(path)) {
		return (
			"No script writes this file: update-package-changelog.sh only handles the packages tree, " +
			"and pointed here it would write the npm package's changelog instead. " +
			"Write the entry by hand" +
			(versionSource
				? ` — \`git log -- ${versionSource}\` is this plugin's own version sequence, ` +
					"and bounds the commits the entry needs to cover.\n"
				: " from the commits that changed the plugin since its last release.\n")
		);
	}
	return "scripts/update-package-changelog.sh writes one from the commits since the last tag.\n";
}

const lines = readFileSync(file, "utf8").split("\n");
const headings = lines
	.map((line, index) => ({ index, match: /^## (.+?)\s*$/.exec(line) }))
	.filter((entry) => entry.match !== null);

if (headings.length === 0) {
	process.stderr.write(
		`${file}: no release headings; expected a "## ${version}" entry at the top.\n${remediation(file)}`,
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
			`Add a "## ${version}" entry describing what changed. ${remediation(file)}`,
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

/**
 * Every version the plugin's version source has ever held, oldest first.
 *
 * Derived from `git log` on that one path: the file's own history is the
 * plugin's own version sequence, with no other version line able to collide
 * with it. A failure to read that history is reported, never treated as "this
 * plugin has released nothing" — the same distinction the callers of
 * changelog-surfaces.mjs now make.
 */
function occupiedVersions(source) {
	const git = (args) =>
		execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	const commits = git(["log", "--format=%H", "--", source])
		.split("\n")
		.filter((line) => line.length > 0);
	const seen = new Set();
	for (const commit of commits) {
		const blob = JSON.parse(git(["show", `${commit}:${source}`]));
		if (typeof blob.version === "string") seen.add(blob.version);
	}
	return seen;
}

function compareVersions(a, b) {
	const parse = (v) => v.split(".").map((part) => Number.parseInt(part, 10));
	const [x, y] = [parse(a), parse(b)];
	for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
		const diff = (x[i] ?? 0) - (y[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

if (versionSource) {
	let occupied;
	try {
		occupied = occupiedVersions(versionSource);
	} catch (error) {
		process.stderr.write(
			`${file}: could not read ${versionSource}'s history to verify the entries below the newest ` +
				`(${error.message.trim()}).\nA history that cannot be read is not a history with no gaps; refusing.\n`,
		);
		process.exit(1);
	}
	const documented = new Set(headings.map((entry) => entry.match[1]));
	// Bounded below by the oldest heading the file carries. A CHANGELOG that
	// starts partway through a plugin's life is documenting from that point on,
	// not silently skipping everything before it — agent-hooks documents a 1.0.0
	// that its plugin.json never held, so the rule is documented ⊇ occupied over
	// the documented range, not equality.
	const floor = [...documented].sort(compareVersions)[0];
	const skipped = [...occupied]
		.filter(
			(released) =>
				!documented.has(released) &&
				compareVersions(released, floor) > 0 &&
				// Bounded above by the release being verified. A version the history
				// holds but the plugin has since come back down from was withdrawn,
				// not released: 2e6cbf8 reverted a spurious hook bump of agent-skills
				// to 1.0.13 with the changelog untouched at 1.0.12, and demanding
				// notes for a number nobody ever installed would be the gate inventing
				// work rather than finding a gap.
				compareVersions(released, version) <= 0,
		)
		.sort(compareVersions);
	if (skipped.length > 0) {
		process.stderr.write(
			`${file}: ${versionSource} released ${skipped.join(", ")}, and ${
				skipped.length === 1 ? "that version has" : "those versions have"
			} no entry here.\n` +
				`A version that is neither described nor marked skipped is a release users cannot account for.\n` +
				remediation(file),
		);
		process.exit(1);
	}
}
