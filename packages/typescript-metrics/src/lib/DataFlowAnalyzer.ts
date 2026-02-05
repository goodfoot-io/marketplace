import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import type { DataFlowMetrics, IgnoredReturn, OrphanRead, UnreadWrite, UnusedParameter } from "../types.js";

export interface DataFlowOptions {
  rootDir: string;
  files: string[];
}

interface FunctionInfo {
  name: string;
  file: string;
  line: number;
  node: ts.FunctionLikeDeclaration;
  parameters: ParameterInfo[];
  returnType: string;
  hasNonVoidReturn: boolean;
  isExported: boolean;
}

interface ParameterInfo {
  name: string;
  index: number;
  isOptional: boolean;
  hasDefault: boolean;
  isRest: boolean;
  isDestructured: boolean;
  destructuredProperties?: string[];
  defaultValue?: string;
}

interface CallSiteInfo {
  file: string;
  line: number;
  argumentCount: number;
  providedArguments: Set<number>;
  spreadUsed: boolean;
}

export class DataFlowAnalyzer {
  private rootDir: string;
  private program: ts.Program | null = null;
  private typeChecker: ts.TypeChecker | null = null;

  constructor(options: DataFlowOptions) {
    this.rootDir = options.rootDir;
  }

  analyze(files: string[]): DataFlowMetrics {
    // Create program for type checking
    const configPath = ts.findConfigFile(this.rootDir, ts.sys.fileExists, "tsconfig.json");
    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
      this.program = ts.createProgram(files, parsedConfig.options);
      this.typeChecker = this.program.getTypeChecker();
    }

    const unusedParameters: UnusedParameter[] = [];
    const ignoredReturns: IgnoredReturn[] = [];
    const unreadWrites: UnreadWrite[] = [];
    const orphanReads: OrphanRead[] = [];

    // First pass: collect all function declarations and their parameters
    const functionMap = new Map<string, FunctionInfo>();
    const callSites = new Map<string, CallSiteInfo[]>();

    for (const file of files) {
      if (!fs.existsSync(file)) continue;

      const content = fs.readFileSync(file, "utf-8");
      const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

      // Collect functions
      this.collectFunctions(sourceFile, file, functionMap);

      // Collect call sites
      this.collectCallSites(sourceFile, file, callSites);

      // Collect ignored returns
      this.collectIgnoredReturns(sourceFile, file, ignoredReturns);

      // Collect property writes and reads for data flow
      this.collectPropertyAccess(sourceFile, file, unreadWrites, orphanReads);
    }

    // Analyze unused parameters by matching functions to call sites
    this.analyzeUnusedParameters(functionMap, callSites, unusedParameters);

