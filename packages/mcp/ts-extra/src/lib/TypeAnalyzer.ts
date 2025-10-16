/**
 * TypeScript Type Analyzer
 * Extracts type information and complexity metrics from TypeScript files
 * Adapted from .devcontainer/utilities/print-type-analysis.ts
 */

import * as path from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';

export interface AnalysisOptions {
  files: string[];
}

export interface TypeInfo {
  kind: string;
  name: string;
  file: string;
  line: number;
  properties?: string[];
  extends?: string[];
  implements?: string[];
  parameters?: string[];
  returnType?: string;
  members?: string[];
  complexity?: number;
  exported?: boolean;
}

export interface AnalysisResult {
  files: FileAnalysis[];
  summary: Summary;
}

export interface FileAnalysis {
  path: string;
  items: TypeInfo[];
}

export interface Summary {
  [key: string]: number;
  total: number;
}

export class TypeAnalyzer {
  private program: ts.Program | undefined;
  private checker: ts.TypeChecker | undefined;
  private results: TypeInfo[] = [];
  private options: AnalysisOptions;
  private expandedFiles: Set<string> = new Set();

  constructor(options: AnalysisOptions) {
    this.options = options;

    // Expand glob patterns to actual file paths
    const allFiles: string[] = [];
    for (const pattern of this.options.files) {
      // Try glob pattern first
      const matches = glob.sync(pattern, { absolute: true });

      if (matches.length > 0) {
        allFiles.push(...matches);
        matches.forEach((file) => this.expandedFiles.add(file));
      } else {
        // If no glob matches, check if it's a literal file
        const absolutePath = path.resolve(pattern);
        // Note: We don't check fs.existsSync here to avoid errors during construction
        // The program creation will handle non-existent files
        allFiles.push(absolutePath);
        this.expandedFiles.add(absolutePath);
      }
    }

    // Create TypeScript program
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      allowJs: true,
      checkJs: false
    };

    // Handle case where no files match the pattern
    if (allFiles.length === 0) {
      // Return empty results but don't error
      return;
    }

