#!/usr/bin/env tsx

/**
 * Create Knowledge Graph Utility
 * Generates a comprehensive Markdown knowledge graph of a TypeScript codebase
 * Based on the Knowledge Graph Construction technique from codebase-analysis-techniques.md
 * 
 * Optimized version using ts-morph for all dependency analysis
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Project, SourceFile, Node, SyntaxKind } from 'ts-morph';

interface KnowledgeGraphOptions {
  sourcePath?: string;
}

interface FileMetadata {
  file: string;
  deps: string[];
  importers: string[];
  complexity: number;
}

class KnowledgeGraphGenerator {
  sourcePath: string;
  content: string[];
  
  // Caches for performance optimization
  private fileMetadataCache: FileMetadata[] | null = null;
  private project: Project | null = null;
  private sourceFiles: SourceFile[] = [];
  private filePathMap: Map<string, SourceFile> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private inverseDependencyGraph: Map<string, Set<string>> = new Map();

  constructor(options: KnowledgeGraphOptions = {}) {
    this.sourcePath = options.sourcePath || this.detectSourcePath();
    this.content = [];
  }

  /**
   * Auto-detect source directory by looking for common patterns
   */
  detectSourcePath(): string {
    // Check current directory first
    if (fs.existsSync('tsconfig.json') || fs.existsSync('package.json')) {
      // We're likely in a project root
      if (fs.existsSync('src') && fs.statSync('src').isDirectory()) {
        return 'src';
      }
      if (fs.existsSync('lib') && fs.statSync('lib').isDirectory()) {
        return 'lib';
      }
      if (fs.existsSync('app') && fs.statSync('app').isDirectory()) {
        return 'app';
      }
      // For monorepos, don't auto-select packages - it's usually too big
      // User should specify which package they want
    }
    
    // If we can't find a standard structure, require explicit path
    console.error('Could not auto-detect source directory. Please specify with -s or provide a path.');
    console.error('Try: create-knowledge-graph src');
    console.error('  or: create-knowledge-graph packages/mypackage');
    process.exit(1);
  }

  /**
   * Initialize ts-morph project and build dependency graph
   */
  private async initializeProject(): Promise<void> {
    if (this.project) return;

    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
    });

    // Add all TypeScript files (excluding node_modules)
    this.sourceFiles = this.project.addSourceFilesAtPaths([
      `${this.sourcePath}/**/*.ts`,
      `!${this.sourcePath}/**/node_modules/**`
    ]);
    
    // Build file path map for quick lookup
    this.sourceFiles.forEach(sourceFile => {
      const filePath = sourceFile.getFilePath();
      this.filePathMap.set(filePath, sourceFile);
      
      // Initialize empty sets for this file
      const normalizedPath = this.normalizeFilePath(filePath);
      if (!this.dependencyGraph.has(normalizedPath)) {
        this.dependencyGraph.set(normalizedPath, new Set());
      }
      if (!this.inverseDependencyGraph.has(normalizedPath)) {
        this.inverseDependencyGraph.set(normalizedPath, new Set());
      }
    });

    // Build dependency graph
    this.sourceFiles.forEach(sourceFile => {
      const filePath = this.normalizeFilePath(sourceFile.getFilePath());
      const imports = this.extractImports(sourceFile);
      
      imports.forEach(importPath => {
        // Add to dependency graph
        this.dependencyGraph.get(filePath)?.add(importPath);
        
        // Add to inverse dependency graph
        if (!this.inverseDependencyGraph.has(importPath)) {
          this.inverseDependencyGraph.set(importPath, new Set());
        }
        this.inverseDependencyGraph.get(importPath)?.add(filePath);
      });
    });
  }

  /**
   * Extract imports from a source file
   */
  private extractImports(sourceFile: SourceFile): string[] {
    const imports: string[] = [];
    const filePath = sourceFile.getFilePath();
    const fileDir = path.dirname(filePath);

    // Get import declarations
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // Skip node_modules and external packages
      if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
        return;
      }

      // Resolve relative imports
      const resolvedPath = this.resolveImportPath(fileDir, moduleSpecifier);
      if (resolvedPath) {
        imports.push(resolvedPath);
      }
    });

    // Get export declarations with module specifiers
    sourceFile.getExportDeclarations().forEach(exportDecl => {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (moduleSpecifier && moduleSpecifier.startsWith('.')) {
        const resolvedPath = this.resolveImportPath(fileDir, moduleSpecifier);
        if (resolvedPath) {
          imports.push(resolvedPath);
        }
      }
    });

    return imports;
  }

  /**
   * Resolve import path to actual file path
   */
  private resolveImportPath(fromDir: string, importPath: string): string | null {
    // Handle relative imports
    const resolved = path.resolve(fromDir, importPath);
    
    // Try different extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const candidates = [
      resolved,
      ...extensions.map(ext => resolved + ext),
      ...extensions.map(ext => path.join(resolved, 'index' + ext))
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeFilePath(candidate);
      if (this.filePathMap.has(candidate) || this.dependencyGraph.has(normalized)) {
        return normalized;
      }
    }

    return null;
  }

  /**
   * Normalize file path for consistency
   */
  private normalizeFilePath(filePath: string): string {
    // Convert absolute path to relative
    const relativePath = path.relative(process.cwd(), filePath);
    // Remove extensions for matching
    return relativePath.replace(/\.(ts|tsx|js|jsx)$/, '');
  }

  /**
   * Pre-compute all file metadata once
   */
  private async computeFileMetadata(): Promise<void> {
    if (this.fileMetadataCache) return;
    
    await this.initializeProject();
    
    this.fileMetadataCache = this.sourceFiles.map(sourceFile => {
      const filePath = sourceFile.getFilePath();
      const normalizedPath = this.normalizeFilePath(filePath);
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Get dependencies from our graph
      const deps = Array.from(this.dependencyGraph.get(normalizedPath) || []);
      const importers = Array.from(this.inverseDependencyGraph.get(normalizedPath) || []);
      
      // Calculate complexity
      const complexity = this.calculateComplexity(sourceFile);
      
      return {
        file: relativePath,
        deps,
        importers,
        complexity
      };
    });
  }

  /**
   * Calculate cyclomatic complexity for a source file
   */
  private calculateComplexity(sourceFile: SourceFile): number {
    let complexity = 1; // Base complexity

    sourceFile.forEachDescendant((node) => {
      switch (node.getKind()) {
        case SyntaxKind.IfStatement:
        case SyntaxKind.ConditionalExpression:
        case SyntaxKind.CaseClause:
        case SyntaxKind.DefaultClause:
        case SyntaxKind.CatchClause:
        case SyntaxKind.ForStatement:
        case SyntaxKind.ForInStatement:
        case SyntaxKind.ForOfStatement:
        case SyntaxKind.WhileStatement:
        case SyntaxKind.DoStatement:
          complexity++;
          break;
        case SyntaxKind.BinaryExpression:
          const binaryExpr = node.asKind(SyntaxKind.BinaryExpression);
          const operatorToken = binaryExpr?.getOperatorToken();
          if (operatorToken) {
            const operator = operatorToken.getKind();
            if (operator === SyntaxKind.AmpersandAmpersandToken || 
                operator === SyntaxKind.BarBarToken ||
                operator === SyntaxKind.QuestionQuestionToken) {
              complexity++;
            }
          }
          break;
      }
    });

    return complexity;
  }

  /**
   * Main entry point for generating the knowledge graph
   */
  async generate(): Promise<void> {
    this.content.push('# Codebase Knowledge Graph');
    this.content.push('');
    this.content.push(`*Generated on ${new Date().toISOString()}*`);
    this.content.push('');

    try {
      // Pre-compute all metadata once
      await this.computeFileMetadata();

      // Generate sections using cached data
      await this.generateModuleDependencies();
      await this.generateTypeHierarchy();
      await this.generateRelationshipSummary();
      await this.generateModuleTree();
      await this.generateKeyInsights();

      // Output to stdout
      console.log(this.content.join('\n'));
    } catch (error) {
      console.error('Error generating knowledge graph:', error);
      process.exit(1);
    }
  }

  /**
   * Step 1: Generate module dependencies section
   */
  async generateModuleDependencies(): Promise<void> {
    this.content.push('## Modules and Their Dependencies');
    this.content.push('');

    if (!this.fileMetadataCache) return;
    
    for (const metadata of this.fileMetadataCache) {
      this.content.push(`### ${metadata.file}`);
      
      if (metadata.deps.length > 0) {
        this.content.push('**Imports:**');
        metadata.deps.forEach(dep => this.content.push(`- ${dep}`));
      } else {
        this.content.push('**Imports:** *None*');
      }
      
      if (metadata.importers.length > 0) {
        this.content.push('**Imported by:**');
        metadata.importers.forEach(dep => this.content.push(`- ${dep}`));
      } else {
        this.content.push('**Imported by:** *None*');
      }
      
      this.content.push('');
    }
  }

  /**
   * Step 2: Generate type hierarchy using ts-morph
   */
  async generateTypeHierarchy(): Promise<void> {
    this.content.push('## Type Hierarchy');
    this.content.push('');

    if (!this.sourceFiles) return;

    this.sourceFiles.forEach(sourceFile => {
      const classes = sourceFile.getClasses();
      const interfaces = sourceFile.getInterfaces();
      const typeAliases = sourceFile.getTypeAliases();
      const enums = sourceFile.getEnums();

      if (classes.length > 0 || interfaces.length > 0 || typeAliases.length > 0 || enums.length > 0) {
        const relativePath = path.relative(process.cwd(), sourceFile.getFilePath());
        this.content.push(`### ${relativePath}`);
        
        // Process classes
        if (classes.length > 0) {
          this.content.push('**Classes:**');
          classes.forEach(cls => {
            this.content.push(`- **${cls.getName() || 'Anonymous'}**`);
            try {
              const baseClass = cls.getBaseClass();
              if (baseClass) {
                this.content.push(`  - extends: ${baseClass.getName()}`);
              }
            } catch (e) {
              // Ignore errors getting base class
            }
            try {
              cls.getImplements().forEach(impl => {
                this.content.push(`  - implements: ${impl.getText()}`);
              });
            } catch (e) {
              // Ignore errors getting implements
            }
          });
        }

        // Process interfaces
        if (interfaces.length > 0) {
          this.content.push('**Interfaces:**');
          interfaces.forEach(iface => {
            this.content.push(`- **${iface.getName()}**`);
            iface.getExtends().forEach(ext => {
              this.content.push(`  - extends: ${ext.getText()}`);
            });
          });
        }

        // Process type aliases
        if (typeAliases.length > 0) {
          this.content.push('**Type Aliases:**');
          typeAliases.forEach(alias => {
            const typeNode = alias.getTypeNode();
            const typeText = typeNode ? typeNode.getText().substring(0, 100) : 'unknown';
            this.content.push(`- **${alias.getName()}**: ${typeText}${typeNode && typeNode.getText().length > 100 ? '...' : ''}`);
          });
        }

        // Process enums
        if (enums.length > 0) {
          this.content.push('**Enums:**');
          enums.forEach(enumDecl => {
            const memberCount = enumDecl.getMembers().length;
            this.content.push(`- **${enumDecl.getName()}** (${memberCount} members)`);
          });
        }

        this.content.push('');
      }
    });
  }

  /**
   * Step 3: Generate relationship summary table
   */
  async generateRelationshipSummary(): Promise<void> {
    this.content.push('## Relationship Summary');
    this.content.push('');
    this.content.push('| Module | Direct Deps | Imported By | Complexity |');
    this.content.push('|--------|-------------|-------------|------------|');

    if (!this.fileMetadataCache) return;

    // Sort by number of importers (most depended upon first)
    const sorted = [...this.fileMetadataCache].sort((a, b) => b.importers.length - a.importers.length);

    sorted.forEach(item => {
      this.content.push(`| ${item.file} | ${item.deps.length} | ${item.importers.length} | ${item.complexity} |`);
    });

    this.content.push('');
  }

  /**
   * Step 4: Generate module tree visualization
   */
  async generateModuleTree(): Promise<void> {
    this.content.push('## Module Tree');
    this.content.push('```');
    
    try {
      const treeOutput = execSync(`tree ${this.sourcePath} -P "*.ts" -I "node_modules|*.test.ts|*.spec.ts" --dirsfirst`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      this.content.push(treeOutput);
    } catch (error) {
      // Fallback to a simple listing if tree command is not available
      this.content.push(this.generateSimpleTree(this.sourcePath));
    }
    
    this.content.push('```');
    this.content.push('');
  }

  /**
   * Step 5: Generate key insights
   */
  async generateKeyInsights(): Promise<void> {
    this.content.push('## Key Insights');
    this.content.push('');

    if (!this.fileMetadataCache) return;

    // Most depended upon modules
    this.content.push('### Most Depended Upon Modules');
    const mostDepended = [...this.fileMetadataCache].sort((a, b) => b.importers.length - a.importers.length).slice(0, 5);
    mostDepended.forEach(item => {
      if (item.importers.length > 0) {
        this.content.push(`- ${item.file} (${item.importers.length} dependents)`);
      }
    });
    if (mostDepended.filter(item => item.importers.length > 0).length === 0) {
      this.content.push('*No inter-module dependencies found*');
    }
    this.content.push('');

    // Modules with most dependencies
    this.content.push('### Modules with Most Dependencies');
    const mostDependencies = [...this.fileMetadataCache].sort((a, b) => b.deps.length - a.deps.length).slice(0, 5);
    mostDependencies.forEach(item => {
      if (item.deps.length > 0) {
        this.content.push(`- ${item.file} (${item.deps.length} dependencies)`);
      }
    });
    if (mostDependencies.filter(item => item.deps.length > 0).length === 0) {
      this.content.push('*No external dependencies found*');
    }
    this.content.push('');

    // Isolated modules (no dependencies or dependents)
    this.content.push('### Isolated Modules');
    const isolated = this.fileMetadataCache.filter(item => item.deps.length === 0 && item.importers.length === 0);
    if (isolated.length > 0) {
      isolated.slice(0, 5).forEach(item => {
        this.content.push(`- ${item.file}`);
      });
      if (isolated.length > 5) {
        this.content.push(`- *...and ${isolated.length - 5} more*`);
      }
    } else {
      this.content.push('*No isolated modules found*');
    }
    this.content.push('');

    // Statistics summary
    this.content.push('### Statistics');
    const totalFiles = this.fileMetadataCache.length;
    const totalDeps = this.fileMetadataCache.reduce((sum, item) => sum + item.deps.length, 0);
    const totalImporters = this.fileMetadataCache.reduce((sum, item) => sum + item.importers.length, 0);
    
    this.content.push(`- Total modules analyzed: ${totalFiles}`);
    this.content.push(`- Average dependencies per module: ${(totalDeps / totalFiles).toFixed(2)}`);
    this.content.push(`- Average dependents per module: ${(totalImporters / totalFiles).toFixed(2)}`);
    this.content.push('');
  }

  /**
   * Helper: Generate simple tree structure when tree command is not available
   */
  generateSimpleTree(dir: string, prefix = '', isLast = true): string {
    const items = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory() && e.name !== 'node_modules').sort();
      const files = entries.filter(e => e.isFile() && e.name.endsWith('.ts')).sort();
      
      [...dirs, ...files].forEach((entry, index) => {
        const isLastEntry = index === dirs.length + files.length - 1;
        const connector = isLastEntry ? '└── ' : '├── ';
        const extension = isLastEntry ? '    ' : '│   ';
        
        items.push(prefix + connector + entry.name);
        
        if (entry.isDirectory()) {
          const subTree = this.generateSimpleTree(
            path.join(dir, entry.name),
            prefix + extension,
            isLastEntry
          );
          if (subTree) items.push(subTree);
        }
      });
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
    
    return items.join('\n');
  }
}

// CLI Interface - Run directly when executed as a script
const args = process.argv.slice(2);
const options: KnowledgeGraphOptions = {};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-s':
    case '--source':
      options.sourcePath = args[++i];
      break;
    case '-h':
    case '--help':
      console.log(`
Usage: create-knowledge-graph [options] [source-path]

Generates a comprehensive Markdown knowledge graph of a TypeScript codebase
and outputs it to stdout. Test files are always included.

Options:
  -s, --source <path>     Source directory path (auto-detected if not specified)
  -h, --help              Show this help message

Auto-detection looks for:
  1. 'src' directory
  2. 'lib' directory  
  3. 'app' directory
  4. Current directory (if none found above)

Examples:
  create-knowledge-graph                    # Auto-detect source directory
  create-knowledge-graph packages/api       # Specific directory
  create-knowledge-graph -s packages > knowledge.md
      `);
      process.exit(0);
      break;
    default:
      if (!args[i].startsWith('-')) {
        options.sourcePath = args[i];
      }
  }
}

const generator = new KnowledgeGraphGenerator(options);
generator.generate().catch(() => {
  process.exit(1);
});

export { KnowledgeGraphGenerator, KnowledgeGraphOptions };