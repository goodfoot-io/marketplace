/**
 * Behavioral tests for pre-packaged template loading
 * Tests loading templates from src/templates/ directory
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateWrapperTemplate, templateToServerConfig } from '../src/types/wrapper.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
