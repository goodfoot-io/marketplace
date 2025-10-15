import { readFile } from 'node:fs/promises';
import * as fuzzball from 'fuzzball';

export interface SimilarSectionsFinderOptions {
  filePathA: string;
  filePathB: string;
  windowSize: number;
  similarity: number;
}

export interface SimilarSection {
  substringA: string;
  substringB: string;
  positionA: number;
  positionB: number;
  similarity: number;
}

export class SimilarSectionsFinder {
  private filePathA: string;
  private filePathB: string;
  private windowSize: number;
  private similarity: number;

  constructor(options: SimilarSectionsFinderOptions) {
    this.filePathA = options.filePathA;
    this.filePathB = options.filePathB;
    this.windowSize = options.windowSize;
    this.similarity = options.similarity;
  }

  async execute(): Promise<SimilarSection[]> {
    try {
      // Read both files
      const [contentA, contentB] = await Promise.all([
        this.readFileContent(this.filePathA),
        this.readFileContent(this.filePathB)
      ]);

      // Find similar sections using sliding window approach
      const similarSections = this.findSimilarSections(contentA, contentB);

      // Remove overlapping matches to get the best non-overlapping set
      return this.removeOverlappingMatches(similarSections);
    } catch (error: unknown) {
      throw new Error(`Failed to find similar sections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async readFileContent(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, 'utf8');
    } catch (error: unknown) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private findSimilarSections(contentA: string, contentB: string): SimilarSection[] {
    const similarSections: SimilarSection[] = [];
    const lengthA = contentA.length;
    const lengthB = contentB.length;

    // Sliding window approach: compare every substring of windowSize from both files
    for (let posA = 0; posA <= lengthA - this.windowSize; posA++) {
      const substringA = contentA.substring(posA, posA + this.windowSize);

      for (let posB = 0; posB <= lengthB - this.windowSize; posB++) {
        const substringB = contentB.substring(posB, posB + this.windowSize);

        // Calculate similarity using both ratio and token_sort_ratio
        const ratioSimilarity = fuzzball.ratio(substringA, substringB);
        const tokenSortSimilarity = fuzzball.token_sort_ratio(substringA, substringB);

        // Use the higher of the two similarity scores
        const maxSimilarity = Math.max(ratioSimilarity, tokenSortSimilarity);

        // Check if similarity meets threshold
        if (maxSimilarity >= this.similarity) {
          similarSections.push({
            substringA,
            substringB,
            positionA: posA,
            positionB: posB,
            similarity: maxSimilarity
          });
        }
      }
    }

    return similarSections;
  }

  private removeOverlappingMatches(sections: SimilarSection[]): SimilarSection[] {
    if (sections.length === 0) {
      return [];
    }

    // Sort by similarity score in descending order to prioritize better matches
    const sortedSections = [...sections].sort((a, b) => b.similarity - a.similarity);

    const nonOverlapping: SimilarSection[] = [];
    const usedRangesA: Array<{ start: number; end: number }> = [];
    const usedRangesB: Array<{ start: number; end: number }> = [];

    for (const section of sortedSections) {
      const rangeA = { start: section.positionA, end: section.positionA + this.windowSize };
      const rangeB = { start: section.positionB, end: section.positionB + this.windowSize };

      // Check if this section overlaps with any already selected sections
      const overlapsA = usedRangesA.some((range) => this.rangesOverlap(rangeA, range));
      const overlapsB = usedRangesB.some((range) => this.rangesOverlap(rangeB, range));

      if (!overlapsA && !overlapsB) {
        // No overlap, add this section
        nonOverlapping.push(section);
        usedRangesA.push(rangeA);
        usedRangesB.push(rangeB);
      }
    }

    // Sort the final result by position in file A for consistent output
    return nonOverlapping.sort((a, b) => a.positionA - b.positionA);
  }

  private rangesOverlap(range1: { start: number; end: number }, range2: { start: number; end: number }): boolean {
    return range1.start < range2.end && range2.start < range1.end;
  }
}
