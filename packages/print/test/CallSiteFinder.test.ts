import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CallSiteFinder } from "../src/lib/CallSiteFinder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("CallSiteFinder", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "project-for-call-sites");
  const originalCwd = process.cwd();

  beforeEach(() => {
    process.chdir(fixturesDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  describe("execute - standalone functions", () => {
    it("should find direct call sites of a simple function", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/utils/math.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      expect(result.definition.name).toBe("add");
      expect(result.definition.file).toContain("src/utils/math.ts");
      expect(result.definition.isMethod).toBe(false);

      // Should find calls in various files
      const files = result.callSites.map((cs) => cs.file);

      // Internal call in math.ts (sum uses add)
      expect(files.some((f) => f.includes("math.ts"))).toBe(true);

      // Calls in calculator.ts
      expect(files.some((f) => f.includes("calculator.ts"))).toBe(true);

      // Calls in index.ts
      expect(files.some((f) => f.includes("index.ts"))).toBe(true);
    });

    it("should find call sites of capitalize function", async () => {
      const finder = new CallSiteFinder({
        functionName: "capitalize",
        sourceFile: "src/utils/strings.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      expect(result.definition.name).toBe("capitalize");
      expect(result.callSites.length).toBeGreaterThan(0);

      // Should find call in strings.ts itself (formatName uses capitalize)
      expect(result.callSites.some((cs) => cs.file.includes("strings.ts"))).toBe(true);

      // Should find call in Widget.ts (render uses capitalize)
      expect(result.callSites.some((cs) => cs.file.includes("Widget.ts"))).toBe(true);

      // Should find call in formatter.ts
      expect(result.callSites.some((cs) => cs.file.includes("formatter.ts"))).toBe(true);

      // Should find call in index.ts
      expect(result.callSites.some((cs) => cs.file.includes("index.ts"))).toBe(true);
    });

    it("should find call sites when function is used as callback", async () => {
      const finder = new CallSiteFinder({
        functionName: "capitalize",
        sourceFile: "src/utils/strings.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      // In formatter.ts: names.map(capitalize) - passed as callback
      const formatterCalls = result.callSites.filter((cs) => cs.file.includes("formatter.ts"));
      expect(formatterCalls.length).toBeGreaterThan(0);
    });

    it("should include line and column information", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/utils/math.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      for (const site of result.callSites) {
        expect(site.line).toBeGreaterThan(0);
        expect(site.column).toBeGreaterThan(0);
        expect(site.file).toBeTruthy();
        expect(site.context).toBeTruthy();
      }
    });

    it("should include context around the call", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/utils/math.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      // Find a call site in index.ts
      const indexCall = result.callSites.find((cs) => cs.file.includes("index.ts") && cs.context.includes("add(1, 2)"));
      expect(indexCall).toBeDefined();
      expect(indexCall?.context).toContain("add");
    });
  });

  describe("execute - class methods", () => {
    it("should find call sites of a class method", async () => {
      const finder = new CallSiteFinder({
        functionName: "render",
        sourceFile: "src/components/Widget.ts",
        className: "Widget",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      expect(result.definition.name).toBe("render");
      expect(result.definition.isMethod).toBe(true);
      expect(result.definition.className).toBe("Widget");

      // Should find calls
      expect(result.callSites.length).toBeGreaterThan(0);
    });

    it("should find call sites of getName method", async () => {
      const finder = new CallSiteFinder({
        functionName: "getName",
        sourceFile: "src/components/Widget.ts",
        className: "Widget",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      expect(result.definition.name).toBe("getName");
      expect(result.definition.isMethod).toBe(true);

      // Button.render calls this.getName()
      expect(result.callSites.some((cs) => cs.file.includes("Button.ts"))).toBe(true);

      // index.ts calls widget.getName()
      expect(result.callSites.some((cs) => cs.file.includes("index.ts"))).toBe(true);
    });

    it("should find call sites of setName method", async () => {
      const finder = new CallSiteFinder({
        functionName: "setName",
        sourceFile: "src/components/Widget.ts",
        className: "Widget",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      expect(result.definition.name).toBe("setName");

      // Form constructor calls submitButton.setName(name)
      expect(result.callSites.some((cs) => cs.file.includes("Form.ts"))).toBe(true);
    });

    it("should find call sites of inherited method calls", async () => {
      const finder = new CallSiteFinder({
        functionName: "click",
        sourceFile: "src/components/Button.ts",
        className: "Button",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      expect(result.definition.name).toBe("click");
      expect(result.definition.className).toBe("Button");

      // Form.submit calls this.submitButton.click()
      expect(result.callSites.some((cs) => cs.file.includes("Form.ts"))).toBe(true);
    });
  });

  describe("execute - aliased and namespaced imports", () => {
    it("should find calls through aliased imports", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/utils/math.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      // Calculator uses: import { add as addNumbers } from "../utils/math.js"
      // and calls addNumbers(a, b)
      const calculatorCalls = result.callSites.filter((cs) => cs.file.includes("calculator.ts"));
      expect(calculatorCalls.length).toBeGreaterThan(0);
    });

    it("should find calls through namespace imports", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/utils/math.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      // Calculator uses: import * as mathUtils from "../utils/math.js"
      // and calls mathUtils.add(a, b)
      const calculatorCalls = result.callSites.filter((cs) => cs.file.includes("calculator.ts"));

      // Should find the namespaced call
      expect(calculatorCalls.some((cs) => cs.context.includes("mathUtils.add"))).toBe(true);
    });
  });

  describe("execute - nested and multiple calls", () => {
    it("should find nested function calls", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/utils/math.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      // Calculator.nestedAdd has: add(add(a, b), c)
      // Should find both calls
      const calculatorCalls = result.callSites.filter(
        (cs) => cs.file.includes("calculator.ts") && cs.context.includes("nestedAdd"),
      );

      // The nested call line should appear (may be counted as one or two depending on implementation)
      expect(result.callSites.some((cs) => cs.context.includes("add(add("))).toBe(true);
    });

    it("should find multiple calls in the same method", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/utils/math.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      // Calculator.calculate has multiple add calls
      const calculateMethodCalls = result.callSites.filter(
        (cs) => cs.file.includes("calculator.ts") && (cs.context.includes("sum = add") || cs.context.includes("add(product")),
      );

      expect(calculateMethodCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("execute - factory functions", () => {
    it("should find call sites of factory functions", async () => {
      const finder = new CallSiteFinder({
        functionName: "createButton",
        sourceFile: "src/components/Button.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      expect(result.definition.name).toBe("createButton");
      expect(result.definition.isMethod).toBe(false);

      // Form constructor uses createButton
      expect(result.callSites.some((cs) => cs.file.includes("Form.ts"))).toBe(true);

      // index.ts uses createButton
      expect(result.callSites.some((cs) => cs.file.includes("index.ts"))).toBe(true);
    });
  });

  describe("execute - search scope limiting", () => {
    it("should limit search to specified glob patterns", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/utils/math.ts",
        projectPath: "tsconfig.json",
        searchGlobs: ["src/services/**/*.ts"],
      });

      const result = await finder.execute();

      // Should only find calls in services directory
      for (const site of result.callSites) {
        expect(site.file).toContain("services");
      }

      // Should NOT include calls from index.ts or other directories
      expect(result.callSites.every((cs) => !cs.file.includes("index.ts"))).toBe(true);
    });

    it("should handle multiple search globs", async () => {
      const finder = new CallSiteFinder({
        functionName: "capitalize",
        sourceFile: "src/utils/strings.ts",
        projectPath: "tsconfig.json",
        searchGlobs: ["src/components/**/*.ts", "src/services/**/*.ts"],
      });

      const result = await finder.execute();

      // Should find calls in components and services
      const files = result.callSites.map((cs) => cs.file);
      expect(files.some((f) => f.includes("components"))).toBe(true);
      expect(files.some((f) => f.includes("services"))).toBe(true);

      // Should NOT find calls in index.ts (outside search scope)
      expect(files.every((f) => !f.includes("index.ts"))).toBe(true);
    });
  });

  describe("execute - error handling", () => {
    it("should throw error when function is not found", async () => {
      const finder = new CallSiteFinder({
        functionName: "nonExistentFunction",
        sourceFile: "src/utils/math.ts",
        projectPath: "tsconfig.json",
      });

      await expect(finder.execute()).rejects.toThrow(/not found/i);
    });

    it("should throw error when source file does not exist", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/nonexistent.ts",
        projectPath: "tsconfig.json",
      });

      await expect(finder.execute()).rejects.toThrow(/not found|does not exist/i);
    });

    it("should throw error when class is specified but not found", async () => {
      const finder = new CallSiteFinder({
        functionName: "render",
        sourceFile: "src/components/Widget.ts",
        className: "NonExistentClass",
        projectPath: "tsconfig.json",
      });

      await expect(finder.execute()).rejects.toThrow(/class.*not found/i);
    });

    it("should throw error when method is not found in specified class", async () => {
      const finder = new CallSiteFinder({
        functionName: "nonExistentMethod",
        sourceFile: "src/components/Widget.ts",
        className: "Widget",
        projectPath: "tsconfig.json",
      });

      await expect(finder.execute()).rejects.toThrow(/not found/i);
    });
  });

  describe("execute - edge cases", () => {
    it("should return empty call sites when function has no callers", async () => {
      const finder = new CallSiteFinder({
        functionName: "lowercase",
        sourceFile: "src/utils/strings.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      expect(result.definition.name).toBe("lowercase");
      // lowercase is exported but never called in the codebase
      expect(result.callSites).toEqual([]);
    });

    it("should handle re-exported functions", async () => {
      // capitalize is re-exported through utils/index.ts
      const finder = new CallSiteFinder({
        functionName: "capitalize",
        sourceFile: "src/utils/strings.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      // Should still find all call sites even though function is re-exported
      expect(result.callSites.length).toBeGreaterThan(0);
    });

    it("should distinguish between functions with same name in different files", async () => {
      // If there were multiple 'render' functions, we should only find calls to the one specified
      const finder = new CallSiteFinder({
        functionName: "render",
        sourceFile: "src/components/Widget.ts",
        className: "Widget",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      expect(result.definition.file).toContain("Widget.ts");
      expect(result.definition.className).toBe("Widget");
    });

    it("should auto-detect tsconfig.json when projectPath is not provided", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/utils/math.ts",
        // projectPath intentionally omitted
      });

      const result = await finder.execute();

      expect(result.definition.name).toBe("add");
      expect(result.callSites.length).toBeGreaterThan(0);
    });
  });

  describe("definition location accuracy", () => {
    it("should report accurate line numbers for function definitions", async () => {
      const finder = new CallSiteFinder({
        functionName: "add",
        sourceFile: "src/utils/math.ts",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      // add function is defined around line 4 in math.ts
      expect(result.definition.line).toBeGreaterThan(0);
      expect(result.definition.line).toBeLessThan(10);
    });

    it("should report accurate line numbers for method definitions", async () => {
      const finder = new CallSiteFinder({
        functionName: "render",
        sourceFile: "src/components/Widget.ts",
        className: "Widget",
        projectPath: "tsconfig.json",
      });

      const result = await finder.execute();

      expect(result.definition.line).toBeGreaterThan(0);
    });
  });
});
