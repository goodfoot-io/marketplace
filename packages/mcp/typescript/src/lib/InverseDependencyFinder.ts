import * as fs from 'fs/promises';
import * as path from 'path';
import { getPackages } from '@manypkg/get-packages';
import { glob } from 'glob';
import * as ts from 'typescript';

export interface InverseDependencyFinderOptions {
  projectPath?: string;
  targetGlobs: string[];
}

export class InverseDependencyFinder {
  private projectPath?: string;
  private targetGlobs: string[];

  constructor(options: InverseDependencyFinderOptions) {
    this.projectPath = options.projectPath;
    this.targetGlobs = options.targetGlobs;
  }

  private async findGitignoreFiles(globs: string[], basePath: string): Promise<string[]> {
    const projectDirMatcher = /^(.+?\/).*$/;
    const uniqueDirs = new Set<string>();

    for (const globPattern of globs) {
      const match = globPattern.match(projectDirMatcher);
      if (match) {
        uniqueDirs.add(match[1]);
      }
    }

    const gitignoreFiles: string[] = [];
    for (const dir of uniqueDirs) {
      const gitignorePath = path.join(basePath, dir, '.gitignore');
      try {
        await fs.access(gitignorePath);
        gitignoreFiles.push(gitignorePath);
      } catch {
        // .gitignore doesn't exist in this directory
      }
    }

    // Also check for .gitignore in the base path
    const baseGitignore = path.join(basePath, '.gitignore');
    try {
      await fs.access(baseGitignore);
      if (!gitignoreFiles.includes(baseGitignore)) {
        gitignoreFiles.push(baseGitignore);
      }
    } catch {
      // No .gitignore in base path
    }

    // Also look for .gitignore files in parent directories
    let currentDir = basePath;
    let parentDir = path.dirname(currentDir);

    while (parentDir !== currentDir) {
      const parentGitignore = path.join(parentDir, '.gitignore');
      try {
        await fs.access(parentGitignore);
        if (!gitignoreFiles.includes(parentGitignore)) {
          gitignoreFiles.push(parentGitignore);
        }
      } catch {
        // Parent .gitignore doesn't exist
      }
      currentDir = parentDir;
      parentDir = path.dirname(currentDir);
    }

    return gitignoreFiles;
  }

  private async parseGitignoreFiles(gitignoreFiles: string[], basePath: string): Promise<string[]> {
    const patterns: string[] = [];

    for (const file of gitignoreFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const dir = path.dirname(path.relative(basePath, file));
        const lines = content.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#'));

        for (const pattern of lines) {
          // Normalize pattern by removing leading ./
          let normalizedPattern = pattern;
          if (normalizedPattern.startsWith('./')) {
            normalizedPattern = normalizedPattern.slice(2);
          }

          if (dir === '.') {
            patterns.push(normalizedPattern);
          } else if (dir.startsWith('..')) {
            // For parent directory gitignore files, patterns should apply from that directory
            if (normalizedPattern.startsWith('/')) {
              // Absolute patterns in parent .gitignore don't apply to subdirectories
              continue;
            } else {
              // Relative patterns from parent should apply to all subdirectories
              patterns.push(normalizedPattern);
              patterns.push('**/' + normalizedPattern);
            }
          } else {
            patterns.push(path.join(dir, normalizedPattern));
          }
        }
      } catch {
        // Ignore errors reading .gitignore files
      }
    }

    // Always ignore .git directories and .eslintcache
    patterns.push('.git', '.git/**', '**/.git', '**/.git/**');
    patterns.push('.eslintcache', '**/.eslintcache');

