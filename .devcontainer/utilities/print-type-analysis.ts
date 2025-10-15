#!/usr/bin/env tsx

/**
 * Print Type Analysis Utility
 * Analyzes TypeScript files using the TypeScript Compiler API
 * Based on Compiler API Investigation technique from codebase-analysis-techniques.md
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import glob from 'glob';

interface AnalysisOptions {
  files: string[];
}

interface TypeInfo {
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

class TypeAnalyzer {
  private program: ts.Program;
  private checker: ts.TypeChecker;
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
        matches.forEach(file => this.expandedFiles.add(file));
      } else {
        // If no glob matches, check if it's a literal file
        const absolutePath = path.resolve(pattern);
        if (fs.existsSync(absolutePath)) {
          allFiles.push(absolutePath);
          this.expandedFiles.add(absolutePath);
        } else if (!pattern.includes('*') && !pattern.includes('?')) {
          // Only error on non-glob patterns that don't exist
          console.error(`Error: File or pattern not found: ${pattern}`);
          process.exit(1);
        }
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

    ts.forEachChild(node, child => this.visitNode(child, sourceFile));
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
    node.members.forEach(member => {
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
    node.members.forEach(member => {
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
    node.members.forEach(member => {
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
    node.parameters.forEach(param => {
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
      if (ts.isIfStatement(n) || 
          ts.isConditionalExpression(n) ||
          ts.isWhileStatement(n) ||
          ts.isForStatement(n) ||
          ts.isForInStatement(n) ||
          ts.isForOfStatement(n) ||
          ts.isDoStatement(n)) {
        complexity++;
      }
      
      // Check for case statements
      if (ts.isCaseClause(n)) {
        complexity++;
      }
      
      // Check for logical operators
      if (ts.isBinaryExpression(n)) {
        const operator = n.operatorToken.kind;
        if (operator === ts.SyntaxKind.AmpersandAmpersandToken ||
            operator === ts.SyntaxKind.BarBarToken) {
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
    if (!node.modifiers) return '';
    
    for (const modifier of node.modifiers) {
      if (modifier.kind === ts.SyntaxKind.PrivateKeyword) return 'private ';
      if (modifier.kind === ts.SyntaxKind.ProtectedKeyword) return 'protected ';
      if (modifier.kind === ts.SyntaxKind.PublicKeyword) return 'public ';
    }
    
    return '';
  }

  private isExported(node: ts.Node): boolean {
    if (!node.modifiers) return false;
    return node.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  output(): void {
    this.outputYAML();
  }

  private outputYAML(): void {
    // Group results by file for better readability
    const groupedByFile: { [key: string]: TypeInfo[] } = {};
    
    this.results.forEach(item => {
      if (!groupedByFile[item.file]) {
        groupedByFile[item.file] = [];
      }
      groupedByFile[item.file].push(item);
    });

    // Output as YAML
    console.log('files:');
    
    Object.keys(groupedByFile).sort().forEach(file => {
      console.log(`  - path: ${file}`);
      console.log('    items:');
      
      const items = groupedByFile[file].sort((a, b) => a.line - b.line);
      items.forEach(item => {
        console.log(`      - kind: ${item.kind}`);
        console.log(`        name: ${item.name}`);
        console.log(`        line: ${item.line}`);
        
        if (item.exported !== undefined) {
          console.log(`        exported: ${item.exported}`);
        }
        
        if (item.extends && item.extends.length > 0) {
          console.log('        extends:');
          item.extends.forEach(ext => {
            console.log(`          - ${ext}`);
          });
        }
        
        if (item.implements && item.implements.length > 0) {
          console.log('        implements:');
          item.implements.forEach(impl => {
            console.log(`          - ${impl}`);
          });
        }
        
        if (item.properties && item.properties.length > 0) {
          if (item.kind === 'type') {
            console.log(`        definition: ${item.properties[0]}`);
          } else {
            console.log('        properties:');
            item.properties.forEach(prop => {
              console.log(`          - ${prop}`);
            });
          }
        }
        
        if (item.members && item.members.length > 0) {
          console.log('        members:');
          item.members.forEach(member => {
            console.log(`          - ${member}`);
          });
        }
        
        if (item.parameters && item.parameters.length > 0) {
          console.log('        parameters:');
          item.parameters.forEach(param => {
            console.log(`          - ${param}`);
          });
        }
        
        if (item.returnType) {
          console.log(`        returnType: ${item.returnType}`);
        }
        
        if (item.complexity !== undefined) {
          console.log(`        complexity: ${item.complexity}`);
        }
      });
    });
    
    // Add summary
    console.log('summary:');
    const counts: { [key: string]: number } = {};
    this.results.forEach(item => {
      counts[item.kind] = (counts[item.kind] || 0) + 1;
    });
    
    Object.keys(counts).sort().forEach(kind => {
      console.log(`  ${kind}s: ${counts[kind]}`);
    });
    console.log(`  total: ${this.results.length}`);
  }
}

// Command-line argument parsing
const options: AnalysisOptions = {
  files: []
};

// Parse command-line arguments
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  
  switch (arg) {
    case '-h':
    case '--help':
      console.log(`
Usage: print-type-analysis [options] <files...>

Analyzes TypeScript files using the TypeScript Compiler API to extract
type information including interfaces, types, classes, enums, and functions.
Always includes cyclomatic complexity calculation for functions and methods.
Output is always in YAML format.

Options:
  -h, --help    Show this help message

Examples:
  print-type-analysis src/**/*.ts
  print-type-analysis src/models/*.ts src/types/*.ts
  print-type-analysis /path/to/specific/file.ts
      `);
      process.exit(0);
      break;
      
    default:
      if (arg.startsWith('-')) {
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
      }
      options.files.push(arg);
  }
}

// Validate arguments
if (options.files.length === 0) {
  console.error('Error: No files specified');
  console.error('Usage: print-type-analysis [options] <files...>');
  process.exit(1);
}

// Run the analyzer
try {
  const analyzer = new TypeAnalyzer(options);
  analyzer.analyze();
  analyzer.output();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}