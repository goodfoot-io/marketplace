import { execSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BINARY_PATH = path.resolve(
  __dirname,
  "../../../plugins-claude/goodfoot/bin/print-type-analysis.mjs",
);
const FIXTURES_DIR = path.resolve(__dirname, "fixtures/type-analysis-project");

function runTypeAnalysis(args: string[], cwd: string = FIXTURES_DIR): string {
  return execSync(`node ${BINARY_PATH} ${args.join(" ")}`, {
    cwd,
    encoding: "utf-8",
  });
}

interface ParsedOutput {
  files: Array<{
    path: string;
    items: Array<{
      kind: string;
      name: string;
      line: number;
      exported?: boolean;
      extends?: string[];
      implements?: string[];
      properties?: string[];
      definition?: string;
      members?: string[];
      parameters?: string[];
      returnType?: string;
      complexity?: number;
    }>;
  }>;
  summary: {
    [key: string]: number;
  };
}

function parseYAMLOutput(output: string): ParsedOutput {
  const result: ParsedOutput = { files: [], summary: {} };
  const lines = output.split("\n");

  let currentFile: ParsedOutput["files"][0] | null = null;
  let currentItem: ParsedOutput["files"][0]["items"][0] | null = null;
  let currentArray: string[] | null = null;
  let currentArrayKey: string | null = null;
  let inSummary = false;

  for (const line of lines) {
    if (line.startsWith("files:")) {
      continue;
    }

    if (line.startsWith("summary:")) {
      inSummary = true;
      continue;
    }

    if (inSummary) {
      const summaryMatch = line.match(/^\s{2}(\w+):\s*(\d+)$/);
      if (summaryMatch) {
        result.summary[summaryMatch[1]] = parseInt(summaryMatch[2], 10);
      }
      continue;
    }

    // Parse file path
    const pathMatch = line.match(/^\s{2}- path:\s*(.+)$/);
    if (pathMatch) {
      if (currentItem && currentArray && currentArrayKey) {
        (currentItem as Record<string, unknown>)[currentArrayKey] = currentArray;
      }
      if (currentFile && currentItem) {
        currentFile.items.push(currentItem);
      }
      currentFile = { path: pathMatch[1], items: [] };
      result.files.push(currentFile);
      currentItem = null;
      currentArray = null;
      currentArrayKey = null;
      continue;
    }

    if (line.match(/^\s{4}items:$/)) {
      continue;
    }

    // Parse item start with kind
    const kindMatch = line.match(/^\s{6}- kind:\s*(.+)$/);
    if (kindMatch) {
      if (currentItem && currentArray && currentArrayKey) {
        (currentItem as Record<string, unknown>)[currentArrayKey] = currentArray;
      }
      if (currentFile && currentItem) {
        currentFile.items.push(currentItem);
      }
      currentItem = { kind: kindMatch[1], name: "", line: 0 };
      currentArray = null;
      currentArrayKey = null;
      continue;
    }

    if (!currentItem) continue;

    // Parse scalar properties
    const nameMatch = line.match(/^\s{8}name:\s*(.+)$/);
    if (nameMatch) {
      currentItem.name = nameMatch[1];
      continue;
    }

    const lineMatch = line.match(/^\s{8}line:\s*(\d+)$/);
    if (lineMatch) {
      currentItem.line = parseInt(lineMatch[1], 10);
      continue;
    }

    const exportedMatch = line.match(/^\s{8}exported:\s*(true|false)$/);
    if (exportedMatch) {
      currentItem.exported = exportedMatch[1] === "true";
      continue;
    }

    const returnTypeMatch = line.match(/^\s{8}returnType:\s*(.+)$/);
    if (returnTypeMatch) {
      currentItem.returnType = returnTypeMatch[1];
      continue;
    }

    const complexityMatch = line.match(/^\s{8}complexity:\s*(\d+)$/);
    if (complexityMatch) {
      currentItem.complexity = parseInt(complexityMatch[1], 10);
      continue;
    }

    const definitionMatch = line.match(/^\s{8}definition:\s*(.+)$/);
    if (definitionMatch) {
      currentItem.definition = definitionMatch[1];
      continue;
    }

    // Parse array headers
    if (line.match(/^\s{8}extends:$/)) {
      if (currentArray && currentArrayKey) {
        (currentItem as Record<string, unknown>)[currentArrayKey] = currentArray;
      }
      currentArray = [];
      currentArrayKey = "extends";
      continue;
    }

    if (line.match(/^\s{8}implements:$/)) {
      if (currentArray && currentArrayKey) {
        (currentItem as Record<string, unknown>)[currentArrayKey] = currentArray;
      }
      currentArray = [];
      currentArrayKey = "implements";
      continue;
    }

    if (line.match(/^\s{8}properties:$/)) {
      if (currentArray && currentArrayKey) {
        (currentItem as Record<string, unknown>)[currentArrayKey] = currentArray;
      }
      currentArray = [];
      currentArrayKey = "properties";
      continue;
    }

    if (line.match(/^\s{8}members:$/)) {
      if (currentArray && currentArrayKey) {
        (currentItem as Record<string, unknown>)[currentArrayKey] = currentArray;
      }
      currentArray = [];
      currentArrayKey = "members";
      continue;
    }

    if (line.match(/^\s{8}parameters:$/)) {
      if (currentArray && currentArrayKey) {
        (currentItem as Record<string, unknown>)[currentArrayKey] = currentArray;
      }
      currentArray = [];
      currentArrayKey = "parameters";
      continue;
    }

    // Parse array items
    const arrayItemMatch = line.match(/^\s{10}- (.+)$/);
    if (arrayItemMatch && currentArray) {
      currentArray.push(arrayItemMatch[1]);
    }
  }

  // Don't forget the last item
  if (currentItem && currentArray && currentArrayKey) {
    (currentItem as Record<string, unknown>)[currentArrayKey] = currentArray;
  }
  if (currentFile && currentItem) {
    currentFile.items.push(currentItem);
  }

  return result;
}

describe("TypeAnalyzer", () => {
  let typesOutput: ParsedOutput;
  let classesOutput: ParsedOutput;
  let functionsOutput: ParsedOutput;
  let allFilesOutput: ParsedOutput;

  beforeAll(() => {
    // Run analysis on individual files
    typesOutput = parseYAMLOutput(runTypeAnalysis(["src/types.ts"]));
    classesOutput = parseYAMLOutput(runTypeAnalysis(["src/classes.ts"]));
    functionsOutput = parseYAMLOutput(runTypeAnalysis(["src/functions.ts"]));
    allFilesOutput = parseYAMLOutput(runTypeAnalysis(["src/*.ts"]));
  });

  describe("interface analysis", () => {
    it("should find interfaces with their properties", () => {
      const userInterface = typesOutput.files[0]?.items.find(
        (item) => item.kind === "interface" && item.name === "User",
      );

      expect(userInterface).toBeDefined();
      expect(userInterface?.properties).toContain("id: number");
      expect(userInterface?.properties).toContain("name: string");
      expect(userInterface?.exported).toBe(true);
    });

    it("should detect extended interfaces", () => {
      const adminUserInterface = typesOutput.files[0]?.items.find(
        (item) => item.kind === "interface" && item.name === "AdminUser",
      );

      expect(adminUserInterface).toBeDefined();
      expect(adminUserInterface?.extends).toContain("User");
      expect(adminUserInterface?.properties).toContain("permissions: string[]");
    });

    it("should include optional properties in the property list", () => {
      const userInterface = typesOutput.files[0]?.items.find(
        (item) => item.kind === "interface" && item.name === "User",
      );

      expect(userInterface).toBeDefined();
      // Note: The TypeAnalyzer does not preserve the optional marker (?) in the output
      // The email property appears without the optional marker
      expect(userInterface?.properties).toContain("email: string");
    });
  });

  describe("type alias analysis", () => {
    it("should find type aliases", () => {
      const userRoleType = typesOutput.files[0]?.items.find((item) => item.kind === "type" && item.name === "UserRole");

      expect(userRoleType).toBeDefined();
      expect(userRoleType?.exported).toBe(true);
    });

    it("should capture the type definition", () => {
      const userRoleType = typesOutput.files[0]?.items.find((item) => item.kind === "type" && item.name === "UserRole");

      expect(userRoleType).toBeDefined();
      expect(userRoleType?.definition).toContain("admin");
      expect(userRoleType?.definition).toContain("user");
      expect(userRoleType?.definition).toContain("guest");
    });
  });

  describe("class analysis", () => {
    it("should find classes with members", () => {
      const buttonClass = classesOutput.files[0]?.items.find((item) => item.kind === "class" && item.name === "Button");

      expect(buttonClass).toBeDefined();
      expect(buttonClass?.members).toBeDefined();
      expect(buttonClass?.members?.length).toBeGreaterThan(0);
    });

    it("should detect inheritance (extends)", () => {
      const buttonClass = classesOutput.files[0]?.items.find((item) => item.kind === "class" && item.name === "Button");

      expect(buttonClass).toBeDefined();
      expect(buttonClass?.extends).toContain("BaseComponent");
    });

    it("should identify visibility modifiers", () => {
      const buttonClass = classesOutput.files[0]?.items.find((item) => item.kind === "class" && item.name === "Button");

      expect(buttonClass).toBeDefined();
      // Check for private label property
      const hasPrivateLabel = buttonClass?.members?.some((m) => m.includes("private") && m.includes("label"));
      expect(hasPrivateLabel).toBe(true);
    });

    it("should find abstract classes", () => {
      const baseComponentClass = classesOutput.files[0]?.items.find(
        (item) => item.kind === "class" && item.name === "BaseComponent",
      );

      expect(baseComponentClass).toBeDefined();
      expect(baseComponentClass?.exported).toBe(true);
    });

    it("should identify protected members", () => {
      const baseComponentClass = classesOutput.files[0]?.items.find(
        (item) => item.kind === "class" && item.name === "BaseComponent",
      );

      expect(baseComponentClass).toBeDefined();
      const hasProtectedName = baseComponentClass?.members?.some((m) => m.includes("protected") && m.includes("name"));
      expect(hasProtectedName).toBe(true);
    });
  });

  describe("function analysis", () => {
    it("should find functions with parameters and return types", () => {
      const addFunction = functionsOutput.files[0]?.items.find(
        (item) => item.kind === "function" && item.name === "add",
      );

      expect(addFunction).toBeDefined();
      expect(addFunction?.parameters).toContain("a: number");
      expect(addFunction?.parameters).toContain("b: number");
      expect(addFunction?.returnType).toBe("number");
    });

    it("should calculate cyclomatic complexity", () => {
      const processItemsFunction = functionsOutput.files[0]?.items.find(
        (item) => item.kind === "function" && item.name === "processItems",
      );

      expect(processItemsFunction).toBeDefined();
      // processItems has: base (1) + for loop (1) + if statement (1) = 3
      expect(processItemsFunction?.complexity).toBeGreaterThanOrEqual(3);
    });

    it("should identify exported functions", () => {
      const addFunction = functionsOutput.files[0]?.items.find(
        (item) => item.kind === "function" && item.name === "add",
      );

      expect(addFunction).toBeDefined();
      expect(addFunction?.exported).toBe(true);
    });

    it("should have complexity of 1 for simple functions", () => {
      const addFunction = functionsOutput.files[0]?.items.find(
        (item) => item.kind === "function" && item.name === "add",
      );

      expect(addFunction).toBeDefined();
      expect(addFunction?.complexity).toBe(1);
    });
  });

  describe("enum analysis", () => {
    it("should find enums with their members", () => {
      const statusEnum = functionsOutput.files[0]?.items.find((item) => item.kind === "enum" && item.name === "Status");

      expect(statusEnum).toBeDefined();
      expect(statusEnum?.members).toBeDefined();
      expect(statusEnum?.members).toContain('Active = "active"');
      expect(statusEnum?.members).toContain('Inactive = "inactive"');
      expect(statusEnum?.members).toContain('Pending = "pending"');
    });

    it("should identify exported enums", () => {
      const statusEnum = functionsOutput.files[0]?.items.find((item) => item.kind === "enum" && item.name === "Status");

      expect(statusEnum).toBeDefined();
      expect(statusEnum?.exported).toBe(true);
    });
  });

  describe("glob patterns", () => {
    it("should handle glob patterns like src/*.ts", () => {
      expect(allFilesOutput.files.length).toBe(3);
    });

    it("should find items from all matched files", () => {
      // Should have items from types.ts, classes.ts, and functions.ts
      const hasInterfaces = allFilesOutput.files.some((f) => f.items.some((i) => i.kind === "interface"));
      const hasClasses = allFilesOutput.files.some((f) => f.items.some((i) => i.kind === "class"));
      const hasFunctions = allFilesOutput.files.some((f) => f.items.some((i) => i.kind === "function"));
      const hasEnums = allFilesOutput.files.some((f) => f.items.some((i) => i.kind === "enum"));

      expect(hasInterfaces).toBe(true);
      expect(hasClasses).toBe(true);
      expect(hasFunctions).toBe(true);
      expect(hasEnums).toBe(true);
    });

    it("should handle multiple file arguments", () => {
      const output = parseYAMLOutput(runTypeAnalysis(["src/types.ts", "src/classes.ts"]));

      expect(output.files.length).toBe(2);
    });
  });

  describe("summary output", () => {
    it("should include summary counts", () => {
      expect(allFilesOutput.summary).toBeDefined();
      expect(allFilesOutput.summary.total).toBeGreaterThan(0);
    });

    it("should count interfaces correctly", () => {
      expect(allFilesOutput.summary.interfaces).toBe(2); // User, AdminUser
    });

    it("should count types correctly", () => {
      expect(allFilesOutput.summary.types).toBe(1); // UserRole
    });

    it("should count classes correctly", () => {
      expect(allFilesOutput.summary.classs).toBe(2); // BaseComponent, Button
    });

    it("should count enums correctly", () => {
      expect(allFilesOutput.summary.enums).toBe(1); // Status
    });
  });

  describe("edge cases", () => {
    it("should handle non-existent glob patterns gracefully", () => {
      // Non-matching glob should not throw, but return empty results
      const output = runTypeAnalysis(["src/nonexistent/*.ts"]);
      expect(output).toContain("files:");
      expect(output).toContain("summary:");
    });

    it("should exit with error for non-existent literal files", () => {
      expect(() => {
        runTypeAnalysis(["nonexistent.ts"]);
      }).toThrow();
    });
  });

  describe("method analysis within classes", () => {
    it("should find methods within classes", () => {
      // Methods are analyzed separately from classes
      const renderMethod = classesOutput.files[0]?.items.find(
        (item) => item.kind === "method" && item.name === "render",
      );

      expect(renderMethod).toBeDefined();
    });

    it("should analyze method parameters and return types", () => {
      const onClickMethod = classesOutput.files[0]?.items.find(
        (item) => item.kind === "method" && item.name === "onClick",
      );

      expect(onClickMethod).toBeDefined();
      expect(onClickMethod?.parameters).toBeDefined();
      expect(onClickMethod?.returnType).toBe("void");
    });

    it("should calculate complexity for methods", () => {
      const getNameMethod = classesOutput.files[0]?.items.find(
        (item) => item.kind === "method" && item.name === "getName",
      );

      expect(getNameMethod).toBeDefined();
      expect(getNameMethod?.complexity).toBe(1);
    });
  });
});
