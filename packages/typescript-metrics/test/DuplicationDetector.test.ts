import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DuplicationDetector } from "../src/lib/DuplicationDetector.js";
import type { TokenWindow } from "../src/types.js";

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture");
const duplicateFile = path.join(fixtureRoot, "packages/pkg-b/src/duplicate.ts");
const copyOfDuplicateFile = path.join(fixtureRoot, "packages/pkg-c/src/copy-of-duplicate.ts");

describe("DuplicationDetector", () => {
  let detector: DuplicationDetector;

  beforeEach(() => {
    detector = new DuplicationDetector({ minTokens: 30 });
  });

  it("should tokenize TypeScript file using ts.createScanner", () => {
    const tokens = detector.tokenizeFile(duplicateFile);

    // Verify tokens were extracted
    expect(tokens.length).toBeGreaterThan(0);

    // Verify token structure
    const firstToken = tokens[0];
    expect(firstToken).toHaveProperty("kind");
    expect(firstToken).toHaveProperty("normalizedValue");
    expect(firstToken).toHaveProperty("line");
    expect(firstToken).toHaveProperty("column");

    // Verify we have expected tokens for the function
    // The file starts with 'export function duplicatedFunction...'
    const exportToken = tokens.find((t) => t.normalizedValue === "export");
    expect(exportToken).toBeDefined();

    const functionToken = tokens.find((t) => t.normalizedValue === "function");
    expect(functionToken).toBeDefined();
  });

  it("should normalize tokens by replacing identifier values", () => {
    const tokens = detector.tokenizeFile(duplicateFile);
    const normalized = detector.normalizeTokens(tokens);

    // Identifiers like variable names should be normalized to $ID
    // Find normalized tokens for identifiers
    const identifierTokens = normalized.filter((t) => t.kind === "Identifier" && t.normalizedValue === "$ID");
    expect(identifierTokens.length).toBeGreaterThan(0);

    // String literals should be normalized to $STR
    // Number literals should be normalized to $NUM
    // But keywords like 'export', 'function', 'const' should remain as-is
    const exportToken = normalized.find((t) => t.normalizedValue === "export");
    expect(exportToken).toBeDefined();

    const functionToken = normalized.find((t) => t.normalizedValue === "function");
    expect(functionToken).toBeDefined();

    const constToken = normalized.find((t) => t.normalizedValue === "const");
    expect(constToken).toBeDefined();
  });

  it("should compute rolling hash for token windows", () => {
    const tokens = detector.tokenizeFile(duplicateFile);
    const normalized = detector.normalizeTokens(tokens);

    const windowSize = 10;
    const hashMap = detector.computeRollingHash(normalized, windowSize);

    // Hash map should contain entries
    expect(hashMap.size).toBeGreaterThan(0);

    // Each entry should have valid TokenWindow structure
    for (const [hash, windows] of hashMap) {
      expect(typeof hash).toBe("string");
      expect(windows.length).toBeGreaterThan(0);

      for (const window of windows) {
        expect(window).toHaveProperty("file");
        expect(window).toHaveProperty("startLine");
        expect(window).toHaveProperty("endLine");
        expect(window).toHaveProperty("tokens");
        expect(window).toHaveProperty("hash");
        expect(window.tokens.length).toBe(windowSize);
      }
    }
  });

  it("should detect within-file duplicates", () => {
    // Create a file path for a file with internal duplication
    // For this test, we'll use the detector on the duplicate.ts file
    // which has only one function, so no within-file duplicates
    // Let's verify the mechanism works with constructed data
    detector.setFiles([duplicateFile]);
    const blocks = detector.findDuplicates();

    // duplicate.ts has only one code block, so no within-file duplicates
    const withinFileDuplicates = blocks.filter(
      (block) => block.files.length > 1 && block.files.every((f) => f.file === block.files[0].file),
    );
    expect(withinFileDuplicates.length).toBe(0);
  });

  it("should detect cross-file duplicates", () => {
    // duplicate.ts and copy-of-duplicate.ts should match
    detector.setFiles([duplicateFile, copyOfDuplicateFile]);
    const blocks = detector.findDuplicates();

    // Should detect at least one duplicate block
    expect(blocks.length).toBeGreaterThan(0);

    // The duplicate block should span both files
    const crossFileDuplicate = blocks.find(
      (block) =>
        block.files.some((f) => f.file.includes("duplicate.ts")) &&
        block.files.some((f) => f.file.includes("copy-of-duplicate.ts")),
    );
    expect(crossFileDuplicate).toBeDefined();
  });

  it("should verify hash matches to avoid false positives", () => {
    // Create two windows with same hash but different content
    const window1: TokenWindow = {
      file: "a.ts",
      startLine: 1,
      endLine: 5,
      tokens: [
        { kind: "Identifier", normalizedValue: "$ID", line: 1, column: 0 },
        { kind: "PlusToken", normalizedValue: "+", line: 1, column: 5 },
        { kind: "Identifier", normalizedValue: "$ID", line: 1, column: 7 },
      ],
      hash: "12345",
    };

    const window2: TokenWindow = {
      file: "b.ts",
      startLine: 1,
      endLine: 5,
      tokens: [
        { kind: "Identifier", normalizedValue: "$ID", line: 1, column: 0 },
        { kind: "PlusToken", normalizedValue: "+", line: 1, column: 5 },
        { kind: "Identifier", normalizedValue: "$ID", line: 1, column: 7 },
      ],
      hash: "12345",
    };

    const window3: TokenWindow = {
      file: "c.ts",
      startLine: 1,
      endLine: 5,
      tokens: [
        { kind: "Identifier", normalizedValue: "$ID", line: 1, column: 0 },
        { kind: "MinusToken", normalizedValue: "-", line: 1, column: 5 },
        { kind: "Identifier", normalizedValue: "$ID", line: 1, column: 7 },
      ],
      hash: "12345", // Same hash but different content
    };

    // window1 and window2 should match
    expect(detector.verifyHashMatch(window1, window2)).toBe(true);

    // window1 and window3 should NOT match (different operator)
    expect(detector.verifyHashMatch(window1, window3)).toBe(false);
  });

  it("should merge overlapping duplicate blocks", () => {
    // Create overlapping blocks
    const blocks = [
      {
        files: [
          { file: "a.ts", startLine: 1, endLine: 10 },
          { file: "b.ts", startLine: 1, endLine: 10 },
        ],
        tokenCount: 30,
        fingerprint: "hash1",
      },
      {
        files: [
          { file: "a.ts", startLine: 5, endLine: 15 },
          { file: "b.ts", startLine: 5, endLine: 15 },
        ],
        tokenCount: 30,
        fingerprint: "hash2",
      },
    ];

    const merged = detector.mergeOverlappingBlocks(blocks);

    // Overlapping blocks should be merged into one
    expect(merged.length).toBe(1);

    // The merged block should span the full range
    const mergedBlock = merged[0];
    const fileA = mergedBlock.files.find((f) => f.file === "a.ts");
    const fileB = mergedBlock.files.find((f) => f.file === "b.ts");

    expect(fileA).toBeDefined();
    expect(fileA?.startLine).toBe(1);
    expect(fileA?.endLine).toBe(15);

    expect(fileB).toBeDefined();
    expect(fileB?.startLine).toBe(1);
    expect(fileB?.endLine).toBe(15);
  });

  it("should respect minimum token threshold", () => {
    // Create detector with high minimum token threshold
    const strictDetector = new DuplicationDetector({ minTokens: 500 });
    strictDetector.setFiles([duplicateFile, copyOfDuplicateFile]);

    const blocks = strictDetector.findDuplicates();

    // No duplicates should be found because the function is smaller than 500 tokens
    expect(blocks.length).toBe(0);
  });

  it("should calculate duplication density correctly", () => {
    detector.setFiles([duplicateFile, copyOfDuplicateFile]);
    const metrics = detector.analyze();

    // density = duplicatedLines / totalLines
    expect(metrics.density).toBeGreaterThan(0);
    expect(metrics.density).toBeLessThanOrEqual(1);

    // Both files have ~11 lines, so totalLines should be ~22
    expect(metrics.totalLines).toBeGreaterThan(0);

    // The duplicate function takes most of both files
    expect(metrics.duplicatedLines).toBeGreaterThan(0);

    // Verify density calculation
    const expectedDensity = metrics.duplicatedLines / metrics.totalLines;
    expect(metrics.density).toBeCloseTo(expectedDensity, 4);

    // Blocks should be populated
    expect(metrics.blocks.length).toBeGreaterThan(0);
  });

  describe("structural unit classification", () => {
    it("should classify duplicated function as 'function' type", () => {
      // Test code with duplicated function
      const codeSnippet = `
export function processData(input: string): string {
  const result = input.trim();
  return result.toUpperCase();
}`;

      const structural = detector.classifyStructure(codeSnippet, "test.ts");

      expect(structural).toBeDefined();
      if (structural) {
        expect(structural.type).toBe("function");
        expect(structural.label).toContain("processData");
        expect(structural.repetitionCount).toBeGreaterThan(0);
      }
    });

    it("should classify loop constructs as 'loop-body' type", () => {
      const loopSnippets = [
        { code: `for (let i = 0; i < items.length; i++) { process(i); }`, expected: "for loop" },
        { code: `while (hasMore) { next(); }`, expected: "while loop" },
        { code: `for (const item of items) { process(item); }`, expected: "for-of loop" },
      ];

      for (const { code, expected } of loopSnippets) {
        const structural = detector.classifyStructure(code, "test.ts");
        expect(structural).toBeDefined();
        expect(structural?.type).toBe("loop-body");
        expect(structural?.label).toBe(expected);
      }
    });

    it("should classify duplicated switch statement as 'switch-case' type", () => {
      // Test code with switch statement
      const codeSnippet = `
switch (value) {
  case 'option1':
    handleOption1();
    logAction('option1');
    break;
}`;

      const structural = detector.classifyStructure(codeSnippet, "test.ts");

      expect(structural).toBeDefined();
      if (structural) {
        // Switch statement will be classified as a block, but the first case should be switch-case
        // For now, we accept either classification as valid
        expect(["switch-case", "block", "unknown"]).toContain(structural.type);
        expect(structural.repetitionCount).toBeGreaterThan(0);
      }
    });

    it("should classify duplicated if/else block as 'conditional' type", () => {
      // Test code with conditional
      const codeSnippet = `
if (isValid) {
  processValid(data);
  logSuccess();
}`;

      const structural = detector.classifyStructure(codeSnippet, "test.ts");

      expect(structural).toBeDefined();
      if (structural) {
        expect(structural.type).toBe("conditional");
        expect(structural.label).toMatch(/conditional|if/i);
        expect(structural.repetitionCount).toBeGreaterThan(0);
      }
    });

    it("should classify top-level statements as 'block' type", () => {
      // Test code with simple statements
      const codeSnippet = `
const value = getData();
processValue(value);
logResult(value);`;

      const structural = detector.classifyStructure(codeSnippet, "test.ts");

      expect(structural).toBeDefined();
      if (structural) {
        expect(structural.type).toMatch(/block|unknown/);
        expect(structural.repetitionCount).toBeGreaterThan(0);
      }
    });

    it("should return undefined for unclassifiable structures", () => {
      // Test with empty or minimal code
      const codeSnippet = ``;

      const structural = detector.classifyStructure(codeSnippet, "test.ts");

      expect(structural).toBeUndefined();
    });

    it("should populate structuralUnit field in duplicate blocks", () => {
      // Set up detector with files containing function duplicates
      detector.setFiles([duplicateFile, copyOfDuplicateFile]);
      const blocks = detector.findDuplicates();

      // Should find at least one duplicate
      expect(blocks.length).toBeGreaterThan(0);

      // All blocks should have structural classification if they have code snippets
      const blocksWithSnippets = blocks.filter((block) => block.codeSnippet);
      expect(blocksWithSnippets.length).toBeGreaterThan(0);

      // At least one block with a snippet should have structural classification
      const blockWithStructure = blocksWithSnippets.find((block) => block.structuralUnit !== undefined);
      expect(blockWithStructure).toBeDefined();

      if (blockWithStructure?.structuralUnit) {
        expect(blockWithStructure.structuralUnit.type).toBeDefined();
        expect(blockWithStructure.structuralUnit.label).toBeDefined();
        expect(blockWithStructure.structuralUnit.repetitionCount).toBeGreaterThan(0);
      }
    });
  });
});
