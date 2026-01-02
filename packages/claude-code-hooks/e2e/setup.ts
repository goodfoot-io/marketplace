/**
 * E2E test setup for building and managing test hooks.
 *
 * Provides utilities to build hook fixtures using the CLI before tests run.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The directory containing test hook fixtures.
 */
export const FIXTURES_DIR = path.join(__dirname, 'fixtures');

/**
 * The output directory for compiled hooks.
 */
export const DIST_DIR = path.join(__dirname, 'dist');

/**
 * The path to the generated hooks.json file.
 */
export const HOOKS_JSON_PATH = path.join(DIST_DIR, 'hooks.json');

/**
 * Path to the CLI script.
 */
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli', 'index.ts');

/**
 * Builds a single test hook fixture.
 *
 * @param fixtureFile - Name of the fixture file (e.g., 'deny-bash-hook.ts')
 * @returns Path to the generated hooks.json
 */
export async function buildSingleHook(fixtureFile: string): Promise<string> {
  const hookPath = path.join(FIXTURES_DIR, fixtureFile);
  const outputDir = path.join(DIST_DIR, path.basename(fixtureFile, '.ts'));
  const outputPath = path.join(outputDir, 'hooks.json');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Build the hook using tsx to run the CLI
  execSync(`npx tsx ${CLI_PATH} -i "${hookPath}" -o "${outputPath}"`, {
    cwd: path.dirname(CLI_PATH),
    encoding: 'utf-8',
    stdio: 'pipe'
  });

  return outputDir;
}

/**
 * Builds all test hook fixtures.
 *
 * @returns Path to the directory containing all compiled hooks
 */
export async function buildAllHooks(): Promise<string> {
  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Build hooks using tsx to run the CLI
  execSync(`npx tsx ${CLI_PATH} -i "${FIXTURES_DIR}/*.ts" -o "${HOOKS_JSON_PATH}"`, {
    cwd: path.dirname(CLI_PATH),
    encoding: 'utf-8',
    stdio: 'pipe'
  });

  return DIST_DIR;
}

/**
 * Cleans up the dist directory.
 */
export function cleanDist(): void {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
}

/**
 * Creates a minimal plugin directory structure for a single hook.
 *
 * @param hookOutputDir - The directory containing the compiled hook and hooks.json
 * @returns Path to the plugin directory
 */
export function getPluginDir(hookOutputDir: string): string {
  return hookOutputDir;
}

/**
 * Retry configuration for flaky operations.
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
}

/**
 * Default retry configuration: 3 retries with 2s/4s/8s exponential backoff.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 2000
};

/**
 * Runs a function with exponential backoff retry logic.
 *
 * @param fn - The async function to execute
 * @param config - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function runWithRetry<T>(fn: () => Promise<T>, config: RetryConfig = DEFAULT_RETRY_CONFIG): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't sleep on the last attempt
      if (attempt < config.maxRetries - 1) {
        const delayMs = config.baseDelayMs * Math.pow(2, attempt);
        await sleep(delayMs);
      }
    }
  }

  throw lastError ?? new Error('All retries failed');
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
