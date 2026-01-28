import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getPackages } from "@manypkg/get-packages";
import { glob } from "glob";
import * as ts from "typescript";

/**
 * Represents a location in a source file where a function/method is called
 */
export interface CallSite {
  /** Absolute path to the file containing the call */
  file: string;
  /** 1-based line number of the call */
  line: number;
  /** 1-based column number of the call */
  column: number;
  /** The expression used to call the function (e.g., "foo()", "obj.method()") */
  callExpression: string;
  /** The context around the call (the full statement or line) */
  context: string;
}

/**
 * Represents the definition of a function or method
 */
export interface FunctionDefinition {
  /** Name of the function or method */
  name: string;
  /** Absolute path to the file containing the definition */
  file: string;
  /** 1-based line number of the definition */
  line: number;
  /** Whether this is a method (true) or standalone function (false) */
  isMethod: boolean;
  /** If a method, the name of the containing class */
  className?: string;
  /** The TypeScript symbol for accurate reference tracking */
  symbol: ts.Symbol;
}

/**
 * Options for the CallSiteFinder
 */
export interface CallSiteFinderOptions {
  /** Name of the function or method to find call sites for */
  functionName: string;
  /** Path to the source file containing the function definition */
  sourceFile: string;
  /** Optional: class name if looking for a method */
  className?: string;
  /** Optional: path to tsconfig.json (auto-detected if not provided) */
  projectPath?: string;
  /** Optional: glob patterns to limit the search scope */
  searchGlobs?: string[];
}

/**
 * Result of finding call sites
 */
export interface CallSiteFinderResult {
  /** The function definition that was found */
  definition: Omit<FunctionDefinition, "symbol">;
  /** All call sites found */
  callSites: CallSite[];
}

/**
 * Finds all call sites of a function or method across a TypeScript codebase
 */
export class CallSiteFinder {
  private functionName: string;
  private sourceFile: string;
  private className?: string;
  private projectPath?: string;
  private searchGlobs?: string[];

  constructor(options: CallSiteFinderOptions) {
    this.functionName = options.functionName;
    this.sourceFile = options.sourceFile;
    this.className = options.className;
    this.projectPath = options.projectPath;
    this.searchGlobs = options.searchGlobs;
  }

  /**
   * Find the function/method definition in the source file
   */
  findFunctionDefinition(program: ts.Program, checker: ts.TypeChecker): FunctionDefinition | null {
    const cwd = process.cwd();
    const absoluteSourceFile = path.isAbsolute(this.sourceFile)
      ? this.sourceFile
      : path.resolve(cwd, this.sourceFile);

    const sourceFile = program.getSourceFile(absoluteSourceFile);
    if (!sourceFile) {
      return null;
    }

    let foundDefinition: FunctionDefinition | null = null;

    const visit = (node: ts.Node): void => {
      if (foundDefinition) return;

      // Looking for a method in a specific class
      if (this.className) {
        if (ts.isClassDeclaration(node) && node.name?.text === this.className) {
          for (const member of node.members) {
            if (ts.isMethodDeclaration(member) && member.name) {
              const memberName = ts.isIdentifier(member.name) ? member.name.text : member.name.getText(sourceFile);
              if (memberName === this.functionName) {
                const symbol = checker.getSymbolAtLocation(member.name);
                if (symbol) {
                  const { line } = sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile));
                  foundDefinition = {
                    name: this.functionName,
                    file: absoluteSourceFile,
                    line: line + 1,
                    isMethod: true,
                    className: this.className,
                    symbol,
                  };
                  return;
                }
              }
            }
          }
        }
      } else {
        // Looking for a standalone function
        if (ts.isFunctionDeclaration(node) && node.name?.text === this.functionName) {
          const symbol = checker.getSymbolAtLocation(node.name);
          if (symbol) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            foundDefinition = {
              name: this.functionName,
              file: absoluteSourceFile,
              line: line + 1,
              isMethod: false,
              symbol,
            };
            return;
          }
        }

