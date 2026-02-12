import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { JsdocError } from './errors.js';
import { discoverFiles } from './file-discovery.js';
import { extractFileJsdoc, parseFileSummaries } from './jsdoc-parser.js';
import type { SelectorInfo, ValidationFileResult, ValidationResult } from './types.js';

/**
 * Check if the JSDoc text has free-text description before the first tag.
 *
 * Free-text is content that appears before any @ tags in the JSDoc block.
 */
function hasFreeText(jsdocText: string): boolean {
  const lines = jsdocText.split('\n');
  for (const line of lines) {
    const stripped = line.replace(/^\s*\*?\s?/, '').trim();
    if (stripped === '') continue;
    if (stripped.startsWith('@')) return false; // First content line is a tag
    return true; // First content line is text = free-text exists
  }
  return false;
}

/**
 * Validate a single file against validation requirements.
 *
 * Validation checks:
 * 1. No syntax errors
 * 2. Has file-level JSDoc block
 * 3. Has at least 2 non-empty @summary tags
 */
function validateFile(filePath: string, cwd: string): ValidationFileResult {
  const relativePath = relative(cwd, filePath);
  const issues: string[] = [];

  try {
    const info = parseFileSummaries(filePath);

    if (!info.hasFileJsdoc) {
      issues.push('Missing file-level JSDoc block');
      return { path: relativePath, passed: false, issues };
    }

    const sourceText = readFileSync(filePath, 'utf-8');
    const jsdocText = extractFileJsdoc(sourceText);

    let summaryTagCount = info.summaryLevels.length;
    if (jsdocText && hasFreeText(jsdocText)) {
      summaryTagCount -= 1; // Remove free-text from count
    }

    if (summaryTagCount < 2) {
      issues.push(`Found ${summaryTagCount} @summary tag(s), minimum is 2`);
      return { path: relativePath, passed: false, issues };
    }

    return { path: relativePath, passed: true, issues: [] };
  } catch (error) {
    if (error instanceof JsdocError && error.code === 'PARSE_ERROR') {
      issues.push(`Syntax error: ${error.message}`);
      return { path: relativePath, passed: false, issues };
    }
    throw error;
  }
}

/**
 * Build a ValidationResult from a list of file validation results.
 */
function buildResult(fileResults: ValidationFileResult[]): ValidationResult {
  const passed = fileResults.filter(f => f.passed).length;
  return {
    files: fileResults,
    summary: {
      total: fileResults.length,
      passed,
      failed: fileResults.length - passed,
    },
  };
}

/**
 * Validate files matching a selector pattern.
 *
 * @param selector - Selector information (glob or path)
 * @param cwd - Working directory for resolving paths
 * @returns Validation results with per-file details and summary
 * @throws {JsdocError} INVALID_DEPTH if selector has @depth suffix
 * @throws {JsdocError} NO_FILES_MATCHED if glob selector matches no files
 * @throws {JsdocError} FILE_NOT_FOUND if path selector targets nonexistent file
 */
export function validate(selector: SelectorInfo, cwd: string): ValidationResult {
  if (selector.depth !== undefined) {
    throw new JsdocError('INVALID_DEPTH', 'Validation mode does not support @depth');
  }

  const files = discoverFiles(selector.pattern, cwd);
  if (files.length === 0) {
    throw new JsdocError('NO_FILES_MATCHED', `No files matched: ${selector.pattern}`);
  }

  const results = files.map(f => validateFile(f, cwd));
  return buildResult(results);
}

/**
 * Validate an explicit list of file paths.
 *
 * Filters to .ts/.tsx files only (useful for stdin input).
 *
 * @param filePaths - List of file paths to validate
 * @param cwd - Working directory for resolving relative paths
 * @returns Validation results with per-file details and summary
 */
export function validateFiles(filePaths: string[], cwd: string): ValidationResult {
  const tsFiles = filePaths.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  const results = tsFiles.map(f => validateFile(f, cwd));
  return buildResult(results);
}
