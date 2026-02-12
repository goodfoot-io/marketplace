import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { getBarrelChildren, isBarrel } from './barrel.js';
import { JsdocError } from './errors.js';
import { discoverFiles } from './file-discovery.js';
import { parseFileSummaries } from './jsdoc-parser.js';
import { generateTypeDeclarations } from './type-declarations.js';
import type { OutputEntry, OutputErrorItem, SelectorInfo } from './types.js';

/**
 * Process a single file at a given depth through the drill-down levels.
 *
 * Level model for a file with N summary levels:
 * - depth 0..N-1: summary text at that level, more=true
 * - depth N: JSDoc + type declarations, more=true
 * - depth N+1: full file content, more=false (terminal)
 * - depth > N+1: clamped to N+1 (terminal)
 */
function processFile(
  filePath: string,
  depth: number,
  cwd: string,
): OutputEntry {
  const info = parseFileSummaries(filePath);
  const relativePath = relative(cwd, filePath);
  const numSummaryLevels = info.summaryLevels.length;

  const typeLevel = numSummaryLevels;
  const fullContentLevel = numSummaryLevels + 1;

  // Clamp depth to terminal level
  const effectiveDepth = Math.min(depth, fullContentLevel);

  if (effectiveDepth < numSummaryLevels) {
    // Return summary text at this level
    return {
      id: `${relativePath}@${effectiveDepth}`,
      path: relativePath,
      more: true,
      text: info.summaryLevels[effectiveDepth],
    };
  }

  if (effectiveDepth === typeLevel) {
    // Return JSDoc + type declarations
    const typeDecls = generateTypeDeclarations(filePath);
    return {
      id: `${relativePath}@${effectiveDepth}`,
      path: relativePath,
      more: true,
      text: typeDecls,
    };
  }

  // Full file content (terminal level)
  const fullContent = readFileSync(filePath, 'utf-8');
  return {
    id: `${relativePath}@${effectiveDepth}`,
    path: relativePath,
    more: false,
    text: fullContent,
  };
}

/**
 * Process a file safely, returning an OutputErrorItem on PARSE_ERROR.
 * Returns null if the file has no summaries.
 * Rethrows non-PARSE_ERROR exceptions.
 */
function processFileSafe(
  filePath: string,
  depth: number,
  cwd: string,
): OutputEntry | null {
  try {
    const info = parseFileSummaries(filePath);
    if (info.summaryLevels.length === 0) return null;
    return processFile(filePath, depth, cwd);
  } catch (error) {
    if (error instanceof JsdocError && error.code === 'PARSE_ERROR') {
      const relativePath = relative(cwd, filePath);
      const errorItem: OutputErrorItem = {
        id: relativePath,
        path: relativePath,
        more: false as const,
        error: { code: error.code, message: error.message },
      };
      return errorItem;
    }
    throw error;
  }
}

/**
 * Information about a barrel file's summary levels and children.
 */
interface BarrelInfo {
  path: string;
  summaryCount: number;
  children: string[];
}

/**
 * Process files discovered via glob with barrel gating.
 *
 * When a glob discovers an index.ts barrel:
 * 1. If the barrel has summaries and depth < barrel's summary count:
 *    show barrel summary (barrel gates its children)
 * 2. If depth >= barrel's summary count: barrel transitions -- barrel disappears
 *    and its children appear at depth - barrelSummaryCount
 * 3. If barrel has 0 summaries: not a tree node, children appear as leaves
 *
 * A barrel that is itself gated by a parent barrel is not processed independently.
 * Non-barrel files that are not gated by any barrel are processed normally.
 */
