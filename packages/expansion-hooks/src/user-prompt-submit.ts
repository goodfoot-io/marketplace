import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { userPromptSubmitHook, userPromptSubmitOutput } from "@goodfoot/claude-code-hooks";
import type { ExpansionData } from "./expansion-store.js";
import { formatExpansion, readStore } from "./expansion-store.js";

export type SeenTerms = string[];

export function getSeenFilePath(sessionId: string): string {
  return `/tmp/expansion_${sessionId}.seen`;
}

export function loadSeen(sessionId: string): SeenTerms {
  const filePath = getSeenFilePath(sessionId);
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as SeenTerms;
  } catch {
    return [];
  }
}

export function saveSeen(sessionId: string, seen: SeenTerms): void {
  writeFileSync(getSeenFilePath(sessionId), JSON.stringify(seen));
}

export function findNewTerms(prompt: string, store: ExpansionData, seen: SeenTerms): string[] {
  return Object.keys(store).filter((key) => prompt.includes(key) && !seen.includes(key));
}

export default userPromptSubmitHook({}, async (input, { logger }) => {
  const store = readStore();
  const seen = loadSeen(input.session_id);
  const newTerms = findNewTerms(input.prompt, store, seen);

  logger.debug(`Found ${newTerms.length} new terms in prompt`);

  if (newTerms.length === 0) {
    return userPromptSubmitOutput({});
  }

  const formattedContext = newTerms.map((key) => formatExpansion(key, store[key])).join("\n\n");

  saveSeen(input.session_id, [...seen, ...newTerms]);

  return userPromptSubmitOutput({
    systemMessage: formattedContext,
    hookSpecificOutput: { additionalContext: formattedContext },
  });
});
