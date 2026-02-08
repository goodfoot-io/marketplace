import * as fs from "node:fs";
import * as ts from "typescript";
import type {
  ComplexityMetrics,
  ComplexityOptions,
  ComplexityPattern,
  FileComplexity,
  FunctionComplexity,
  LOCBreakdown,
} from "../types.js";

/**
 * Analyzes cyclomatic and cognitive complexity of TypeScript code.
 *
 * Cyclomatic Complexity: McCabe's complexity measure
 * - Base = 1
 * - +1 for each: if, else if, for, while, do, case, catch, &&, ||, ??, ?:
 *
 * Cognitive Complexity: SonarSource specification
 * - Structural increments (+1, no nesting): if, else if, else, switch, for, while, do, catch, ?:, &&, ||, ??
 * - Nesting penalty: applied to if, switch, for, while, do, catch, ternary (NOT else, NOT logical operators)
 * - Consecutive same logical operators count as +1 total (e.g., a && b && c = +1)
 */
export class ComplexityAnalyzer {
  private options: ComplexityOptions;

  constructor(options: ComplexityOptions) {
    this.options = options;
  }

  analyzeFile(filePath: string): FileComplexity {
    const content = fs.readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    const functions: FunctionComplexity[] = [];
    this.visitFunctions(sourceFile, sourceFile, filePath, functions);

    const loc = this.countLOC(filePath);
    const statementCount = this.countStatements(sourceFile);
    const commentDensity = this.calculateCommentDensity(loc);

    return {
      file: filePath,
      functions,
      loc,
      statementCount,
      commentDensity,
    };
  }

  /**
   * Recursively visits all function-like declarations in the AST.
   */
  private visitFunctions(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    filePath: string,
    functions: FunctionComplexity[],
  ): void {
    if (this.isFunctionLike(node)) {
      const fn = node as ts.FunctionLikeDeclaration;
      const name = this.getFunctionName(fn);
      const line = sourceFile.getLineAndCharacterOfPosition(fn.getStart()).line + 1;
      const endLine = sourceFile.getLineAndCharacterOfPosition(fn.getEnd()).line + 1;
      const cyclomatic = this.calculateCyclomaticComplexity(fn);
      const cognitive = this.calculateCognitiveComplexity(fn);

      // Only capture code snippet and pattern for hotspots (complex functions)
      const isHotspot = cyclomatic >= 10 || cognitive >= 15;
      const codeSnippet = isHotspot ? this.getCodeSnippet(fn, sourceFile) : undefined;
      const complexityPattern = isHotspot ? this.detectComplexityPattern(fn) : undefined;

      functions.push({
        name,
        file: filePath,
        line,
        endLine,
        cyclomatic,
        cognitive,
        codeSnippet,
        complexityPattern,
      });
    }

    ts.forEachChild(node, (child) => this.visitFunctions(child, sourceFile, filePath, functions));
  }

  private isFunctionLike(node: ts.Node): boolean {
    return (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessor(node) ||
      ts.isSetAccessor(node) ||
      ts.isConstructorDeclaration(node)
    );
  }

  private getFunctionName(fn: ts.FunctionLikeDeclaration): string {
    if (ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) {
      return fn.name?.getText() ?? "<anonymous>";
    }
    if (ts.isConstructorDeclaration(fn)) {
      return "constructor";
    }
    if (ts.isGetAccessor(fn)) {
      return `get ${fn.name?.getText() ?? "<anonymous>"}`;
    }
    if (ts.isSetAccessor(fn)) {
      return `set ${fn.name?.getText() ?? "<anonymous>"}`;
    }

    // For function expressions and arrow functions, try to get name from parent context
    const parent = fn.parent;

    // Variable declaration: const handler = () => {}
    if (ts.isVariableDeclaration(parent) && parent.name) {
      return parent.name.getText();
    }

    // Property assignment: { onClick: () => {} }
    if (ts.isPropertyAssignment(parent) && parent.name) {
      return parent.name.getText();
    }

    // Class property: class Foo { bar = () => {} }
    if (ts.isPropertyDeclaration(parent) && parent.name) {
      const className = this.getEnclosingClassName(parent);
      const propName = parent.name.getText();
      return className ? `${className}.${propName}` : propName;
    }

    // Call expression argument: app.get('/path', () => {})
    if (ts.isCallExpression(parent)) {
      const callName = this.getCallExpressionName(parent);
      if (callName) {
        const argIndex = parent.arguments.indexOf(fn as ts.Expression);
        return argIndex >= 0 ? `callback in ${callName}` : `callback in ${callName}`;
      }
    }

    // Try to find enclosing named function as fallback
    const enclosingName = this.getEnclosingFunctionName(fn);
    if (enclosingName) {
      return `<anonymous in ${enclosingName}>`;
    }

    return "<anonymous>";
  }

