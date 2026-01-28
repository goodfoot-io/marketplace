// Test destructured imports and callback patterns
import { capitalize, formatName } from "../utils/strings.js";

/**
 * Format user data
 */
export function formatUser(user: { firstName: string; lastName: string }): string {
  return formatName(user.firstName, user.lastName);
}

/**
 * Format a list of names with callback pattern
 */
export function formatNames(names: string[]): string[] {
  return names.map(capitalize);
}

/**
 * Higher-order function that uses capitalize
 */
export function createFormatter(): (s: string) => string {
  return (s: string) => capitalize(s);
}

/**
 * Conditional call
 */
export function maybeCapitalize(str: string, shouldCapitalize: boolean): string {
  if (shouldCapitalize) {
    return capitalize(str);
  }
  return str;
}

/**
 * Arrow function with implicit return
 */
export const quickCapitalize = (s: string): string => capitalize(s);
