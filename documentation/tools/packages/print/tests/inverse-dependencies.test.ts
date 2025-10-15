import * as path from 'path';
import { fileURLToPath } from 'url';
import { InverseDependencyFinder } from '../src/lib/InverseDependencyFinder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('InverseDependencyFinder', () => {
  const testProjectDir = path.join(__dirname, 'fixtures', 'project-for-inverse-deps');
  const originalCwd = process.cwd();

  beforeEach(() => {
    process.chdir(testProjectDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  test('finds direct importers of a file', async () => {
    const finder = new InverseDependencyFinder({
      targetGlobs: ['src/utils/helpers.ts'],
      projectPath: 'tsconfig.json'
    });
    const importers = await finder.execute();

    expect(importers).toContain('src/utils/formatter.ts');
    expect(importers).toContain('src/components/Button.ts');
  });

  test('finds importers of formatter module', async () => {
    const finder = new InverseDependencyFinder({
      targetGlobs: ['src/utils/formatter.ts'],
      projectPath: 'tsconfig.json'
    });
    const importers = await finder.execute();

    expect(importers).toContain('src/index.ts');
    expect(importers).toContain('test/example.test.ts');
  });

  test('finds importers of base component', async () => {
    const finder = new InverseDependencyFinder({
      targetGlobs: ['src/components/ComponentBase.ts'],
      projectPath: 'tsconfig.json'
    });
    const importers = await finder.execute();

    expect(importers).toContain('src/components/Button.ts');
  });

  test('finds importers of logger', async () => {
    const finder = new InverseDependencyFinder({
      targetGlobs: ['src/lib/logger.ts'],
      projectPath: 'tsconfig.json'
    });
    const importers = await finder.execute();

    expect(importers).toContain('src/index.ts');
  });

  test('handles multiple target files', async () => {
    const finder = new InverseDependencyFinder({
      targetGlobs: ['src/utils/helpers.ts', 'src/utils/formatter.ts'],
      projectPath: 'tsconfig.json'
    });
    const importers = await finder.execute();

    // Should find all importers of both files
    expect(importers).toContain('src/index.ts'); // imports formatter
    expect(importers).toContain('src/components/Button.ts'); // imports helpers
    expect(importers).toContain('test/example.test.ts'); // imports formatter

    // Note: src/utils/formatter.ts imports helpers.ts, but it won't be in the results
    // because InverseDependencyFinder excludes files that are in the target list

    // Should deduplicate results
    const uniqueImporters = [...new Set(importers)];
    expect(importers.length).toBe(uniqueImporters.length);
  });

  test('handles non-existent files gracefully', async () => {
    // Mock console.warn to capture the warning
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (msg: string) => {
      warnMessage = msg;
    };

    try {
      const finder = new InverseDependencyFinder({
        targetGlobs: ['src/nonexistent.ts'],
        projectPath: 'tsconfig.json'
      });
      const importers = await finder.execute();

      expect(importers).toEqual([]);
      expect(warnMessage).toContain('Warning: No files found matching the input glob patterns.');
    } finally {
      console.warn = originalWarn;
    }
  });
});