function processGlobWithBarrels(
  files: string[],
  depth: number,
  cwd: string,
): OutputEntry[] {
  // Separate barrels from non-barrel files
  const barrels: string[] = [];
  const nonBarrels: string[] = [];

  for (const filePath of files) {
    if (isBarrel(filePath)) {
      barrels.push(filePath);
    } else {
      nonBarrels.push(filePath);
    }
  }

  // If no barrels, process all files normally (no gating)
  if (barrels.length === 0) {
    return processLeafFiles(nonBarrels, depth, cwd);
  }

  // First pass: gather barrel info and build the gated-files set.
  // A barrel with 0 summaries is not a tree node and does not gate children.
  const barrelInfos: BarrelInfo[] = [];
  const barrelErrors: OutputEntry[] = [];

  for (const barrelPath of barrels) {
    let summaryCount: number;
    try {
      const info = parseFileSummaries(barrelPath);
      summaryCount = info.summaryLevels.length;
    } catch (error) {
      if (error instanceof JsdocError && error.code === 'PARSE_ERROR') {
        const relativePath = relative(cwd, barrelPath);
        barrelErrors.push({
          id: relativePath,
          path: relativePath,
          more: false as const,
          error: { code: error.code, message: error.message },
        });
        continue;
      }
      throw error;
    }

    const children = getBarrelChildren(barrelPath, cwd);
    barrelInfos.push({ path: barrelPath, summaryCount, children });
  }

  // Build the complete set of gated files (children of barrels with summaries > 0)
  const gatedFiles = new Set<string>();
  for (const barrel of barrelInfos) {
    if (barrel.summaryCount > 0) {
      for (const child of barrel.children) {
        gatedFiles.add(child);
      }
    }
  }

  // Second pass: process barrels that are NOT themselves gated by another barrel
  const results: OutputEntry[] = [...barrelErrors];

  for (const barrel of barrelInfos) {
    // Skip barrels that are gated by a parent barrel
    if (gatedFiles.has(barrel.path)) continue;

    if (barrel.summaryCount === 0) {
      // Barrel with 0 summaries is not a tree node.
      // Its children appear as regular leaf files (not gated).
      // The barrel itself is skipped (no summaries to show).
      continue;
    }

    if (depth < barrel.summaryCount) {
      // Show barrel summary at this depth
      const result = processFileSafe(barrel.path, depth, cwd);
      if (result) {
        results.push(result);
      }
    } else {
      // Barrel transitions: barrel disappears, children appear
      const childDepth = depth - barrel.summaryCount;
      for (const child of barrel.children) {
        const result = processFileSafe(child, childDepth, cwd);
        if (result) {
          results.push(result);
        }
      }
    }
  }

  // Process non-barrel files that are NOT gated by any barrel
  for (const filePath of nonBarrels) {
    if (gatedFiles.has(filePath)) continue;
    const result = processFileSafe(filePath, depth, cwd);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Process a list of files as leaf files (no barrel gating).
 */
function processLeafFiles(
  files: string[],
  depth: number,
  cwd: string,
): OutputEntry[] {
  const results: OutputEntry[] = [];
  for (const filePath of files) {
    const result = processFileSafe(filePath, depth, cwd);
    if (result) {
      results.push(result);
    }
  }
  return results;
}

/**
 * Main entry point for normal-mode processing.
 *
 * Resolves files from a selector, processes each through the drill-down model,
 * and returns an array of output entries. Barrel gating is applied in glob mode.
 *
 * @param selector - Parsed selector with type, pattern, and optional depth
 * @param cwd - Working directory for file resolution
 * @returns Array of output entries sorted alphabetically by path
 * @throws {JsdocError} FILE_NOT_FOUND for missing path selector target
 * @throws {JsdocError} NO_FILES_MATCHED for empty glob results
 * @throws {JsdocError} NO_SUMMARY_FOUND for path selector targeting file without summaries
 * @throws {JsdocError} PARSE_ERROR for path selector targeting file with syntax errors
 */
export function drilldown(
  selector: SelectorInfo,
  cwd: string,
): OutputEntry[] {
  const depth = selector.depth ?? 0;

  if (selector.type === 'path') {
    // Single file path — errors are fatal, no barrel gating
    const files = discoverFiles(selector.pattern, cwd);
    const filePath = files[0];
    const info = parseFileSummaries(filePath);
    if (info.summaryLevels.length === 0) {
      throw new JsdocError(
        'NO_SUMMARY_FOUND',
        `No summary found: ${selector.pattern}`,
      );
    }
    return [processFile(filePath, depth, cwd)];
  }

  // Glob selector — apply barrel gating
  const files = discoverFiles(selector.pattern, cwd);
  if (files.length === 0) {
    throw new JsdocError(
      'NO_FILES_MATCHED',
      `No files matched: ${selector.pattern}`,
    );
  }

  const results = processGlobWithBarrels(files, depth, cwd);

  if (results.length === 0) {
    throw new JsdocError(
      'NO_FILES_MATCHED',
      `No files with summaries matched: ${selector.pattern}`,
    );
  }

  // Sort alphabetically by path
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Process an explicit list of file paths at a given depth.
 *
 * Used for stdin input. Always treats paths as leaf files (no barrel gating).
 * Filters to .ts/.tsx only. Excludes files with no summaries.
 * Does NOT throw NO_FILES_MATCHED for empty results.
 *
 * @param filePaths - Array of absolute file paths
 * @param depth - Drill-down depth (defaults to 0 if undefined)
 * @param cwd - Working directory for relative path output
 * @returns Array of output entries sorted alphabetically by path
 */
export function drilldownFiles(
  filePaths: string[],
  depth: number | undefined,
  cwd: string,
): OutputEntry[] {
  const d = depth ?? 0;
  const tsFiles = filePaths.filter(
    (f) => f.endsWith('.ts') || f.endsWith('.tsx'),
  );

  const results: OutputEntry[] = [];
  for (const filePath of tsFiles) {
    try {
      const info = parseFileSummaries(filePath);
      if (info.summaryLevels.length === 0) continue;
      results.push(processFile(filePath, d, cwd));
    } catch (error) {
      if (error instanceof JsdocError && error.code === 'PARSE_ERROR') {
        const relativePath = relative(cwd, filePath);
        const errorItem: OutputErrorItem = {
          id: relativePath,
          path: relativePath,
          more: false as const,
          error: { code: error.code, message: error.message },
        };
        results.push(errorItem);
      } else {
        throw error;
      }
    }
  }

  return results.sort((a, b) => a.path.localeCompare(b.path));
}
