import * as fs from "node:fs";
import * as path from "node:path";
import { getPackages } from "@manypkg/get-packages";
import * as ts from "typescript";
import type {
  CrossBoundaryMatrix,
  MonorepoMetrics,
  MonorepoOptions,
  PackageApiSurface,
  PackageImportBreakdown,
  WorkspacePackage,
} from "../types.js";

export class MonorepoAnalyzer {
  private options: MonorepoOptions;

  constructor(options: MonorepoOptions) {
    this.options = options;
  }

  /**
   * Recursively find all TypeScript files in a directory.
   */
  private findTsFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        files.push(...this.findTsFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Check if a node has the export modifier.
   */
  private hasExportModifier(node: ts.Node): boolean {
    const modifiers = (node as ts.HasModifiers).modifiers;
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  }

  /**
   * Check if a node has the default modifier.
   */
  private hasDefaultModifier(node: ts.Node): boolean {
    const modifiers = (node as ts.HasModifiers).modifiers;
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
  }

  /**
   * Check if an import path refers to a workspace package.
   */
  private isWorkspaceImport(importPath: string, workspacePackageNames: Set<string>): boolean {
    return workspacePackageNames.has(importPath) || workspacePackageNames.has(importPath.split("/")[0]);
  }

  /**
   * Check if an import path is a relative (internal) import.
   */
  private isRelativeImport(importPath: string): boolean {
    return importPath.startsWith("./") || importPath.startsWith("../");
  }

  async discoverPackages(): Promise<WorkspacePackage[]> {
    const { packages } = await getPackages(this.options.rootDir);

    return packages
      .filter(
        (pkg) =>
          !this.options.packageFilter ||
          this.options.packageFilter({
            name: pkg.packageJson.name as string,
            dir: pkg.dir,
            relativeDir: path.relative(this.options.rootDir, pkg.dir),
            packageJson: pkg.packageJson as unknown as Record<string, unknown>,
          }),
      )
      .map((pkg) => ({
        name: pkg.packageJson.name as string,
        dir: pkg.dir,
        relativeDir: path.relative(this.options.rootDir, pkg.dir),
        packageJson: pkg.packageJson as unknown as Record<string, unknown>,
      }));
  }

  analyzeApiSurface(packageDir: string): PackageApiSurface {
    const entryPoint = path.join(packageDir, "src/index.ts");

    if (!fs.existsSync(entryPoint)) {
      return { namedExports: [], defaultExport: false, typeExports: [], barrelReexports: 0 };
    }

    const sourceText = fs.readFileSync(entryPoint, "utf-8");
    const sourceFile = ts.createSourceFile(entryPoint, sourceText, ts.ScriptTarget.Latest, true);

    const namedExports: string[] = [];
    let defaultExport = false;
    const typeExports: string[] = [];
    let barrelReexports = 0;

    const visit = (node: ts.Node): void => {
      if (ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier && !node.exportClause) {
          barrelReexports++;
        } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            (node.isTypeOnly ? typeExports : namedExports).push(element.name.text);
          }
        }
      } else if (ts.isExportAssignment(node)) {
        defaultExport = true;
      } else if (ts.isFunctionDeclaration(node) && this.hasExportModifier(node)) {
        if (this.hasDefaultModifier(node)) {
          defaultExport = true;
        } else if (node.name) {
          namedExports.push(node.name.text);
        }
      } else if (ts.isClassDeclaration(node) && this.hasExportModifier(node)) {
        if (this.hasDefaultModifier(node)) {
          defaultExport = true;
        } else if (node.name) {
          namedExports.push(node.name.text);
        }
      } else if (ts.isVariableStatement(node) && this.hasExportModifier(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            namedExports.push(declaration.name.text);
          }
        }
      } else if (ts.isInterfaceDeclaration(node) && this.hasExportModifier(node)) {
        namedExports.push(node.name.text);
      } else if (ts.isTypeAliasDeclaration(node) && this.hasExportModifier(node)) {
        namedExports.push(node.name.text);
      } else if (ts.isEnumDeclaration(node) && this.hasExportModifier(node)) {
        namedExports.push(node.name.text);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { namedExports, defaultExport, typeExports, barrelReexports };
  }

  analyzeImportBreakdown(packageDir: string, workspacePackageNames: string[]): PackageImportBreakdown {
    let internal = 0;
    let workspace = 0;
    let external = 0;

    const workspaceSet = new Set(workspacePackageNames);
    const tsFiles = this.findTsFiles(packageDir);

    for (const file of tsFiles) {
      const sourceText = fs.readFileSync(file, "utf-8");
      const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);

      const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const importPath = node.moduleSpecifier.text;

          if (this.isRelativeImport(importPath)) {
            internal++;
          } else if (this.isWorkspaceImport(importPath, workspaceSet)) {
            workspace++;
          } else {
            external++;
          }
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const importPath = node.moduleSpecifier.text;

          // Skip relative re-exports for internal counting
          if (!this.isRelativeImport(importPath)) {
            if (this.isWorkspaceImport(importPath, workspaceSet)) {
              workspace++;
            } else {
              external++;
            }
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    const total = internal + workspace + external;
    return {
      internal: { count: internal, ratio: total ? internal / total : 0 },
      workspacePackages: { count: workspace, ratio: total ? workspace / total : 0 },
      externalNpm: { count: external, ratio: total ? external / total : 0 },
    };
  }

  buildCrossBoundaryMatrix(packages: WorkspacePackage[]): CrossBoundaryMatrix {
    const matrix = new Map<string, Map<string, number>>();
    const packageNameSet = new Set(packages.map((p) => p.name));

    for (const pkg of packages) {
      const imports = new Map<string, number>();
      const tsFiles = this.findTsFiles(pkg.dir);

      for (const file of tsFiles) {
        const sourceText = fs.readFileSync(file, "utf-8");
        const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);

        const visit = (node: ts.Node): void => {
          if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            const importPath = node.moduleSpecifier.text;

            if (this.isWorkspaceImport(importPath, packageNameSet)) {
              const targetPackage = importPath.split("/")[0];
              imports.set(targetPackage, (imports.get(targetPackage) ?? 0) + 1);
            }
          }

          ts.forEachChild(node, visit);
        };

        visit(sourceFile);
      }

      matrix.set(pkg.name, imports);
    }

    return matrix;
  }

  calculateDependencyDepth(packages: WorkspacePackage[]): number {
    const packageNames = new Set(packages.map((p) => p.name));
    const deps = new Map<string, string[]>();

    for (const pkg of packages) {
      const pkgDeps = (pkg.packageJson.dependencies as Record<string, string>) ?? {};
      const workspaceDeps = Object.keys(pkgDeps).filter((d) => packageNames.has(d));
      deps.set(pkg.name, workspaceDeps);
    }

    const memo = new Map<string, number>();

    function findDepth(name: string, visiting = new Set<string>()): number {
      const cached = memo.get(name);
      if (cached !== undefined) return cached;

      if (visiting.has(name)) return 0; // Cycle detected

      visiting.add(name);
      const pkgDeps = deps.get(name) ?? [];
      const depth = pkgDeps.length === 0 ? 0 : 1 + Math.max(...pkgDeps.map((d) => findDepth(d, visiting)));
      visiting.delete(name);

      memo.set(name, depth);
      return depth;
    }

    return Math.max(0, ...packages.map((pkg) => findDepth(pkg.name)));
  }

  async analyze(): Promise<MonorepoMetrics> {
    const packages = await this.discoverPackages();
    const workspacePackageNames = packages.map((p) => p.name);

    const apiSurfaces = new Map<string, PackageApiSurface>();
    const importBreakdowns = new Map<string, PackageImportBreakdown>();

    for (const pkg of packages) {
      apiSurfaces.set(pkg.name, this.analyzeApiSurface(pkg.dir));
      importBreakdowns.set(pkg.name, this.analyzeImportBreakdown(pkg.dir, workspacePackageNames));
    }

    const crossBoundaryMatrix = this.buildCrossBoundaryMatrix(packages);
    const dependencyDepth = this.calculateDependencyDepth(packages);

    return {
      packages,
      apiSurfaces,
      importBreakdowns,
      crossBoundaryMatrix,
      dependencyDepth,
    };
  }
}
