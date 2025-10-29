import * as path from 'path';
import { fileURLToPath } from 'url';
import { InverseDependencyFinder } from '../src/lib/InverseDependencyFinder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('InverseDependencyFinder', () => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'project-for-inverse-deps');

  beforeEach(() => {
    process.chdir(fixturesDir);
  });

  describe('execute', () => {
    it('should find direct importers of a file', async () => {
      const finder = new InverseDependencyFinder({
        targetGlobs: ['src/utils/helpers.ts'],
        projectPath: 'tsconfig.json'
      });

      const result = await finder.execute();

      expect(result).toContain('src/utils/formatter.ts');
      expect(result).toContain('src/components/Button.ts');
    });

    it('should find importers of formatter module', async () => {
      const finder = new InverseDependencyFinder({
        targetGlobs: ['src/utils/formatter.ts'],
        projectPath: 'tsconfig.json'
      });

      const result = await finder.execute();

      expect(result).toContain('src/index.ts');
      expect(result).toContain('test/example.test.ts');
    });

    it('should find importers of base component', async () => {
      const finder = new InverseDependencyFinder({
        targetGlobs: ['src/components/ComponentBase.ts'],
        projectPath: 'tsconfig.json'
      });

      const result = await finder.execute();

      expect(result).toContain('src/components/Button.ts');
    });

    it('should find importers of logger', async () => {
      const finder = new InverseDependencyFinder({
        targetGlobs: ['src/lib/logger.ts'],
        projectPath: 'tsconfig.json'
      });

      const result = await finder.execute();

      expect(result).toContain('src/index.ts');
    });

    it('should handle multiple target files', async () => {
      const finder = new InverseDependencyFinder({
        targetGlobs: ['src/utils/helpers.ts', 'src/utils/formatter.ts'],
        projectPath: 'tsconfig.json'
      });

      const result = await finder.execute();

      // Should find all importers of both files
      expect(result).toContain('src/index.ts'); // imports formatter
      expect(result).toContain('src/components/Button.ts'); // imports helpers
      expect(result).toContain('test/example.test.ts'); // imports formatter

      // Note: src/utils/formatter.ts is not in results because it's one of the target files
      // The tool returns files that import FROM the targets, not the targets themselves

      // Should deduplicate results
      const uniqueResults = [...new Set(result)];
      expect(result.length).toBe(uniqueResults.length);
    });

    it('should return empty array for non-matching globs', async () => {
      const finder = new InverseDependencyFinder({
        targetGlobs: ['src/nonexistent.ts'],
        projectPath: 'tsconfig.json'
      });

      const result = await finder.execute();
      expect(result).toEqual([]);
    });

    it('should return empty array when no target files match', async () => {
      const finder = new InverseDependencyFinder({
        targetGlobs: ['src/**/*.xyz'], // No files match this pattern
        projectPath: 'tsconfig.json'
      });

      const result = await finder.execute();
      expect(result).toEqual([]);
    });
  });
});
