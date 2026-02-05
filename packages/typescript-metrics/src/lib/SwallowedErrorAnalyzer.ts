import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import type {
  SwallowedErrorContext,
  SwallowedErrorFinding,
  SwallowedErrorMetrics,
  SwallowedErrorPattern,
} from "../types.js";

export interface SwallowedErrorOptions {
  rootDir: string;
  files: string[];
  /** Enable strict async detection (void promise) - disabled by default due to noise */
  strictAsync?: boolean;
  /** Exclude test files from analysis */
  excludeTestFiles?: boolean;
  /** Function name patterns to treat as intentionally optional */
  optionalFunctionPatterns?: RegExp[];
  /** Comment keywords that indicate intentional swallowing */
  intentionalKeywords?: string[];
  /** Function names to exclude from void-promise detection (telemetry, analytics, etc.) */
  fireAndForgetAllowlist?: RegExp[];
}

const DEFAULT_INTENTIONAL_KEYWORDS = [
  "intentional",
  "expected",
  "ignore",
  "optional",
  "fallback",
  "graceful",
  "best-effort",
  "fire-and-forget",
  "non-critical",
];

const DEFAULT_OPTIONAL_FUNCTION_PATTERNS = [/^try[A-Z]/, /^maybe[A-Z]/, /^attempt[A-Z]/, /^optional[A-Z]/];

const DEFAULT_FIRE_AND_FORGET_ALLOWLIST = [
  /^track/i,
  /^log/i,
  /^telemetry/i,
  /^analytics/i,
  /^metrics/i,
  /^warm/i,
  /^prefetch/i,
  /^preload/i,
  /^flush/i,
  /^report/i,
  /^emit/i,
  /^notify/i,
];

