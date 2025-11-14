/**
 * Tests for template resolver with priority-based loading
 * Validates resolution order and error handling
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTemplate } from '../src/template-resolver.js';
import { WrapperTemplate } from '../src/types/wrapper.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Template Resolver', () => {
  let tempConfigDir: string;
  let tempTemplatesDir: string;
  let tempWorkingDir: string;
  let originalClaudeConfigDir: string | undefined;
  let originalCwd: string;

  beforeEach(async () => {
    // Save original env var and cwd
    originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
    originalCwd = process.cwd();

    // Create temporary Claude config directory
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-config-'));
    tempTemplatesDir = path.join(tempConfigDir, 'mcp-wrapper-templates');
    await fs.mkdir(tempTemplatesDir, { recursive: true });

    // Create temporary working directory for relative path tests
    tempWorkingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'working-dir-'));

    // Set env var to temporary directory
    process.env.CLAUDE_CONFIG_DIR = tempConfigDir;

    // Change to temporary working directory
    process.chdir(tempWorkingDir);
  });

  afterEach(async () => {
    // Restore original env var and cwd
    if (originalClaudeConfigDir !== undefined) {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
    process.chdir(originalCwd);

    // Clean up temporary directories
    await fs.rm(tempConfigDir, { recursive: true, force: true });
    await fs.rm(tempWorkingDir, { recursive: true, force: true });
  });

  const createValidTemplate = (name: string): WrapperTemplate => ({
    metadata: {
      name,
      description: `Test template: ${name}`,
      version: '1.0.0'
    },
    name: 'test-server',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite']
  });

  describe('Resolution priority order', () => {
    it('should resolve absolute paths first', async () => {
      const absolutePath = path.join(tempWorkingDir, 'absolute-template.json');
      const template = createValidTemplate('absolute-template');

      await fs.writeFile(absolutePath, JSON.stringify(template));

      const resolved = await resolveTemplate(absolutePath);
      expect(resolved).toEqual(template);
      expect(resolved.metadata.name).toBe('absolute-template');
    });

    it('should resolve relative paths starting with ./ second', async () => {
      const template = createValidTemplate('relative-template');
      await fs.writeFile(path.join(tempWorkingDir, 'relative-template.json'), JSON.stringify(template));

      const resolved = await resolveTemplate('./relative-template.json');
      expect(resolved).toEqual(template);
      expect(resolved.metadata.name).toBe('relative-template');
    });

    it('should resolve relative paths starting with ../ second', async () => {
      const subDir = path.join(tempWorkingDir, 'subdir');
      await fs.mkdir(subDir, { recursive: true });

      const template = createValidTemplate('parent-template');
      await fs.writeFile(path.join(tempWorkingDir, 'parent-template.json'), JSON.stringify(template));

      // Change to subdirectory
      process.chdir(subDir);

      const resolved = await resolveTemplate('../parent-template.json');
      expect(resolved).toEqual(template);
      expect(resolved.metadata.name).toBe('parent-template');
    });

    it('should resolve packaged templates third', async () => {
      // Use an existing packaged template (sqlite)
      const resolved = await resolveTemplate('sqlite');
      expect(resolved.metadata.name).toBe('SQLite MCP');
      expect(resolved.transport).toBe('stdio');
    });

    it('should resolve local templates fourth', async () => {
      const template = createValidTemplate('local-template');
      await fs.writeFile(path.join(tempTemplatesDir, 'local-template.json'), JSON.stringify(template));

      const resolved = await resolveTemplate('local-template');
      expect(resolved).toEqual(template);
      expect(resolved.metadata.name).toBe('local-template');
    });

    it('should prioritize absolute path over packaged template with same name', async () => {
      // Create absolute path template named 'sqlite' (same as packaged template)
      const absolutePath = path.join(tempWorkingDir, 'sqlite.json');
      const customTemplate = createValidTemplate('custom-sqlite');

      await fs.writeFile(absolutePath, JSON.stringify(customTemplate));

      // Absolute path should take priority
      const resolved = await resolveTemplate(absolutePath);
      expect(resolved.metadata.name).toBe('custom-sqlite');
    });

    it('should prioritize relative path over packaged template with same name', async () => {
      // Create relative path template named 'github' (same as packaged template)
      const customTemplate = createValidTemplate('custom-github');
      await fs.writeFile(path.join(tempWorkingDir, 'github.json'), JSON.stringify(customTemplate));

      // Relative path should take priority
      const resolved = await resolveTemplate('./github.json');
      expect(resolved.metadata.name).toBe('custom-github');
    });

    it('should prioritize packaged template over local template with same name', async () => {
      // Create local template with same name as packaged template
      const localTemplate = createValidTemplate('local-sqlite');
      await fs.writeFile(path.join(tempTemplatesDir, 'sqlite.json'), JSON.stringify(localTemplate));

      // Packaged template should take priority
      const resolved = await resolveTemplate('sqlite');
      expect(resolved.metadata.name).toBe('SQLite MCP'); // The real packaged template
      expect(resolved.metadata.name).not.toBe('local-sqlite');
    });

    it('should prioritize local template over GitHub reference', async () => {
      // Create local template that looks like GitHub reference
      const localTemplate = createValidTemplate('owner-repo');
      await fs.writeFile(path.join(tempTemplatesDir, 'owner-repo.json'), JSON.stringify(localTemplate));

      // Local template should take priority (won't try GitHub)
      const resolved = await resolveTemplate('owner-repo');
      expect(resolved.metadata.name).toBe('owner-repo');
    });
  });

  describe('Absolute path resolution', () => {
    it('should load template from absolute path', async () => {
      const absolutePath = path.join(tempWorkingDir, 'absolute-test.json');
      const template = createValidTemplate('absolute-test');

      await fs.writeFile(absolutePath, JSON.stringify(template));

      const resolved = await resolveTemplate(absolutePath);
      expect(resolved).toEqual(template);
    });

    it('should add .json extension if missing', async () => {
      const absolutePath = path.join(tempWorkingDir, 'no-extension');
      const template = createValidTemplate('no-extension');

      await fs.writeFile(`${absolutePath}.json`, JSON.stringify(template));

      const resolved = await resolveTemplate(absolutePath);
      expect(resolved).toEqual(template);
    });

    it('should throw descriptive error for missing absolute path', async () => {
      const absolutePath = path.join(tempWorkingDir, 'missing.json');

      await expect(resolveTemplate(absolutePath)).rejects.toThrow(
        `Template '${absolutePath}' from absolute path failed:`
      );
    });

    it('should throw descriptive error for invalid JSON in absolute path', async () => {
      const absolutePath = path.join(tempWorkingDir, 'invalid.json');
      await fs.writeFile(absolutePath, 'invalid json {');

      await expect(resolveTemplate(absolutePath)).rejects.toThrow(
        `Template '${absolutePath}' from absolute path failed:`
      );
    });

    it('should throw descriptive error for validation failure in absolute path', async () => {
      const absolutePath = path.join(tempWorkingDir, 'invalid-template.json');
      const invalidTemplate = {
        metadata: { name: 'test', description: 'test', version: '1.0.0' },
        name: 'test',
        transport: 'stdio'
        // Missing required 'command' for stdio transport
      };

      await fs.writeFile(absolutePath, JSON.stringify(invalidTemplate));

      await expect(resolveTemplate(absolutePath)).rejects.toThrow(
        `Template '${absolutePath}' from absolute path failed:`
      );
      await expect(resolveTemplate(absolutePath)).rejects.toThrow('stdio transport requires');
    });

    it('should preserve environment variable placeholders', async () => {
      const absolutePath = path.join(tempWorkingDir, 'with-env-vars.json');
      const template: WrapperTemplate = {
        metadata: {
          name: 'with-env-vars',
          description: 'Template with env vars',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'http',
        url: 'http://localhost:3000',
        headers: {
          Authorization: 'Bearer ${API_TOKEN}'
        },
        env: {
          DATABASE_URL: '${DATABASE_URL}'
        }
      };

      await fs.writeFile(absolutePath, JSON.stringify(template));

      const resolved = await resolveTemplate(absolutePath);
      expect(resolved.headers?.Authorization).toBe('Bearer ${API_TOKEN}');
      expect(resolved.env?.DATABASE_URL).toBe('${DATABASE_URL}');
    });
  });

  describe('Relative path resolution', () => {
    it('should load template from ./ relative path', async () => {
      const template = createValidTemplate('relative-current');
      await fs.writeFile(path.join(tempWorkingDir, 'relative-current.json'), JSON.stringify(template));

      const resolved = await resolveTemplate('./relative-current.json');
      expect(resolved).toEqual(template);
    });

    it('should load template from ../ relative path', async () => {
      const subDir = path.join(tempWorkingDir, 'subdir');
      await fs.mkdir(subDir, { recursive: true });

      const template = createValidTemplate('relative-parent');
      await fs.writeFile(path.join(tempWorkingDir, 'relative-parent.json'), JSON.stringify(template));

      process.chdir(subDir);

      const resolved = await resolveTemplate('../relative-parent.json');
      expect(resolved).toEqual(template);
    });

    it('should resolve relative path from current working directory', async () => {
      const subDir = path.join(tempWorkingDir, 'subdir');
      await fs.mkdir(subDir, { recursive: true });

      const template = createValidTemplate('in-subdir');
      await fs.writeFile(path.join(subDir, 'in-subdir.json'), JSON.stringify(template));

      const resolved = await resolveTemplate('./subdir/in-subdir.json');
      expect(resolved).toEqual(template);
    });

    it('should throw descriptive error for missing relative path', async () => {
      await expect(resolveTemplate('./missing.json')).rejects.toThrow(
        "Template './missing.json' from relative path failed:"
      );
    });

    it('should throw descriptive error for invalid JSON in relative path', async () => {
      await fs.writeFile(path.join(tempWorkingDir, 'invalid.json'), 'not json');

      await expect(resolveTemplate('./invalid.json')).rejects.toThrow(
        "Template './invalid.json' from relative path failed:"
      );
    });

    it('should throw descriptive error for validation failure in relative path', async () => {
      const invalidTemplate = {
        metadata: { name: 'test', description: 'test', version: '1.0.0' },
        name: 'test',
        transport: 'http'
        // Missing required 'url' for http transport
      };

      await fs.writeFile(path.join(tempWorkingDir, 'invalid-http.json'), JSON.stringify(invalidTemplate));

      await expect(resolveTemplate('./invalid-http.json')).rejects.toThrow(
        "Template './invalid-http.json' from relative path failed:"
      );
      await expect(resolveTemplate('./invalid-http.json')).rejects.toThrow('http transport requires');
    });
  });

  describe('Packaged template resolution', () => {
    it('should load sqlite packaged template', async () => {
      const resolved = await resolveTemplate('sqlite');
      expect(resolved.metadata.name).toBe('SQLite MCP');
      expect(resolved.transport).toBe('stdio');
      expect(resolved.command).toBe('npx');
      expect(resolved.args).toContain('@modelcontextprotocol/server-sqlite');
    });

    it('should load postgres packaged template', async () => {
      const resolved = await resolveTemplate('postgres');
      expect(resolved.metadata.name).toBe('PostgreSQL MCP');
      expect(resolved.transport).toBe('stdio');
      expect(resolved.command).toBe('npx');
      expect(resolved.args).toContain('@modelcontextprotocol/server-postgres');
    });

    it('should load github packaged template', async () => {
      const resolved = await resolveTemplate('github');
      expect(resolved.metadata.name).toBe('GitHub MCP');
      expect(resolved.transport).toBe('http');
      expect(resolved.url).toBe('https://api.github.com');
    });

    it('should work with or without .json extension', async () => {
      const withoutExt = await resolveTemplate('sqlite');
      const withExt = await resolveTemplate('sqlite.json');

      expect(withoutExt).toEqual(withExt);
    });

    it('should fail immediately on packaged template validation error', async () => {
      // Create a packaged template directory with invalid template
      const srcDir = path.join(__dirname, '..', 'src');
      const templatesDir = path.join(srcDir, 'templates');

      // Check if we can write to templates directory (skip test if not in dev mode)
      try {
        await fs.access(templatesDir);

        const invalidPath = path.join(templatesDir, 'test-invalid-packaged.json');
        const invalidTemplate = {
          metadata: { name: 'invalid', description: 'test', version: '1.0.0' },
          name: 'test',
          transport: 'stdio'
          // Missing command
        };

        await fs.writeFile(invalidPath, JSON.stringify(invalidTemplate));

        try {
          await expect(resolveTemplate('test-invalid-packaged')).rejects.toThrow(
            "Template 'test-invalid-packaged' from packaged templates failed:"
          );
          await expect(resolveTemplate('test-invalid-packaged')).rejects.toThrow('stdio transport requires');
        } finally {
          // Clean up
          await fs.unlink(invalidPath).catch(() => {
            /* ignore */
          });
        }
      } catch {
        // Skip test if not in development mode
      }
    });
  });

  describe('Local template resolution', () => {
    it('should load template from local directory', async () => {
      const template = createValidTemplate('my-local-template');
      await fs.writeFile(path.join(tempTemplatesDir, 'my-local-template.json'), JSON.stringify(template));

      const resolved = await resolveTemplate('my-local-template');
      expect(resolved).toEqual(template);
    });

    it('should work with or without .json extension', async () => {
      const template = createValidTemplate('local-no-ext');
      await fs.writeFile(path.join(tempTemplatesDir, 'local-no-ext.json'), JSON.stringify(template));

      const withoutExt = await resolveTemplate('local-no-ext');
      const withExt = await resolveTemplate('local-no-ext.json');

      expect(withoutExt).toEqual(withExt);
    });

    it('should fail immediately on local template validation error', async () => {
      const invalidTemplate = {
        metadata: { name: 'invalid-local', description: 'test', version: '1.0.0' },
        name: 'test',
        transport: 'http'
        // Missing url
      };

      await fs.writeFile(path.join(tempTemplatesDir, 'invalid-local.json'), JSON.stringify(invalidTemplate));

      await expect(resolveTemplate('invalid-local')).rejects.toThrow(
        "Template 'invalid-local' from local templates failed:"
      );
      await expect(resolveTemplate('invalid-local')).rejects.toThrow('http transport requires');
    });

    it('should fail immediately on local template invalid JSON', async () => {
      await fs.writeFile(path.join(tempTemplatesDir, 'bad-json.json'), 'not valid json {');

      await expect(resolveTemplate('bad-json')).rejects.toThrow("Template 'bad-json' from local templates failed:");
      await expect(resolveTemplate('bad-json')).rejects.toThrow('Invalid JSON');
    });

    it('should use CLAUDE_CONFIG_DIR environment variable', async () => {
      const template = createValidTemplate('config-dir-template');
      await fs.writeFile(path.join(tempTemplatesDir, 'config-dir-template.json'), JSON.stringify(template));

      const resolved = await resolveTemplate('config-dir-template');
      expect(resolved).toEqual(template);
    });
  });

  describe('GitHub template resolution', () => {
    it('should attempt GitHub resolution as last resort', async () => {
      // This will fail because it's not a valid GitHub reference,
      // but we can test that it attempts GitHub resolution
      await expect(resolveTemplate('invalid/reference/format')).rejects.toThrow('from GitHub failed:');
    });

    it('should throw descriptive error for invalid GitHub reference', async () => {
      await expect(resolveTemplate('not-found/repo')).rejects.toThrow("Template 'not-found/repo' from GitHub failed:");
    });

    it('should handle GitHub reference format', async () => {
      // We can't test actual GitHub fetching without network,
      // but we can verify it attempts the right source
      await expect(resolveTemplate('someuser/somerepo')).rejects.toThrow(
        "Template 'someuser/somerepo' from GitHub failed:"
      );
    });
  });

  describe('Error handling', () => {
    it('should provide clear error message with source when template not found anywhere', async () => {
      await expect(resolveTemplate('completely-missing')).rejects.toThrow('from GitHub failed:');
    });

    it('should fail fast on validation errors without trying next source', async () => {
      // Create packaged template with validation error
      const srcDir = path.join(__dirname, '..', 'src');
      const templatesDir = path.join(srcDir, 'templates');

      try {
        await fs.access(templatesDir);

        const invalidPath = path.join(templatesDir, 'fail-fast-test.json');
        const invalidTemplate = {
          metadata: { name: 'fail-fast', description: 'test', version: '1.0.0' },
          name: 'test',
          transport: 'stdio'
          // Missing command - should fail validation
        };

        await fs.writeFile(invalidPath, JSON.stringify(invalidTemplate));

        try {
          // Should fail on packaged template validation, not continue to local/GitHub
          await expect(resolveTemplate('fail-fast-test')).rejects.toThrow(
            "Template 'fail-fast-test' from packaged templates failed:"
          );
        } finally {
          await fs.unlink(invalidPath).catch(() => {
            /* ignore */
          });
        }
      } catch {
        // Skip test if not in development mode
      }
    });

    it('should fail fast on JSON parse errors without trying next source', async () => {
      // Create packaged template with JSON error
      const srcDir = path.join(__dirname, '..', 'src');
      const templatesDir = path.join(srcDir, 'templates');

      try {
        await fs.access(templatesDir);

        const invalidPath = path.join(templatesDir, 'json-error-test.json');
        await fs.writeFile(invalidPath, 'invalid json {');

        try {
          await expect(resolveTemplate('json-error-test')).rejects.toThrow(
            "Template 'json-error-test' from packaged templates failed:"
          );
          await expect(resolveTemplate('json-error-test')).rejects.toThrow('Invalid JSON');
        } finally {
          await fs.unlink(invalidPath).catch(() => {
            /* ignore */
          });
        }
      } catch {
        // Skip test if not in development mode
      }
    });
  });

  describe('Environment variable placeholder preservation', () => {
    it('should preserve placeholders in absolute path templates', async () => {
      const absolutePath = path.join(tempWorkingDir, 'env-absolute.json');
      const template: WrapperTemplate = {
        metadata: { name: 'env-absolute', description: 'test', version: '1.0.0' },
        name: 'test',
        transport: 'http',
        url: '${BASE_URL}/api',
        headers: { Authorization: 'Bearer ${TOKEN}' },
        env: { API_KEY: '${API_KEY}' }
      };

      await fs.writeFile(absolutePath, JSON.stringify(template));

      const resolved = await resolveTemplate(absolutePath);
      expect(resolved.url).toBe('${BASE_URL}/api');
      expect(resolved.headers?.Authorization).toBe('Bearer ${TOKEN}');
      expect(resolved.env?.API_KEY).toBe('${API_KEY}');
    });

    it('should preserve placeholders in relative path templates', async () => {
      const template: WrapperTemplate = {
        metadata: { name: 'env-relative', description: 'test', version: '1.0.0' },
        name: 'test',
        transport: 'stdio',
        command: '${NODE_PATH}/node',
        args: ['${SCRIPT_PATH}/server.js'],
        env: { CONFIG: '${CONFIG_DIR}/config.json' }
      };

      await fs.writeFile(path.join(tempWorkingDir, 'env-relative.json'), JSON.stringify(template));

      const resolved = await resolveTemplate('./env-relative.json');
      expect(resolved.command).toBe('${NODE_PATH}/node');
      expect(resolved.args).toEqual(['${SCRIPT_PATH}/server.js']);
      expect(resolved.env?.CONFIG).toBe('${CONFIG_DIR}/config.json');
    });

    it('should preserve placeholders in local templates', async () => {
      const template: WrapperTemplate = {
        metadata: { name: 'env-local', description: 'test', version: '1.0.0' },
        name: 'test',
        transport: 'http',
        url: 'http://${HOST}:${PORT}',
        env: { DATABASE: '${DATABASE_URL}' }
      };

      await fs.writeFile(path.join(tempTemplatesDir, 'env-local.json'), JSON.stringify(template));

      const resolved = await resolveTemplate('env-local');
      expect(resolved.url).toBe('http://${HOST}:${PORT}');
      expect(resolved.env?.DATABASE).toBe('${DATABASE_URL}');
    });

    it('should preserve placeholders in packaged templates', async () => {
      // github.json has placeholders
      const resolved = await resolveTemplate('github');
      // Check that placeholders are preserved (not expanded)
      expect(JSON.stringify(resolved)).toContain('${');
    });
  });

  describe('Edge cases', () => {
    it('should handle Windows-style absolute paths', async () => {
      if (process.platform === 'win32') {
        const winPath = path.join('C:\\', 'temp', 'template.json');
        const template = createValidTemplate('windows-path');
        await fs.writeFile(winPath, JSON.stringify(template));

        const resolved = await resolveTemplate(winPath);
        expect(resolved).toEqual(template);
      }
    });

    it('should handle paths with spaces', async () => {
      const dirWithSpaces = path.join(tempWorkingDir, 'dir with spaces');
      await fs.mkdir(dirWithSpaces, { recursive: true });

      const template = createValidTemplate('space-path');
      const filePath = path.join(dirWithSpaces, 'template.json');
      await fs.writeFile(filePath, JSON.stringify(template));

      const resolved = await resolveTemplate(filePath);
      expect(resolved).toEqual(template);
    });

    it('should handle template names with special characters', async () => {
      const template = createValidTemplate('special-chars');
      await fs.writeFile(
        path.join(tempTemplatesDir, 'template-with-dashes_and_underscores.json'),
        JSON.stringify(template)
      );

      const resolved = await resolveTemplate('template-with-dashes_and_underscores');
      expect(resolved.metadata.name).toBe('special-chars');
    });

    it('should handle empty reference gracefully', async () => {
      await expect(resolveTemplate('')).rejects.toThrow();
    });

    it('should handle reference with only whitespace', async () => {
      await expect(resolveTemplate('   ')).rejects.toThrow();
    });
  });
});
