/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to lowercase
 */
export function lowercase(str: string): string {
  return str.toLowerCase();
}

/**
 * Format a name with proper capitalization
 */
export function formatName(firstName: string, lastName: string): string {
  return `${capitalize(firstName)} ${capitalize(lastName)}`;
}