    this.program = ts.createProgram(allFiles, compilerOptions);
    this.checker = this.program.getTypeChecker();
  }

  analyze(): void {
    if (!this.program) return;

    for (const sourceFile of this.program.getSourceFiles()) {
      // Skip declaration files and node_modules
      if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('node_modules')) {
        continue;
      }

      // Only analyze files that were explicitly requested
      const isRequestedFile = this.expandedFiles.has(sourceFile.fileName);

      if (!isRequestedFile) continue;

      this.visitNode(sourceFile, sourceFile);
    }
  }

  private visitNode(node: ts.Node, sourceFile: ts.SourceFile): void {
    if (ts.isInterfaceDeclaration(node)) {
      this.analyzeInterface(node, sourceFile);
    }

    if (ts.isTypeAliasDeclaration(node)) {
      this.analyzeTypeAlias(node, sourceFile);
    }

    if (ts.isClassDeclaration(node)) {
      this.analyzeClass(node, sourceFile);
    }

    if (ts.isEnumDeclaration(node)) {
      this.analyzeEnum(node, sourceFile);
    }

    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      this.analyzeFunction(node, sourceFile);
    }

    ts.forEachChild(node, (child) => this.visitNode(child, sourceFile));
  }

  private analyzeInterface(node: ts.InterfaceDeclaration, sourceFile: ts.SourceFile): void {
    const name = node.name?.text || 'Anonymous';
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    const properties: string[] = [];
    const extendsList: string[] = [];

    // Get extended interfaces
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            extendsList.push(type.expression.getText());
          }
        }
      }
    }

    // Get properties
    node.members.forEach((member) => {
      if (ts.isPropertySignature(member) || ts.isMethodSignature(member)) {
        const propName = member.name?.getText() || 'anonymous';
        const propType = member.type ? `: ${member.type.getText()}` : '';
        properties.push(`${propName}${propType}`);
      }
    });

    this.results.push({
      kind: 'interface',
      name,
      file: path.relative(process.cwd(), sourceFile.fileName),
      line: line + 1,
      properties,
      extends: extendsList.length > 0 ? extendsList : undefined,
      exported: this.isExported(node)
    });
  }

  private analyzeTypeAlias(node: ts.TypeAliasDeclaration, sourceFile: ts.SourceFile): void {
    const name = node.name?.text || 'Anonymous';
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    // Get type definition
    const typeText = node.type.getText();

    this.results.push({
      kind: 'type',
      name,
      file: path.relative(process.cwd(), sourceFile.fileName),
      line: line + 1,
      properties: [typeText],
      exported: this.isExported(node)
    });
  }

  private analyzeClass(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): void {
    const name = node.name?.text || 'Anonymous';
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    const members: string[] = [];
    const extendsList: string[] = [];
    const implementsList: string[] = [];

    // Get inheritance and implementation
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            extendsList.push(type.expression.getText());
          }
        } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          for (const type of clause.types) {
            implementsList.push(type.expression.getText());
          }
        }
      }
    }

    // Get members
    node.members.forEach((member) => {
      if (ts.isPropertyDeclaration(member) || ts.isMethodDeclaration(member)) {
        const memberName = member.name?.getText() || 'anonymous';
        const visibility = this.getVisibility(member);
        const memberType = ts.isMethodDeclaration(member) ? 'method' : 'property';
        members.push(`${visibility}${memberName} (${memberType})`);
      }
    });

    this.results.push({
      kind: 'class',
      name,
      file: path.relative(process.cwd(), sourceFile.fileName),
      line: line + 1,
      extends: extendsList.length > 0 ? extendsList : undefined,
      implements: implementsList.length > 0 ? implementsList : undefined,
      members: members.length > 0 ? members : undefined,
      exported: this.isExported(node)
    });
  }

  private analyzeEnum(node: ts.EnumDeclaration, sourceFile: ts.SourceFile): void {
    const name = node.name?.text || 'Anonymous';
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    const members: string[] = [];

    // Get enum members
    node.members.forEach((member) => {
      const memberName = member.name?.getText() || 'anonymous';
      const memberValue = member.initializer ? ` = ${member.initializer.getText()}` : '';
      members.push(`${memberName}${memberValue}`);
    });

    this.results.push({
      kind: 'enum',
      name,
      file: path.relative(process.cwd(), sourceFile.fileName),
      line: line + 1,
      members,
      exported: this.isExported(node)
    });
  }

  private analyzeFunction(node: ts.FunctionDeclaration | ts.MethodDeclaration, sourceFile: ts.SourceFile): void {
    const name = node.name?.getText() || 'anonymous';
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    const parameters: string[] = [];
    let returnType: string | undefined;
    let complexity: number | undefined;

    // Get parameters
    node.parameters.forEach((param) => {
      const paramName = param.name.getText();
      const paramType = param.type ? `: ${param.type.getText()}` : '';
      parameters.push(`${paramName}${paramType}`);
    });

    // Get return type
    if (node.type) {
      returnType = node.type.getText();
    }

    // Always calculate cyclomatic complexity
    if (node.body) {
      complexity = this.calculateComplexity(node.body);
    }

    this.results.push({
      kind: ts.isFunctionDeclaration(node) ? 'function' : 'method',
      name,
      file: path.relative(process.cwd(), sourceFile.fileName),
      line: line + 1,
      parameters,
      returnType,
      complexity,
      exported: ts.isFunctionDeclaration(node) ? this.isExported(node) : undefined
    });
  }

  private calculateComplexity(node: ts.Node): number {
    let complexity = 1; // Base complexity

    const visit = (n: ts.Node) => {
      // Increment for each decision point
      if (
        ts.isIfStatement(n) ||
        ts.isConditionalExpression(n) ||
        ts.isWhileStatement(n) ||
        ts.isForStatement(n) ||
        ts.isForInStatement(n) ||
        ts.isForOfStatement(n) ||
        ts.isDoStatement(n)
      ) {
        complexity++;
      }

      // Check for case statements
      if (ts.isCaseClause(n)) {
        complexity++;
      }

      // Check for logical operators
      if (ts.isBinaryExpression(n)) {
        const operator = n.operatorToken.kind;
        if (operator === ts.SyntaxKind.AmpersandAmpersandToken || operator === ts.SyntaxKind.BarBarToken) {
          complexity++;
        }
      }

      // Check for catch clauses
      if (ts.isCatchClause(n)) {
        complexity++;
      }

      ts.forEachChild(n, visit);
    };

    visit(node);
    return complexity;
  }

  private getVisibility(node: ts.ClassElement): string {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!modifiers) return '';

    for (const modifier of modifiers) {
      if (modifier.kind === ts.SyntaxKind.PrivateKeyword) return 'private ';
      if (modifier.kind === ts.SyntaxKind.ProtectedKeyword) return 'protected ';
      if (modifier.kind === ts.SyntaxKind.PublicKeyword) return 'public ';
    }

    return '';
  }

  private isExported(node: ts.Node): boolean {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!modifiers) return false;
    return modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  getResults(): AnalysisResult {
    // Group results by file for better readability
    const groupedByFile: { [key: string]: TypeInfo[] } = {};

    this.results.forEach((item) => {
      if (!groupedByFile[item.file]) {
        groupedByFile[item.file] = [];
      }
      groupedByFile[item.file].push(item);
    });

    // Create file analysis array
    const files: FileAnalysis[] = Object.keys(groupedByFile)
      .sort()
      .map((filePath) => ({
        path: filePath,
        items: groupedByFile[filePath].sort((a, b) => a.line - b.line)
      }));

    // Add summary
    const summary: Summary = { total: this.results.length };
    this.results.forEach((item) => {
      // Proper pluralization: class -> classes, not classs
      const key = item.kind === 'class' ? 'classes' : `${item.kind}s`;
      summary[key] = (summary[key] || 0) + 1;
    });

    return { files, summary };
  }

  outputYAML(): string {
    const result = this.getResults();
    const lines: string[] = [];

    lines.push('files:');

    result.files.forEach((file) => {
      lines.push(`  - path: ${file.path}`);
      lines.push('    items:');

      file.items.forEach((item) => {
        lines.push(`      - kind: ${item.kind}`);
        lines.push(`        name: ${item.name}`);
        lines.push(`        line: ${item.line}`);

        if (item.exported !== undefined) {
          lines.push(`        exported: ${item.exported}`);
        }

        if (item.extends && item.extends.length > 0) {
          lines.push('        extends:');
          item.extends.forEach((ext) => {
            lines.push(`          - ${ext}`);
          });
        }

        if (item.implements && item.implements.length > 0) {
          lines.push('        implements:');
          item.implements.forEach((impl) => {
            lines.push(`          - ${impl}`);
          });
        }

        if (item.properties && item.properties.length > 0) {
          if (item.kind === 'type') {
            lines.push(`        definition: ${item.properties[0]}`);
          } else {
            lines.push('        properties:');
            item.properties.forEach((prop) => {
              lines.push(`          - ${prop}`);
            });
          }
        }

        if (item.members && item.members.length > 0) {
          lines.push('        members:');
          item.members.forEach((member) => {
            lines.push(`          - ${member}`);
          });
        }

        if (item.parameters && item.parameters.length > 0) {
          lines.push('        parameters:');
          item.parameters.forEach((param) => {
            lines.push(`          - ${param}`);
          });
        }

        if (item.returnType) {
          lines.push(`        returnType: ${item.returnType}`);
        }

        if (item.complexity !== undefined) {
          lines.push(`        complexity: ${item.complexity}`);
        }
      });
    });

    // Add summary
    lines.push('summary:');
    Object.keys(result.summary)
      .sort()
      .forEach((key) => {
        lines.push(`  ${key}: ${result.summary[key]}`);
      });

    return lines.join('\n');
  }
}
