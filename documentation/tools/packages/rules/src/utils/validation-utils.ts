/**
 * Common validation patterns and utilities
 */

// Version file pattern: v[number]-[YYYYMMDD]-[descriptive-status].md
// Status should describe changes, avoiding temporal/hyperbolic terms
export const VERSION_FILE_PATTERN = /^v\d+-\d{8}-[a-z]+(-[a-z]+)*\.md$/;

// Source file date prefix pattern: YYYYMMDD-
export const SOURCE_DATE_PREFIX_PATTERN = /^\d{8}-/;

// ISO-8601 date format
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

// URL pattern for source validation
export const URL_PATTERN =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

// Valid workflow states
export const VALID_WORKFLOW_STATES = [
  'assigned',
  'research',
  'drafting',
  'review',
  'revision',
  'final-review',
  'ready',
  'published',
  'archived'
] as const;

export type WorkflowState = (typeof VALID_WORKFLOW_STATES)[number];

// Vague attribution phrases to flag
export const VAGUE_ATTRIBUTIONS = [
  'multiple academic studies',
  'multiple studies',
  'various sources',
  'several studies',
  'many researchers',
  'numerous articles',
  'some experts',
  'research shows',
  'studies suggest'
] as const;

/**
 * Checks if a filename matches the version file pattern
 */
export function isValidVersionFilename(filename: string): boolean {
  return VERSION_FILE_PATTERN.test(filename);
}

/**
 * Checks if a filename has the required date prefix
 */
export function hasDatePrefix(filename: string): boolean {
  return SOURCE_DATE_PREFIX_PATTERN.test(filename);
}

/**
 * Validates an ISO-8601 date string
 */
export function isValidISODate(dateString: string): boolean {
  return ISO_DATE_PATTERN.test(dateString);
}

/**
 * Checks if a workflow state is valid
 */
export function isValidWorkflowState(state: string): boolean {
  return (VALID_WORKFLOW_STATES as readonly string[]).includes(state);
}

/**
 * Checks if text contains vague attributions
 */
export function containsVagueAttribution(text: string): string | null {
  const lowerText = text.toLowerCase();
  for (const phrase of VAGUE_ATTRIBUTIONS) {
    const index = lowerText.indexOf(phrase);
    if (index !== -1) {
      // Return the original case from the text
      return text.substring(index, index + phrase.length);
    }
  }
  return null;
}

/**
 * Extracts the first N lines from text content
 */
export function getFirstLines(content: string, lineCount: number = 10): string[] {
  return content.split('\n').slice(0, lineCount);
}