    return {
      unusedParameters: this.filterHighConfidence(unusedParameters),
      ignoredReturns: ignoredReturns.slice(0, 50), // Limit output
      unreadWrites: unreadWrites.slice(0, 30),
      orphanReads: orphanReads.slice(0, 30),
    };
  }

  private collectFunctions(sourceFile: ts.SourceFile, file: string, functionMap: Map<string, FunctionInfo>): void {
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const info = this.extractFunctionInfo(node, file, sourceFile);
        if (info && this.hasInterestingParameters(info)) {
          functionMap.set(this.getFunctionKey(file, info.name), info);
        }
      } else if (ts.isMethodDeclaration(node) && node.name) {
        const info = this.extractFunctionInfo(node, file, sourceFile);
        if (info && this.hasInterestingParameters(info)) {
          const className = this.getEnclosingClassName(node);
          const key = className ? `${file}#${className}.${info.name}` : `${file}#${info.name}`;
          functionMap.set(key, info);
        }
      } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        const parent = node.parent;
        let name: string | undefined;

        if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
          name = parent.name.text;
        } else if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
          name = parent.name.text;
        }

        if (name) {
          const info = this.extractFunctionInfo(node, file, sourceFile, name);
          if (info && this.hasInterestingParameters(info)) {
            functionMap.set(this.getFunctionKey(file, name), info);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private extractFunctionInfo(
    node: ts.FunctionLikeDeclaration,
    file: string,
    sourceFile: ts.SourceFile,
    overrideName?: string,
  ): FunctionInfo | null {
    let name = overrideName;
    if (!name) {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        name = node.name?.getText(sourceFile);
      }
    }
    if (!name) return null;

    const parameters: ParameterInfo[] = [];
    node.parameters.forEach((param, index) => {
      const paramInfo = this.extractParameterInfo(param, index, sourceFile);
      parameters.push(paramInfo);
    });

    const returnType = this.getReturnType(node, sourceFile);
    const hasNonVoidReturn = returnType !== "void" && returnType !== "undefined" && returnType !== "never";
    const isExported = this.isNodeExported(node);

    return {
      name,
      file,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      node,
      parameters,
      returnType,
      hasNonVoidReturn,
      isExported,
    };
  }

  private isNodeExported(node: ts.Node): boolean {
    // Check for export keyword on the node itself
    if (ts.canHaveModifiers(node)) {
      const modifiers = ts.getModifiers(node);
      if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        return true;
      }
    }

    // Check if it's a variable declaration inside an exported variable statement
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isVariableStatement(current)) {
        const modifiers = ts.getModifiers(current);
        if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          return true;
        }
      }
      current = current.parent;
    }

    return false;
  }

  private extractParameterInfo(
    param: ts.ParameterDeclaration,
    index: number,
    sourceFile: ts.SourceFile,
  ): ParameterInfo {
    const isDestructured = ts.isObjectBindingPattern(param.name) || ts.isArrayBindingPattern(param.name);
    let destructuredProperties: string[] | undefined;

    if (ts.isObjectBindingPattern(param.name)) {
      destructuredProperties = param.name.elements
        .filter((el): el is ts.BindingElement => ts.isBindingElement(el))
        .map((el) => {
          if (ts.isIdentifier(el.name)) {
            return el.name.text;
          }
          return el.name.getText(sourceFile);
        });
    }

    // Extract default value (truncated if too long)
    let defaultValue: string | undefined;
    if (param.initializer) {
      const initText = param.initializer.getText(sourceFile);
      defaultValue = initText.length > 30 ? initText.slice(0, 27) + "..." : initText;
    }

    return {
      name: isDestructured ? "(destructured)" : param.name.getText(sourceFile),
      index,
      isOptional: param.questionToken !== undefined,
      hasDefault: param.initializer !== undefined,
      isRest: param.dotDotDotToken !== undefined,
      isDestructured,
      destructuredProperties,
      defaultValue,
    };
  }

  private getReturnType(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string {
    if (node.type) {
      return node.type.getText(sourceFile);
    }

    // Try to infer from type checker - wrap in try/catch for safety
    if (this.typeChecker && this.program) {
      try {
        const programSourceFile = this.program.getSourceFile(sourceFile.fileName);
        if (programSourceFile) {
          const signature = this.typeChecker.getSignatureFromDeclaration(node);
          if (signature) {
            const returnType = this.typeChecker.getReturnTypeOfSignature(signature);
            return this.typeChecker.typeToString(returnType);
          }
        }
      } catch {
        // Type checker can fail on some AST nodes, fall through to unknown
      }
    }

    return "unknown";
  }

  private hasInterestingParameters(info: FunctionInfo): boolean {
    return info.parameters.some((p) => p.isOptional || p.hasDefault || p.isRest || p.isDestructured);
  }

  private getFunctionKey(file: string, name: string): string {
    return `${file}#${name}`;
  }

  private getEnclosingClassName(node: ts.Node): string | undefined {
    let parent = node.parent;
    while (parent) {
      if (ts.isClassDeclaration(parent) && parent.name) {
        return parent.name.text;
      }
      parent = parent.parent;
    }
    return undefined;
  }

  private collectCallSites(sourceFile: ts.SourceFile, file: string, callSites: Map<string, CallSiteInfo[]>): void {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        let functionName: string | undefined;

        if (ts.isIdentifier(callee)) {
          functionName = callee.text;
        } else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
          functionName = callee.name.text;
        }

        if (functionName) {
          const callInfo: CallSiteInfo = {
            file,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            argumentCount: node.arguments.length,
            providedArguments: new Set(node.arguments.map((_, i) => i)),
            spreadUsed: node.arguments.some((arg) => ts.isSpreadElement(arg)),
          };

          // Store by function name (we'll match across files)
          const key = functionName;
          const existing = callSites.get(key) || [];
          existing.push(callInfo);
          callSites.set(key, existing);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private analyzeUnusedParameters(
    functionMap: Map<string, FunctionInfo>,
    callSites: Map<string, CallSiteInfo[]>,
    results: UnusedParameter[],
  ): void {
    for (const [_key, funcInfo] of functionMap) {
      const calls = callSites.get(funcInfo.name) || [];

      // Skip if no call sites found (might be exported/external)
      if (calls.length === 0) continue;

      // Skip if any call uses spread (can't determine argument count)
      if (calls.some((c) => c.spreadUsed)) continue;

      for (const param of funcInfo.parameters) {
        if (!param.isOptional && !param.hasDefault && !param.isRest) continue;

        // Count how many call sites provide this parameter
        const providingCount = calls.filter((c) => c.argumentCount > param.index).length;

        if (providingCount === 0) {
          let paramType: UnusedParameter["parameterType"] = "optional";
          if (param.hasDefault) paramType = "default";
          if (param.isRest) paramType = "rest";
          if (param.isDestructured) paramType = "destructured";

          // Get sample call sites (up to 2)
          const sampleCallSites = calls.slice(0, 2).map((c) => `${path.relative(this.rootDir, c.file)}:${c.line}`);

          results.push({
            file: funcInfo.file,
            line: funcInfo.line,
            functionName: funcInfo.name,
            parameterName: param.name,
            parameterType: paramType,
            totalCallSites: calls.length,
            callSitesProviding: providingCount,
            defaultValue: param.defaultValue,
            isExported: funcInfo.isExported,
            sampleCallSites,
          });
        }
      }
    }
  }

  private collectIgnoredReturns(sourceFile: ts.SourceFile, file: string, results: IgnoredReturn[]): void {
    const visit = (node: ts.Node): void => {
      // Look for expression statements that are call expressions
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
        const call = node.expression;
        let functionName = "<anonymous>";

        if (ts.isIdentifier(call.expression)) {
          functionName = call.expression.text;
        } else if (ts.isPropertyAccessExpression(call.expression)) {
          functionName = call.expression.name.text;
        }

        // Skip common void-returning patterns
        if (this.isLikelyVoidFunction(functionName)) {
          ts.forEachChild(node, visit);
          return;
        }

        // Try to get return type from type checker
        let returnType = "unknown";
        let hasNonVoidReturn = false;

        if (this.typeChecker && this.program) {
          try {
            const programSourceFile = this.program.getSourceFile(file);
            if (programSourceFile) {
              // Re-parse to get the node in the program's AST
              const type = this.typeChecker.getTypeAtLocation(call);
              returnType = this.typeChecker.typeToString(type);
              hasNonVoidReturn =
                returnType !== "void" && returnType !== "undefined" && returnType !== "never" && returnType !== "any";
            }
          } catch {
            // Type checker can fail on some AST nodes, fall through to pattern matching
          }
        }

        // Only report if we're confident it has a meaningful return
        if (hasNonVoidReturn || this.isLikelyReturningFunction(functionName)) {
          results.push({
            file,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            functionName,
            returnType,
            confidence: hasNonVoidReturn ? "high" : "medium",
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private isLikelyVoidFunction(name: string): boolean {
    const voidPatterns = [
      /^set[A-Z]/, // setters
      /^add[A-Z]/, // add methods
      /^remove[A-Z]/, // remove methods
      /^clear/, // clear methods
      /^reset/, // reset methods
      /^init/, // init methods
      /^dispose/, // dispose methods
      /^destroy/, // destroy methods
      /^close/, // close methods
      /^log/, // logging
      /^console\./, // console methods
      /^print/, // print methods
      /^emit/, // event emitters
      /^dispatch/, // dispatchers
      /^fire/, // fire events
      /^trigger/, // trigger events
      /^notify/, // notifications
      /^subscribe/, // subscriptions often return void
      /^unsubscribe/, // unsubscribe
      /^on[A-Z]/, // event handlers
      /^handle[A-Z]/, // handlers
      /^process[A-Z]/, // processors
      /^update[A-Z]/, // update methods
      /^render/, // render methods
      /^mount/, // mount methods
      /^unmount/, // unmount methods
      /^push$/, // array push
      /^pop$/, // array pop (technically returns)
      /^shift$/, // array shift
      /^unshift$/, // array unshift
      /^splice$/, // array splice
      /^forEach$/, // forEach
      /^assign$/, // Object.assign used for side effects
    ];

    return voidPatterns.some((p) => p.test(name));
  }

  private isLikelyReturningFunction(name: string): boolean {
    const returningPatterns = [
      /^get[A-Z]/, // getters
      /^find[A-Z]/, // find methods
      /^create[A-Z]/, // create methods
      /^build[A-Z]/, // build methods
      /^make[A-Z]/, // make methods
      /^parse[A-Z]/, // parse methods
      /^compute[A-Z]/, // compute methods
      /^calculate[A-Z]/, // calculate methods
      /^generate[A-Z]/, // generate methods
      /^fetch[A-Z]/, // fetch methods
      /^load[A-Z]/, // load methods
      /^read[A-Z]/, // read methods
      /^extract[A-Z]/, // extract methods
      /^transform[A-Z]/, // transform methods
      /^convert[A-Z]/, // convert methods
      /^to[A-Z]/, // to* conversions
      /^from[A-Z]/, // from* conversions
      /^clone/, // clone methods
      /^copy/, // copy methods
      /^slice$/, // slice returns new array
      /^map$/, // map returns new array
      /^filter$/, // filter returns new array
      /^reduce$/, // reduce returns value
      /^concat$/, // concat returns new array
      /^join$/, // join returns string
      /^split$/, // split returns array
    ];

    return returningPatterns.some((p) => p.test(name));
  }

  private collectPropertyAccess(
    sourceFile: ts.SourceFile,
    file: string,
    unreadWrites: UnreadWrite[],
    orphanReads: OrphanRead[],
  ): void {
    // Track writes and reads within this file
    const writes = new Map<string, { line: number; context: string }[]>();
    const reads = new Map<string, { line: number; context: string }[]>();

    const visit = (node: ts.Node): void => {
      // Track property writes: this.prop = value or obj.prop = value
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left)
      ) {
        const propAccess = node.left;
        const propName = propAccess.name.text;
        const objectText = propAccess.expression.getText(sourceFile);

        // Only track this.* writes for now (most reliable)
        if (objectText === "this") {
          const existing = writes.get(propName) || [];
          existing.push({
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            context: `this.${propName} = ...`,
          });
          writes.set(propName, existing);
        }
      }

      // Track property reads
      if (ts.isPropertyAccessExpression(node)) {
        const parent = node.parent;

        // Skip if this is the left side of an assignment
        if (
          ts.isBinaryExpression(parent) &&
          parent.left === node &&
          parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ) {
          ts.forEachChild(node, visit);
          return;
        }

        const propName = node.name.text;
        const objectText = node.expression.getText(sourceFile);

        if (objectText === "this") {
          const existing = reads.get(propName) || [];
          existing.push({
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            context: `this.${propName}`,
          });
          reads.set(propName, existing);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    // Find writes without reads (within this file - low confidence)
    for (const [propName, writeList] of writes) {
      if (!reads.has(propName)) {
        for (const write of writeList) {
          unreadWrites.push({
            file,
            line: write.line,
            propertyName: propName,
            writeContext: write.context,
            confidence: "low", // Low because reads might be in other files
          });
        }
      }
    }

    // Find reads without writes (within this file - low confidence)
    for (const [propName, readList] of reads) {
      // Skip common inherited properties
      if (this.isCommonProperty(propName)) continue;

      if (!writes.has(propName)) {
        // Only report first occurrence
        const read = readList[0];
        orphanReads.push({
          file,
          line: read.line,
          propertyName: propName,
          readContext: read.context,
          confidence: "low", // Low because writes might be in constructor, base class, etc.
        });
      }
    }
  }

  private isCommonProperty(name: string): boolean {
    const common = new Set([
      // Common inherited/built-in properties
      "length",
      "name",
      "prototype",
      "constructor",
      "toString",
      "valueOf",
      "hasOwnProperty",
      // Common framework properties
      "props",
      "state",
      "context",
      "refs",
      "children",
      // Common class properties often set in constructor
      "options",
      "config",
      "settings",
      "id",
      "type",
      "value",
      "data",
      "items",
      "list",
      "map",
      "set",
    ]);
    return common.has(name);
  }

  private filterHighConfidence(params: UnusedParameter[]): UnusedParameter[] {
    // Filter to parameters with enough call sites to be confident
    return params.filter((p) => p.totalCallSites >= 2);
  }
}
