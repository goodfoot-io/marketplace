import * as path from 'path';
import { fileURLToPath } from 'url';
import { DependencyFinder } from '../src/lib/DependencyFinder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DependencyFinder', () => {
  const testProjectDir = path.join(__dirname, 'fixtures', 'project-for-inverse-deps');
  const originalCwd = process.cwd();

  beforeEach(() => {
    process.chdir(testProjectDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  test('finds dependencies of a file', async () => {
    const finder = new DependencyFinder({ targetGlobs: ['src/index.ts'] });
    const dependencies = await finder.execute();

    // Should include the file itself and its dependencies
    expect(dependencies).toContain('src/index.ts');
    expect(dependencies).toContain('src/components/Button.ts');
    expect(dependencies).toContain('src/lib/logger.ts');
    expect(dependencies).toContain('src/utils/formatter.ts');
  });

  test('handles multiple input files', async () => {
    const finder = new DependencyFinder({
      targetGlobs: ['src/index.ts', 'src/utils/formatter.ts']
    });
    const dependencies = await finder.execute();

    // Should include all files and their combined dependencies
    expect(dependencies).toContain('src/index.ts');
    expect(dependencies).toContain('src/utils/formatter.ts');
    expect(dependencies).toContain('src/utils/helpers.ts');
  });

  test('handles glob patterns', async () => {
    const finder = new DependencyFinder({ targetGlobs: ['src/**/*.ts'] });
    const dependencies = await finder.execute();

    // Should find all TypeScript files
    expect(dependencies.length).toBeGreaterThan(5);
    expect(dependencies).toContain('src/index.ts');
    expect(dependencies).toContain('src/components/Button.ts');
  });

  test('handles non-existent files gracefully', async () => {
    // Mock console.warn to capture the warning
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (msg: string) => {
      warnMessage = msg;
    };

    try {
      const finder = new DependencyFinder({ targetGlobs: ['nonexistent.ts'] });
      const dependencies = await finder.execute();

      expect(dependencies).toEqual([]);
      expect(warnMessage).toContain('Warning: No files found matching the input glob patterns.');
    } finally {
      console.warn = originalWarn;
    }
  });
});