        // Also check for arrow functions assigned to variables
        if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name) && decl.name.text === this.functionName) {
              if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
                const symbol = checker.getSymbolAtLocation(decl.name);
                if (symbol) {
                  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
                  foundDefinition = {
                    name: this.functionName,
                    file: absoluteSourceFile,
                    line: line + 1,
                    isMethod: false,
                    symbol,
                  };
                  return;
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return foundDefinition;
  }

  /**
   * Build the list of files to search for call sites
   */
  async buildSearchScope(configFileName: string): Promise<string[]> {
    const configDir = path.dirname(configFileName);

    // If search globs are provided, use them
    if (this.searchGlobs && this.searchGlobs.length > 0) {
      const files = await glob(this.searchGlobs, {
        cwd: process.cwd(),
        absolute: true,
        nodir: true,
        ignore: ["**/node_modules/**", "**/*.d.ts"],
      });
      return files;
    }

    // Otherwise, parse tsconfig.json to get the project files
    const configFile = ts.readConfigFile(configFileName, (filePath) => ts.sys.readFile(filePath));
    if (configFile.error) {
      throw new Error(
        `Error reading tsconfig.json: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`,
      );
    }

    const parsedCommandLine = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      configDir,
    );

    if (parsedCommandLine.errors.length > 0) {
      throw new Error(
        `Error parsing tsconfig.json: ${ts.flattenDiagnosticMessageText(parsedCommandLine.errors[0].messageText, "\n")}`,
      );
    }

    const rawConfig = parsedCommandLine.raw as { include?: string[]; exclude?: string[] } | undefined;
    const includePatterns: string[] = rawConfig?.include || ["**/*.ts", "**/*.tsx"];
    const excludePatterns: string[] = rawConfig?.exclude || ["node_modules", "**/*.d.ts"];

    const files = await glob(includePatterns, {
      cwd: configDir,
      absolute: true,
      nodir: true,
      ignore: excludePatterns,
    });

    return files;
  }

  /**
   * Find all call sites of the target function/method
   */
  findCallSites(program: ts.Program, checker: ts.TypeChecker, definition: FunctionDefinition, searchScope?: Set<string>): CallSite[] {
    const callSites: CallSite[] = [];
    const targetSymbol = definition.symbol;

    // Get the aliased symbol if this is an alias (e.g., from export)
    const resolvedSymbol = targetSymbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(targetSymbol)
      : targetSymbol;

    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;
      if (sourceFile.fileName.includes("node_modules")) continue;

      // If a search scope is defined, only search files in that scope
      if (searchScope && !searchScope.has(sourceFile.fileName)) continue;

      const visit = (node: ts.Node): void => {
        // Check for call expressions
        if (ts.isCallExpression(node)) {
          const callee = node.expression;
          let calledSymbol: ts.Symbol | undefined;

          // Direct function call: foo()
          if (ts.isIdentifier(callee)) {
            calledSymbol = checker.getSymbolAtLocation(callee);
          }
          // Method call: obj.method() or namespace.func()
          else if (ts.isPropertyAccessExpression(callee)) {
            calledSymbol = checker.getSymbolAtLocation(callee.name);
          }

          if (calledSymbol) {
            // Resolve alias if needed
            const resolvedCalledSymbol = calledSymbol.flags & ts.SymbolFlags.Alias
              ? checker.getAliasedSymbol(calledSymbol)
              : calledSymbol;

            if (resolvedCalledSymbol === resolvedSymbol) {
              const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

              // Get the context (the full line)
              const lineStart = sourceFile.getLineStarts()[line];
              const lineEnd = line + 1 < sourceFile.getLineStarts().length
                ? sourceFile.getLineStarts()[line + 1]
                : sourceFile.text.length;
              const context = sourceFile.text.substring(lineStart, lineEnd).trimEnd();

              callSites.push({
                file: sourceFile.fileName,
                line: line + 1,
                column: character + 1,
                callExpression: node.getText(sourceFile),
                context,
              });
            }
          }
        }

        // Check for function references (passed as callbacks)
        // e.g., arr.map(capitalize)
        if (ts.isIdentifier(node) && !ts.isCallExpression(node.parent)) {
          // Don't count the definition itself
          if (node.getSourceFile().fileName === definition.file) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            if (line + 1 === definition.line) {
              ts.forEachChild(node, visit);
              return;
            }
          }

          // Check if this is a function reference being passed somewhere
          const parent = node.parent;
          const isArgument = ts.isCallExpression(parent) && parent.arguments.includes(node);
          const isPropertyValue = ts.isPropertyAssignment(parent) && parent.initializer === node;
          const isArrayElement = ts.isArrayLiteralExpression(parent);
          const isArrowReturn = ts.isArrowFunction(parent) && parent.body === node;
          const isReturnStatement = ts.isReturnStatement(parent) && parent.expression === node;

          if (isArgument || isPropertyValue || isArrayElement || isArrowReturn || isReturnStatement) {
            const symbol = checker.getSymbolAtLocation(node);
            if (symbol) {
              const resolvedSym = symbol.flags & ts.SymbolFlags.Alias
                ? checker.getAliasedSymbol(symbol)
                : symbol;

              if (resolvedSym === resolvedSymbol) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

                const lineStart = sourceFile.getLineStarts()[line];
                const lineEnd = line + 1 < sourceFile.getLineStarts().length
                  ? sourceFile.getLineStarts()[line + 1]
                  : sourceFile.text.length;
                const context = sourceFile.text.substring(lineStart, lineEnd).trimEnd();

                callSites.push({
                  file: sourceFile.fileName,
                  line: line + 1,
                  column: character + 1,
                  callExpression: node.getText(sourceFile),
                  context,
                });
              }
            }
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    // Sort by file and line
    callSites.sort((a, b) => {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      if (a.line !== b.line) return a.line - b.line;
      return a.column - b.column;
    });

    return callSites;
  }

  /**
   * Find tsconfig.json for the project
   */
  async findTsConfig(): Promise<string> {
    const cwd = process.cwd();
    const absoluteSourceFile = path.isAbsolute(this.sourceFile)
      ? this.sourceFile
      : path.resolve(cwd, this.sourceFile);

    // If projectPath is provided, use it
    if (this.projectPath) {
      const absoluteProjectPath = path.isAbsolute(this.projectPath)
        ? this.projectPath
        : path.resolve(cwd, this.projectPath);

      if (ts.sys.fileExists(absoluteProjectPath)) {
        return absoluteProjectPath;
      }
      throw new Error(`tsconfig.json not found at: ${this.projectPath}`);
    }

    // Try to auto-detect from monorepo structure
    try {
      const { packages } = await getPackages(cwd);
      const containingPackage = packages.find((pkg) => absoluteSourceFile.startsWith(pkg.dir + path.sep));

      if (containingPackage) {
        const packageTsconfig = path.join(containingPackage.dir, "tsconfig.json");
        if (ts.sys.fileExists(packageTsconfig)) {
          return packageTsconfig;
        }
      }
    } catch {
      // Ignore auto-detection errors
    }

    // Try from current working directory
    let configFileName = ts.findConfigFile(cwd, (filePath) => ts.sys.fileExists(filePath), "tsconfig.json");

    // If not found, try from the directory containing the source file
    if (!configFileName) {
      const sourceDir = path.dirname(absoluteSourceFile);
      configFileName = ts.findConfigFile(sourceDir, (filePath) => ts.sys.fileExists(filePath), "tsconfig.json");
    }

    if (!configFileName) {
      throw new Error("Could not find tsconfig.json");
    }

    return configFileName;
  }

  /**
   * Create a TypeScript program from config
   */
  async createProgram(configFileName: string, additionalFiles?: string[]): Promise<ts.Program> {
    const configDir = path.dirname(configFileName);

    const configFile = ts.readConfigFile(configFileName, (filePath) => ts.sys.readFile(filePath));
    if (configFile.error) {
      throw new Error(
        `Error reading tsconfig.json: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`,
      );
    }

    const parsedCommandLine = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      configDir,
    );

    if (parsedCommandLine.errors.length > 0) {
      throw new Error(
        `Error parsing tsconfig.json: ${ts.flattenDiagnosticMessageText(parsedCommandLine.errors[0].messageText, "\n")}`,
      );
    }

    // Combine parsed files with additional files
    const allFiles = new Set([...parsedCommandLine.fileNames, ...(additionalFiles || [])]);

    return ts.createProgram(Array.from(allFiles), parsedCommandLine.options);
  }

  /**
   * Execute the call site finder
   */
  async execute(): Promise<CallSiteFinderResult> {
    const cwd = process.cwd();
    const absoluteSourceFile = path.isAbsolute(this.sourceFile)
      ? this.sourceFile
      : path.resolve(cwd, this.sourceFile);

    // Check if source file exists
    try {
      await fs.access(absoluteSourceFile);
    } catch {
      throw new Error(`Source file does not exist: ${this.sourceFile}`);
    }

    // Find tsconfig.json
    const configFileName = await this.findTsConfig();

    // Build search scope
    const searchFiles = await this.buildSearchScope(configFileName);

    // Create program with source file and search files
    const program = await this.createProgram(configFileName, [absoluteSourceFile, ...searchFiles]);
    const checker = program.getTypeChecker();

    // Find the function definition
    const definition = this.findFunctionDefinition(program, checker);
    if (!definition) {
      if (this.className) {
        // Check if class exists
        const sourceFileNode = program.getSourceFile(absoluteSourceFile);
        if (sourceFileNode) {
          let classFound = false;
          ts.forEachChild(sourceFileNode, (node) => {
            if (ts.isClassDeclaration(node) && node.name?.text === this.className) {
              classFound = true;
            }
          });
          if (!classFound) {
            throw new Error(`Class '${this.className}' not found in ${this.sourceFile}`);
          }
        }
        throw new Error(`Method '${this.functionName}' not found in class '${this.className}' in ${this.sourceFile}`);
      }
      throw new Error(`Function '${this.functionName}' not found in ${this.sourceFile}`);
    }

    // Find all call sites
    // If searchGlobs was provided, limit search to those files
    const searchScope = this.searchGlobs && this.searchGlobs.length > 0
      ? new Set(searchFiles)
      : undefined;
    const callSites = this.findCallSites(program, checker, definition, searchScope);

    // Return result without the symbol (not serializable)
    return {
      definition: {
        name: definition.name,
        file: definition.file,
        line: definition.line,
        isMethod: definition.isMethod,
        className: definition.className,
      },
      callSites,
    };
  }
}
