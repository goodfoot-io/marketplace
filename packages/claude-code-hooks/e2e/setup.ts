/**
 * E2E test setup for building and managing test hooks.
 *
 * Provides utilities to build hook fixtures using the CLI before tests run.
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
 * Gets the path to hooks.json within a plugin directory.
 * @param pluginDir - The plugin directory returned by buildSingleHook
 * @returns Path to hooks/hooks.json
 * @example
 * ```typescript
 * const pluginDir = buildSingleHook('my-hook.ts');
 * const hooksJsonPath = getHooksJsonPath(pluginDir);
 * ```
 */
export function getHooksJsonPath(pluginDir: string): string {
  return path.join(pluginDir, 'hooks', 'hooks.json');
}

/**
 * Path to the CLI script.
 */
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli.ts');

/**
 * Generates a unique suffix for output directories.
 * @returns A unique string combining timestamp and random characters
 */
function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Represents the hooks.json file structure for post-processing.
 */
interface HooksJsonStructure {
  hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; command: string; timeout?: number }> }>>;
  __generated?: { files: string[]; timestamp: string };
}

/**
 * Builds a single test hook fixture as a valid Claude Code plugin.
 *
 * Creates the proper plugin directory structure:
 * ```
 * <plugin-dir>/
 * .claude-plugin/
 * plugin.json
 * hooks/
 * hooks.json
 * build/
 * hook-file.mjs
 * ```
 * @param fixtureFile - Name of the fixture file (e.g., 'deny-bash-hook.ts')
 * @returns Path to the plugin directory (use with --plugin-dir)
 * @example
 * ```typescript
 * const pluginDir = buildSingleHook('deny-bash-hook.ts');
 * // pluginDir: '/path/to/e2e/dist/deny-bash-hook-1234567890-abc123'
 * ```
 */
export function buildSingleHook(fixtureFile: string): string {
  const hookPath = path.join(FIXTURES_DIR, fixtureFile);
  const baseName = path.basename(fixtureFile, '.ts');
  const pluginDir = path.join(DIST_DIR, `${baseName}-${uniqueSuffix()}`);

  // Create plugin directory structure
  const claudePluginDir = path.join(pluginDir, '.claude-plugin');
  const hooksDir = path.join(pluginDir, 'hooks');
  const buildDir = path.join(hooksDir, 'build');

  fs.mkdirSync(claudePluginDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });

  // Create plugin.json
  const pluginJson = {
    name: `test-${baseName}`,
    version: '1.0.0',
    description: `Test plugin for ${baseName}`
  };
  fs.writeFileSync(path.join(claudePluginDir, 'plugin.json'), JSON.stringify(pluginJson, null, 2));

  // Build the hook - CLI outputs to buildDir, hooks.json to hooksDir
  const tempHooksJsonPath = path.join(hooksDir, 'hooks.json');
  execSync(`npx tsx ${CLI_PATH} -i "${hookPath}" -o "${tempHooksJsonPath}"`, {
    cwd: path.dirname(CLI_PATH),
    encoding: 'utf-8',
    stdio: 'pipe'
  });

  // Move .mjs files from hooksDir to buildDir
  const mjsFiles = fs.readdirSync(hooksDir).filter((f) => f.endsWith('.mjs'));
  for (const mjsFile of mjsFiles) {
    fs.renameSync(path.join(hooksDir, mjsFile), path.join(buildDir, mjsFile));
  }

  // Post-process hooks.json to use ${CLAUDE_PLUGIN_ROOT} paths
  const hooksJson = JSON.parse(fs.readFileSync(tempHooksJsonPath, 'utf-8')) as HooksJsonStructure;

  for (const eventType of Object.keys(hooksJson.hooks)) {
    for (const matcherEntry of hooksJson.hooks[eventType]) {
      for (const hook of matcherEntry.hooks) {
        // Replace absolute path with ${CLAUDE_PLUGIN_ROOT}/hooks/build/filename.mjs
        const filename = path.basename(hook.command);
        hook.command = `\${CLAUDE_PLUGIN_ROOT}/hooks/build/${filename}`;
      }
    }
  }

  fs.writeFileSync(tempHooksJsonPath, JSON.stringify(hooksJson, null, 2));

  return pluginDir;
}

/**
 * Builds all test hook fixtures.
 * @returns Path to the dist directory containing all compiled hooks
 * @example
 * ```typescript
 * const distDir = buildAllHooks();
 * // distDir: '/path/to/e2e/dist'
 * ```
 */
export function buildAllHooks(): string {
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
 * Cleans up a specific output directory.
 * @param outputDir - The directory to clean (e.g., from buildSingleHook return value)
 * @example
 * ```typescript
 * const pluginDir = buildSingleHook('deny-bash-hook.ts');
 * // ... run tests ...
 * cleanOutputDir(pluginDir); // Only removes this specific hook's directory
 * ```
 */
export function cleanOutputDir(outputDir: string): void {
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
}

/**
 * @deprecated Use cleanOutputDir(pluginDir) instead to avoid race conditions between tests.
 * @example
 * Cleans up the entire dist directory - only use when running tests serially.
 */
export function cleanDist(): void {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
}

/**
 * Creates a minimal plugin directory structure for a single hook.
 * @param hookOutputDir - The directory containing the compiled hook and hooks.json
 * @returns Path to the plugin directory (same as input for simple cases)
 * @example
 * ```typescript
 * const pluginDir = getPluginDir('/path/to/hook-output');
 * // Use pluginDir with --plugin-dir flag
 * ```
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
 * @param fn - The async function to execute
 * @param config - Retry configuration (defaults to 3 retries with 2s base delay)
 * @returns The result of the function if successful
 * @throws The last error if all retries fail
 * @example
 * ```typescript
 * const result = await runWithRetry(async () => {
 *   return await fetchData();
 * }, { maxRetries: 5, baseDelayMs: 1000 });
 * ```
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
 * @param ms - Duration in milliseconds to wait
 * @returns A promise that resolves after the specified duration
 * @example
 * ```typescript
 * await sleep(1000); // Wait 1 second
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