const LOGGING_PATTERNS = [
  /console\.(log|warn|error|info|debug)/,
  /logger\.(log|warn|error|info|debug)/,
  /log\.(log|warn|error|info|debug)/,
  /\.(log|warn|error|info|debug)\(/,
];

/**
 * Analyzes TypeScript code for swallowed error patterns.
 *
 * Detects patterns that hide errors from callers, developers, or operators:
 * - Empty catch blocks
 * - Catch blocks with only comments
 * - Catch blocks returning success values
 * - Catch blocks that only log without rethrowing
 * - Fire-and-forget async (void asyncOp())
 * - Empty .catch() handlers on promises
 * - Error parameters declared but unused
 */
export class SwallowedErrorAnalyzer {
  private rootDir: string;
  private options: SwallowedErrorOptions;
  private program: ts.Program | null = null;
  private typeChecker: ts.TypeChecker | null = null;

  constructor(options: SwallowedErrorOptions) {
    this.rootDir = options.rootDir;
    this.options = {
      strictAsync: false,
      excludeTestFiles: false,
      optionalFunctionPatterns: DEFAULT_OPTIONAL_FUNCTION_PATTERNS,
      intentionalKeywords: DEFAULT_INTENTIONAL_KEYWORDS,
      fireAndForgetAllowlist: DEFAULT_FIRE_AND_FORGET_ALLOWLIST,
      ...options,
    };
  }

  analyze(files: string[]): SwallowedErrorMetrics {
    // Try to create TypeScript program for type checking (optional but improves accuracy)
    const configPath = ts.findConfigFile(this.rootDir, ts.sys.fileExists, "tsconfig.json");
    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
      this.program = ts.createProgram(files, parsedConfig.options);
      this.typeChecker = this.program.getTypeChecker();
    }

    const findings: SwallowedErrorFinding[] = [];

    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      if (this.options.excludeTestFiles && this.isTestFile(file)) continue;

      const content = fs.readFileSync(file, "utf-8");
      const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

      this.analyzeSourceFile(sourceFile, file, findings);
    }

    return this.buildMetrics(findings);
  }

  private analyzeSourceFile(sourceFile: ts.SourceFile, file: string, findings: SwallowedErrorFinding[]): void {
    const visit = (node: ts.Node): void => {
      // Pattern 1: Empty catch blocks
      if (ts.isCatchClause(node)) {
        this.analyzeCatchClause(node, sourceFile, file, findings);
      }

      // Pattern 4 & 5: void asyncOp() and empty .catch()
      if (ts.isCallExpression(node)) {
        this.analyzeCallExpression(node, sourceFile, file, findings);
      }

      // Pattern 4: void expression wrapping a call
      if (ts.isVoidExpression(node)) {
        this.analyzeVoidExpression(node, sourceFile, file, findings);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Analyzes catch clauses for multiple swallowed error patterns:
   * - Empty catch blocks
   * - Comment-only catch blocks
   * - Catch returning success values
   * - Catch log-only (no rethrow)
   * - Error parameter unused
   */
  private analyzeCatchClause(
    catchClause: ts.CatchClause,
    sourceFile: ts.SourceFile,
    file: string,
    findings: SwallowedErrorFinding[],
  ): void {
    const block = catchClause.block;
    const statements = block.statements;
    const errorParam = catchClause.variableDeclaration;
    const context = this.buildContext(catchClause, sourceFile, file);
    const pos = sourceFile.getLineAndCharacterOfPosition(catchClause.getStart(sourceFile));

    // Pattern 1: Empty catch blocks
    if (statements.length === 0) {
      const hasComments = this.hasCommentTrivia(block, sourceFile);

      if (hasComments) {
        // Pattern 2: Comment-only catch
        findings.push({
          file,
          line: pos.line + 1,
          column: pos.character + 1,
          pattern: "comment-only-catch",
          confidence: this.adjustConfidence("high", context),
          context,
          codeSnippet: this.getCodeSnippet(catchClause, sourceFile),
          suggestion: "Add explicit error handling or rethrow. If intentional, consider logging the reason.",
        });
      } else {
        // Pattern 1: Truly empty catch
        findings.push({
          file,
          line: pos.line + 1,
          column: pos.character + 1,
          pattern: "empty-catch",
          confidence: this.adjustConfidence("high", context),
          context,
          codeSnippet: this.getCodeSnippet(catchClause, sourceFile),
          suggestion: "Handle the error explicitly, log it, or rethrow. Empty catch blocks hide failures.",
        });
      }
      return;
    }

    // Check for rethrow
    const hasRethrow = this.hasRethrow(block);

    // Pattern 3: Catch returning success values
    const successReturn = this.findSuccessReturn(block, sourceFile);
    if (successReturn && !hasRethrow) {
      findings.push({
        file,
        line: pos.line + 1,
        column: pos.character + 1,
        pattern: "catch-returns-success",
        confidence: this.adjustConfidence("medium", context),
        context,
        codeSnippet: this.getCodeSnippet(catchClause, sourceFile),
        suggestion: `Returning ${successReturn} masks the error. Consider returning an error indicator or rethrowing.`,
      });
      return;
    }

    // Pattern 4: Catch only logs (doesn't rethrow)
    const hasLogging = this.hasLogging(block, sourceFile);
    if (hasLogging && !hasRethrow && statements.length <= 2) {
      // Only flag if the catch block ONLY logs (1-2 statements, all logging-related)
      const allStatementsAreLogging = this.allStatementsAreLogging(block, sourceFile);
      if (allStatementsAreLogging) {
        findings.push({
          file,
          line: pos.line + 1,
          column: pos.character + 1,
          pattern: "catch-log-only",
          confidence: this.adjustConfidence("medium", context),
          context: { ...context, hasLoggingNearby: true },
          codeSnippet: this.getCodeSnippet(catchClause, sourceFile),
          suggestion: "Logging without rethrowing hides the error from callers. Consider rethrowing after logging.",
        });
        return;
      }
    }

    // Pattern 7: Error parameter declared but unused
    if (errorParam && !hasRethrow) {
      const errorParamName = errorParam.name.getText(sourceFile);
      const isErrorUsed = this.isIdentifierUsedInBlock(errorParamName, block, sourceFile);

      if (!isErrorUsed && errorParamName !== "_" && !errorParamName.startsWith("_")) {
        findings.push({
          file,
          line: pos.line + 1,
          column: pos.character + 1,
          pattern: "error-param-unused",
          confidence: this.adjustConfidence("medium", context),
          context,
          codeSnippet: this.getCodeSnippet(catchClause, sourceFile),
          suggestion: `Error parameter '${errorParamName}' is declared but never used. Log it or use '_' to indicate intentional discard.`,
        });
      }
    }
  }

  /**
   * Analyzes call expressions for:
   * - Empty .catch() handlers: promise.catch(() => {})
   */
  private analyzeCallExpression(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    file: string,
    findings: SwallowedErrorFinding[],
  ): void {
    // Pattern 6: Empty .catch() handlers
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "catch") {
      const args = node.arguments;
      if (args.length === 1) {
        const handler = args[0];

        // Check for empty arrow function: .catch(() => {})
        if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
          const body = handler.body;
          let isEmpty = false;

          if (ts.isBlock(body)) {
            isEmpty = body.statements.length === 0 && !this.hasCommentTrivia(body, sourceFile);
          }

          if (isEmpty) {
            const context = this.buildContext(node, sourceFile, file);
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

            findings.push({
              file,
              line: pos.line + 1,
              column: pos.character + 1,
              pattern: "empty-promise-catch",
              confidence: this.adjustConfidence("high", context),
              context,
              codeSnippet: this.getCodeSnippet(node, sourceFile),
              suggestion: "Empty .catch() handler silently discards promise rejections. Handle or log the error.",
            });
          }
        }
      }
    }
  }

  /**
   * Analyzes void expressions for fire-and-forget async patterns:
   * - void asyncOp()
   */
  private analyzeVoidExpression(
    node: ts.VoidExpression,
    sourceFile: ts.SourceFile,
    file: string,
    findings: SwallowedErrorFinding[],
  ): void {
    // Only analyze if strictAsync is enabled
    if (!this.options.strictAsync) return;

    const operand = node.expression;
    if (!ts.isCallExpression(operand)) return;

    // Get the function name being called
    const functionName = this.getCallExpressionName(operand, sourceFile);

    // Check allowlist
    if (this.isInFireAndForgetAllowlist(functionName)) return;

    // Try to verify it returns a Promise using type checker
    let isPromise = false;
    if (this.typeChecker) {
      const type = this.typeChecker.getTypeAtLocation(operand);
      const typeString = this.typeChecker.typeToString(type);
      isPromise = typeString.startsWith("Promise<") || typeString === "Promise";
    } else {
      // Without type checker, use heuristics (async function names, etc.)
      isPromise = this.looksLikeAsyncCall(operand, sourceFile);
    }

    if (!isPromise) return;

    const context = this.buildContext(node, sourceFile, file);
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

    findings.push({
      file,
      line: pos.line + 1,
      column: pos.character + 1,
      pattern: "void-promise",
      confidence: this.adjustConfidence("medium", context),
      context,
      codeSnippet: this.getCodeSnippet(node, sourceFile),
      suggestion: `'void ${functionName}()' silently discards promise rejections. Add .catch() or await with try/catch.`,
    });
  }

  // ============ Helper Methods ============

  private buildContext(node: ts.Node, sourceFile: ts.SourceFile, file: string): SwallowedErrorContext {
    const enclosingFunction = this.getEnclosingFunction(node);
    const functionName = enclosingFunction ? this.getFunctionName(enclosingFunction, sourceFile) : "";

    return {
      isTestFile: this.isTestFile(file),
      hasLoggingNearby: this.hasLoggingNearby(node, sourceFile),
      functionNameSuggestsOptional: this.matchesOptionalPattern(functionName),
      nearbyCommentKeywords: this.findNearbyIntentionalKeywords(node, sourceFile),
      isInFinallyBlock: this.isInFinallyBlock(node),
    };
  }

  private adjustConfidence(
    baseConfidence: "high" | "medium" | "low",
    context: SwallowedErrorContext,
  ): "high" | "medium" | "low" {
    // Factors that reduce confidence
    if (context.isTestFile) {
      return this.lowerConfidence(baseConfidence);
    }
    if (context.functionNameSuggestsOptional) {
      return this.lowerConfidence(baseConfidence);
    }
    if (context.nearbyCommentKeywords.length > 0) {
      return this.lowerConfidence(baseConfidence);
    }
    if (context.isInFinallyBlock) {
      return this.lowerConfidence(baseConfidence);
    }

    return baseConfidence;
  }

  private lowerConfidence(confidence: "high" | "medium" | "low"): "high" | "medium" | "low" {
    if (confidence === "high") return "medium";
    if (confidence === "medium") return "low";
    return "low";
  }

  private isTestFile(file: string): boolean {
    return (
      file.includes(".test.") ||
      file.includes(".spec.") ||
      file.includes("__tests__") ||
      file.includes("/test/") ||
      file.includes("/tests/")
    );
  }

  private hasCommentTrivia(block: ts.Block, sourceFile: ts.SourceFile): boolean {
    const fullText = sourceFile.getFullText();
    const start = block.getStart(sourceFile);
    const end = block.getEnd();

    // Check for leading comments in the block
    const leadingComments = ts.getLeadingCommentRanges(fullText, block.statements.pos);
    if (leadingComments && leadingComments.length > 0) {
      return true;
    }

    // Check for comments between braces
    const blockText = fullText.slice(start, end);
    return /\/\/|\/\*/.test(blockText);
  }

  private hasRethrow(block: ts.Block): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
      if (found) return;
      if (ts.isThrowStatement(node)) {
        found = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(block);
    return found;
  }

  private findSuccessReturn(block: ts.Block, sourceFile: ts.SourceFile): string | null {
    for (const stmt of block.statements) {
      if (ts.isReturnStatement(stmt) && stmt.expression) {
        const expr = stmt.expression;

        // Empty array: []
        if (ts.isArrayLiteralExpression(expr) && expr.elements.length === 0) {
          return "[]";
        }

        // Empty object: {}
        if (ts.isObjectLiteralExpression(expr) && expr.properties.length === 0) {
          return "{}";
        }

        // Literals: null, undefined, 0, false, ''
        if (expr.kind === ts.SyntaxKind.NullKeyword) return "null";
        if (expr.kind === ts.SyntaxKind.UndefinedKeyword) return "undefined";
        if (expr.kind === ts.SyntaxKind.FalseKeyword) return "false";
        if (ts.isNumericLiteral(expr) && expr.text === "0") return "0";
        if (ts.isStringLiteral(expr) && expr.text === "") return '""';

        // Check for resolve() calls with success values
        if (ts.isCallExpression(expr)) {
          const callName = this.getCallExpressionName(expr, sourceFile);
          if (callName === "resolve" && expr.arguments.length <= 1) {
            if (expr.arguments.length === 0) return "resolve()";
            const arg = expr.arguments[0];
            if (arg.kind === ts.SyntaxKind.NullKeyword) return "resolve(null)";
            if (ts.isArrayLiteralExpression(arg) && arg.elements.length === 0) return "resolve([])";
          }
        }
      }
    }
    return null;
  }

  private hasLogging(block: ts.Block, sourceFile: ts.SourceFile): boolean {
    const text = block.getText(sourceFile);
    return LOGGING_PATTERNS.some((pattern) => pattern.test(text));
  }

  private hasLoggingNearby(node: ts.Node, sourceFile: ts.SourceFile): boolean {
    // Check parent try statement for logging in try block
    let current: ts.Node | undefined = node;
    while (current) {
      if (ts.isTryStatement(current)) {
        const tryText = current.tryBlock.getText(sourceFile);
        if (LOGGING_PATTERNS.some((p) => p.test(tryText))) {
          return true;
        }
      }
      current = current.parent;
    }
    return false;
  }

  private allStatementsAreLogging(block: ts.Block, sourceFile: ts.SourceFile): boolean {
    for (const stmt of block.statements) {
      const text = stmt.getText(sourceFile);
      const isLogging = LOGGING_PATTERNS.some((p) => p.test(text));
      if (!isLogging) return false;
    }
    return true;
  }

  private isIdentifierUsedInBlock(name: string, block: ts.Block, sourceFile: ts.SourceFile): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
      if (found) return;
      if (ts.isIdentifier(node) && node.text === name) {
        // Check it's not the parameter declaration itself
        if (!ts.isVariableDeclaration(node.parent) && !ts.isParameter(node.parent)) {
          found = true;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(block);
    return found;
  }

  private getEnclosingFunction(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (
        ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current) ||
        ts.isMethodDeclaration(current)
      ) {
        return current;
      }
      current = current.parent;
    }
    return undefined;
  }

  private getFunctionName(fn: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string {
    if (ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) {
      return fn.name?.getText(sourceFile) ?? "";
    }
    if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
      const parent = fn.parent;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
      if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
    }
    return "";
  }

  private matchesOptionalPattern(name: string): boolean {
    if (!name) return false;
    return this.options.optionalFunctionPatterns!.some((p) => p.test(name));
  }

  private findNearbyIntentionalKeywords(node: ts.Node, sourceFile: ts.SourceFile): string[] {
    const keywords: string[] = [];
    const fullText = sourceFile.getFullText();

    // Get comments around the node
    const start = node.getStart(sourceFile);
    const leadingComments = ts.getLeadingCommentRanges(fullText, node.pos) ?? [];

    for (const comment of leadingComments) {
      const commentText = fullText.slice(comment.pos, comment.end).toLowerCase();
      for (const keyword of this.options.intentionalKeywords!) {
        if (commentText.includes(keyword.toLowerCase())) {
          keywords.push(keyword);
        }
      }
    }

    return [...new Set(keywords)];
  }

  private isInFinallyBlock(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      const parent: ts.Node | undefined = current.parent;
      if (parent && ts.isTryStatement(parent) && parent.finallyBlock === current) {
        return true;
      }
      current = parent;
    }
    return false;
  }

  private getCallExpressionName(call: ts.CallExpression, sourceFile: ts.SourceFile): string {
    const expr = call.expression;
    if (ts.isIdentifier(expr)) {
      return expr.text;
    }
    if (ts.isPropertyAccessExpression(expr)) {
      return expr.name.text;
    }
    return expr.getText(sourceFile);
  }

  private isInFireAndForgetAllowlist(name: string): boolean {
    if (!name) return false;
    return this.options.fireAndForgetAllowlist!.some((p) => p.test(name));
  }

  private looksLikeAsyncCall(call: ts.CallExpression, sourceFile: ts.SourceFile): boolean {
    const name = this.getCallExpressionName(call, sourceFile).toLowerCase();
    // Common async patterns
    return (
      name.includes("async") ||
      name.includes("fetch") ||
      name.includes("load") ||
      name.includes("save") ||
      name.includes("read") ||
      name.includes("write") ||
      name.includes("send") ||
      name.includes("request")
    );
  }

  private getCodeSnippet(node: ts.Node, sourceFile: ts.SourceFile): string {
    const text = node.getText(sourceFile);
    // Truncate long snippets
    if (text.length > 100) {
      return text.slice(0, 97) + "...";
    }
    return text;
  }

  private buildMetrics(findings: SwallowedErrorFinding[]): SwallowedErrorMetrics {
    const byPattern: Record<SwallowedErrorPattern, number> = {
      "empty-catch": 0,
      "comment-only-catch": 0,
      "catch-returns-success": 0,
      "catch-log-only": 0,
      "void-promise": 0,
      "empty-promise-catch": 0,
      "error-param-unused": 0,
    };

    const byConfidence: Record<"high" | "medium" | "low", number> = {
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const finding of findings) {
      byPattern[finding.pattern]++;
      byConfidence[finding.confidence]++;
    }

    return {
      findings,
      summary: {
        total: findings.length,
        byPattern,
        byConfidence,
        highConfidenceCount: byConfidence.high,
      },
    };
  }
}
