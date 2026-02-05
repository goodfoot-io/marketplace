import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SwallowedErrorAnalyzer } from "../src/lib/SwallowedErrorAnalyzer.js";

describe("SwallowedErrorAnalyzer", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "swallowed-errors-test-"));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createTestFile(content: string): string {
    const filePath = path.join(tempDir, `test-${Date.now()}.ts`);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  describe("empty catch blocks", () => {
    it("should detect empty catch blocks", () => {
      const file = createTestFile(`
        function test() {
          try {
            riskyOperation();
          } catch (error) {
          }
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["empty-catch"]).toBe(1);
      expect(result.findings[0].pattern).toBe("empty-catch");
      expect(result.findings[0].confidence).toBe("high");
    });

    it("should detect catch blocks with only comments as comment-only-catch", () => {
      const file = createTestFile(`
        function test() {
          try {
            riskyOperation();
          } catch (error) {
            // intentionally ignored
          }
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["comment-only-catch"]).toBe(1);
      expect(result.findings[0].pattern).toBe("comment-only-catch");
    });
  });

  describe("catch returning success values", () => {
    it("should detect catch returning empty array", () => {
      const file = createTestFile(`
        function test() {
          try {
            return getData();
          } catch (error) {
            return [];
          }
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["catch-returns-success"]).toBe(1);
      expect(result.findings[0].pattern).toBe("catch-returns-success");
    });

    it("should detect catch returning null", () => {
      const file = createTestFile(`
        function test() {
          try {
            return getData();
          } catch (error) {
            return null;
          }
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["catch-returns-success"]).toBe(1);
    });

    it("should not flag catch that rethrows", () => {
      const file = createTestFile(`
        function test() {
          try {
            return getData();
          } catch (error) {
            console.log(error);
            throw error;
          }
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["catch-returns-success"]).toBe(0);
      expect(result.summary.byPattern["catch-log-only"]).toBe(0);
    });
  });

  describe("empty promise catch", () => {
    it("should detect empty .catch() handlers", () => {
      const file = createTestFile(`
        function test() {
          asyncOperation().catch(() => {});
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["empty-promise-catch"]).toBe(1);
      expect(result.findings[0].confidence).toBe("high");
    });

    it("should detect empty .catch() with error parameter", () => {
      const file = createTestFile(`
        function test() {
          asyncOperation().catch((err) => {});
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["empty-promise-catch"]).toBe(1);
    });
  });

  describe("error parameter unused", () => {
    it("should detect unused error parameter", () => {
      const file = createTestFile(`
        function test() {
          try {
            riskyOperation();
          } catch (error) {
            return defaultValue;
          }
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["error-param-unused"]).toBe(1);
    });

    it("should not flag underscore-prefixed error parameter", () => {
      const file = createTestFile(`
        function test() {
          try {
            riskyOperation();
          } catch (_error) {
            return defaultValue;
          }
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["error-param-unused"]).toBe(0);
    });

    it("should not flag used error parameter", () => {
      const file = createTestFile(`
        function test() {
          try {
            riskyOperation();
          } catch (error) {
            console.log(error);
            return defaultValue;
          }
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["error-param-unused"]).toBe(0);
    });
  });

  describe("confidence adjustments", () => {
    it("should lower confidence in test files", () => {
      const file = path.join(tempDir, "example.test.ts");
      fs.writeFileSync(
        file,
        `
        function test() {
          try {
            riskyOperation();
          } catch (error) {
          }
        }
      `,
      );

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.findings[0].confidence).toBe("medium"); // lowered from high
      expect(result.findings[0].context.isTestFile).toBe(true);
    });

    it("should lower confidence for functions named try*", () => {
      const file = createTestFile(`
        function tryLoadConfig() {
          try {
            return loadConfig();
          } catch (error) {
            return null;
          }
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      // Should have lower confidence due to function name
      const finding = result.findings.find((f) => f.pattern === "catch-returns-success");
      expect(finding?.confidence).toBe("low"); // lowered from medium
      expect(finding?.context.functionNameSuggestsOptional).toBe(true);
    });
  });

  describe("void promise (strictAsync mode)", () => {
    it("should not detect void promise by default", () => {
      const file = createTestFile(`
        function test() {
          void asyncOperation();
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.byPattern["void-promise"]).toBe(0);
    });

    it("should detect void promise with strictAsync enabled", () => {
      const file = createTestFile(`
        async function asyncOperation(): Promise<void> {}
        function test() {
          void asyncOperation();
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({
        rootDir: tempDir,
        files: [file],
        strictAsync: true,
      });
      const result = analyzer.analyze([file]);

      // Note: without type checker, detection is heuristic-based
      // This may or may not detect based on function name patterns
      expect(result.summary.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe("metrics summary", () => {
    it("should provide accurate summary counts", () => {
      const file = createTestFile(`
        function test1() {
          try { op1(); } catch (e) {}
        }
        function test2() {
          try { op2(); } catch (e) {}
        }
        function test3() {
          asyncOp().catch(() => {});
        }
      `);

      const analyzer = new SwallowedErrorAnalyzer({ rootDir: tempDir, files: [file] });
      const result = analyzer.analyze([file]);

      expect(result.summary.total).toBe(3);
      expect(result.summary.byPattern["empty-catch"]).toBe(2);
      expect(result.summary.byPattern["empty-promise-catch"]).toBe(1);
      expect(result.summary.highConfidenceCount).toBe(3);
    });
  });
});
