import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { describe, it, expect } from 'vitest';
import { extractFileJsdoc, parseFileSummaries } from '../src/jsdoc-parser.js';
import { JsdocError } from '../src/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, 'fixtures', 'leaf-files');

function fixture(name: string): string {
  return path.join(fixturesDir, name);
}

/** Write source to a temp .ts file, run the callback, then clean up. */
function withTempFile(source: string, fn: (filePath: string) => void): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsdoczoom-test-'));
  const tmpFile = path.join(tmpDir, 'temp.ts');
  fs.writeFileSync(tmpFile, source);
  try {
    fn(tmpFile);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
}

describe('extractFileJsdoc', () => {
  it('extracts first /** */ block before code statements', () => {
    const source = [
      '/**',
      ' * Hello world.',
      ' *',
      ' * @summary A summary',
      ' */',
      '',
      'export const x = 1;',
    ].join('\n');
    const result = extractFileJsdoc(source);
    expect(result).not.toBeNull();
    expect(result).toContain('Hello world.');
    expect(result).toContain('@summary A summary');
  });

  it('JSDoc after import statements is valid (extracted correctly)', () => {
    const source = [
      "import { readFileSync } from 'fs';",
      '',
      '/**',
      ' * This JSDoc appears after imports but before code.',
      ' *',
      ' * @summary After imports summary',
      ' */',
      '',
      'export function doSomething(): string {',
      "  return readFileSync('/dev/null', 'utf-8');",
      '}',
    ].join('\n');
    const result = extractFileJsdoc(source);
    expect(result).not.toBeNull();
    expect(result).toContain('This JSDoc appears after imports but before code.');
    expect(result).toContain('@summary After imports summary');
  });

  it('ignores JSDoc blocks that appear after code statements', () => {
    const source = [
      'export const x = 1;',
      '',
      '/**',
      ' * This JSDoc is after code, so it should not be the file-level JSDoc.',
      ' *',
      ' * @summary Should be ignored',
      ' */',
      '',
      'export const y = 2;',
    ].join('\n');
    const result = extractFileJsdoc(source);
    expect(result).toBeNull();
  });

  it('handles TypeScript syntax errors (throws PARSE_ERROR)', () => {
    const source = 'export const broken: = { this is not valid };';
    expect(() => extractFileJsdoc(source)).toThrow(JsdocError);
    try {
      extractFileJsdoc(source);
    } catch (e) {
      expect(e).toBeInstanceOf(JsdocError);
      expect((e as JsdocError).code).toBe('PARSE_ERROR');
    }
  });

  it('literal @ in prose (like user@example.com) does not start a new tag', () => {
    const source = [
      '/**',
      ' * Contact user@example.com for more info.',
      ' *',
      ' * @summary Email module summary',
      ' */',
      '',
      'export const x = 1;',
    ].join('\n');
    const result = extractFileJsdoc(source);
    expect(result).not.toBeNull();
    expect(result).toContain('user@example.com');
  });
});

