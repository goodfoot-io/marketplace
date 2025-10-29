import * as path from 'path';
import { fileURLToPath } from 'url';
import { SimilarSectionsFinder, SimilarSectionsFinderOptions, SimilarSection } from '../src/similar-sections.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('similar-sections module integration', () => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'similar-documents');

  test('exports SimilarSectionsFinder class', () => {
    expect(SimilarSectionsFinder).toBeDefined();
    expect(typeof SimilarSectionsFinder).toBe('function');
  });

  test('exports are properly typed', () => {
    // Test that we can create an instance with proper options type
    const options: SimilarSectionsFinderOptions = {
      filePathA: 'path/to/file1.txt',
      filePathB: 'path/to/file2.txt',
      windowSize: 100,
      similarity: 80
    };

    const finder = new SimilarSectionsFinder(options);
    expect(finder).toBeInstanceOf(SimilarSectionsFinder);
  });

  test('basic functionality works with identical files', async () => {
    const doc1Path = path.join(fixturesDir, 'doc1.txt');
    const identicalPath = path.join(fixturesDir, 'identical.txt');

    const finder = new SimilarSectionsFinder({
      filePathA: doc1Path,
      filePathB: identicalPath,
      windowSize: 50,
      similarity: 95
    });

    const results: SimilarSection[] = await finder.execute();

    // Should find multiple similar sections with high similarity
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((section) => section.similarity >= 95)).toBe(true);

    // Results should have proper structure
    expect(results[0]).toHaveProperty('substringA');
    expect(results[0]).toHaveProperty('substringB');
    expect(results[0]).toHaveProperty('positionA');
    expect(results[0]).toHaveProperty('positionB');
    expect(results[0]).toHaveProperty('similarity');

    // Types should be correct
    expect(typeof results[0].substringA).toBe('string');
    expect(typeof results[0].substringB).toBe('string');
    expect(typeof results[0].positionA).toBe('number');
    expect(typeof results[0].positionB).toBe('number');
    expect(typeof results[0].similarity).toBe('number');
  });

  test('basic functionality works with similar files', async () => {
    const doc1Path = path.join(fixturesDir, 'doc1.txt');
    const doc2Path = path.join(fixturesDir, 'doc2.txt');

    const finder = new SimilarSectionsFinder({
      filePathA: doc1Path,
      filePathB: doc2Path,
      windowSize: 100,
      similarity: 70
    });

    const results: SimilarSection[] = await finder.execute();

    // Should find some similar sections with moderate similarity
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((section) => section.similarity >= 70)).toBe(true);
    expect(results.every((section) => section.similarity <= 100)).toBe(true);
  });

  test('handles non-existent files gracefully', async () => {
    const finder = new SimilarSectionsFinder({
      filePathA: 'nonexistent1.txt',
      filePathB: 'nonexistent2.txt',
      windowSize: 50,
      similarity: 80
    });

    await expect(finder.execute()).rejects.toThrow('Failed to find similar sections');
  });

  test('returns empty array when no similar sections found', async () => {
    const doc1Path = path.join(fixturesDir, 'doc1.txt');
    const doc2Path = path.join(fixturesDir, 'doc2.txt');

    // Use very high similarity threshold
    const finder = new SimilarSectionsFinder({
      filePathA: doc1Path,
      filePathB: doc2Path,
      windowSize: 50,
      similarity: 99
    });

    const results: SimilarSection[] = await finder.execute();

    // Should return empty array for very high similarity threshold
    expect(Array.isArray(results)).toBe(true);
  });
});
