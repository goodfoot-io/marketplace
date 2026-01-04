/**
 * E2E tests for incremental hooks.json updates.
 *
 * These tests verify that the CLI correctly:
 * - Preserves hooks from other sources when rebuilding
 * - Removes old generated files before creating new ones
 * - Writes hooks.json atomically
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path to the CLI script.
 */
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli.ts');

/**
 * Directory containing build test fixtures.
 */
const BUILD_TEST_FIXTURES = path.join(__dirname, 'fixtures');

/**
 * Output directory for incremental update test results.
 */
const TEST_OUTPUT = path.join(__dirname, 'dist', 'incremental-test');

/**
 * Represents a matcher entry in hooks.json.
 */
interface MatcherEntry {
  matcher?: string;
  hooks: Array<{
    type: string;
    command: string;
    timeout?: number;
  }>;
}

/**
 * Represents the hooks.json file structure.
 */
interface HooksJson {
  __generated?: {
    files: string[];
    timestamp: string;
  };
  hooks: Record<string, MatcherEntry[]>;
}

/**
 * Runs the CLI to build hooks from TypeScript source files.
 * @param inputPattern - Glob pattern for input hook files
 * @param outputPath - Path where hooks.json will be written
 * @returns Object with success status and captured stdout/stderr
 */
function runCli(inputPattern: string, outputPath: string): { success: boolean; stdout: string; stderr: string } {
  const result = spawnSync('npx', ['tsx', CLI_PATH, '-i', inputPattern, '-o', outputPath], {
    cwd: path.dirname(CLI_PATH),
    encoding: 'utf-8',
    stdio: 'pipe'
  });

  return {
    success: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

/**
 * Reads and parses hooks.json.
 * @param hooksJsonPath - Absolute path to the hooks.json file
 * @returns Parsed HooksJson object
 */
function readHooksJson(hooksJsonPath: string): HooksJson {
  return JSON.parse(fs.readFileSync(hooksJsonPath, 'utf-8')) as HooksJson;
}

/**
 * Cleans up the test output directory.
 */
function cleanTestOutput(): void {
  if (fs.existsSync(TEST_OUTPUT)) {
    fs.rmSync(TEST_OUTPUT, { recursive: true });
  }
}

/**
 * Creates a proper plugin directory structure for testing.
 * @param testName - Name for the test directory
 * @returns Object with pluginDir, hooksDir, outputPath
 */
function createPluginStructure(testName: string): {
  pluginDir: string;
  hooksDir: string;
  outputPath: string;
} {
  const pluginDir = path.join(TEST_OUTPUT, testName);
  const hooksDir = path.join(pluginDir, 'hooks');
  const outputPath = path.join(hooksDir, 'hooks.json');

  fs.mkdirSync(path.join(pluginDir, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(hooksDir, { recursive: true });

  return { pluginDir, hooksDir, outputPath };
}

describe('E2E: Incremental Updates', () => {
  beforeAll(() => {
    cleanTestOutput();
    fs.mkdirSync(TEST_OUTPUT, { recursive: true });
  });

  afterAll(() => {
    cleanTestOutput();
  });

  describe('Preserving External Hooks', () => {
    it('preserves hooks from other sources when rebuilding', () => {
      const { outputPath } = createPluginStructure('preserve-external');

      // First, create an initial hooks.json with an external hook
      const externalHooksJson: HooksJson = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'ExternalTool',
              hooks: [
                {
                  type: 'command',
                  command: '/usr/local/bin/external-hook.sh'
                }
              ]
            }
          ],
          SessionStart: [
            {
              hooks: [
                {
                  type: 'command',
                  command: '/path/to/another-external-hook'
                }
              ]
            }
          ]
        }
      };
      fs.writeFileSync(outputPath, JSON.stringify(externalHooksJson, null, 2));

      // Now build our hooks on top
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Preserved 2 hooks from other sources');

      const hooksJson = readHooksJson(outputPath);

      // Should have both external and generated hooks
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
      expect(hooksJson.hooks.PreToolUse.length).toBeGreaterThanOrEqual(2);

      // Find the external hook
      const externalEntry = hooksJson.hooks.PreToolUse.find((e) => e.matcher === 'ExternalTool');
      expect(externalEntry).toBeDefined();
      expect(externalEntry?.hooks[0].command).toBe('/usr/local/bin/external-hook.sh');

      // Find the generated hook
      const generatedEntry = hooksJson.hooks.PreToolUse.find((e) => e.matcher === 'Write');
      expect(generatedEntry).toBeDefined();
      expect(generatedEntry?.hooks[0].command).toMatch(/^node \$CLAUDE_PLUGIN_ROOT\/hooks\/build\//);

      // SessionStart external hook should also be preserved
      expect(hooksJson.hooks.SessionStart).toBeDefined();
      const externalSessionHook = hooksJson.hooks.SessionStart.find((e) =>
        e.hooks.some((h) => h.command === '/path/to/another-external-hook')
      );
      expect(externalSessionHook).toBeDefined();

      // Should have __generated metadata
      expect(hooksJson.__generated).toBeDefined();
      expect(hooksJson.__generated?.files.length).toBeGreaterThan(0);
    });

    it('handles mixed external and generated hooks in the same matcher group', () => {
      const { outputPath } = createPluginStructure('mixed-hooks');

      // Create hooks.json with an external hook using the same matcher as our generated hook
      const mixedHooksJson: HooksJson = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Write', // Same matcher as hook-with-timeout.ts
              hooks: [
                {
                  type: 'command',
                  command: '/external/write-validator.sh'
                }
              ]
            }
          ]
        }
      };
      fs.writeFileSync(outputPath, JSON.stringify(mixedHooksJson, null, 2));

      // Build our hook
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      // Should have PreToolUse with both hooks
      expect(hooksJson.hooks.PreToolUse).toBeDefined();

      // Find external hook entry (preserved)
      const externalEntry = hooksJson.hooks.PreToolUse.find(
        (e) => e.matcher === 'Write' && e.hooks.some((h) => h.command === '/external/write-validator.sh')
      );
      expect(externalEntry).toBeDefined();

      // Find generated hook entry
      const generatedEntry = hooksJson.hooks.PreToolUse.find(
        (e) => e.matcher === 'Write' && e.hooks.some((h) => h.command.includes('$CLAUDE_PLUGIN_ROOT'))
      );
      expect(generatedEntry).toBeDefined();
    });
  });

  describe('Removing Old Generated Files', () => {
    it('removes old generated .mjs files when rebuilding', () => {
      const { hooksDir, outputPath } = createPluginStructure('remove-old-files');
      const buildDir = path.join(hooksDir, 'build');

      // First build
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      let result = runCli(inputPath, outputPath);
      expect(result.success).toBe(true);

      // Get the generated file from the first build
      let hooksJson = readHooksJson(outputPath);
      const firstBuildFiles = hooksJson.__generated?.files ?? [];
      expect(firstBuildFiles.length).toBe(1);

      const firstBuildFilePath = path.join(buildDir, firstBuildFiles[0]);
      expect(fs.existsSync(firstBuildFilePath)).toBe(true);

      // Modify the source slightly to get a different hash (simulate code change)
      // We'll use a different fixture file for the second build
      const inputPath2 = path.join(BUILD_TEST_FIXTURES, 'notification-hook.ts');
      result = runCli(inputPath2, outputPath);
      expect(result.success).toBe(true);

      // The old file should be removed
      expect(fs.existsSync(firstBuildFilePath)).toBe(false);

      // New file should exist
      hooksJson = readHooksJson(outputPath);
      const secondBuildFiles = hooksJson.__generated?.files ?? [];
      expect(secondBuildFiles.length).toBe(1);
      expect(secondBuildFiles[0]).not.toBe(firstBuildFiles[0]); // Different file

      const secondBuildFilePath = path.join(buildDir, secondBuildFiles[0]);
      expect(fs.existsSync(secondBuildFilePath)).toBe(true);
    });

    it('does not remove files not tracked in __generated', () => {
      const { pluginDir, outputPath } = createPluginStructure('preserve-untracked');

      // Create an untracked file in the plugin directory
      const untrackedFile = path.join(pluginDir, 'untracked-file.txt');
      fs.writeFileSync(untrackedFile, 'This should not be deleted');

      // Create initial hooks.json without __generated
      const initialHooksJson: HooksJson = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'External',
              hooks: [{ type: 'command', command: '/external/hook' }]
            }
          ]
        }
      };
      fs.writeFileSync(outputPath, JSON.stringify(initialHooksJson, null, 2));

      // Build hooks
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath);
      expect(result.success).toBe(true);

      // Untracked file should still exist
      expect(fs.existsSync(untrackedFile)).toBe(true);
      expect(fs.readFileSync(untrackedFile, 'utf-8')).toBe('This should not be deleted');
    });
  });

  describe('Rebuilding Generated Hooks', () => {
    it('replaces old generated hooks with new ones on rebuild', () => {
      const { outputPath } = createPluginStructure('replace-generated');

      // First build with one hook
      const inputPath1 = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      let result = runCli(inputPath1, outputPath);
      expect(result.success).toBe(true);

      let hooksJson = readHooksJson(outputPath);
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
      expect(hooksJson.hooks.Notification).toBeUndefined();

      // Second build with a different hook
      const inputPath2 = path.join(BUILD_TEST_FIXTURES, 'notification-hook.ts');
      result = runCli(inputPath2, outputPath);
      expect(result.success).toBe(true);

      hooksJson = readHooksJson(outputPath);

      // Old PreToolUse hook should be gone (it was generated)
      expect(hooksJson.hooks.PreToolUse).toBeUndefined();

      // New Notification hook should be present
      expect(hooksJson.hooks.Notification).toBeDefined();
    });

    it('updates __generated metadata on each rebuild', () => {
      const { hooksDir, outputPath } = createPluginStructure('update-generated-meta');
      const buildDir = path.join(hooksDir, 'build');

      // First build
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      let result = runCli(inputPath, outputPath);
      expect(result.success).toBe(true);

      let hooksJson = readHooksJson(outputPath);
      const firstTimestamp = hooksJson.__generated?.timestamp;
      const firstFiles = [...(hooksJson.__generated?.files ?? [])];

      expect(firstTimestamp).toBeDefined();
      expect(firstFiles.length).toBe(1);
      expect(firstFiles[0]).toMatch(/^hook-with-timeout\.[a-f0-9]+\.mjs$/);

      // Second build with same input
      result = runCli(inputPath, outputPath);
      expect(result.success).toBe(true);

      hooksJson = readHooksJson(outputPath);
      const secondTimestamp = hooksJson.__generated?.timestamp;
      const secondFiles = hooksJson.__generated?.files ?? [];

      // Timestamp should be valid
      expect(secondTimestamp).toBeDefined();

      // Should still have exactly one file with the expected naming pattern
      expect(secondFiles.length).toBe(1);
      expect(secondFiles[0]).toMatch(/^hook-with-timeout\.[a-f0-9]+\.mjs$/);

      // Only the new file should exist on disk in the build directory (old one removed)
      const filesOnDisk = fs.readdirSync(buildDir).filter((f) => f.endsWith('.mjs'));
      expect(filesOnDisk.length).toBe(1);
      expect(filesOnDisk[0]).toBe(secondFiles[0]);
    });
  });

  describe('Atomic Writes', () => {
    it('does not leave partial hooks.json on error', () => {
      const { pluginDir, outputPath } = createPluginStructure('atomic-write');

      // Create initial valid hooks.json
      const initialHooksJson: HooksJson = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'External',
              hooks: [{ type: 'command', command: '/external/hook' }]
            }
          ]
        }
      };
      fs.writeFileSync(outputPath, JSON.stringify(initialHooksJson, null, 2));
      const initialContent = fs.readFileSync(outputPath, 'utf-8');

      // Try to build with a non-existent input file (should fail)
      const result = runCli('/non/existent/path/*.ts', outputPath);
      expect(result.success).toBe(false);

      // hooks.json should remain unchanged
      const afterContent = fs.readFileSync(outputPath, 'utf-8');
      expect(afterContent).toBe(initialContent);

      // No temp files should be left behind
      const files = fs.readdirSync(pluginDir);
      const tempFiles = files.filter((f) => f.includes('.tmp.'));
      expect(tempFiles).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty existing hooks.json gracefully', () => {
      const { outputPath } = createPluginStructure('empty-existing');

      // Create empty hooks.json
      fs.writeFileSync(outputPath, JSON.stringify({ hooks: {} }, null, 2));

      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
    });

    it('handles malformed existing hooks.json by overwriting', () => {
      const { outputPath } = createPluginStructure('malformed-existing');

      // Create malformed hooks.json
      fs.writeFileSync(outputPath, '{ invalid json }');

      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
    });

    it('handles hooks.json without __generated field', () => {
      const { outputPath } = createPluginStructure('no-generated-field');

      // Create hooks.json without __generated
      const legacyHooksJson: HooksJson = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Legacy',
              hooks: [{ type: 'command', command: '/legacy/hook' }]
            }
          ]
        }
      };
      fs.writeFileSync(outputPath, JSON.stringify(legacyHooksJson, null, 2));

      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      // Legacy hook should be preserved (no __generated means nothing to remove)
      const legacyEntry = hooksJson.hooks.PreToolUse?.find((e) => e.matcher === 'Legacy');
      expect(legacyEntry).toBeDefined();

      // New hook should be added
      const newEntry = hooksJson.hooks.PreToolUse?.find((e) => e.matcher === 'Write');
      expect(newEntry).toBeDefined();

      // __generated should now exist
      expect(hooksJson.__generated).toBeDefined();
    });
  });
});