describe('parseFileSummaries', () => {
  it('extracts @summary tags in source order', () => {
    const result = parseFileSummaries(fixture('two-summaries.ts'));
    expect(result.hasFileJsdoc).toBe(true);
    expect(result.summaryLevels.length).toBe(3);
    expect(result.summaryLevels[0]).toBe('First summary - concise overview');
    expect(result.summaryLevels[1]).toBe('Second summary - more detail about the module');
    // Free-text is last
    expect(result.summaryLevels[2]).toBe(
      'This is the free-text description of the module.',
    );
  });

  it('joins multi-line @summary content with spaces', () => {
    const result = parseFileSummaries(fixture('multi-line-summary.ts'));
    expect(result.hasFileJsdoc).toBe(true);
    expect(result.summaryLevels.length).toBe(2); // 1 summary + 1 free-text
    expect(result.summaryLevels[0]).toBe(
      'This is a multi-line summary that spans across multiple lines and should be joined with spaces',
    );
    expect(result.summaryLevels[1]).toBe('Module description.');
  });

  it('skips whitespace-only @summary tags (not counted as levels)', () => {
    const result = parseFileSummaries(fixture('whitespace-summary.ts'));
    expect(result.hasFileJsdoc).toBe(true);
    // Only the non-empty summary and free-text should be counted
    expect(result.summaryLevels.length).toBe(2);
    expect(result.summaryLevels[0]).toBe('Real summary here');
    expect(result.summaryLevels[1]).toBe('Module with whitespace summaries.');
  });

  it('places free-text description as last summary level', () => {
    const result = parseFileSummaries(fixture('one-summary.ts'));
    expect(result.hasFileJsdoc).toBe(true);
    expect(result.summaryLevels.length).toBe(2);
    expect(result.summaryLevels[0]).toBe('Single summary line');
    expect(result.summaryLevels[1]).toBe('Module description as free-text.');
  });

  it('handles file with only free-text and no @summary tags (1 level)', () => {
    const result = parseFileSummaries(fixture('description-only.ts'));
    expect(result.hasFileJsdoc).toBe(true);
    expect(result.summaryLevels.length).toBe(1);
    expect(result.summaryLevels[0]).toBe(
      'This module only has a free-text description with no @summary tags.',
    );
  });

  it('handles file with no JSDoc at all (0 levels, hasFileJsdoc: false)', () => {
    const result = parseFileSummaries(fixture('no-jsdoc.ts'));
    expect(result.hasFileJsdoc).toBe(false);
    expect(result.summaryLevels.length).toBe(0);
  });

  it('only recognizes lowercase @summary (ignores @Summary, @SUMMARY, @desc, @description)', () => {
    const source = [
      '/**',
      ' * Free text here.',
      ' *',
      ' * @Summary Uppercase summary',
      ' * @SUMMARY All caps summary',
      ' * @desc Description tag',
      ' * @description Full description tag',
      ' * @summary Real summary',
      ' */',
      '',
      'export const x = 1;',
    ].join('\n');

    withTempFile(source, (tmpFile) => {
      const result = parseFileSummaries(tmpFile);
      expect(result.hasFileJsdoc).toBe(true);
      // Only the lowercase @summary should be picked up
      expect(result.summaryLevels).toContain('Real summary');
      // Free-text should be last
      expect(result.summaryLevels[result.summaryLevels.length - 1]).toBe(
        'Free text here.',
      );
      // Total: 1 summary + 1 free-text = 2 levels
      expect(result.summaryLevels.length).toBe(2);
    });
  });

  it('handles TypeScript syntax errors (throws PARSE_ERROR)', () => {
    expect(() => parseFileSummaries(fixture('syntax-error.ts'))).toThrow(
      JsdocError,
    );
    try {
      parseFileSummaries(fixture('syntax-error.ts'));
    } catch (e) {
      expect(e).toBeInstanceOf(JsdocError);
      expect((e as JsdocError).code).toBe('PARSE_ERROR');
    }
  });

  it('@param/@returns and other non-summary tags do not create summary levels', () => {
    const source = [
      '/**',
      ' * Module with various tags.',
      ' *',
      ' * @summary The real summary',
      ' * @param x - some param',
      ' * @returns nothing',
      ' * @deprecated Use something else',
      ' */',
      '',
      'export const x = 1;',
    ].join('\n');

    withTempFile(source, (tmpFile) => {
      const result = parseFileSummaries(tmpFile);
      expect(result.hasFileJsdoc).toBe(true);
      // Only @summary + free-text
      expect(result.summaryLevels.length).toBe(2);
      expect(result.summaryLevels[0]).toBe('The real summary');
      expect(result.summaryLevels[1]).toBe('Module with various tags.');
    });
  });

  it('@param between @summary tags does not interrupt summary extraction', () => {
    const source = [
      '/**',
      ' * Module description.',
      ' *',
      ' * @summary First summary',
      ' * @param x - some param',
      ' * @summary Second summary',
      ' */',
      '',
      'export const x = 1;',
    ].join('\n');

    withTempFile(source, (tmpFile) => {
      const result = parseFileSummaries(tmpFile);
      expect(result.hasFileJsdoc).toBe(true);
      expect(result.summaryLevels.length).toBe(3);
      expect(result.summaryLevels[0]).toBe('First summary');
      expect(result.summaryLevels[1]).toBe('Second summary');
      expect(result.summaryLevels[2]).toBe('Module description.');
    });
  });

  it('literal @ in prose does not start a new tag', () => {
    const result = parseFileSummaries(fixture('email-in-prose.ts'));
    expect(result.hasFileJsdoc).toBe(true);
    expect(result.summaryLevels.length).toBe(2);
    expect(result.summaryLevels[0]).toBe('Email module summary');
    // Free-text should contain the email as-is
    expect(result.summaryLevels[1]).toBe(
      'Contact user@example.com for more info about this module.',
    );
  });
});
