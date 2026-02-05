import * as path from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";
import { ComplexityAnalyzer } from "../src/lib/ComplexityAnalyzer.js";

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture");

describe("ComplexityAnalyzer", () => {
  it("should calculate cyclomatic complexity for simple function", () => {
    // Simple function with no branches = CC 1
    const analyzer = new ComplexityAnalyzer({ files: [] });
    const code = `function simple() { return 1; }`;
    const sourceFile = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
    const fn = sourceFile.statements[0] as ts.FunctionDeclaration;
    expect(analyzer.calculateCyclomaticComplexity(fn, sourceFile)).toBe(1);
  });

  it("should increment cyclomatic for if/for/while/case/catch", () => {
    // Each decision point adds +1
    const analyzer = new ComplexityAnalyzer({ files: [] });
    const code = `function complex(x: number) {
      if (x > 0) return 1;
      for (let i = 0; i < x; i++) {}
      while (x > 0) { x--; }
      switch (x) {
        case 1: break;
        case 2: break;
      }
      try {} catch (e) {}
      return 0;
    }`;
    const sourceFile = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
    const fn = sourceFile.statements[0] as ts.FunctionDeclaration;
    // Base 1 + if(1) + for(1) + while(1) + case(2) + catch(1) = 7
    expect(analyzer.calculateCyclomaticComplexity(fn, sourceFile)).toBe(7);
  });

  it("should increment cyclomatic for &&/||/?? operators", () => {
    // Logical operators add +1 each
    const analyzer = new ComplexityAnalyzer({ files: [] });
    const code = `function logical(a: boolean, b: boolean, c: number | null) {
      if (a && b) return 1;
      if (a || b) return 2;
      const d = c ?? 0;
      return d;
    }`;
    const sourceFile = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
    const fn = sourceFile.statements[0] as ts.FunctionDeclaration;
    // Base 1 + if(1) + &&(1) + if(1) + ||(1) + ??(1) = 6
    expect(analyzer.calculateCyclomaticComplexity(fn, sourceFile)).toBe(6);
  });

  it("should calculate cognitive complexity with nesting penalty", () => {
    // Nested structures add depth penalty
    const analyzer = new ComplexityAnalyzer({ files: [] });
    const code = `function nested(x: number) {
      if (x > 0) {
        if (x > 10) {
          return "large";
        }
      }
      return "small";
    }`;
    const sourceFile = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
    const fn = sourceFile.statements[0] as ts.FunctionDeclaration;
    // outer if: +1 (no nesting yet)
    // inner if: +1 + 1 (nesting penalty = depth 1) = +2
    // Total: 3
    expect(analyzer.calculateCognitiveComplexity(fn, sourceFile)).toBe(3);
  });

  it("should add +1 for else but NO nesting penalty", () => {
    // else-test.ts: if + else = cognitive 2
    const analyzer = new ComplexityAnalyzer({
      files: [path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts")],
    });
    const filePath = path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts");
    const result = analyzer.analyzeFile(filePath);
    const handleElseFn = result.functions.find((f) => f.name === "handleElse");
    expect(handleElseFn).toBeDefined();
    expect(handleElseFn?.cognitive).toBe(2);
  });

  it("should apply nesting penalty for nested catch clauses", () => {
    // catch-test.ts: outer catch + inner catch with nesting
    const analyzer = new ComplexityAnalyzer({
      files: [path.join(fixtureRoot, "packages/pkg-a/src/catch-test.ts")],
    });
    const filePath = path.join(fixtureRoot, "packages/pkg-a/src/catch-test.ts");
    const result = analyzer.analyzeFile(filePath);
    const catchNestingFn = result.functions.find((f) => f.name === "catchNesting");
    expect(catchNestingFn).toBeDefined();
    // outer catch: +1
    // inner catch: +1 + 1 (nesting from outer try) = +2
    // Total: 3
    expect(catchNestingFn?.cognitive).toBe(3);
  });

  it("should count consecutive same logical operators as +1 total", () => {
    // logical-ops.ts: a && b && c && d = +1, not +3
    const analyzer = new ComplexityAnalyzer({
      files: [path.join(fixtureRoot, "packages/pkg-a/src/logical-ops.ts")],
    });
    const filePath = path.join(fixtureRoot, "packages/pkg-a/src/logical-ops.ts");
    const result = analyzer.analyzeFile(filePath);
    const checkLogicalFn = result.functions.find((f) => f.name === "checkLogical");
    expect(checkLogicalFn).toBeDefined();
    expect(checkLogicalFn?.cognitive).toBe(5);
  });

  it("should handle ?? the same as && and || for cognitive complexity", () => {
    // Nullish coalescing treated same as other logical operators
    const analyzer = new ComplexityAnalyzer({ files: [] });
    const code = `function nullish(a: number | null, b: number | null, c: number | null) {
      return a ?? b ?? c ?? 0;
    }`;
    const sourceFile = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
    const fn = sourceFile.statements[0] as ts.FunctionDeclaration;
    // a ?? b ?? c ?? 0 = one sequence of ?? operators = +1
    expect(analyzer.calculateCognitiveComplexity(fn, sourceFile)).toBe(1);
  });

  it("should count LOC correctly (total, code, blank, comment)", () => {
    // Parse file and count line types
    const analyzer = new ComplexityAnalyzer({ files: [] });
    const filePath = path.join(fixtureRoot, "packages/pkg-a/src/complex.ts");
    const loc = analyzer.countLOC(filePath);
    expect(loc.total).toBeGreaterThan(0);
    expect(loc.code).toBeGreaterThan(0);
    expect(loc.blank + loc.code + loc.comment).toBe(loc.total);
  });

  it("should count statements using AST", () => {
    // Count statement nodes in AST
    const analyzer = new ComplexityAnalyzer({ files: [] });
    const code = `
      const a = 1;
      let b = 2;
      console.log(a + b);
      if (a > 0) { return; }
    `;
    const sourceFile = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
    // const a = 1; (VariableStatement)
    // let b = 2; (VariableStatement)
    // console.log(a + b); (ExpressionStatement)
    // if (a > 0) { return; } (IfStatement containing ReturnStatement)
    // At minimum we have 4 top-level statements, plus the return inside
    expect(analyzer.countStatements(sourceFile)).toBeGreaterThanOrEqual(4);
  });

  it("should calculate comment density", () => {
    // density = comment lines / code lines
    const analyzer = new ComplexityAnalyzer({ files: [] });
    const loc: import("../src/types.js").LOCBreakdown = {
      total: 100,
      code: 70,
      blank: 10,
      comment: 20,
    };
    // comment density = comment / code = 20/70
    const density = analyzer.calculateCommentDensity(loc);
    expect(density).toBeCloseTo(20 / 70, 4);
  });

  it("should analyze complex.ts with CC=15 and cognitive=20", () => {
    // The complex.ts fixture file should have these specific values
    const analyzer = new ComplexityAnalyzer({
      files: [path.join(fixtureRoot, "packages/pkg-a/src/complex.ts")],
    });
    const filePath = path.join(fixtureRoot, "packages/pkg-a/src/complex.ts");
    const result = analyzer.analyzeFile(filePath);
    const processDataFn = result.functions.find((f) => f.name === "processData");
    expect(processDataFn).toBeDefined();
    expect(processDataFn?.cyclomatic).toBe(15);
    expect(processDataFn?.cognitive).toBe(20);
  });

  it("should analyze all files and return ComplexityMetrics", () => {
    const analyzer = new ComplexityAnalyzer({
      files: [
        path.join(fixtureRoot, "packages/pkg-a/src/complex.ts"),
        path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts"),
      ],
    });
    const result = analyzer.analyze();
    expect(result.files).toHaveLength(2);
    expect(result.functions.length).toBeGreaterThan(0);
    expect(result.hotspots.length).toBeGreaterThanOrEqual(0);
  });

  it("should identify hotspots based on thresholds", () => {
    const analyzer = new ComplexityAnalyzer({
      files: [
        path.join(fixtureRoot, "packages/pkg-a/src/complex.ts"),
        path.join(fixtureRoot, "packages/pkg-a/src/else-test.ts"),
      ],
      thresholds: {
        cyclomatic: 10,
        cognitive: 15,
      },
    });
    const result = analyzer.analyze();
    // complex.ts processData has CC=15, cognitive=20 - should be a hotspot
    expect(result.hotspots.length).toBeGreaterThan(0);
    const processDataHotspot = result.hotspots.find((f) => f.name === "processData");
    expect(processDataHotspot).toBeDefined();
  });
});
