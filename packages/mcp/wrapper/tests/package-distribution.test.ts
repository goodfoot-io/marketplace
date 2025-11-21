import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWrapperTemplate, type WrapperTemplate } from '../src/types/wrapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');

// Helper to safely parse JSON with proper typing
function parseJSON(content: string): unknown {
  return JSON.parse(content) as unknown;
}

// Helper to parse and validate template
function parseTemplate(content: string): WrapperTemplate {
  const parsed = parseJSON(content);
  return validateWrapperTemplate(parsed);
}

interface PackageJson {
  files?: string[];
  scripts?: {
    build?: string;
  };
}

describe('Package Distribution', () => {
  describe('Build output verification', () => {
    const buildDir = join(packageRoot, 'build', 'dist', 'src', 'templates');
    const expectedTemplates = ['github.json', 'sqlite.json', 'postgres.json'];

    beforeAll(() => {
      // Ensure build exists by running build command
      try {
        execSync('yarn build', {
          cwd: packageRoot,
          stdio: 'pipe',
          encoding: 'utf-8'
        });
      } catch (error) {
        // If build fails, the tests will fail appropriately
        console.error('Build failed:', error);
      }
    });

    it('should have templates directory in build output', () => {
      expect(existsSync(buildDir)).toBe(true);
    });

    it.each(expectedTemplates)('should include %s in build output', (templateName) => {
      const templatePath = join(buildDir, templateName);
      expect(existsSync(templatePath)).toBe(true);
    });

    it.each(expectedTemplates)('should have valid JSON in %s', (templateName) => {
      const templatePath = join(buildDir, templateName);
      const content = readFileSync(templatePath, 'utf-8');

      expect(() => {
        parseJSON(content);
      }).not.toThrow();
    });

    it.each(expectedTemplates)('should have valid template schema in %s', (templateName) => {
      const templatePath = join(buildDir, templateName);
      const content = readFileSync(templatePath, 'utf-8');

      expect(() => {
        parseTemplate(content);
      }).not.toThrow();
    });

    it('should validate github.json has required fields', () => {
      const templatePath = join(buildDir, 'github.json');
      const content = readFileSync(templatePath, 'utf-8');
      const template = parseTemplate(content);

      expect(template.metadata).toBeDefined();
      expect(template.metadata.name).toBe('GitHub MCP');
      expect(template.transport).toBe('http');
      expect(template.url).toBe('https://api.github.com');
      expect(template.headers).toBeDefined();
      expect(template.headers?.['Authorization']).toContain('${GITHUB_TOKEN}');
    });

    it('should validate sqlite.json has required fields', () => {
      const templatePath = join(buildDir, 'sqlite.json');
      const content = readFileSync(templatePath, 'utf-8');
      const template = parseTemplate(content);

      expect(template.metadata).toBeDefined();
      expect(template.metadata.name).toBe('SQLite MCP');
      expect(template.transport).toBe('stdio');
      expect(template.command).toBeDefined();
    });

    it('should validate postgres.json has required fields', () => {
      const templatePath = join(buildDir, 'postgres.json');
      const content = readFileSync(templatePath, 'utf-8');
      const template = parseTemplate(content);

      expect(template.metadata).toBeDefined();
      expect(template.metadata.name).toBe('PostgreSQL MCP');
      expect(template.transport).toBe('stdio');
      expect(template.command).toBeDefined();
    });

    it('should preserve environment variable placeholders in templates', () => {
      // Check github.json preserves ${GITHUB_TOKEN}
      const githubPath = join(buildDir, 'github.json');
      const githubContent = readFileSync(githubPath, 'utf-8');
      expect(githubContent).toContain('${GITHUB_TOKEN}');

      // Check postgres.json preserves ${DATABASE_URL}
      const postgresPath = join(buildDir, 'postgres.json');
      const postgresContent = readFileSync(postgresPath, 'utf-8');
      expect(postgresContent).toContain('${DATABASE_URL}');
    });
  });

  describe('package.json files array', () => {
    it('should include "build" in files array', () => {
      const packageJsonPath = join(packageRoot, 'package.json');
      const content = readFileSync(packageJsonPath, 'utf-8');
      const packageJson = parseJSON(content) as PackageJson;

      expect(packageJson.files).toBeDefined();
      expect(packageJson.files).toContain('build');
    });

    it('should have build script that copies templates', () => {
      const packageJsonPath = join(packageRoot, 'package.json');
      const content = readFileSync(packageJsonPath, 'utf-8');
      const packageJson = parseJSON(content) as PackageJson;

      expect(packageJson.scripts?.build).toBeDefined();
      expect(packageJson.scripts?.build).toContain('cp src/templates/*.json build/dist/src/templates/');
    });

    it('should verify templates are in the "build" directory which is included in files array', () => {
      const packageJsonPath = join(packageRoot, 'package.json');
      const content = readFileSync(packageJsonPath, 'utf-8');
      const packageJson = parseJSON(content) as PackageJson;
      const templatePath = 'build/dist/src/templates/github.json';

      // Verify "build" is in files array
      expect(packageJson.files).toContain('build');

      // Verify template exists within the "build" directory
      const fullTemplatePath = join(packageRoot, templatePath);
      expect(existsSync(fullTemplatePath)).toBe(true);
    });
  });

  describe('Template loadability from build output', () => {
    it('should be able to load all templates from build output', () => {
      const buildDir = join(packageRoot, 'build', 'dist', 'src', 'templates');
      const expectedTemplates = ['github.json', 'sqlite.json', 'postgres.json'];

      for (const templateName of expectedTemplates) {
        const templatePath = join(buildDir, templateName);
        const content = readFileSync(templatePath, 'utf-8');
        const template = parseTemplate(content);

        // Verify metadata exists
        expect(template.metadata).toBeDefined();
        expect(template.metadata.name).toBeTruthy();

        // Verify server configuration exists
        expect(template.transport).toBeDefined();
        expect(template.transport).toMatch(/^(stdio|http)$/);
      }
    });
  });

  describe('npm pack simulation', () => {
    it('should verify that npm would include templates in published package', () => {
      const packageJsonPath = join(packageRoot, 'package.json');
      const content = readFileSync(packageJsonPath, 'utf-8');
      const packageJson = parseJSON(content) as PackageJson;

      // Verify files array includes "build"
      expect(packageJson.files).toContain('build');

      // Verify templates exist in build directory
      const templatePaths = [
        'build/dist/src/templates/github.json',
        'build/dist/src/templates/sqlite.json',
        'build/dist/src/templates/postgres.json'
      ];

      for (const templatePath of templatePaths) {
        const fullPath = join(packageRoot, templatePath);
        expect(existsSync(fullPath)).toBe(true);
      }

      // When npm pack/publish runs, it will include everything in the "build" directory
      // which includes build/dist/src/templates/*.json
    });
  });
});
