import { existsSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { relative, dirname, resolve, join } from 'node:path';
import dependencyTree from 'dependency-tree';
import { glob, globSync } from 'glob';

export interface DependencyFinderOptions {
  targetGlobs: string[];
}

export class DependencyFinder {
  private targetGlobs: string[];

  constructor(options: DependencyFinderOptions) {
    this.targetGlobs = options.targetGlobs;
  }

  private findGitignoreFiles(inputGlobs: string[]): string[] {
    // First find all directories that would be searched
    const searchDirs: Set<string> = new Set();

    // Add root directory
    searchDirs.add(process.cwd());

    // For each include pattern, add its directory and all parent directories
    for (const pattern of inputGlobs) {
      let dir: string = resolve(process.cwd(), dirname(pattern));
      while (dir.startsWith(process.cwd())) {
        searchDirs.add(dir);
        dir = dirname(dir);
      }
    }

    // Find all .gitignore files in these directories
    const gitignoreFiles: string[] = [];
    for (const dir of searchDirs) {
      const files: string[] = globSync('.gitignore', {
        cwd: dir,
        absolute: true,
        dot: true,
        nodir: true
      });
      gitignoreFiles.push(...files);
    }

    // Also look for .gitignore files in parent directories
    let currentDir = process.cwd();
    let parentDir = dirname(currentDir);

    while (parentDir !== currentDir) {
      const parentGitignore = join(parentDir, '.gitignore');
      if (existsSync(parentGitignore) && !gitignoreFiles.includes(parentGitignore)) {
        gitignoreFiles.push(parentGitignore);
      }
      currentDir = parentDir;
      parentDir = dirname(currentDir);
    }

    return gitignoreFiles;
  }

  private async parseGitignoreFiles(gitignoreFiles: string[]): Promise<string[]> {
    const ignorePatterns: string[] = [];

    for (const file of gitignoreFiles) {
      try {
        const content: string = await readFile(file, 'utf8');
        const patterns: string[] = content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'));

        // Add patterns relative to the .gitignore file's location
        const gitignoreDir: string = dirname(file);
        const relativeDir: string = relative(process.cwd(), gitignoreDir);

        for (const pattern of patterns) {
          // Normalize pattern by removing leading ./
          let normalizedPattern = pattern;
          if (normalizedPattern.startsWith('./')) {
            normalizedPattern = normalizedPattern.slice(2);
          }

          if (!relativeDir) {
            // Root .gitignore patterns can be used as-is
            ignorePatterns.push(normalizedPattern);
          } else if (relativeDir.startsWith('..')) {
            // For parent directory gitignore files, patterns should apply from that directory
            if (normalizedPattern.startsWith('/')) {
              // Absolute patterns in parent .gitignore don't apply to subdirectories
              continue;
            } else {
              // Relative patterns from parent should apply to all subdirectories
              ignorePatterns.push(normalizedPattern);
              ignorePatterns.push('**/' + normalizedPattern);
            }
          } else {
            // If .gitignore is in a subdirectory, prefix its patterns with the relative path
            ignorePatterns.push(
              normalizedPattern.startsWith('/')
                ? `${relativeDir}${normalizedPattern}` // Absolute pattern (relative to .gitignore location)
                : `${relativeDir}/**/${normalizedPattern}` // Relative pattern (matches in all subdirs)
            );
          }
        }
      } catch (error: unknown) {
        console.error(`Error reading ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return ignorePatterns;
  }

  async execute(): Promise<string[]> {
    const allDependencies: Set<string> = new Set();
    const cwd: string = process.cwd();

    try {
      // Find and parse .gitignore files
      const gitignoreFiles: string[] = this.findGitignoreFiles(this.targetGlobs);
      const ignorePatterns: string[] = await this.parseGitignoreFiles(gitignoreFiles);

      // Expand the input globs to get the initial list of files
      // Using realpath to resolve symlinks, ensuring canonical paths
      const initialFilePaths: string[] = await glob(this.targetGlobs, {
        ignore: ignorePatterns,
        absolute: true,
        nodir: true,
        dot: true,
        cwd
      });
      const resolvedInitialFiles: string[] = await Promise.all(initialFilePaths.map((p) => realpath(p)));

      if (resolvedInitialFiles.length === 0) {
        console.warn('Warning: No files found matching the input glob patterns.');
        return [];
      }

      // Process each initial file to find its dependencies
      for (const absoluteFilePath of resolvedInitialFiles) {
        try {
          const dependencies: string[] = dependencyTree.toList({
            filename: absoluteFilePath,
            directory: cwd, // Use CWD as the base for module resolution
            filter: (path: string) => path.indexOf('node_modules') === -1, // Exclude node_modules by default
            noTypeDefinitions: true // Prefer .js/.jsx over .d.ts for TS projects
            // Add other options like tsConfig, webpackConfig if needed
          });

          // Add the initial file itself and its dependencies to the set
          // Using realpath ensures we store canonical paths in the set
          allDependencies.add(await realpath(absoluteFilePath));
          const resolvedDeps: string[] = await Promise.all(dependencies.map((p) => realpath(p)));
          resolvedDeps.forEach((dep) => allDependencies.add(dep));
        } catch (err: unknown) {
          // Log specific file processing errors but continue with others
          console.error(
            `Error processing dependencies for ${relative(cwd, absoluteFilePath)}:`,
            err instanceof Error ? err.message : 'Unknown error'
          );
          // Optionally, re-throw or exit if any single file error should halt the process
          // process.exit(1);
        }
      }

      // Convert all collected absolute paths to paths relative to the current working directory
      const relativeDependencies: string[] = [...allDependencies].map((absPath) => relative(cwd, absPath)).sort(); // Sort for consistent output order

      if (relativeDependencies.length === 0) {
        console.warn('Warning: No dependencies found for the specified files (excluding node_modules).');
      }

      return relativeDependencies;
    } catch (error: unknown) {
      // Handle errors during glob expansion or other general errors
      console.error('An unexpected error occurred:', error);
      throw error;
    }
  }
}
