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
} from "@goodfoot/claude-code-hooks";

// Build pattern strings dynamically to avoid self-matching
const ESLINT = "eslint";
const DISABLE = "disable";
const TS = "ts";
const IGNORE = "ignore";
const EXPECT = "expect";
const ERROR = "error";
const NOCHECK = "nocheck";
const BIOME = "biome";
const AS = "as";
const ANY = "any";

/**
 * Pattern definitions with descriptions for error messages.
 */
const BYPASS_PATTERNS: ReadonlyArray<{ pattern: RegExp; description: string }> = [
  // ESLint patterns
  {
    pattern: new RegExp(`\\/\\/\\s*${ESLINT}-${DISABLE}(-next-line|-line)?\\b`, "g"),
    description: `ESLint ${DISABLE} comment`,
  },
  {
    pattern: new RegExp(`\\/\\*\\s*${ESLINT}-${DISABLE}\\b`, "g"),
    description: `ESLint block ${DISABLE} comment`,
  },
  // TypeScript patterns
  {
    pattern: new RegExp(`\\/\\/\\s*@${TS}-${IGNORE}\\b`, "g"),
    description: `TypeScript @${TS}-${IGNORE} comment`,
  },
  {
    pattern: new RegExp(`\\/\\/\\s*@${TS}-${EXPECT}-${ERROR}\\b`, "g"),
    description: `TypeScript @${TS}-${EXPECT}-${ERROR} comment`,
  },
  {
    pattern: new RegExp(`\\/\\/\\s*@${TS}-${NOCHECK}\\b`, "g"),
    description: `TypeScript @${TS}-${NOCHECK} comment`,
  },
  {
    pattern: new RegExp(`\\b${AS}\\s+${ANY}\\b`, "g"),
    description: `TypeScript '${AS} ${ANY}' type casting`,
  },
  // Biome v2 patterns (order matters - more specific patterns first)
  {
    pattern: new RegExp(`\\/\\/\\s*${BIOME}-${IGNORE}-all\\b`, "g"),
    description: "Biome file-level suppress comment",
  },
  {
    pattern: new RegExp(`\\/\\/\\s*${BIOME}-${IGNORE}-start\\b`, "g"),
    description: "Biome range suppress start comment",
  },
  {
    pattern: new RegExp(`\\/\\/\\s*${BIOME}-${IGNORE}-end\\b`, "g"),
    description: "Biome range suppress end comment",
  },
  {
    pattern: new RegExp(`\\/\\/\\s*${BIOME}-${IGNORE}[^-]`, "g"),
    description: "Biome suppress comment",
  },
  {
    pattern: new RegExp(`\\/\\*\\s*${BIOME}-${IGNORE}`, "g"),
    description: "Biome block suppress comment",
  },
];

/**
 * Guidance message shown when denying an operation.
 */
const GUIDANCE_MESSAGE = `Instead of bypassing rules, please:
- Fix the underlying type or linting issue
- Refactor the code to be type-safe
- Use more specific types instead of '${ANY}'
- Configure ESLint/TypeScript/Biome rules in project configuration files if needed`;

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