    return patterns;
  }

  private extractReferencedFiles(sourceFile: ts.SourceFile): string[] {
    const referencedFiles: string[] = [];

    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        referencedFiles.push(node.moduleSpecifier.text);
      } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          referencedFiles.push(arg.text);
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return referencedFiles;
  }

  private buildReverseDependencyMap(program: ts.Program): Map<string, Set<string>> {
    const reverseDepMap = new Map<string, Set<string>>();
    const sourceFiles = program.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      if (sourceFile.isDeclarationFile) continue;

      const currentFileAbsolute = sourceFile.fileName;
      const referencedFiles = this.extractReferencedFiles(sourceFile);

      for (const ref of referencedFiles) {
        const resolvedModule = ts.resolveModuleName(ref, currentFileAbsolute, program.getCompilerOptions(), ts.sys);

        if (resolvedModule.resolvedModule && resolvedModule.resolvedModule.resolvedFileName) {
          const dependencyAbsolute = resolvedModule.resolvedModule.resolvedFileName;

          if (!reverseDepMap.has(dependencyAbsolute)) {
            reverseDepMap.set(dependencyAbsolute, new Set());
          }
          reverseDepMap.get(dependencyAbsolute)!.add(currentFileAbsolute);
        }
      }
    }

    return reverseDepMap;
  }

  private findRecursiveImporters(
    targets: string[],
    reverseDepMap: Map<string, Set<string>>,
    scope: string[]
  ): Set<string> {
    const visited = new Set<string>();
    const result = new Set<string>();
    const scopeSet = new Set(scope);

    function dfs(file: string) {
      if (visited.has(file)) return;
      visited.add(file);

      const importers = reverseDepMap.get(file) || new Set();
      for (const importer of importers) {
        if (scopeSet.has(importer) && !targets.includes(importer)) {
          result.add(importer);
          dfs(importer);
        }
      }
    }

    for (const target of targets) {
      dfs(target);
    }

    return result;
  }

  async execute(): Promise<string[]> {
    const cwd = process.cwd();

    // Resolve target files first
    const initialGitignoreFilesForTargets = await this.findGitignoreFiles(this.targetGlobs, cwd);
    const ignorePatternsForTargets = await this.parseGitignoreFiles(initialGitignoreFilesForTargets, cwd);

    const targetFilePathsFromGlobs = await glob(this.targetGlobs, {
      ignore: ignorePatternsForTargets,
      absolute: true,
      nodir: true,
      dot: true,
      cwd
    });

    const resolvedTargetFilesAbsolute = await Promise.all(
      targetFilePathsFromGlobs.map(async (p: string) => {
        try {
          return await fs.realpath(p);
        } catch {
          return null;
        }
      })
    ).then((results) => results.filter((p: string | null): p is string => p !== null));

    if (resolvedTargetFilesAbsolute.length === 0) {
      console.warn('Warning: No files found matching the input glob patterns.');
      return [];
    }

    // Check if target files exist
    for (const targetFile of resolvedTargetFilesAbsolute) {
      try {
        await fs.access(targetFile);
      } catch {
        throw new Error(`Target file does not exist: ${path.relative(cwd, targetFile)}`);
      }
    }

    // Find tsconfig.json
    let effectiveConfigFileName = this.projectPath;

    if (!effectiveConfigFileName) {
      // Try to auto-detect from monorepo structure
      if (!this.projectPath) {
        try {
          const { packages } = await getPackages(cwd);
          const firstTargetFile = resolvedTargetFilesAbsolute[0];
          const containingPackage = packages.find((pkg) => firstTargetFile.startsWith(pkg.dir + path.sep));

          if (containingPackage) {
            const packageTsconfig = path.join(containingPackage.dir, 'tsconfig.json');
            if (ts.sys.fileExists(packageTsconfig)) {
              effectiveConfigFileName = packageTsconfig;
            }
          }
        } catch {
          // Ignore auto-detection errors
        }
      }

      if (!effectiveConfigFileName) {
        // First try from current working directory
        effectiveConfigFileName = ts.findConfigFile(cwd, (path) => ts.sys.fileExists(path), 'tsconfig.json');

        // If not found, try from the directory containing the first target file
        if (!effectiveConfigFileName && resolvedTargetFilesAbsolute.length > 0) {
          const targetDir = path.dirname(resolvedTargetFilesAbsolute[0]);
          effectiveConfigFileName = ts.findConfigFile(targetDir, (path) => ts.sys.fileExists(path), 'tsconfig.json');
        }
      }
    }

    if (!effectiveConfigFileName) {
      throw new Error('Could not find tsconfig.json');
    }

    // Parse tsconfig.json
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const configFile = ts.readConfigFile(effectiveConfigFileName, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(
        `Error reading tsconfig.json: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')}`
      );
    }

    const parsedCommandLine = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(effectiveConfigFileName)
    );

    if (parsedCommandLine.errors.length > 0) {
      throw new Error(
        `Error parsing tsconfig.json: ${ts.flattenDiagnosticMessageText(parsedCommandLine.errors[0].messageText, '\n')}`
      );
    }

    const compilerOptions = parsedCommandLine.options;
    const rawConfig = parsedCommandLine.raw as { include?: string[]; exclude?: string[] } | undefined;
    const includePatterns: string[] = rawConfig?.include || ['**/*.ts', '**/*.tsx'];
    const excludePatterns: string[] = rawConfig?.exclude || ['node_modules', '**/*.d.ts'];

    // Find project files
    const configDir = path.dirname(effectiveConfigFileName);
    let projectFilesFromGlob = await glob(includePatterns, {
      ignore: excludePatterns,
      absolute: true,
      nodir: true,
      cwd: configDir
    });

    // Resolve symlinks
    projectFilesFromGlob = await Promise.all(
      projectFilesFromGlob.map((p: string) => fs.realpath(p).catch(() => null))
    ).then((results) => results.filter((p: string | null): p is string => p !== null));

    const allFilesForProgram = Array.from(new Set([...projectFilesFromGlob, ...resolvedTargetFilesAbsolute]));

    if (allFilesForProgram.length === 0) {
      return [];
    }

    const program = ts.createProgram(allFilesForProgram, compilerOptions);
    const reverseDepMap = this.buildReverseDependencyMap(program);

    const allDependentFiles = this.findRecursiveImporters(
      resolvedTargetFilesAbsolute,
      reverseDepMap,
      projectFilesFromGlob
    );

    return [...allDependentFiles].map((absPath) => path.relative(cwd, absPath)).sort();
  }
}
