import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DependencyFinder } from '../src/lib/DependencyFinder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DependencyFinder', () => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'dependency-test-project');

  beforeEach(async () => {
    // Create a test project with dependencies
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.mkdir(path.join(fixturesDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(fixturesDir, 'lib'), { recursive: true });

    // Create main entry file
    await fs.writeFile(
      path.join(fixturesDir, 'src', 'index.ts'),
      `import { helper } from './helper.js';
import { utility } from '../lib/utility.js';

export function main() {
  helper();
  utility();
}`
    );

    // Create helper file
    await fs.writeFile(
      path.join(fixturesDir, 'src', 'helper.ts'),
      `import { shared } from '../lib/shared.js';

export function helper() {
  shared();
}`
    );

    // Create utility file
    await fs.writeFile(
      path.join(fixturesDir, 'lib', 'utility.ts'),
      `import { shared } from './shared.js';

export function utility() {
  shared();
}`
    );

    // Create shared file
    await fs.writeFile(
      path.join(fixturesDir, 'lib', 'shared.ts'),
      `export function shared() {
  console.log('shared');
}`
    );

    // Create .gitignore
    await fs.writeFile(
      path.join(fixturesDir, '.gitignore'),
      `node_modules/
*.log
.DS_Store`
    );

    // Create tsconfig.json for proper module resolution
    await fs.writeFile(
      path.join(fixturesDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            module: 'ESNext',
            moduleResolution: 'node',
            target: 'ES2022',
            baseUrl: '.'
          },
          include: ['src/**/*', 'lib/**/*']
        },
        null,
        2
      )
    );

    process.chdir(fixturesDir);
  });

  afterEach(async () => {
    process.chdir(__dirname);
    await fs.rm(fixturesDir, { recursive: true, force: true });
  });

  describe('execute', () => {
    it('should find dependencies of a single file', async () => {
      const finder = new DependencyFinder({
        targetGlobs: ['src/index.ts']
      });

      const result = await finder.execute();

      expect(result).toContain('src/index.ts');
      expect(result).toContain('src/helper.ts');
      expect(result).toContain('lib/utility.ts');
      expect(result).toContain('lib/shared.ts');
    });

    it('should find dependencies using glob patterns', async () => {
      const finder = new DependencyFinder({
        targetGlobs: ['src/*.ts']
      });

      const result = await finder.execute();

      expect(result).toContain('src/index.ts');
      expect(result).toContain('src/helper.ts');
      expect(result).toContain('lib/shared.ts');
    });

    it('should handle multiple glob patterns', async () => {
      const finder = new DependencyFinder({
        targetGlobs: ['src/index.ts', 'lib/utility.ts']
      });

      const result = await finder.execute();

      expect(result).toContain('src/index.ts');
      expect(result).toContain('src/helper.ts');
      expect(result).toContain('lib/utility.ts');
      expect(result).toContain('lib/shared.ts');
    });

    it('should return empty array for non-matching globs', async () => {
      const finder = new DependencyFinder({
        targetGlobs: ['nonexistent/*.ts']
      });

      const result = await finder.execute();
      expect(result).toEqual([]);
    });

    it('should respect gitignore patterns', async () => {
      // Create a file that should be ignored
      await fs.writeFile(path.join(fixturesDir, 'test.log'), 'log content');

      const finder = new DependencyFinder({
        targetGlobs: ['*.log']
      });

      const result = await finder.execute();
      expect(result).toEqual([]);
    });

    it('should handle files with no dependencies', async () => {
      await fs.writeFile(path.join(fixturesDir, 'standalone.ts'), 'export const value = 42;');

      const finder = new DependencyFinder({
        targetGlobs: ['standalone.ts']
      });

      const result = await finder.execute();
      expect(result).toEqual(['standalone.ts']);
    });

    it('should deduplicate dependencies', async () => {
      // Both index.ts and helper.ts depend on shared.ts
      const finder = new DependencyFinder({
        targetGlobs: ['src/index.ts', 'src/helper.ts']
      });

      const result = await finder.execute();

      // shared.ts should appear only once
      const sharedCount = result.filter((dep) => dep === 'lib/shared.ts').length;
      expect(sharedCount).toBe(1);
    });
  });
});
