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
 * Usage: check-changelog-entry.mjs <file> <version> <releaseLabel> <versionSource>
 *
 * Exit 1 means the notes are missing or wrong and the author has to write
 * something; exit 3 means the notes could not be checked at all, because the
 * history this needs is unreadable. Callers summarise these differently and
 * must not merge them: a caller that reported every non-zero as "release notes
 * are missing; no script can write them for you" told an author on a shallow
 * checkout to write an entry that was already there, one line under this
 * script's own message saying the history could not be read.
 *
 * releaseLabel names the selected release line. versionSource is that line's
 * resolved manifest, the file
 * whose `.version` field every other surface follows. Its history is the whole
 * set of versions the plugin has released, and the whole set of headings is
 * checked against it. Checking only the newest heading is what let agent-hooks
 * release 1.0.5 and then document 1.0.6 directly above 1.0.4: the newest
 * heading matched the newest release at every commit, so nothing ever looked
 * below it and the hole was invisible to the gate and to 378 tests.
 *
 * It is required rather than optional. It was optional for one round, and an
 * omitted argument skipped the entire interior check in silence — the third
 * appearance on this card of an absence reading as a pass, after an undeclared
 * changelog list and a failed subprocess. Every caller passes it; nothing is
 * served by leaving a way not to.
 */

const [file, version, releaseLabel, versionSource] = process.argv.slice(2);
if (!file || !version || !releaseLabel || !versionSource) {
	process.stderr.write(
		"usage: check-changelog-entry.mjs <file> <version> <releaseLabel> <versionSource>\n",
	);
	process.exit(2);
}

/**
 * Whether this checkout's history is truncated.
 *
 * `git log` on a shallow clone succeeds and returns what it has, so the
 * interior check read one commit as the plugin's entire release history and
 * passed everything below it. Both evaluators witnessed the same tree refused
 * at full depth and accepted at `--depth 1`, with CI — checkout@v6, which
 * defaults to depth 1 — on the accepting side. A truncated history is not a
 * history with no gaps.
 *
 * Probed once. A probe that itself fails leaves the question open, which the
 * interior check below resolves the same way it resolves any unreadable
 * history: by refusing.
 */
let shallowProbe;
function isShallow() {
	if (shallowProbe === undefined) {
		try {
			shallowProbe =
				execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
					encoding: "utf8",
					stdio: ["ignore", "pipe", "pipe"],
				}).trim() === "true";
		} catch {
			shallowProbe = null;
		}
	}
	return shallowProbe;
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
 *
 * On a shallow clone that `git log` is withheld rather than caveated. It would
 * return a confidently wrong bound — a couple of commits presented as the whole
 * release — and an author who trusts it writes an entry covering a fraction of
 * what shipped. That is strictly worse than the tag namespace it replaced,
 * which at least returned visibly nothing, and it is the same asymmetry that
 * motivated dropping the tags in the first place.
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
			(isShallow() === false
				? ` — \`git log -- ${versionSource}\` is the ${releaseLabel} version sequence, ` +
					"and bounds the commits the entry needs to cover.\n"
				: " from the commits that changed the plugin since its last release. " +
					"This checkout is shallow, so `git log` here would name a fraction of them as if it were all of them; " +
					"run `git fetch --unshallow` first.\n")
		);
	}
	return "scripts/update-package-changelog.sh writes one from the commits since the last tag.\n";
}

const lines = readFileSync(file, "utf8").split("\n");
const expectedTitle = `# ${releaseLabel} changelog`;
if (lines[0]?.trim() !== expectedTitle) {
	process.stderr.write(
		`${file}: title is ${JSON.stringify(lines[0]?.trim() ?? "")}, but the ${releaseLabel} release line at ${versionSource} requires ${JSON.stringify(expectedTitle)}.\n` +
			`Replace the first line with ${expectedTitle}.\n`,
	);
	process.exit(1);
}
const headings = lines
	.map((line, index) => ({ index, match: /^## (.+?)\s*$/.exec(line) }))
	.filter((entry) => entry.match !== null);

if (headings.length === 0) {
	process.stderr.write(
		`${file}: the ${releaseLabel} (${versionSource}) has no release headings; expected a "## ${version}" entry at the top.\n${remediation(file)}`,
	);
	process.exit(1);
}

// The newest entry, not merely some entry: a CHANGELOG is read from the top,
// and a version buried below a newer heading is one nobody finds where they
// look for it.
const [latest] = headings;
if (latest.match[1] !== version) {
	process.stderr.write(
		`${file}: newest entry is "## ${latest.match[1]}", but the ${releaseLabel} release at ${versionSource} is ${version}.\n` +
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
		`${file}: the ${releaseLabel} entry "## ${version}" for ${versionSource} has no body. A heading alone tells a user which version they installed ` +
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
	const commits = git(["log", "--follow", "--format=%H", "--", source])
		.split("\n")
		.filter((line) => line.length > 0);
	const seen = new Set();
	let historicalPath = source;
	for (const commit of commits) {
		const blob = JSON.parse(git(["show", `${commit}:${historicalPath}`]));
		if (typeof blob.version === "string") seen.add(blob.version);
		const changes = git(["diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "-M", commit]);
		for (const line of changes.split("\n")) {
			const [status, oldPath, newPath] = line.split("\t");
			if (status?.startsWith("R") && newPath === historicalPath) historicalPath = oldPath;
		}
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

if (isShallow() !== false) {
	process.stderr.write(
		`${file}: this checkout's history is ${isShallow() === null ? "of unknown depth" : "shallow"}, so ` +
			`the ${releaseLabel} release sequence at ${versionSource} cannot be read in full and the versions below the newest ` +
			`cannot be verified.\nA truncated history is not a history with no gaps; refusing. ` +
			`Run \`git fetch --unshallow\` (in CI, set the checkout's fetch-depth to 0) and try again.\n`,
	);
	process.exit(3);
}

{
	let occupied;
	try {
		occupied = occupiedVersions(versionSource);
	} catch (error) {
		process.stderr.write(
			`${file}: could not read the ${releaseLabel} history at ${versionSource} to verify the entries below the newest ` +
				`(${error.message.trim()}).\nA history that cannot be read is not a history with no gaps; refusing.\n`,
		);
		process.exit(3);
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
			`${file}: the ${releaseLabel} history at ${versionSource} released ${skipped.join(", ")}, and ${
				skipped.length === 1 ? "that version has" : "those versions have"
			} no entry here.\n` +
				`A version that is neither described nor marked skipped is a release users cannot account for.\n` +
				remediation(file),
		);
		process.exit(1);
	}
}
