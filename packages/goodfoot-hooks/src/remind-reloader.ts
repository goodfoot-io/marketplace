/**
 * Remind Reloader - SessionStart hook that re-injects file contents after context compaction.
 *
 * When a session starts due to compaction, this hook reads the list of file paths
 * stored by the /remind command (via a PID-keyed paths file) and outputs their full
 * contents wrapped in semantic XML tags.
 *
 * Unlike the implement-plan reloader, this is NOT one-shot: the paths file is preserved
 * so that files persist through multiple compactions. Users can add additional files
 * at any time by running /remind again.
 *
 * @see https://code.claude.com/docs/en/hooks#sessionstart
 */

import { existsSync, readFileSync } from "node:fs";
import { sessionStartHook, sessionStartOutput } from "@goodfoot/claude-code-hooks";
import { findClaudePid } from "./implement-plan-reloader.js";

/**
 * Returns the path to the remind paths file for the given Claude PID.
 * This file contains one absolute file path per line.
 */
export function getRemindPathsFilePath(claudePid: number): string {
	return `/tmp/claude_remind_${claudePid}.paths`;
}

export default sessionStartHook({ matcher: "compact" }, (_input, { logger }) => {
	const claudePid = findClaudePid();

	if (claudePid === null) {
		logger.debug("Could not find Claude PID");
		return sessionStartOutput({});
	}

	const pathsFile = getRemindPathsFilePath(claudePid);

	if (!existsSync(pathsFile)) {
		logger.debug("No remind paths file for this session", { claudePid });
		return sessionStartOutput({});
	}

	let rawPaths: string;
	try {
		rawPaths = readFileSync(pathsFile, "utf-8");
	} catch {
		logger.debug("Failed to read remind paths file", { claudePid });
		return sessionStartOutput({});
	}

	const filePaths = rawPaths
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	if (filePaths.length === 0) {
		logger.debug("Remind paths file is empty", { claudePid });
		return sessionStartOutput({});
	}

	const fileBlocks: string[] = [];
	const missing: string[] = [];

	for (const filePath of filePaths) {
		if (!existsSync(filePath)) {
			missing.push(filePath);
			logger.warn("Reminded file no longer exists, skipping", { filePath });
			continue;
		}

		try {
			const content = readFileSync(filePath, "utf-8");
			fileBlocks.push(`<file path="${filePath}">\n${content}\n</file>`);
		} catch {
			missing.push(filePath);
			logger.warn("Failed to read reminded file, skipping", { filePath });
		}
	}

	if (fileBlocks.length === 0) {
		logger.info("All reminded files are missing or unreadable", { claudePid, missing });
		return sessionStartOutput({});
	}

	const context = fileBlocks.join("\n\n");

	logger.info("Reloading reminded files after compaction", {
		claudePid,
		loaded: fileBlocks.length,
		missing: missing.length,
	});

	return sessionStartOutput({
		systemMessage: `Remind reloader: ${fileBlocks.length} file(s) restored after context compaction`,
		hookSpecificOutput: {
			additionalContext: context,
		},
	});
});
