import { JsdocError } from './errors.js';
import type { SelectorInfo } from './types.js';

/**
 * Parses a selector string into its components.
 *
 * @param input - Selector string (e.g., "src/star-star/star.ts@3", "file.ts", "../config.js@2")
 * @returns SelectorInfo with type, pattern, and optional depth
 * @throws JsdocError INVALID_SELECTOR if input is empty
 * @throws JsdocError INVALID_DEPTH if depth is negative, non-integer, or float
 */
export function parseSelector(input: string): SelectorInfo {
  // Validate non-empty input
  if (!input || input.trim() === '') {
    throw new JsdocError('INVALID_SELECTOR', 'Selector cannot be empty');
  }

  let pattern = input;
  let depth: number | undefined;

  // Match @<digits> at the end of the string
  const depthMatch = input.match(/@(\d+)$/);

  if (depthMatch && depthMatch.index !== undefined) {
    const depthStr = depthMatch[1];
    const parsedDepth = parseInt(depthStr, 10);

    // Validate depth is non-negative integer
    if (parsedDepth < 0) {
      throw new JsdocError('INVALID_DEPTH', 'Depth must be non-negative');
    }

    // Check if the original string contained a float (e.g., @2.5)
    // This is prevented by our regex which only matches digits, but we should
    // also check if there's a decimal point before the @
    const beforeAt = input.substring(0, depthMatch.index);
    const afterDigits = input.substring(depthMatch.index + depthMatch[0].length);

    // If there are any characters after the digits, it's invalid
    if (afterDigits.length > 0) {
      throw new JsdocError('INVALID_DEPTH', 'Invalid depth format');
    }

    depth = parsedDepth;
    pattern = beforeAt;
  }

  // Additional check: if input contains @<number>.<number>, reject it
  if (/@\d+\.\d+$/.test(input)) {
    throw new JsdocError('INVALID_DEPTH', 'Depth must be an integer, not a float');
  }

  // Detect glob metacharacters
  const hasGlobChars = /[*?[\]{]/.test(pattern);
  const type = hasGlobChars ? 'glob' : 'path';

  return {
    type,
    pattern,
    depth,
  };
}
