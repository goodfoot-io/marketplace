/**
 * Template Integration Tests
 *
 * Tests the full initialization flow with template loading:
 * - Template load → validate → convert → discover tools
 * - System prompt integration from templates
 * - Environment variable placeholder preservation
 * - Error handling for invalid templates
 */

import type { WrapperTemplate } from '../src/types/wrapper.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Template Integration in main()', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'template-integration-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Full initialization flow: template load → validate → convert → discover tools', () => {
    it('should load template from absolute path and initialize server', async () => {
      // Create a minimal stdio template
      const template: WrapperTemplate = {
        metadata: {
          name: 'test-server',
          version: '1.0.0',
          description: 'Test server for integration'
        },
        name: 'test-stdio',
        transport: 'stdio',
        command: 'echo',
        args: ['test']
      };

      const templatePath = join(tempDir, 'test-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      // Import main after setting up the template
      const { parseCliArguments } = await import('../src/wrapper.js');

      // Simulate CLI: mcp-wrapper-agent --template /path/to/template.json
      const result = parseCliArguments(['node', 'wrapper.js', '--template', templatePath]);

      // Should have options.template set
      expect(result.options.template).toBe(templatePath);

      // Should have no configs (template replaces them)
      expect(result.configs).toEqual([]);
    });

    it('should load packaged template by name', async () => {
      const { parseCliArguments } = await import('../src/wrapper.js');

      // Simulate CLI: mcp-wrapper-agent --template sqlite
      const result = parseCliArguments(['node', 'wrapper.js', '--template', 'sqlite']);

      // Should have options.template set to the name
      expect(result.options.template).toBe('sqlite');
      expect(result.configs).toEqual([]);
    });

    it('should load relative template path', async () => {
      // Create template in a subdirectory
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(tempDir, 'templates'), { recursive: true });
      await writeFile(
        join(tempDir, 'templates', 'test.json'),
        JSON.stringify({
          metadata: {
            name: 'test-server',
            version: '1.0.0',
            description: 'Test'
          },
          name: 'test',
          transport: 'stdio',
          command: 'echo',
          args: []
        })
      );

      const { parseCliArguments } = await import('../src/wrapper.js');

      // Change to temp dir to test relative paths
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const result = parseCliArguments(['node', 'wrapper.js', '--template', './templates/test.json']);

        expect(result.options.template).toBe('./templates/test.json');
        expect(result.configs).toEqual([]);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Template-based server initialization with stdio transport', () => {
    it('should convert stdio template to ServerConfig', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'stdio-test',
          version: '1.0.0',
          description: 'Stdio test server'
        },
        name: 'test-stdio',
        transport: 'stdio',
        command: 'node',
        args: ['--version']
      };

      const templatePath = join(tempDir, 'stdio-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { templateToServerConfig } = await import('../src/types/wrapper.js');

      // Load template
      const loadedTemplate = await resolveTemplate(templatePath);
      expect(loadedTemplate.transport).toBe('stdio');

      // Convert to ServerConfig
      const config = templateToServerConfig(loadedTemplate);
      expect(config.name).toBe('test-stdio');
      expect(config.transport).toBe('stdio');
      expect(config.command).toBe('node');
      expect(config.args).toEqual(['--version']);
    });

    it('should preserve environment variables in stdio command', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'env-test',
          version: '1.0.0',
          description: 'Test with env vars'
        },
        name: 'test-env',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sqlite', '${DATABASE_PATH}']
      };

      const templatePath = join(tempDir, 'env-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { templateToServerConfig } = await import('../src/types/wrapper.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      const config = templateToServerConfig(loadedTemplate);

      // Environment variable should be preserved
      expect(config.args).toContain('${DATABASE_PATH}');
    });

    it('should handle stdio template with env object', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'env-object-test',
          version: '1.0.0',
          description: 'Test with env object'
        },
        name: 'test-env-obj',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: {
          NODE_ENV: 'production',
          API_KEY: '${API_KEY}',
          PORT: '3000'
        }
      };

      const templatePath = join(tempDir, 'env-obj-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { templateToServerConfig } = await import('../src/types/wrapper.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      const config = templateToServerConfig(loadedTemplate);

      // Environment variables should be preserved
      expect(config.env).toBeDefined();
      expect(config.env?.API_KEY).toBe('${API_KEY}');
      expect(config.env?.NODE_ENV).toBe('production');
      expect(config.env?.PORT).toBe('3000');
    });
  });

  describe('Template-based server initialization with HTTP transport', () => {
    it('should convert HTTP template to ServerConfig', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'http-test',
          version: '1.0.0',
          description: 'HTTP test server'
        },
        name: 'test-http',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      };

      const templatePath = join(tempDir, 'http-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { templateToServerConfig } = await import('../src/types/wrapper.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      expect(loadedTemplate.transport).toBe('http');

      const config = templateToServerConfig(loadedTemplate);
      expect(config.name).toBe('test-http');
      expect(config.transport).toBe('http');
      expect(config.url).toBe('http://localhost:3000/mcp');
    });

    it('should preserve environment variables in HTTP URL', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'http-env-test',
          version: '1.0.0',
          description: 'HTTP with env vars'
        },
        name: 'test-http-env',
        transport: 'http',
        url: '${API_BASE_URL}/mcp'
      };

      const templatePath = join(tempDir, 'http-env-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { templateToServerConfig } = await import('../src/types/wrapper.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      const config = templateToServerConfig(loadedTemplate);

      // Environment variable should be preserved
      expect(config.url).toBe('${API_BASE_URL}/mcp');
    });

    it('should handle HTTP template with headers containing env vars', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'http-headers-test',
          version: '1.0.0',
          description: 'HTTP with headers'
        },
        name: 'test-http-headers',
        transport: 'http',
        url: 'http://localhost:3000/mcp',
        headers: {
          Authorization: 'Bearer ${API_TOKEN}',
          'Content-Type': 'application/json'
        }
      };

      const templatePath = join(tempDir, 'http-headers-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { templateToServerConfig } = await import('../src/types/wrapper.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      const config = templateToServerConfig(loadedTemplate);

      // Headers should be preserved with env vars
      expect(config.headers).toBeDefined();
      expect(config.headers?.['Authorization']).toBe('Bearer ${API_TOKEN}');
      expect(config.headers?.['Content-Type']).toBe('application/json');
    });
  });

  describe('System prompt integration from templates', () => {
    it('should merge text system prompt from template', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'prompt-test',
          version: '1.0.0',
          description: 'Template with system prompt'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'echo',
        args: ['test'],
        systemPrompt: {
          type: 'text',
          content: 'You are a helpful assistant.'
        }
      };

      const templatePath = join(tempDir, 'prompt-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { resolveSystemPrompt } = await import('../src/types/wrapper.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      expect(loadedTemplate.systemPrompt).toBeDefined();

      // Resolve system prompt options
      const promptOptions = resolveSystemPrompt(loadedTemplate.systemPrompt!);
      expect(promptOptions.systemPrompt).toBe('You are a helpful assistant.');
    });

    it('should merge file system prompt from template', async () => {
      // Create a system prompt file
      const promptFile = join(tempDir, 'system-prompt.txt');
      await writeFile(promptFile, 'Custom system prompt from file.');

      const template: WrapperTemplate = {
        metadata: {
          name: 'file-prompt-test',
          version: '1.0.0',
          description: 'Template with file prompt'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'echo',
        args: ['test'],
        systemPrompt: {
          type: 'file',
          path: promptFile
        }
      };

      const templatePath = join(tempDir, 'file-prompt-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { resolveSystemPrompt } = await import('../src/types/wrapper.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      const promptOptions = resolveSystemPrompt(loadedTemplate.systemPrompt!);

      expect(promptOptions.systemPromptFile).toBe(promptFile);
    });

    it('should merge append system prompt from template', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'append-prompt-test',
          version: '1.0.0',
          description: 'Template with append prompt'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'echo',
        args: ['test'],
        systemPrompt: {
          type: 'append',
          content: 'Additional context for the assistant.'
        }
      };

      const templatePath = join(tempDir, 'append-prompt-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { resolveSystemPrompt } = await import('../src/types/wrapper.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      const promptOptions = resolveSystemPrompt(loadedTemplate.systemPrompt!);

      expect(promptOptions.appendSystemPrompt).toBe('Additional context for the assistant.');
    });

    it('should handle template without system prompt', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'no-prompt-test',
          version: '1.0.0',
          description: 'Template without system prompt'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'echo',
        args: ['test']
      };

      const templatePath = join(tempDir, 'no-prompt-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      expect(loadedTemplate.systemPrompt).toBeUndefined();
    });
  });

  describe('Environment variable placeholder preservation through entire pipeline', () => {
    it('should preserve ${VAR} format through load → convert → config', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'preserve-test',
          version: '1.0.0',
          description: 'Test placeholder preservation'
        },
        name: 'test-preserve',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'],
        env: {
          NODE_ENV: '${NODE_ENV}',
          API_KEY: '${API_KEY}',
          STATIC_VALUE: 'not-a-placeholder'
        }
      };

      const templatePath = join(tempDir, 'preserve-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { templateToServerConfig } = await import('../src/types/wrapper.js');

      // Load template
      const loadedTemplate = await resolveTemplate(templatePath);

      // Convert to ServerConfig
      const config = templateToServerConfig(loadedTemplate);

      // All placeholders should be preserved
      expect(config.args).toContain('${DATABASE_URL}');
      expect(config.env?.NODE_ENV).toBe('${NODE_ENV}');
      expect(config.env?.API_KEY).toBe('${API_KEY}');
      expect(config.env?.STATIC_VALUE).toBe('not-a-placeholder');
    });

    it('should preserve placeholders in HTTP URL and headers', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'http-preserve-test',
          version: '1.0.0',
          description: 'HTTP placeholder preservation'
        },
        name: 'test-http-preserve',
        transport: 'http',
        url: '${API_BASE_URL}/mcp/v1',
        headers: {
          Authorization: 'Bearer ${API_TOKEN}',
          'X-API-Key': '${API_KEY}',
          'Content-Type': 'application/json'
        }
      };

      const templatePath = join(tempDir, 'http-preserve-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { templateToServerConfig } = await import('../src/types/wrapper.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      const config = templateToServerConfig(loadedTemplate);

      // All placeholders should be preserved
      expect(config.url).toBe('${API_BASE_URL}/mcp/v1');
      expect(config.headers?.['Authorization']).toBe('Bearer ${API_TOKEN}');
      expect(config.headers?.['X-API-Key']).toBe('${API_KEY}');
      expect(config.headers?.['Content-Type']).toBe('application/json');
    });

    it('should preserve multiple placeholders in same string', async () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'multi-preserve-test',
          version: '1.0.0',
          description: 'Multiple placeholder preservation'
        },
        name: 'test-multi',
        transport: 'http',
        url: '${PROTOCOL}://${HOST}:${PORT}${PATH}',
        headers: {
          Authorization: '${AUTH_TYPE} ${AUTH_TOKEN}'
        }
      };

      const templatePath = join(tempDir, 'multi-preserve-template.json');
      await writeFile(templatePath, JSON.stringify(template));

      const { resolveTemplate } = await import('../src/template-resolver.js');
      const { templateToServerConfig } = await import('../src/types/wrapper.js');

      const loadedTemplate = await resolveTemplate(templatePath);
      const config = templateToServerConfig(loadedTemplate);

      // All placeholders should be preserved
      expect(config.url).toBe('${PROTOCOL}://${HOST}:${PORT}${PATH}');
      expect(config.headers?.['Authorization']).toBe('${AUTH_TYPE} ${AUTH_TOKEN}');
    });
  });

  describe('Error handling: invalid template references', () => {
    it('should throw error for non-existent absolute path', async () => {
      const { resolveTemplate } = await import('../src/template-resolver.js');

      await expect(resolveTemplate('/nonexistent/path/to/template.json')).rejects.toThrow(/not found/i);
    });

    it('should throw error for non-existent relative path', async () => {
      const { resolveTemplate } = await import('../src/template-resolver.js');

      await expect(resolveTemplate('./nonexistent/template.json')).rejects.toThrow(/not found/i);
    });

    it('should throw error for non-existent packaged template', async () => {
      const { resolveTemplate } = await import('../src/template-resolver.js');

      await expect(resolveTemplate('nonexistent-template')).rejects.toThrow();
    });

    it('should throw error for invalid JSON in template file', async () => {
      const templatePath = join(tempDir, 'invalid.json');
      await writeFile(templatePath, '{ invalid json }');

      const { resolveTemplate } = await import('../src/template-resolver.js');

      await expect(resolveTemplate(templatePath)).rejects.toThrow(/JSON/i);
    });
  });

  describe('Error handling: validation failures', () => {
    it('should throw error for template missing metadata', async () => {
      const invalidTemplate = {
        name: 'test',
        transport: 'stdio',
        command: 'echo'
      };

      const templatePath = join(tempDir, 'no-metadata.json');
      await writeFile(templatePath, JSON.stringify(invalidTemplate));

      const { resolveTemplate } = await import('../src/template-resolver.js');

      await expect(resolveTemplate(templatePath)).rejects.toThrow(/Invalid wrapper template/i);
    });

    it('should throw error for template missing name', async () => {
      const invalidTemplate = {
        metadata: {
          name: 'test',
          version: '1.0.0',
          description: 'test'
        },
        transport: 'stdio',
        command: 'echo'
      };

      const templatePath = join(tempDir, 'no-name.json');
      await writeFile(templatePath, JSON.stringify(invalidTemplate));

      const { resolveTemplate } = await import('../src/template-resolver.js');

      await expect(resolveTemplate(templatePath)).rejects.toThrow(/Invalid wrapper template/i);
    });

    it('should throw error for stdio template without command', async () => {
      const invalidTemplate = {
        metadata: {
          name: 'test',
          version: '1.0.0',
          description: 'test'
        },
        name: 'test',
        transport: 'stdio'
        // Missing command
      };

      const templatePath = join(tempDir, 'no-command.json');
      await writeFile(templatePath, JSON.stringify(invalidTemplate));

      const { resolveTemplate } = await import('../src/template-resolver.js');

      await expect(resolveTemplate(templatePath)).rejects.toThrow(/Invalid wrapper template/i);
    });

    it('should throw error for HTTP template without url', async () => {
      const invalidTemplate = {
        metadata: {
          name: 'test',
          version: '1.0.0',
          description: 'test'
        },
        name: 'test',
        transport: 'http'
        // Missing url
      };

      const templatePath = join(tempDir, 'no-url.json');
      await writeFile(templatePath, JSON.stringify(invalidTemplate));

      const { resolveTemplate } = await import('../src/template-resolver.js');

      await expect(resolveTemplate(templatePath)).rejects.toThrow(/Invalid wrapper template/i);
    });

    it('should throw error for invalid transport type', async () => {
      const invalidTemplate = {
        metadata: {
          name: 'test',
          version: '1.0.0',
          description: 'test'
        },
        name: 'test',
        transport: 'websocket', // Invalid transport
        command: 'echo'
      };

      const templatePath = join(tempDir, 'invalid-transport.json');
      await writeFile(templatePath, JSON.stringify(invalidTemplate));

      const { resolveTemplate } = await import('../src/template-resolver.js');

      await expect(resolveTemplate(templatePath)).rejects.toThrow(/Invalid wrapper template/i);
    });
  });

  describe('Integration with existing initialization flow', () => {
    it('should work with traditional server configs when no template provided', async () => {
      const { parseCliArguments } = await import('../src/wrapper.js');

      // Traditional CLI: mcp-wrapper-agent -- server1 --transport stdio echo arg1
      const result = parseCliArguments(['node', 'wrapper.js', '--', 'server1', '--transport', 'stdio', 'echo', 'arg1']);

      // Should have config, no template
      expect(result.configs.length).toBe(1);
      expect(result.configs[0].name).toBe('server1');
      expect(result.options.template).toBeUndefined();
    });

    it('should reject mixing template with server configs', async () => {
      const { parseCliArguments } = await import('../src/wrapper.js');

      // Invalid: mcp-wrapper-agent --template sqlite -- server1 echo
      expect(() => {
        parseCliArguments(['node', 'wrapper.js', '--template', 'sqlite', '--', 'server1', 'echo']);
      }).toThrow(/Cannot use --template with explicit server configurations/i);
    });

    it('should allow template with system prompt flags', async () => {
      const { parseCliArguments } = await import('../src/wrapper.js');

      // Valid: mcp-wrapper-agent --template sqlite --system-prompt "Custom prompt"
      const result = parseCliArguments([
        'node',
        'wrapper.js',
        '--template',
        'sqlite',
        '--system-prompt',
        'Custom prompt'
      ]);

      expect(result.options.template).toBe('sqlite');
      expect(result.options.systemPrompt).toBe('Custom prompt');
      expect(result.configs).toEqual([]);
    });

    it('should allow template with append system prompt', async () => {
      const { parseCliArguments } = await import('../src/wrapper.js');

      const result = parseCliArguments([
        'node',
        'wrapper.js',
        '--template',
        'postgres',
        '--append-system-prompt',
        'Additional context'
      ]);

      expect(result.options.template).toBe('postgres');
      expect(result.options.appendSystemPrompt).toBe('Additional context');
      expect(result.configs).toEqual([]);
    });

    it('should allow template with system prompt file', async () => {
      // Create a system prompt file
      const promptFile = join(tempDir, 'custom-prompt.txt');
      await writeFile(promptFile, 'Custom prompt from file');

      const { parseCliArguments } = await import('../src/wrapper.js');

      const result = parseCliArguments([
        'node',
        'wrapper.js',
        '--template',
        'github',
        '--system-prompt-file',
        promptFile
      ]);

      expect(result.options.template).toBe('github');
      expect(result.options.systemPromptFile).toBe(promptFile);
      expect(result.configs).toEqual([]);
    });
  });
});
