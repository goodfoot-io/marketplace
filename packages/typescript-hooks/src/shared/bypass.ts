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
export const BYPASS_PATTERNS: ReadonlyArray<{ pattern: RegExp; description: string }> = [
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
export const GUIDANCE_MESSAGE = `Instead of bypassing rules, please:
- Fix the underlying type or linting issue
- Refactor the code to be type-safe
- Use more specific types instead of '${ANY}'
- Configure ESLint/TypeScript/Biome rules in project configuration files if needed`;

// Compare each edit separately so a bypass elsewhere cannot hide a new one.
export function findBypassViolations(oldContent: string, newContent: string): string[] {
  return BYPASS_PATTERNS.filter(({ pattern }) => {
    const remaining = new Map<string, number>();
    for (const match of oldContent.matchAll(pattern)) {
      remaining.set(match[0], (remaining.get(match[0]) ?? 0) + 1);
    }
    for (const match of newContent.matchAll(pattern)) {
      const count = remaining.get(match[0]) ?? 0;
      if (!count) return true;
      remaining.set(match[0], count - 1);
    }
    return false;
  }).map(({ description }) => description);
}
