/**
 * PreToolUse hook: ESLint/TypeScript/Biome bypass prevention.
 *
 * Prevents prohibited bypass patterns from being added to JS/TS files.
 *
 * @see https://code.claude.com/docs/en/hooks#pretooluse
 */

import {
  type PatternCheckResult,
  checkContentForPattern,
  getFilePath,
  isJsTsFile,
  preToolUseHook,
  preToolUseOutput,
} from "@goodfoot/agent-hooks/claude-code";

import { BYPASS_PATTERNS, GUIDANCE_MESSAGE } from "./shared/bypass.js";

export default preToolUseHook({ matcher: "Write|Edit|MultiEdit", timeout: 10000 }, (input, { logger }) => {
  const filePath = getFilePath(input);

  // Skip if no file path or not a JS/TS file
  if (!filePath || !isJsTsFile(filePath)) {
    logger.debug("Skipping non-JS/TS file", { filePath });
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: "allow",
        permissionDecisionReason: "No content to check",
      },
    });
  }

  logger.debug("Checking file for bypass patterns", { filePath });

  // Check each pattern and collect violations
  const violations: string[] = [];

  for (const { pattern, description } of BYPASS_PATTERNS) {
    const result: PatternCheckResult | null = checkContentForPattern(input, pattern);

    // Only report if the pattern is being ADDED (not already present)
    if (result?.isAddition) {
      violations.push(description);
      logger.warn("Bypass pattern being added", { pattern: description, matches: result.matches });
    }
  }

  // If no violations, allow the operation
  if (violations.length === 0) {
    logger.debug("No violations found");
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: "allow",
        permissionDecisionReason: "No ESLint/TypeScript/Biome rule bypasses detected",
      },
    });
  }

  // Build denial message
  const violationList = violations.map((v) => `- ${v}`).join("\n");
  const reason = `The following ESLint/TypeScript/Biome rule bypasses are not allowed:\n${violationList}\n\n${GUIDANCE_MESSAGE}`;

  logger.info("Denying operation due to bypass patterns", { violations });

  return preToolUseOutput({
    systemMessage:
      "ESLint/TypeScript/Biome bypass prevention: Fix the underlying issue instead of using bypass comments or type casts.",
    hookSpecificOutput: {
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });
});