  private getEnclosingClassName(node: ts.Node): string | undefined {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
        return current.name?.getText();
      }
      current = current.parent;
    }
    return undefined;
  }

  private getCallExpressionName(call: ts.CallExpression): string | undefined {
    const expr = call.expression;
    if (ts.isIdentifier(expr)) {
      return expr.getText();
    }
    if (ts.isPropertyAccessExpression(expr)) {
      // Get the method name (e.g., "get" from "app.get")
      return expr.name.getText();
    }
    return undefined;
  }

  private getEnclosingFunctionName(node: ts.Node): string | undefined {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (this.isFunctionLike(current)) {
        const fn = current as ts.FunctionLikeDeclaration;
        // Only return if the enclosing function has a name
        if (ts.isFunctionDeclaration(fn) && fn.name) {
          return fn.name.getText();
        }
        if (ts.isMethodDeclaration(fn) && fn.name) {
          return fn.name.getText();
        }
        // Check if it's a named variable declaration
        if ((ts.isFunctionExpression(fn) || ts.isArrowFunction(fn)) && ts.isVariableDeclaration(fn.parent)) {
          const varDecl = fn.parent;
          if (varDecl.name && ts.isIdentifier(varDecl.name)) {
            return varDecl.name.getText();
          }
        }
      }
      current = current.parent;
    }
    return undefined;
  }

  /**
   * Calculates cyclomatic complexity (McCabe).
   * Base = 1, then +1 for each decision point.
   */
  calculateCyclomaticComplexity(fn: ts.FunctionLikeDeclaration): number {
    let complexity = 1; // Base complexity

    const visit = (node: ts.Node): void => {
      switch (node.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ConditionalExpression:
          complexity++;
          break;
        case ts.SyntaxKind.BinaryExpression: {
          const binaryExpr = node as ts.BinaryExpression;
          if (this.isLogicalOperator(binaryExpr.operatorToken.kind)) {
            complexity++;
          }
          break;
        }
      }
      ts.forEachChild(node, visit);
    };

    if (fn.body) {
      visit(fn.body);
    }

    return complexity;
  }

  /**
   * Checks if a token kind is a logical operator (&&, ||, ??)
   */
  private isLogicalOperator(kind: ts.SyntaxKind): boolean {
    return (
      kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      kind === ts.SyntaxKind.BarBarToken ||
      kind === ts.SyntaxKind.QuestionQuestionToken
    );
  }

  /**
   * Calculates cognitive complexity per SonarSource specification.
   *
   * Key rules:
   * 1. Structural increment (+1): if, else if, else, switch, for, while, do, catch, ?:, logical ops
   * 2. Nesting penalty: depth added for if, switch, for, while, do, catch, ternary (NOT else, NOT logical)
   * 3. Consecutive same logical operators count as +1 total
   */
  calculateCognitiveComplexity(fn: ts.FunctionLikeDeclaration): number {
    let complexity = 0;

    const visit = (node: ts.Node, depth: number): void => {
      switch (node.kind) {
        case ts.SyntaxKind.IfStatement: {
          const ifStmt = node as ts.IfStatement;
          // +1 structural + nesting penalty
          complexity += 1 + depth;

          // Visit condition (for logical operators)
          this.visitLogicalOperators(ifStmt.expression, (inc) => {
            complexity += inc;
          });

          // Visit then branch with increased depth
          if (ifStmt.thenStatement) {
            visit(ifStmt.thenStatement, depth + 1);
          }

          // Handle else / else if
          if (ifStmt.elseStatement) {
            if (ts.isIfStatement(ifStmt.elseStatement)) {
              // else if: +1 structural, NO nesting penalty, continue at same depth
              complexity += 1;
              // Visit else if condition for logical operators
              this.visitLogicalOperators(ifStmt.elseStatement.expression, (inc) => {
                complexity += inc;
              });
              // Visit else if then branch
              if (ifStmt.elseStatement.thenStatement) {
                visit(ifStmt.elseStatement.thenStatement, depth + 1);
              }
              // Continue with else if's else
              if (ifStmt.elseStatement.elseStatement) {
                this.visitElseChain(
                  ifStmt.elseStatement.elseStatement,
                  depth,
                  (inc) => {
                    complexity += inc;
                  },
                  visit,
                );
              }
            } else {
              // else: +1 structural, NO nesting penalty
              complexity += 1;
              visit(ifStmt.elseStatement, depth + 1);
            }
          }
          return; // Don't use default child visiting
        }

        case ts.SyntaxKind.SwitchStatement: {
          const switchStmt = node as ts.SwitchStatement;
          // +1 structural + nesting penalty
          complexity += 1 + depth;
          // Visit cases with increased depth
          ts.forEachChild(switchStmt.caseBlock, (child) => visit(child, depth + 1));
          return;
        }

        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement: {
          // +1 structural + nesting penalty
          complexity += 1 + depth;
          ts.forEachChild(node, (child) => visit(child, depth + 1));
          return;
        }

        case ts.SyntaxKind.CatchClause: {
          // +1 structural + nesting penalty
          complexity += 1 + depth;
          const catchClause = node as ts.CatchClause;
          visit(catchClause.block, depth + 1);
          return;
        }

        case ts.SyntaxKind.ConditionalExpression: {
          // Ternary: +1 structural + nesting penalty
          complexity += 1 + depth;
          const ternary = node as ts.ConditionalExpression;
          visit(ternary.condition, depth);
          visit(ternary.whenTrue, depth + 1);
          visit(ternary.whenFalse, depth + 1);
          return;
        }

        case ts.SyntaxKind.BinaryExpression: {
          const binaryExpr = node as ts.BinaryExpression;
          if (this.isLogicalOperator(binaryExpr.operatorToken.kind)) {
            // Only count if this is the root of a logical expression tree
            if (!this.isChildOfLogicalOperator(binaryExpr)) {
              complexity += this.countLogicalOperatorTypes(binaryExpr);
            }
            // Visit operands for non-logical expressions only
            this.visitNonLogicalChildren(binaryExpr, depth, visit);
            return;
          }
          break;
        }

        case ts.SyntaxKind.TryStatement: {
          // Try itself doesn't add complexity, but increases nesting for its contents
          const tryStmt = node as ts.TryStatement;
          // The try block contents are at increased nesting depth
          visit(tryStmt.tryBlock, depth + 1);
          if (tryStmt.catchClause) {
            // Catch clause itself gets the current depth (nesting penalty is added in CatchClause case)
            visit(tryStmt.catchClause, depth);
          }
          if (tryStmt.finallyBlock) {
            visit(tryStmt.finallyBlock, depth + 1);
          }
          return;
        }
      }

      // Default: visit children at same depth
      ts.forEachChild(node, (child) => visit(child, depth));
    };

    if (fn.body) {
      visit(fn.body, 0);
    }

    return complexity;
  }

  /**
   * Visits else chain for cognitive complexity.
   */
  private visitElseChain(
    elseStmt: ts.Statement,
    depth: number,
    addComplexity: (inc: number) => void,
    visit: (node: ts.Node, depth: number) => void,
  ): void {
    if (ts.isIfStatement(elseStmt)) {
      // else if: +1 structural, NO nesting penalty
      addComplexity(1);
      this.visitLogicalOperators(elseStmt.expression, addComplexity);
      if (elseStmt.thenStatement) {
        visit(elseStmt.thenStatement, depth + 1);
      }
      if (elseStmt.elseStatement) {
        this.visitElseChain(elseStmt.elseStatement, depth, addComplexity, visit);
      }
    } else {
      // else: +1 structural, NO nesting penalty
      addComplexity(1);
      visit(elseStmt, depth + 1);
    }
  }

  /**
   * Visits logical operators in an expression (for conditions in if statements, etc.)
   */
  private visitLogicalOperators(expr: ts.Expression, addComplexity: (inc: number) => void): void {
    const visit = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node) && this.isLogicalOperator(node.operatorToken.kind)) {
        // Only count if this is the root of a logical tree
        if (!this.isChildOfLogicalOperator(node)) {
          addComplexity(this.countLogicalOperatorTypes(node));
        }
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(expr);
  }

  /**
   * Checks if a binary expression is a child of another logical operator.
   */
  private isChildOfLogicalOperator(expr: ts.BinaryExpression): boolean {
    const parent = expr.parent;
    return ts.isBinaryExpression(parent) && this.isLogicalOperator(parent.operatorToken.kind);
  }

  /**
   * Counts unique logical operator types in a logical expression tree.
   * e.g., a && b && c = 1 (only &&), a && b || c = 2 (&& and ||)
   */
  private countLogicalOperatorTypes(expr: ts.BinaryExpression): number {
    const seenOps = new Set<ts.SyntaxKind>();

    const collectOps = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node) && this.isLogicalOperator(node.operatorToken.kind)) {
        seenOps.add(node.operatorToken.kind);
        collectOps(node.left);
        collectOps(node.right);
      }
    };

    collectOps(expr);
    return seenOps.size;
  }

  /**
   * Visits children of a logical expression that are not themselves logical operators.
   */
  private visitNonLogicalChildren(
    expr: ts.BinaryExpression,
    depth: number,
    visit: (node: ts.Node, depth: number) => void,
  ): void {
    const visitChild = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node) && this.isLogicalOperator(node.operatorToken.kind)) {
        visitChild(node.left);
        visitChild(node.right);
      } else {
        visit(node, depth);
      }
    };

    visitChild(expr.left);
    visitChild(expr.right);
  }

  /**
   * Counts lines of code in a file.
   */
  countLOC(filePath: string): LOCBreakdown {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    const total = lines.length;
    let blank = 0;
    let comment = 0;
    let code = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (inBlockComment) {
        comment++;
        if (trimmed.includes("*/")) {
          inBlockComment = false;
        }
        continue;
      }

      if (trimmed === "") {
        blank++;
      } else if (trimmed.startsWith("//")) {
        comment++;
      } else if (trimmed.startsWith("/*")) {
        comment++;
        if (!trimmed.includes("*/")) {
          inBlockComment = true;
        }
      } else {
        code++;
      }
    }

    return { total, code, blank, comment };
  }

  /**
   * Counts the number of statements in a source file.
   */
  countStatements(sourceFile: ts.SourceFile): number {
    let count = 0;

    const visit = (node: ts.Node): void => {
      if (ts.isStatement(node)) {
        count++;
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return count;
  }

  /**
   * Calculates comment density as comment lines / code lines.
   */
  calculateCommentDensity(loc: LOCBreakdown): number {
    if (loc.code === 0) {
      return 0;
    }
    return loc.comment / loc.code;
  }

  /**
   * Gets a code snippet for a function showing the signature and the most complex portion.
   * Shows 12-15 lines to provide meaningful context about why the function is complex.
   */
  private getCodeSnippet(fn: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string {
    const fullText = fn.getText(sourceFile);
    const lines = fullText.split("\n");

    // For short functions, show the entire thing
    if (lines.length <= 15) {
      return fullText;
    }

    // Find the deepest nesting location to show the most complex part
    const deepestLocation = this.findDeepestNestingLocation(fn, sourceFile);

    if (deepestLocation !== null) {
      // Show context around the deepest nesting
      const fnStartLine = sourceFile.getLineAndCharacterOfPosition(fn.getStart()).line;
      const deepestLineInFn = deepestLocation - fnStartLine;

      // Show 3 lines of signature/context, then skip to the complex part
      const signatureLines = lines.slice(0, 3);
      const contextStart = Math.max(3, deepestLineInFn - 4);
      const contextEnd = Math.min(lines.length, deepestLineInFn + 6);
      const complexLines = lines.slice(contextStart, contextEnd);

      if (contextStart > 3) {
        // There's a gap between signature and complex section
        const snippet = [...signatureLines, "    // ... (skipping to complex section)", ...complexLines];
        if (contextEnd < lines.length) {
          snippet.push("    // ...");
        }
        return this.truncateSnippet(snippet.join("\n"));
      }

      // No gap needed, just show from start to complex section
      const snippet = lines.slice(0, contextEnd);
      if (contextEnd < lines.length) {
        snippet.push("    // ...");
      }
      return this.truncateSnippet(snippet.join("\n"));
    }

    // Fallback: show first 12 lines
    const snippetLines = lines.slice(0, 12);
    if (lines.length > 12) {
      snippetLines.push("    // ...");
    }
    return this.truncateSnippet(snippetLines.join("\n"));
  }

  /**
   * Truncates a snippet if it exceeds the maximum length.
   */
  private truncateSnippet(snippet: string): string {
    const maxLength = 600;
    if (snippet.length > maxLength) {
      return `${snippet.slice(0, maxLength - 3)}...`;
    }
    return snippet;
  }

  /**
   * Finds the line number (0-based from source file start) with the deepest nesting.
   */
  private findDeepestNestingLocation(fn: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): number | null {
    let maxDepth = 0;
    let deepestLine: number | null = null;

    const visit = (node: ts.Node, depth: number): void => {
      let newDepth = depth;

      // These constructs increase nesting depth
      if (
        ts.isIfStatement(node) ||
        ts.isSwitchStatement(node) ||
        ts.isForStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node) ||
        ts.isTryStatement(node) ||
        ts.isCatchClause(node)
      ) {
        newDepth = depth + 1;
        if (newDepth > maxDepth) {
          maxDepth = newDepth;
          deepestLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        }
      }

      ts.forEachChild(node, (child) => visit(child, newDepth));
    };

    if (fn.body) {
      visit(fn.body, 0);
    }

    return deepestLine;
  }

  /**
   * Detects the primary complexity pattern in a function.
   */
  private detectComplexityPattern(fn: ts.FunctionLikeDeclaration): ComplexityPattern {
    let ifCount = 0;
    let switchCount = 0;
    let caseCount = 0;
    let loopCount = 0;
    let maxNestingDepth = 0;

    const visit = (node: ts.Node, depth: number): void => {
      let newDepth = depth;

      switch (node.kind) {
        case ts.SyntaxKind.IfStatement:
          ifCount++;
          newDepth = depth + 1;
          break;
        case ts.SyntaxKind.SwitchStatement:
          switchCount++;
          newDepth = depth + 1;
          break;
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.DefaultClause:
          caseCount++;
          break;
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
          loopCount++;
          newDepth = depth + 1;
          break;
      }

      maxNestingDepth = Math.max(maxNestingDepth, newDepth);
      ts.forEachChild(node, (child) => visit(child, newDepth));
    };

    if (fn.body) {
      visit(fn.body, 0);
    }

    // Determine the primary pattern
    if (switchCount > 0 && caseCount >= 5) {
      return "switch-heavy";
    }
    if (maxNestingDepth >= 3 && ifCount >= 3) {
      return "nested-conditionals";
    }
    if (loopCount >= 3) {
      return "loop-heavy";
    }
    if (ifCount >= 5 || caseCount >= 5) {
      return "many-branches";
    }
    if (ifCount >= 2 && loopCount >= 2) {
      return "mixed";
    }

    return "unknown";
  }

  /**
   * Analyzes all files and returns aggregated metrics.
   */
  analyze(): ComplexityMetrics {
    const files: FileComplexity[] = [];
    const allFunctions: FunctionComplexity[] = [];

    for (const filePath of this.options.files) {
      const fileResult = this.analyzeFile(filePath);
      files.push(fileResult);
      allFunctions.push(...fileResult.functions);
    }

    // Identify hotspots based on thresholds
    const cyclomaticThreshold = this.options.thresholds?.cyclomatic ?? 10;
    const cognitiveThreshold = this.options.thresholds?.cognitive ?? 15;

    const hotspots = allFunctions.filter(
      (fn) => fn.cyclomatic >= cyclomaticThreshold || fn.cognitive >= cognitiveThreshold,
    );

    // Sort hotspots by total complexity (cyclomatic + cognitive)
    hotspots.sort((a, b) => b.cyclomatic + b.cognitive - (a.cyclomatic + a.cognitive));

    return {
      files,
      functions: allFunctions,
      hotspots,
    };
  }
}
