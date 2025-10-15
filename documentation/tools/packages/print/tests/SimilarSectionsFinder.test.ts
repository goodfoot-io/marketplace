import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SimilarSectionsFinder, SimilarSectionsFinderOptions } from '../src/similar-sections.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SimilarSectionsFinder', () => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'similar-documents');
  const doc1Path = path.join(fixturesDir, 'doc1.txt');
  const doc2Path = path.join(fixturesDir, 'doc2.txt');
  const doc3Path = path.join(fixturesDir, 'doc3.txt');
  const identicalPath = path.join(fixturesDir, 'identical.txt');

  describe('constructor', () => {
    it('should create instance with valid options', () => {
      const options: SimilarSectionsFinderOptions = {
        filePathA: doc1Path,
        filePathB: doc2Path,
        windowSize: 100,
        similarity: 80
      };

      const finder = new SimilarSectionsFinder(options);
      expect(finder).toBeInstanceOf(SimilarSectionsFinder);
    });
  });

  describe('execute', () => {
    describe('basic functionality', () => {
      it('should find similar blocks between two similar documents', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 100,
          similarity: 70
        });

        const results = await finder.execute();

        expect(results).toBeInstanceOf(Array);
        expect(results.length).toBeGreaterThan(0);

        // Each result should have the correct structure
        results.forEach((result) => {
          expect(result).toHaveProperty('substringA');
          expect(result).toHaveProperty('substringB');
          expect(result).toHaveProperty('positionA');
          expect(result).toHaveProperty('positionB');
          expect(result).toHaveProperty('similarity');

          expect(typeof result.substringA).toBe('string');
          expect(typeof result.substringB).toBe('string');
          expect(typeof result.positionA).toBe('number');
          expect(typeof result.positionB).toBe('number');
          expect(typeof result.similarity).toBe('number');

          // Verify similarity meets threshold
          expect(result.similarity).toBeGreaterThanOrEqual(70);
          expect(result.similarity).toBeLessThanOrEqual(100);

          // Verify positions are non-negative
          expect(result.positionA).toBeGreaterThanOrEqual(0);
          expect(result.positionB).toBeGreaterThanOrEqual(0);

          // Verify substring lengths match window size
          expect(result.substringA.length).toBe(100);
          expect(result.substringB.length).toBe(100);
        });
      });

      it('should find matches with identical files and similarity 1.0', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: identicalPath,
          windowSize: 50,
          similarity: 95
        });

        const results = await finder.execute();

        expect(results.length).toBeGreaterThan(0);

        // All matches should have perfect similarity since files are identical
        results.forEach((result) => {
          expect(result.similarity).toBe(100);
          expect(result.substringA).toBe(result.substringB);
        });
      });

      it('should return empty array when no matches found (dissimilar documents)', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc3Path,
          windowSize: 100,
          similarity: 80
        });

        const results = await finder.execute();

        expect(results).toBeInstanceOf(Array);
        expect(results.length).toBe(0);
      });
    });

    describe('window size variations', () => {
      it('should handle window size of 50', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 50,
          similarity: 70
        });

        const results = await finder.execute();

        results.forEach((result) => {
          expect(result.substringA.length).toBe(50);
          expect(result.substringB.length).toBe(50);
        });
      });

      it('should handle window size of 100', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 100,
          similarity: 70
        });

        const results = await finder.execute();

        results.forEach((result) => {
          expect(result.substringA.length).toBe(100);
          expect(result.substringB.length).toBe(100);
        });
      });

      it('should handle window size of 200', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 200,
          similarity: 70
        });

        const results = await finder.execute();

        results.forEach((result) => {
          expect(result.substringA.length).toBe(200);
          expect(result.substringB.length).toBe(200);
        });
      });

      it('should return empty array when window size is larger than file content', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 5000, // Much larger than the file content
          similarity: 70
        });

        const results = await finder.execute();
        expect(results).toEqual([]);
      });
    });

    describe('similarity threshold variations', () => {
      it('should respect similarity threshold of 0.5 (50%)', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 100,
          similarity: 50
        });

        const results = await finder.execute();

        results.forEach((result) => {
          expect(result.similarity).toBeGreaterThanOrEqual(50);
        });
      });

      it('should respect similarity threshold of 0.8 (80%)', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 100,
          similarity: 80
        });

        const results = await finder.execute();

        results.forEach((result) => {
          expect(result.similarity).toBeGreaterThanOrEqual(80);
        });
      });

      it('should respect similarity threshold of 0.95 (95%)', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 100,
          similarity: 95
        });

        const results = await finder.execute();

        results.forEach((result) => {
          expect(result.similarity).toBeGreaterThanOrEqual(95);
        });
      });

      it('should return fewer results with higher similarity threshold', async () => {
        const finderLow = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 100,
          similarity: 50
        });

        const finderHigh = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 100,
          similarity: 90
        });

        const resultsLow = await finderLow.execute();
        const resultsHigh = await finderHigh.execute();

        expect(resultsLow.length).toBeGreaterThanOrEqual(resultsHigh.length);
      });
    });

    describe('empty files', () => {
      let emptyFile1: string;
      let emptyFile2: string;

      beforeAll(async () => {
        emptyFile1 = path.join(fixturesDir, 'empty1.txt');
        emptyFile2 = path.join(fixturesDir, 'empty2.txt');
        await fs.writeFile(emptyFile1, '');
        await fs.writeFile(emptyFile2, '');
      });

      afterAll(async () => {
        await fs.unlink(emptyFile1).catch(() => {});
        await fs.unlink(emptyFile2).catch(() => {});
      });

      it('should return empty array for empty files', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: emptyFile1,
          filePathB: emptyFile2,
          windowSize: 50,
          similarity: 80
        });

        const results = await finder.execute();
        expect(results).toEqual([]);
      });

      it('should return empty array when one file is empty', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: emptyFile1,
          windowSize: 50,
          similarity: 80
        });

        const results = await finder.execute();
        expect(results).toEqual([]);
      });
    });

    describe('error handling', () => {
      it('should throw error for non-existent file A', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: 'nonexistent1.txt',
          filePathB: doc2Path,
          windowSize: 100,
          similarity: 80
        });

        await expect(finder.execute()).rejects.toThrow('Failed to find similar sections');
      });

      it('should throw error for non-existent file B', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: 'nonexistent2.txt',
          windowSize: 100,
          similarity: 80
        });

        await expect(finder.execute()).rejects.toThrow('Failed to find similar sections');
      });

      it('should throw error for both non-existent files', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: 'nonexistent1.txt',
          filePathB: 'nonexistent2.txt',
          windowSize: 100,
          similarity: 80
        });

        await expect(finder.execute()).rejects.toThrow('Failed to find similar sections');
      });
    });

    describe('parameter validation edge cases', () => {
      it('should handle window size of 1', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 1,
          similarity: 80
        });

        const results = await finder.execute();

        results.forEach((result) => {
          expect(result.substringA.length).toBe(1);
          expect(result.substringB.length).toBe(1);
        });
      });

      it('should handle similarity threshold of 0 (0%)', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 50,
          similarity: 0
        });

        const results = await finder.execute();

        // Should find many matches with 0% threshold
        expect(results.length).toBeGreaterThan(0);
        results.forEach((result) => {
          expect(result.similarity).toBeGreaterThanOrEqual(0);
        });
      });

      it('should handle similarity threshold of 100 (100%)', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: identicalPath, // Use identical file for 100% matches
          windowSize: 50,
          similarity: 100
        });

        const results = await finder.execute();

        results.forEach((result) => {
          expect(result.similarity).toBe(100);
        });
      });
    });

    describe('removeOverlappingMatches functionality', () => {
      it('should remove overlapping matches and keep higher similarity scores', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: identicalPath,
          windowSize: 50,
          similarity: 80
        });

        const results = await finder.execute();

        // Verify no overlapping positions in file A
        const positionsA = results.map((r) => r.positionA).sort((a, b) => a - b);
        for (let i = 1; i < positionsA.length; i++) {
          const prevEnd = positionsA[i - 1] + 50; // windowSize
          const currentStart = positionsA[i];
          expect(currentStart).toBeGreaterThanOrEqual(prevEnd);
        }

        // Verify no overlapping positions in file B
        const positionsB = results.map((r) => r.positionB).sort((a, b) => a - b);
        for (let i = 1; i < positionsB.length; i++) {
          const prevEnd = positionsB[i - 1] + 50; // windowSize
          const currentStart = positionsB[i];
          expect(currentStart).toBeGreaterThanOrEqual(prevEnd);
        }
      });

      it('should sort final results by position in file A', async () => {
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: doc2Path,
          windowSize: 100,
          similarity: 70
        });

        const results = await finder.execute();

        // Verify results are sorted by positionA
        for (let i = 1; i < results.length; i++) {
          expect(results[i].positionA).toBeGreaterThanOrEqual(results[i - 1].positionA);
        }
      });

      it('should prioritize higher similarity matches when removing overlaps', async () => {
        // Create a test scenario with potential overlaps using identical files
        const finder = new SimilarSectionsFinder({
          filePathA: doc1Path,
          filePathB: identicalPath,
          windowSize: 30,
          similarity: 50
        });

        const results = await finder.execute();

        // All matches should have high similarity (100% for identical files)
        results.forEach((result) => {
          expect(result.similarity).toBe(100);
        });

        // Verify no overlaps exist
        for (let i = 1; i < results.length; i++) {
          const prevMatch = results[i - 1];
          const currentMatch = results[i];

          // Check file A overlap
          const prevEndA = prevMatch.positionA + 30;
          expect(currentMatch.positionA).toBeGreaterThanOrEqual(prevEndA);

          // Check file B overlap
          const prevEndB = prevMatch.positionB + 30;
          expect(currentMatch.positionB).toBeGreaterThanOrEqual(prevEndB);
        }
      });
    });

    describe('performance and edge cases', () => {
      it('should handle very small files', async () => {
        let smallFile1: string = '';
        let smallFile2: string = '';

        try {
          smallFile1 = path.join(fixturesDir, 'small1.txt');
          smallFile2 = path.join(fixturesDir, 'small2.txt');
          await fs.writeFile(smallFile1, 'Hello world!');
          await fs.writeFile(smallFile2, 'Hello world!');

          const finder = new SimilarSectionsFinder({
            filePathA: smallFile1,
            filePathB: smallFile2,
            windowSize: 5,
            similarity: 80
          });

          const results = await finder.execute();
          expect(results.length).toBeGreaterThan(0);

          results.forEach((result) => {
            expect(result.substringA.length).toBe(5);
            expect(result.substringB.length).toBe(5);
          });
        } finally {
          await fs.unlink(smallFile1).catch(() => {});
          await fs.unlink(smallFile2).catch(() => {});
        }
      });

      it('should handle files with special characters', async () => {
        let specialFile1: string = '';
        let specialFile2: string = '';

        try {
          specialFile1 = path.join(fixturesDir, 'special1.txt');
          specialFile2 = path.join(fixturesDir, 'special2.txt');
          const specialContent = 'Special chars: àáâãäåæçèéêë ñòóôõö ùúûüý 中文 日本語 한국어 🚀🎉💡';
          await fs.writeFile(specialFile1, specialContent);
          await fs.writeFile(specialFile2, specialContent);

          const finder = new SimilarSectionsFinder({
            filePathA: specialFile1,
            filePathB: specialFile2,
            windowSize: 20,
            similarity: 90
          });

          const results = await finder.execute();
          expect(results.length).toBeGreaterThan(0);

          results.forEach((result) => {
            expect(result.similarity).toBeGreaterThanOrEqual(90);
          });
        } finally {
          await fs.unlink(specialFile1).catch(() => {});
          await fs.unlink(specialFile2).catch(() => {});
        }
      });

      it('should handle files with only whitespace', async () => {
        let whitespaceFile1: string = '';
        let whitespaceFile2: string = '';

        try {
          whitespaceFile1 = path.join(fixturesDir, 'whitespace1.txt');
          whitespaceFile2 = path.join(fixturesDir, 'whitespace2.txt');
          await fs.writeFile(whitespaceFile1, '   \n\t   \n   ');
          await fs.writeFile(whitespaceFile2, '   \n\t   \n   ');

          const finder = new SimilarSectionsFinder({
            filePathA: whitespaceFile1,
            filePathB: whitespaceFile2,
            windowSize: 5,
            similarity: 90
          });

          const results = await finder.execute();

          results.forEach((result) => {
            expect(result.similarity).toBeGreaterThanOrEqual(90);
          });
        } finally {
          await fs.unlink(whitespaceFile1).catch(() => {});
          await fs.unlink(whitespaceFile2).catch(() => {});
        }
      });
    });
  });
});
