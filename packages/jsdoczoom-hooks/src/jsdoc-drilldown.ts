/**
 * PostToolUse hook that enriches Grep/Glob results with JSDoc summaries.
 *
 * After a Grep or Glob tool returns file paths, this hook filters for
 * .ts/.tsx files and runs drilldownFiles to extract JSDoc summaries,
 * returning them as additional context for Claude.
 *
 * @summary Enriches search results with JSDoc drill-down summaries
 */

import { isTsFile, postToolUseHook, postToolUseOutput } from "@goodfoot/claude-code-hooks";
import type { DrilldownResult } from "jsdoczoom";
import { drilldownFiles } from "jsdoczoom";

/**
 * Extract unique absolute .ts/.tsx file paths from a structured tool response.
 *
 * Handles both Glob responses (filenames array with absolute paths) and
 * Grep responses (filenames array for files_with_matches mode, or content
 * string with "path:line:content" lines for content mode).
 *
 * @param toolResponse - The structured tool_response object from PostToolUse
 * @param cwd - The working directory, used to resolve relative paths
 */
export function extractTsFilePaths(toolResponse: unknown, cwd: string): string[] {
  if (!toolResponse || typeof toolResponse !== "object") return [];

  const resp = toolResponse as Record<string, unknown>;
  const paths = new Set<string>();

  // Both Glob and Grep include a filenames array
  if (Array.isArray(resp.filenames)) {
    for (const f of resp.filenames) {
      if (typeof f !== "string") continue;
      const resolved = f.startsWith("/") ? f : `${cwd}/${f}`;
      if (isTsFile(resolved)) {
        paths.add(resolved);
      }
    }
  }

  // Grep content mode: "path:line:content" lines in the content string
  if (typeof resp.content === "string" && resp.content) {
    for (const line of resp.content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx <= 0) continue;
      const candidate = trimmed.slice(0, colonIdx);
      const resolved = candidate.startsWith("/") ? candidate : `${cwd}/${candidate}`;
      if (isTsFile(resolved)) {
        paths.add(resolved);
      }
    }
  }

  return [...paths];
}

/**
 * Format a DrilldownResult as JSON identical to `jsdoczoom` CLI output,
 * followed by an instruction to drill deeper with `npx jsdoczoom [next_id]`.
 */
export function formatDrilldownResult(result: DrilldownResult): string {
  if (result.items.length === 0) return "";

  const json = JSON.stringify(result);
  return `${json}\nRun \`npx jsdoczoom [next_id]\` for more details on the file.`;
}

export default postToolUseHook({ matcher: "Grep|Glob" }, async (input, { logger }) => {
  const filePaths = extractTsFilePaths(input.tool_response, input.cwd);

  if (filePaths.length === 0) {
    logger.debug("No .ts/.tsx files found in tool response");
    return postToolUseOutput({});
  }

  logger.info("Running JSDoc drilldown on search results", {
    fileCount: filePaths.length,
  });

  const result = await drilldownFiles(filePaths, 1, input.cwd);
  const formatted = formatDrilldownResult(result);

  if (!formatted) {
    return postToolUseOutput({});
  }

  return postToolUseOutput({
    systemMessage: formatted,
    hookSpecificOutput: {
      additionalContext: formatted,
    },
  });
});
