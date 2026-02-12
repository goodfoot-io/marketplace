import { readFileSync } from 'fs';
import ts from 'typescript';
import { JsdocError } from './errors.js';
import type { ParsedFileInfo } from './types.js';

/**
 * Extract the first file-level JSDoc block from TypeScript source text.
 *
 * The JSDoc block must appear before any code statements (after imports is OK).
 * Returns the raw JSDoc text without the leading `/**` and trailing `*​/` delimiters,
 * or null if no file-level JSDoc is found.
 */
export function extractFileJsdoc(sourceText: string): string | null {
  const sourceFile = ts.createSourceFile(
    'input.ts',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  // Check for syntax errors — if the file has diagnostics, throw PARSE_ERROR
  const diagnostics = getDiagnostics(sourceFile);
  if (diagnostics.length > 0) {
    throw new JsdocError(
      'PARSE_ERROR',
      `TypeScript parse error: ${diagnostics[0]}`,
    );
  }

  // Find the first non-import top-level statement
  let firstNonImportStatement: ts.Statement | undefined;
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      continue;
    }
    firstNonImportStatement = statement;
    break;
  }

  // If there are no non-import statements, check for comments at file start
  if (firstNonImportStatement === undefined) {
    return findFirstJsdocBlock(sourceText, 0, sourceText.length);
  }

  // The JSDoc block sits in the leading trivia of the first non-import statement.
  // Use getFullStart() to get the position including leading trivia, then scan
  // from there to the node's actual start for block comments.
  const fullStart = firstNonImportStatement.getFullStart();
  const nodeStart = firstNonImportStatement.getStart(sourceFile);

  // Also check from position 0 if there are no imports at all
  // (the JSDoc could be at the very start of the file)
  const searchStart = fullStart;

  return findFirstJsdocBlock(sourceText, searchStart, nodeStart);
}

/**
 * Find the first `/** ... *​/` block comment in the given text range.
 */
function findFirstJsdocBlock(
  sourceText: string,
  start: number,
  end: number,
): string | null {
  // Get all comment ranges from the beginning of the search area
  // We need to check leading comments for each statement, but simpler: scan text directly
  const commentRanges = getAllBlockComments(sourceText, start, end);

  for (const range of commentRanges) {
    const commentText = sourceText.slice(range.start, range.end);
    if (commentText.startsWith('/**') && !commentText.startsWith('/***')) {
      // Strip /** and */ delimiters
      const inner = commentText.slice(3, -2);
      return inner;
    }
  }

  return null;
}

/**
 * Scan for block comments in the source text between start and end positions.
 */
function getAllBlockComments(
  sourceText: string,
  start: number,
  end: number,
): Array<{ start: number; end: number }> {
  const results: Array<{ start: number; end: number }> = [];
  let pos = start;

  while (pos < end) {
    // Skip whitespace
    if (
      sourceText[pos] === ' ' ||
      sourceText[pos] === '\t' ||
      sourceText[pos] === '\n' ||
      sourceText[pos] === '\r'
    ) {
      pos++;
      continue;
    }

    // Check for block comment
    if (sourceText[pos] === '/' && pos + 1 < end && sourceText[pos + 1] === '*') {
      const commentStart = pos;
      pos += 2;
      while (pos < sourceText.length) {
        if (sourceText[pos] === '*' && pos + 1 < sourceText.length && sourceText[pos + 1] === '/') {
          pos += 2;
          break;
        }
        pos++;
      }
      results.push({ start: commentStart, end: pos });
      continue;
    }

    // Check for line comment
    if (sourceText[pos] === '/' && pos + 1 < end && sourceText[pos + 1] === '/') {
      pos += 2;
      while (pos < sourceText.length && sourceText[pos] !== '\n') {
        pos++;
      }
      continue;
    }

    // Any other character means we've hit code — stop scanning
    break;
  }

  return results;
}

/**
 * Get syntax error diagnostics from a parsed source file.
 */
function getDiagnostics(sourceFile: ts.SourceFile): string[] {
  // parseDiagnostics is available on the internal SourceFile
  const diags = (sourceFile as unknown as { parseDiagnostics: ts.DiagnosticWithLocation[] })
    .parseDiagnostics;
  if (!diags || diags.length === 0) return [];
  return diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

/**
 * Parse @summary tags and free-text description from raw JSDoc inner text.
 *
 * Returns an array of summary levels:
 * - L0..LN-1: @summary tags in source order
 * - LN: free-text description (always last, despite appearing first in JSDoc)
 *
 * Whitespace-only @summary tags are skipped.
 */
function parseSummaryLevels(jsdocText: string): string[] {
  const lines = jsdocText.split('\n');

  let freeText = '';
  const summaries: string[] = [];
  let currentTag: string | null = null;
  let currentContent = '';

  for (const rawLine of lines) {
    // Strip leading whitespace and optional leading "* " prefix
    const stripped = rawLine.replace(/^\s*\*?\s?/, '');

    // Check if this line starts a new tag
    // A tag is @word at the beginning of the stripped line (after * prefix removal)
    const tagMatch = stripped.match(/^@([a-zA-Z]+)(?:\s|$)/);

    if (tagMatch) {
      // Flush previous tag/content
      flushContent();

      currentTag = tagMatch[1];
      currentContent = stripped.slice(tagMatch[0].length);
    } else {
      // Continuation line — check for @ in the middle (like user@example.com)
      // This is NOT a tag start, just append to current content
      if (currentTag === null) {
        // We're in free-text region (before first tag)
        if (freeText.length > 0 && stripped.length > 0) {
          freeText += ` ${stripped}`;
        } else if (stripped.length > 0) {
          freeText += stripped;
        }
      } else {
        // Continue the current tag content
        if (stripped.length > 0) {
          currentContent += ` ${stripped}`;
        }
      }
    }
  }

  // Flush the last tag
  flushContent();

  function flushContent(): void {
    if (currentTag === 'summary') {
      const trimmed = currentContent.trim();
      if (trimmed.length > 0) {
        summaries.push(trimmed);
      }
    }
    // Reset for next tag (non-summary tags are simply discarded)
    currentTag = null;
    currentContent = '';
  }

  // Build the result: summaries first, then free-text last
  const levels: string[] = [...summaries];
  const trimmedFreeText = freeText.trim();
  if (trimmedFreeText.length > 0) {
    levels.push(trimmedFreeText);
  }

  return levels;
}

/**
 * Parse a TypeScript file and extract its summary levels from file-level JSDoc.
 *
 * Reads the file, extracts the first file-level JSDoc block, and parses @summary
 * tags and free-text into ordered summary levels.
 */
export function parseFileSummaries(filePath: string): ParsedFileInfo {
  let sourceText: string;
  try {
    sourceText = readFileSync(filePath, 'utf-8');
  } catch {
    throw new JsdocError('FILE_NOT_FOUND', `File not found: ${filePath}`);
  }

  const jsdocText = extractFileJsdoc(sourceText);

  if (jsdocText === null) {
    return {
      path: filePath,
      summaryLevels: [],
      hasFileJsdoc: false,
    };
  }

  const summaryLevels = parseSummaryLevels(jsdocText);

  return {
    path: filePath,
    summaryLevels,
    hasFileJsdoc: true,
  };
}
