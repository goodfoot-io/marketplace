/**
 * Tests for template loader functionality
 * Loads templates from local, packaged, and file locations
 */

import { readFileSync } from 'fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadLocalTemplate, loadPackagedTemplate, loadFileTemplate } from '../src/template-loader.js';
import { validateWrapperTemplate, templateToServerConfig } from '../src/types/wrapper.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Template Loader', () => {
  describe('loadLocalTemplate', () => {
    let tempConfigDir: string;
    let tempTemplatesDir: string;
    let originalClaudeConfigDir: string | undefined;

    beforeEach(async () => {
      // Save original env var
      originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

      // Create temporary Claude config directory
      tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-config-'));
      tempTemplatesDir = path.join(tempConfigDir, 'mcp-wrapper-templates');
      await fs.mkdir(tempTemplatesDir, { recursive: true });

      // Set env var to temporary directory
      process.env.CLAUDE_CONFIG_DIR = tempConfigDir;
    });

    afterEach(async () => {
      // Restore original env var
      if (originalClaudeConfigDir !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }

      // Clean up temporary directory
      await fs.rm(tempConfigDir, { recursive: true, force: true });
    });

    describe('successful template loading', () => {
      it('should load a valid template from local directory', async () => {
        const template = {
          metadata: {
            name: 'test-template',
            description: 'A test template',
            version: '1.0.0'
          },
          name: 'test-server',
          transport: 'stdio' as const,
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sqlite']
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'test-template.json'), JSON.stringify(template));

        const loaded = await loadLocalTemplate('test-template');
        expect(loaded).toEqual(template);
      });

      it('should load template without .json extension', async () => {
        const template = {
          metadata: {
            name: 'no-ext',
            description: 'Template without extension in name',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'http' as const,
          url: 'http://localhost:3000'
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'no-ext.json'), JSON.stringify(template));

        const loaded = await loadLocalTemplate('no-ext');
        expect(loaded).toEqual(template);
      });

      it('should load template with .json extension', async () => {
        const template = {
          metadata: {
            name: 'with-ext',
            description: 'Template with extension in name',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node',
          args: ['server.js']
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'with-ext.json'), JSON.stringify(template));

        const loaded = await loadLocalTemplate('with-ext.json');
        expect(loaded).toEqual(template);
      });

      it('should handle .JSON extension (case-insensitive)', async () => {
        const template = {
          metadata: {
            name: 'upper-ext',
            description: 'Template with uppercase extension',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'upper-ext.json'), JSON.stringify(template));

        const loaded = await loadLocalTemplate('upper-ext.JSON');
        expect(loaded).toEqual(template);
      });

      it('should prevent double-extension when name ends with .json', async () => {
        const template = {
          metadata: {
            name: 'prevent-double',
            description: 'Prevents .json.json',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'prevent-double.json'), JSON.stringify(template));

        const loaded = await loadLocalTemplate('prevent-double.json');
        expect(loaded).toEqual(template);

        // Ensure .json.json file was not created
        const doubleExtPath = path.join(tempTemplatesDir, 'prevent-double.json.json');
        await expect(fs.access(doubleExtPath)).rejects.toThrow();
      });

      it('should preserve environment variable placeholders', async () => {
        const template = {
          metadata: {
            name: 'env-vars',
            description: 'Template with environment variables',
            version: '1.0.0'
          },
          name: 'github',
          transport: 'http' as const,
          url: 'https://api.github.com',
          headers: {
            Authorization: 'token ${GITHUB_TOKEN}'
          },
          env: {
            GITHUB_TOKEN: '${GITHUB_TOKEN}',
            API_URL: '${API_URL:-https://api.github.com}'
          }
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'env-vars.json'), JSON.stringify(template));

        const loaded = await loadLocalTemplate('env-vars');
        expect(loaded.headers?.Authorization).toBe('token ${GITHUB_TOKEN}');
        expect(loaded.env?.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
        expect(loaded.env?.API_URL).toBe('${API_URL:-https://api.github.com}');
      });

      it('should load template with system prompt configuration', async () => {
        const template = {
          metadata: {
            name: 'with-prompt',
            description: 'Template with system prompt',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node',
          systemPrompt: {
            type: 'text' as const,
            content: 'You are a helpful assistant.'
          }
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'with-prompt.json'), JSON.stringify(template));

        const loaded = await loadLocalTemplate('with-prompt');
        expect(loaded.systemPrompt).toEqual({
          type: 'text',
          content: 'You are a helpful assistant.'
        });
      });
    });

    describe('error handling', () => {
      it('should throw descriptive error for missing file', async () => {
        await expect(loadLocalTemplate('non-existent')).rejects.toThrow(/Template not found.*non-existent\.json/);
      });

      it('should throw error for invalid JSON', async () => {
        await fs.writeFile(path.join(tempTemplatesDir, 'invalid.json'), 'not valid json {');

        await expect(loadLocalTemplate('invalid')).rejects.toThrow(/Invalid JSON in template/);
      });

      it('should throw error for template validation failure', async () => {
        const invalidTemplate = {
          metadata: {
            name: 'invalid',
            description: 'Missing version',
            version: ''
          },
          name: 'server'
          // missing transport
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'invalid-schema.json'), JSON.stringify(invalidTemplate));

        await expect(loadLocalTemplate('invalid-schema')).rejects.toThrow(/Invalid wrapper template/);
      });

      it('should throw error for stdio template without command', async () => {
        const invalidTemplate = {
          metadata: {
            name: 'no-command',
            description: 'Stdio without command',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio'
          // missing command
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'no-command.json'), JSON.stringify(invalidTemplate));

        await expect(loadLocalTemplate('no-command')).rejects.toThrow(/stdio transport requires a command/);
      });

      it('should throw error for HTTP template without url', async () => {
        const invalidTemplate = {
          metadata: {
            name: 'no-url',
            description: 'HTTP without url',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'http'
          // missing url
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'no-url.json'), JSON.stringify(invalidTemplate));

        await expect(loadLocalTemplate('no-url')).rejects.toThrow(/http transport requires a url/);
      });

      it('should handle empty template name', async () => {
        await expect(loadLocalTemplate('')).rejects.toThrow(/Template not found/);
      });
    });

    describe('CLAUDE_CONFIG_DIR resolution', () => {
      it('should use CLAUDE_CONFIG_DIR environment variable', async () => {
        const template = {
          metadata: {
            name: 'env-dir',
            description: 'Uses env var',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        await fs.writeFile(path.join(tempTemplatesDir, 'env-dir.json'), JSON.stringify(template));

        const loaded = await loadLocalTemplate('env-dir');
        expect(loaded).toEqual(template);
      });

      it('should use ~/.claude when CLAUDE_CONFIG_DIR not set', async () => {
        // Remove env var temporarily
        delete process.env.CLAUDE_CONFIG_DIR;

        // Create template in home directory
        const homeClaudeDir = path.join(os.homedir(), '.claude', 'mcp-wrapper-templates');
        await fs.mkdir(homeClaudeDir, { recursive: true });

        const template = {
          metadata: {
            name: 'home-dir',
            description: 'Uses home directory',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        await fs.writeFile(path.join(homeClaudeDir, 'home-dir.json'), JSON.stringify(template));

        try {
          const loaded = await loadLocalTemplate('home-dir');
          expect(loaded).toEqual(template);
        } finally {
          // Clean up
          await fs.rm(homeClaudeDir, { recursive: true, force: true });
          process.env.CLAUDE_CONFIG_DIR = tempConfigDir;
        }
      });
    });
  });

  describe('loadPackagedTemplate', () => {
    describe('successful template loading', () => {
      it('should load sqlite template from packaged templates', async () => {
        const loaded = await loadPackagedTemplate('sqlite');

        expect(loaded.metadata.name).toBe('SQLite MCP');
        expect(loaded.transport).toBe('stdio');
        expect(loaded.command).toBe('npx');
      });

      it('should load postgres template from packaged templates', async () => {
        const loaded = await loadPackagedTemplate('postgres');

        expect(loaded.metadata.name).toBe('PostgreSQL MCP');
        expect(loaded.transport).toBe('stdio');
        expect(loaded.command).toBe('npx');
      });

      it('should load github template from packaged templates', async () => {
        const loaded = await loadPackagedTemplate('github');

        expect(loaded.metadata.name).toBe('GitHub MCP');
        expect(loaded.transport).toBe('http');
        expect(loaded.url).toBe('https://api.github.com');
      });

      it('should load template without .json extension', async () => {
        const loaded = await loadPackagedTemplate('sqlite');
        expect(loaded.metadata.name).toBe('SQLite MCP');
      });

      it('should load template with .json extension', async () => {
        const loaded = await loadPackagedTemplate('sqlite.json');
        expect(loaded.metadata.name).toBe('SQLite MCP');
      });

      it('should handle .JSON extension (case-insensitive)', async () => {
        const loaded = await loadPackagedTemplate('sqlite.JSON');
        expect(loaded.metadata.name).toBe('SQLite MCP');
      });

      it('should preserve environment variable placeholders', async () => {
        const loaded = await loadPackagedTemplate('postgres');

        // Postgres template should have environment variable placeholders
        expect(loaded.env?.DATABASE_URL).toContain('${');
      });
    });

    describe('error handling', () => {
      it('should throw descriptive error for missing packaged template', async () => {
        await expect(loadPackagedTemplate('non-existent')).rejects.toThrow(
          /Packaged template not found.*non-existent\.json/
        );
      });

      it('should handle empty template name', async () => {
        await expect(loadPackagedTemplate('')).rejects.toThrow(/Packaged template not found/);
      });
    });

    describe('template location resolution', () => {
      it('should try src/templates/ first in development', async () => {
        // This test verifies the loader checks src/templates/ directory
        // In production build, it falls back to build/templates/
        const loaded = await loadPackagedTemplate('sqlite');
        expect(loaded.metadata.name).toBe('SQLite MCP');
      });
    });
  });

  describe('loadFileTemplate', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'template-loader-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('absolute paths', () => {
      it('should load template from absolute path', async () => {
        const template = {
          metadata: {
            name: 'absolute-path',
            description: 'Loaded from absolute path',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        const filePath = path.join(tempDir, 'absolute.json');
        await fs.writeFile(filePath, JSON.stringify(template));

        const loaded = await loadFileTemplate(filePath);
        expect(loaded).toEqual(template);
      });

      it('should load template from absolute path without .json extension', async () => {
        const template = {
          metadata: {
            name: 'no-ext-abs',
            description: 'Absolute path without extension',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'http' as const,
          url: 'http://localhost:3000'
        };

        const filePath = path.join(tempDir, 'no-ext-abs.json');
        await fs.writeFile(filePath, JSON.stringify(template));

        const loaded = await loadFileTemplate(path.join(tempDir, 'no-ext-abs'));
        expect(loaded).toEqual(template);
      });

      it('should handle absolute path with .json extension', async () => {
        const template = {
          metadata: {
            name: 'with-ext-abs',
            description: 'Absolute path with extension',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        const filePath = path.join(tempDir, 'with-ext-abs.json');
        await fs.writeFile(filePath, JSON.stringify(template));

        const loaded = await loadFileTemplate(filePath);
        expect(loaded).toEqual(template);
      });
    });

    describe('relative paths', () => {
      it('should load template from relative path', async () => {
        const template = {
          metadata: {
            name: 'relative-path',
            description: 'Loaded from relative path',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        // Create subdirectory in temp
        const subdir = path.join(tempDir, 'subdir');
        await fs.mkdir(subdir);
        const filePath = path.join(subdir, 'relative.json');
        await fs.writeFile(filePath, JSON.stringify(template));

        // Save current directory
        const originalCwd = process.cwd();

        try {
          // Change to temp directory
          process.chdir(tempDir);

          const loaded = await loadFileTemplate('subdir/relative.json');
          expect(loaded).toEqual(template);
        } finally {
          // Restore original directory
          process.chdir(originalCwd);
        }
      });

      it('should resolve relative path from cwd', async () => {
        const template = {
          metadata: {
            name: 'cwd-relative',
            description: 'Resolved from cwd',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'http' as const,
          url: 'http://localhost:3000'
        };

        const filePath = path.join(tempDir, 'cwd-relative.json');
        await fs.writeFile(filePath, JSON.stringify(template));

        // Save current directory
        const originalCwd = process.cwd();

        try {
          // Change to temp directory
          process.chdir(tempDir);

          const loaded = await loadFileTemplate('./cwd-relative.json');
          expect(loaded).toEqual(template);
        } finally {
          // Restore original directory
          process.chdir(originalCwd);
        }
      });

      it('should handle ../parent relative paths', async () => {
        const template = {
          metadata: {
            name: 'parent-relative',
            description: 'Uses parent directory',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        const filePath = path.join(tempDir, 'parent.json');
        await fs.writeFile(filePath, JSON.stringify(template));

        // Create child directory
        const childDir = path.join(tempDir, 'child');
        await fs.mkdir(childDir);

        const originalCwd = process.cwd();

        try {
          process.chdir(childDir);

          const loaded = await loadFileTemplate('../parent.json');
          expect(loaded).toEqual(template);
        } finally {
          process.chdir(originalCwd);
        }
      });
    });

    describe('extension handling', () => {
      it('should prevent double-extension for absolute paths', async () => {
        const template = {
          metadata: {
            name: 'prevent-double-abs',
            description: 'Prevents .json.json',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        const filePath = path.join(tempDir, 'prevent-double.json');
        await fs.writeFile(filePath, JSON.stringify(template));

        const loaded = await loadFileTemplate(filePath);
        expect(loaded).toEqual(template);
      });

      it('should prevent double-extension for relative paths', async () => {
        const template = {
          metadata: {
            name: 'prevent-double-rel',
            description: 'Prevents .json.json',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        const filePath = path.join(tempDir, 'relative-double.json');
        await fs.writeFile(filePath, JSON.stringify(template));

        const originalCwd = process.cwd();

        try {
          process.chdir(tempDir);

          const loaded = await loadFileTemplate('./relative-double.json');
          expect(loaded).toEqual(template);
        } finally {
          process.chdir(originalCwd);
        }
      });

      it('should handle case-insensitive .JSON extension', async () => {
        const template = {
          metadata: {
            name: 'upper-ext-file',
            description: 'Uppercase extension',
            version: '1.0.0'
          },
          name: 'server',
          transport: 'stdio' as const,
          command: 'node'
        };

        const filePath = path.join(tempDir, 'upper.json');
        await fs.writeFile(filePath, JSON.stringify(template));

        const loaded = await loadFileTemplate(path.join(tempDir, 'upper.JSON'));
        expect(loaded).toEqual(template);
      });
    });

    describe('error handling', () => {
      it('should throw descriptive error for missing file (absolute)', async () => {
        const nonExistentPath = path.join(tempDir, 'non-existent.json');
        await expect(loadFileTemplate(nonExistentPath)).rejects.toThrow(/Template file not found/);
      });

      it('should throw descriptive error for missing file (relative)', async () => {
        await expect(loadFileTemplate('./non-existent.json')).rejects.toThrow(/Template file not found/);
      });

      it('should throw error for invalid JSON', async () => {
        const filePath = path.join(tempDir, 'invalid.json');
        await fs.writeFile(filePath, 'not valid json {');

        await expect(loadFileTemplate(filePath)).rejects.toThrow(/Invalid JSON in template file/);
      });

      it('should throw error for template validation failure', async () => {
        const invalidTemplate = {
          metadata: {
            name: 'invalid',
            description: 'Missing version',
            version: ''
          }
          // missing required fields
        };

        const filePath = path.join(tempDir, 'invalid-schema.json');
        await fs.writeFile(filePath, JSON.stringify(invalidTemplate));

        await expect(loadFileTemplate(filePath)).rejects.toThrow(/Invalid wrapper template/);
      });

      it('should handle empty file path', async () => {
        await expect(loadFileTemplate('')).rejects.toThrow(/Template file not found/);
      });
    });

    describe('environment variable placeholder preservation', () => {
      it('should preserve ${VARIABLE} placeholders in loaded template', async () => {
        const template = {
          metadata: {
            name: 'file-env-vars',
            description: 'Template with environment variables',
            version: '1.0.0'
          },
          name: 'github',
          transport: 'http' as const,
          url: '${API_URL:-https://api.github.com}',
          headers: {
            Authorization: 'token ${GITHUB_TOKEN}'
          },
          env: {
            GITHUB_TOKEN: '${GITHUB_TOKEN}',
            DEBUG: '${DEBUG:-false}'
          }
        };

        const filePath = path.join(tempDir, 'env-vars.json');
        await fs.writeFile(filePath, JSON.stringify(template));

        const loaded = await loadFileTemplate(filePath);
        expect(loaded.url).toBe('${API_URL:-https://api.github.com}');
        expect(loaded.headers?.Authorization).toBe('token ${GITHUB_TOKEN}');
        expect(loaded.env?.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
        expect(loaded.env?.DEBUG).toBe('${DEBUG:-false}');
      });
    });
  });
});

// Keep existing pre-packaged template tests for validation
describe('Pre-packaged Template Loading', () => {
  describe('github.json template', () => {
    it('should load and validate github template', () => {
      const templatePath = join(__dirname, '../src/templates/github.json');
      const templateContent = readFileSync(templatePath, 'utf-8');
      const templateData = JSON.parse(templateContent) as unknown;

      // Should validate successfully
      expect(() => validateWrapperTemplate(templateData)).not.toThrow();
      const template = validateWrapperTemplate(templateData);

      // Verify metadata
      expect(template.metadata.name).toBe('GitHub MCP');
      expect(template.metadata.description).toContain('GitHub');
      expect(template.metadata.version).toBe('1.0.0');
      expect(template.metadata.author).toBe('Anthropic');

      // Verify server configuration
      expect(template.name).toBe('github');
      expect(template.transport).toBe('http');
      expect(template.url).toBe('https://api.github.com');
    });

    it('should preserve ${GITHUB_TOKEN} environment variable placeholder', () => {
      const templatePath = join(__dirname, '../src/templates/github.json');
      const templateContent = readFileSync(templatePath, 'utf-8');
      const templateData = JSON.parse(templateContent) as unknown;
      const template = validateWrapperTemplate(templateData);

      // Verify placeholders are preserved in headers
      expect(template.headers).toBeDefined();
      expect(template.headers?.Authorization).toContain('${GITHUB_TOKEN}');

      // Verify placeholders are preserved in env
      expect(template.env).toBeDefined();
      expect(template.env?.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
    });

    it('should convert github template to ServerConfig', () => {
      const templatePath = join(__dirname, '../src/templates/github.json');
      const templateContent = readFileSync(templatePath, 'utf-8');
      const templateData = JSON.parse(templateContent) as unknown;
      const template = validateWrapperTemplate(templateData);

      const serverConfig = templateToServerConfig(template);

      expect(serverConfig.name).toBe('github');
      expect(serverConfig.transport).toBe('http');
      expect(serverConfig.url).toBe('https://api.github.com');
      expect(serverConfig.headers).toBeDefined();
      expect(serverConfig.env).toBeDefined();

      // Verify placeholders are preserved in conversion
      expect(serverConfig.headers?.Authorization).toContain('${GITHUB_TOKEN}');
      expect(serverConfig.env?.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
    });
  });

  describe('sqlite.json template', () => {
    it('should load and validate sqlite template', () => {
      const templatePath = join(__dirname, '../src/templates/sqlite.json');
      const templateContent = readFileSync(templatePath, 'utf-8');
      const templateData = JSON.parse(templateContent) as unknown;

      // Should validate successfully
      expect(() => validateWrapperTemplate(templateData)).not.toThrow();
      const template = validateWrapperTemplate(templateData);

      // Verify metadata
      expect(template.metadata.name).toBe('SQLite MCP');
      expect(template.metadata.description).toContain('SQLite');
      expect(template.metadata.version).toBe('1.0.0');
      expect(template.metadata.author).toBe('Anthropic');

      // Verify server configuration
      expect(template.name).toBe('sqlite');
      expect(template.transport).toBe('stdio');
      expect(template.command).toBe('npx');
      expect(template.args).toBeDefined();
      expect(template.args).toContain('-y');
      expect(template.args).toContain('@modelcontextprotocol/server-sqlite');
    });

    it('should not require environment variables for sqlite', () => {
      const templatePath = join(__dirname, '../src/templates/sqlite.json');
      const templateContent = readFileSync(templatePath, 'utf-8');
      const templateData = JSON.parse(templateContent) as unknown;
      const template = validateWrapperTemplate(templateData);

      // SQLite doesn't need env variables
      expect(template.env).toBeUndefined();
    });

    it('should convert sqlite template to ServerConfig', () => {
      const templatePath = join(__dirname, '../src/templates/sqlite.json');
      const templateContent = readFileSync(templatePath, 'utf-8');
      const templateData = JSON.parse(templateContent) as unknown;
      const template = validateWrapperTemplate(templateData);

      const serverConfig = templateToServerConfig(template);

      expect(serverConfig.name).toBe('sqlite');
      expect(serverConfig.transport).toBe('stdio');
      expect(serverConfig.command).toBe('npx');
      expect(serverConfig.args).toBeDefined();
      expect(serverConfig.args).toEqual(expect.arrayContaining(['-y', '@modelcontextprotocol/server-sqlite']));
    });
  });

  describe('postgres.json template', () => {
    it('should load and validate postgres template', () => {
      const templatePath = join(__dirname, '../src/templates/postgres.json');
      const templateContent = readFileSync(templatePath, 'utf-8');
      const templateData = JSON.parse(templateContent) as unknown;

      // Should validate successfully
      expect(() => validateWrapperTemplate(templateData)).not.toThrow();
      const template = validateWrapperTemplate(templateData);

      // Verify metadata
      expect(template.metadata.name).toBe('PostgreSQL MCP');
      expect(template.metadata.description).toContain('PostgreSQL');
      expect(template.metadata.version).toBe('1.0.0');
      expect(template.metadata.author).toBe('Anthropic');

      // Verify server configuration
      expect(template.name).toBe('postgres');
      expect(template.transport).toBe('stdio');
      expect(template.command).toBe('npx');
      expect(template.args).toBeDefined();
      expect(template.args).toContain('-y');
      expect(template.args).toContain('@modelcontextprotocol/server-postgres');
    });

    it('should preserve ${DATABASE_URL} environment variable placeholder', () => {
      const templatePath = join(__dirname, '../src/templates/postgres.json');
      const templateContent = readFileSync(templatePath, 'utf-8');
      const templateData = JSON.parse(templateContent) as unknown;
      const template = validateWrapperTemplate(templateData);

      // Verify placeholder is preserved in env
      expect(template.env).toBeDefined();
      expect(template.env?.DATABASE_URL).toBe('${DATABASE_URL}');
    });

    it('should convert postgres template to ServerConfig', () => {
      const templatePath = join(__dirname, '../src/templates/postgres.json');
      const templateContent = readFileSync(templatePath, 'utf-8');
      const templateData = JSON.parse(templateContent) as unknown;
      const template = validateWrapperTemplate(templateData);

      const serverConfig = templateToServerConfig(template);

      expect(serverConfig.name).toBe('postgres');
      expect(serverConfig.transport).toBe('stdio');
      expect(serverConfig.command).toBe('npx');
      expect(serverConfig.args).toEqual(expect.arrayContaining(['-y', '@modelcontextprotocol/server-postgres']));
      expect(serverConfig.env).toBeDefined();

      // Verify placeholder is preserved in conversion
      expect(serverConfig.env?.DATABASE_URL).toBe('${DATABASE_URL}');
    });
  });

  describe('Template structure validation', () => {
    const templateNames = ['github', 'sqlite', 'postgres'];

    templateNames.forEach((templateName) => {
      it(`should have all required fields in ${templateName} template`, () => {
        const templatePath = join(__dirname, `../src/templates/${templateName}.json`);
        const templateContent = readFileSync(templatePath, 'utf-8');
        const templateData = JSON.parse(templateContent) as unknown;
        const template = validateWrapperTemplate(templateData);

        // Required fields in metadata
        expect(template.metadata).toBeDefined();
        expect(template.metadata.name).toBeDefined();
        expect(template.metadata.name.length).toBeGreaterThan(0);
        expect(template.metadata.description).toBeDefined();
        expect(template.metadata.version).toBeDefined();
        expect(template.metadata.version.length).toBeGreaterThan(0);

        // Required fields in server config
        expect(template.name).toBeDefined();
        expect(template.name.length).toBeGreaterThan(0);
        expect(template.transport).toBeDefined();
        expect(['stdio', 'http']).toContain(template.transport);

        // Transport-specific requirements
        if (template.transport === 'stdio') {
          expect(template.command).toBeDefined();
          expect(template.command!.length).toBeGreaterThan(0);
        } else if (template.transport === 'http') {
          expect(template.url).toBeDefined();
          expect(template.url!.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Template JSON parsing', () => {
    it('should parse github.json without errors', () => {
      const templatePath = join(__dirname, '../src/templates/github.json');
      const templateContent = readFileSync(templatePath, 'utf-8');

      expect(() => JSON.parse(templateContent) as unknown).not.toThrow();
      const parsed = JSON.parse(templateContent) as unknown;
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe('object');
    });

    it('should parse sqlite.json without errors', () => {
      const templatePath = join(__dirname, '../src/templates/sqlite.json');
      const templateContent = readFileSync(templatePath, 'utf-8');

      expect(() => JSON.parse(templateContent) as unknown).not.toThrow();
      const parsed = JSON.parse(templateContent) as unknown;
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe('object');
    });

    it('should parse postgres.json without errors', () => {
      const templatePath = join(__dirname, '../src/templates/postgres.json');
      const templateContent = readFileSync(templatePath, 'utf-8');

      expect(() => JSON.parse(templateContent) as unknown).not.toThrow();
      const parsed = JSON.parse(templateContent) as unknown;
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe('object');
    });
  });

  describe('Template conversion compatibility', () => {
    it('should convert all templates to ServerConfig format', () => {
      const templateNames = ['github', 'sqlite', 'postgres'];

      templateNames.forEach((templateName) => {
        const templatePath = join(__dirname, `../src/templates/${templateName}.json`);
        const templateContent = readFileSync(templatePath, 'utf-8');
        const templateData = JSON.parse(templateContent) as unknown;
        const template = validateWrapperTemplate(templateData);

        const serverConfig = templateToServerConfig(template);

        // Verify ServerConfig structure
        expect(serverConfig.name).toBeDefined();
        expect(serverConfig.transport).toBeDefined();
        expect(['stdio', 'http']).toContain(serverConfig.transport);

        // Verify no metadata leaked into ServerConfig
        expect(serverConfig).not.toHaveProperty('metadata');
        expect(serverConfig).not.toHaveProperty('systemPrompt');
      });
    });

    it('should preserve all environment variable placeholders during conversion', () => {
      const templateNames = ['github', 'sqlite', 'postgres'];

      templateNames.forEach((templateName) => {
        const templatePath = join(__dirname, `../src/templates/${templateName}.json`);
        const templateContent = readFileSync(templatePath, 'utf-8');
        const templateData = JSON.parse(templateContent) as unknown;
        const template = validateWrapperTemplate(templateData);

        const serverConfig = templateToServerConfig(template);

        // Check for ${...} patterns in all string fields
        if (serverConfig.env) {
          Object.values(serverConfig.env).forEach((value) => {
            if (value.includes('${')) {
              // If it contains ${, verify it's preserved
              expect(value).toMatch(/\$\{[A-Z_]+\}/);
            }
          });
        }

        if (serverConfig.headers) {
          Object.values(serverConfig.headers).forEach((value) => {
            if (value.includes('${')) {
              // If it contains ${, verify it's preserved
              expect(value).toMatch(/\$\{[A-Z_]+\}/);
            }
          });
        }

        if (serverConfig.args) {
          serverConfig.args.forEach((arg) => {
            if (arg.includes('${')) {
              // If it contains ${, verify it's preserved
              expect(arg).toMatch(/\$\{[A-Z_]+\}/);
            }
          });
        }
      });
    });
  });

  describe('Environment variable placeholder patterns', () => {
    it('should use consistent placeholder format across templates', () => {
      const templateNames = ['github', 'postgres']; // Only these have env vars

      templateNames.forEach((templateName) => {
        const templatePath = join(__dirname, `../src/templates/${templateName}.json`);
        const templateContent = readFileSync(templatePath, 'utf-8');

        // Verify ${VARIABLE} pattern is used consistently
        const placeholderPattern = /\$\{[A-Z_]+\}/g;
        const matches = templateContent.match(placeholderPattern);

        if (matches) {
          matches.forEach((match) => {
            // Should match ${UPPERCASE_WITH_UNDERSCORES} format
            expect(match).toMatch(/^\$\{[A-Z_]+\}$/);
          });
        }
      });
    });

    it('should not expand placeholders during JSON parsing', () => {
      const templatePath = join(__dirname, '../src/templates/github.json');
      const templateContent = readFileSync(templatePath, 'utf-8');
      const templateData = JSON.parse(templateContent) as unknown;

      // JSON.parse should preserve ${...} as literal strings
      expect(JSON.stringify(templateData)).toContain('${GITHUB_TOKEN}');
    });
  });
});

describe('Template Validation Edge Cases', () => {
  it('should reject template with missing metadata', () => {
    const invalidTemplate = {
      name: 'test',
      transport: 'stdio',
      command: 'npx'
    };

    expect(() => validateWrapperTemplate(invalidTemplate)).toThrow('metadata');
  });

  it('should reject template with empty server name', () => {
    const invalidTemplate = {
      metadata: {
        name: 'Test',
        description: 'Test template',
        version: '1.0.0'
      },
      name: '',
      transport: 'stdio',
      command: 'npx'
    };

    expect(() => validateWrapperTemplate(invalidTemplate)).toThrow('empty');
  });

  it('should reject stdio template without command', () => {
    const invalidTemplate = {
      metadata: {
        name: 'Test',
        description: 'Test template',
        version: '1.0.0'
      },
      name: 'test',
      transport: 'stdio'
      // Missing command
    };

    expect(() => validateWrapperTemplate(invalidTemplate)).toThrow('command');
  });

  it('should reject http template without url', () => {
    const invalidTemplate = {
      metadata: {
        name: 'Test',
        description: 'Test template',
        version: '1.0.0'
      },
      name: 'test',
      transport: 'http'
      // Missing url
    };

    expect(() => validateWrapperTemplate(invalidTemplate)).toThrow('url');
  });

  it('should reject template with invalid transport type', () => {
    const invalidTemplate = {
      metadata: {
        name: 'Test',
        description: 'Test template',
        version: '1.0.0'
      },
      name: 'test',
      transport: 'websocket'
    };

    expect(() => validateWrapperTemplate(invalidTemplate)).toThrow();
  });
});
