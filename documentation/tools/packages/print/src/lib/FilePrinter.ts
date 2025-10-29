import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob as globBase } from 'glob';
import { isText } from 'istextorbinary';

export interface FilePrinterOptions {
  includes: string[];
  excludes: string[];
}

export class FilePrinter {
  private includes: string[];
  private excludes: string[];

  constructor(options: FilePrinterOptions) {
    // Normalize patterns by removing leading ./
    this.includes = options.includes.map((pattern) => {
      if (pattern.startsWith('./')) {
        return pattern.slice(2);
      }
      return pattern;
    });
    this.excludes = options.excludes.map((pattern) => {
      if (pattern.startsWith('./')) {
        return pattern.slice(2);
      }
      return pattern;
    });
  }

  findGitignoreFiles(): string[] {
    const files: string[] = [];
    const searchedDirs = new Set<string>();

    // Extract directories from the include patterns
    for (const pattern of this.includes) {
      // Get the directory part of the pattern
      const parts = pattern.split('/');
      let dirPath = '';

      for (const part of parts) {
        if (part.includes('*') || part.includes('?') || part.includes('[')) {
          break;
        }
        dirPath = dirPath ? path.join(dirPath, part) : part;
      }

      if (dirPath && !searchedDirs.has(dirPath)) {
        searchedDirs.add(dirPath);

        // Search for .gitignore files in this directory and its subdirectories
        const gitignorePattern = path.join(dirPath, '**/.gitignore');
        const dirGitignores = globBase.sync(gitignorePattern, {
          ignore: ['.git/**', '**/.git/**', '**/node_modules/**'],
          dot: true,
          absolute: false
        });
        files.push(...dirGitignores);

        // Also check for .gitignore in the directory itself
        const directGitignore = path.join(dirPath, '.gitignore');
        if (fsSync.existsSync(directGitignore) && !files.includes(directGitignore)) {
          files.push(directGitignore);
        }

        // IMPORTANT: Also check all parent directories of this path
        let checkDir = dirPath;
        while (checkDir && checkDir !== '.' && checkDir !== '/') {
          const parentGitignore = path.join(checkDir, '.gitignore');
          if (fsSync.existsSync(parentGitignore) && !files.includes(parentGitignore)) {
            files.push(parentGitignore);
          }
          checkDir = path.dirname(checkDir);
        }
      }
    }

    // Also find .gitignore files in current directory if not already searched
    if (!searchedDirs.has('.') && !searchedDirs.has('')) {
      const localFiles = globBase.sync('**/.gitignore', {
        ignore: ['.git/**', '**/.git/**', '**/node_modules/**'],
        dot: true,
        absolute: false
      });
      files.push(...localFiles);
    }

    // Then, look for .gitignore files in parent directories
    let currentDir = process.cwd();
    let parentDir = path.dirname(currentDir);

    while (parentDir !== currentDir) {
      const parentGitignore = path.join(parentDir, '.gitignore');
      if (fsSync.existsSync(parentGitignore)) {
        // Convert to relative path from current directory
        const relativePath = path.relative(process.cwd(), parentGitignore);
        files.push(relativePath);
      }
      currentDir = parentDir;
      parentDir = path.dirname(currentDir);
    }

    // Remove duplicates
    return [...new Set(files)];
  }

  async parseGitignoreFiles(gitignoreFiles: string[]): Promise<string[]> {
    const patterns = [...this.excludes];

    // Always ignore .git directories and common cache files
    patterns.push('.git', '.git/**', '**/.git', '**/.git/**');
    patterns.push('.eslintcache', '**/.eslintcache');

    for (const file of gitignoreFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        const dir = path.dirname(file);
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
            // We need to handle these patterns specially
            if (normalizedPattern.startsWith('/')) {
              // Absolute patterns in parent .gitignore don't apply to subdirectories
              continue;
            } else {
              // Relative patterns from parent should apply to all subdirectories
              patterns.push(normalizedPattern);
              patterns.push('**/' + normalizedPattern);
            }
          } else {
            // For gitignore files in subdirectories
            // Handle absolute patterns (starting with /)
            if (normalizedPattern.startsWith('/')) {
              patterns.push(path.join(dir, normalizedPattern.slice(1)));
            } else {
              // For relative patterns like "node_modules", they should match:
              // 1. In the gitignore's directory: dir/node_modules
              patterns.push(path.join(dir, normalizedPattern));
              // 2. In any subdirectory: dir/**/node_modules
              patterns.push(path.join(dir, '**', normalizedPattern));
            }
          }
        }
      } catch (error: unknown) {
        console.error(`Error reading ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Final normalization: ensure no pattern starts with ./
    return patterns.map((pattern) => {
      if (pattern.startsWith('./')) {
        return pattern.slice(2);
      }
      return pattern;
    });
  }

  async findFiles(ignorePatterns: string[]): Promise<string[]> {
    try {
      // Use the ignore package to properly handle gitignore patterns
      const ignoreModule = await import('ignore');
      const ig = ignoreModule.default();

      // Add all ignore patterns
      ig.add(ignorePatterns);

      // First, use regular glob to find all matching files
      const allFiles = await globBase(this.includes, {
        ignore: this.excludes,
        nodir: true,
        dot: true,
        absolute: false
      });

      // Filter files using the ignore instance
      let files = allFiles.filter((file) => !ig.ignores(file));

      // Normalize files to remove leading ./
      files = files.map((file) => {
        if (file.startsWith('./')) {
          return file.slice(2);
        }
        return file;
      });

      // Filter to only include text files
      const textFiles = await Promise.all(
        files.map(async (file) => {
          try {
            const stats = await fs.stat(file);
            if (stats.size > 1024 * 1024) {
              // Skip files larger than 1MB
              return null;
            }
            const buffer = await fs.readFile(file);
            return isText(file, buffer) ? file : null;
          } catch {
            return null;
          }
        })
      );

      return textFiles.filter((file): file is string => file !== null).sort();
    } catch (error) {
      console.error('Error finding files:', error);
      return [];
    }
  }

  buildTree(files: string[]): { tree: Record<string, unknown>; rootName: string } {
    const tree: Record<string, unknown> = {};

    // Convert all files to absolute paths
    const absolutePaths = files.map((file) => path.resolve(process.cwd(), file));

    // Check if any files go outside the current working directory
    const cwd = process.cwd();
    const anyOutsideCwd = files.some((file) => file.startsWith('../'));

    let commonRoot: string;

    if (anyOutsideCwd) {
      // If files go outside cwd, find the actual common ancestor
      commonRoot = absolutePaths[0];
      if (absolutePaths.length > 1) {
        commonRoot = path.dirname(commonRoot);

        for (const filePath of absolutePaths) {
          while (!filePath.startsWith(commonRoot + path.sep) && commonRoot !== path.dirname(commonRoot)) {
            commonRoot = path.dirname(commonRoot);
          }
        }
      } else {
        // For a single file outside cwd, go up to find a meaningful root
        commonRoot = path.dirname(commonRoot);
      }

      // Find the repository root by going up until we find .git or reach filesystem root
      let repoRoot = commonRoot;
      let current = repoRoot;

      while (current !== path.dirname(current)) {
        if (fsSync.existsSync(path.join(current, '.git'))) {
          repoRoot = current;
          break;
        }
        // Also check for key project markers
        if (
          fsSync.existsSync(path.join(current, 'CLAUDE.md')) ||
          fsSync.existsSync(path.join(current, '.gitignore')) ||
          (fsSync.existsSync(path.join(current, 'package.json')) &&
            fsSync.existsSync(path.join(current, 'tools')) &&
            fsSync.existsSync(path.join(current, 'protocols')))
        ) {
          repoRoot = current;
          break;
        }
        current = path.dirname(current);
      }

      // Use the repository root if it's not too far from our common root
      const depthFromRepo = path.relative(repoRoot, commonRoot).split(path.sep).length;
      if (depthFromRepo <= 3) {
        commonRoot = repoRoot;
      }
    } else {
      // If all files are within cwd, use cwd as root
      commonRoot = cwd;
    }

    const rootName = path.basename(commonRoot);

    files.forEach((file) => {
      // Convert relative paths to absolute, then back to relative from common root
      const absolutePath = path.resolve(process.cwd(), file);
      const relativeFromRoot = path.relative(commonRoot, absolutePath);
      const parts = relativeFromRoot.split(path.sep);
      let current = tree;

      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = null;
        } else {
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part] as Record<string, unknown>;
        }
      });
    });

    return { tree, rootName };
  }

  generateFormattedTreeLines(tree: Record<string, unknown>, prefix: string = ''): string[] {
    const entries = Object.entries(tree);
    const lines: string[] = [];

    entries.forEach(([key, value], index) => {
      const isLast = index === entries.length - 1;
      const connector = isLast ? '└─' : '├─';
      const extension = isLast ? '   ' : '│  ';

      if (value === null) {
        lines.push(`${prefix}${connector} ${key}`);
      } else {
        lines.push(`${prefix}${connector} ${key}/`);
        const subLines = this.generateFormattedTreeLines(value as Record<string, unknown>, prefix + extension);
        lines.push(...subLines);
      }
    });

    return lines;
  }

  getLanguageHint(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'ts',
      '.tsx': 'ts',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.json': 'json',
      '.md': 'markdown',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.py': 'python',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.r': 'r',
      '.R': 'r',
      '.m': 'objc',
      '.mm': 'objcpp',
      '.pl': 'perl',
      '.lua': 'lua',
      '.vim': 'vim',
      '.sh': 'bash',
      '.bash': 'bash',
      '.zsh': 'zsh',
      '.fish': 'fish',
      '.ps1': 'powershell',
      '.clj': 'clojure',
      '.sql': 'sql',
      '.dockerfile': 'dockerfile',
      '.Dockerfile': 'dockerfile',
      '.makefile': 'makefile',
      '.Makefile': 'makefile',
      '.cmake': 'cmake',
      '.proto': 'protobuf'
    };
    return languageMap[ext] || ext.slice(1);
  }

  async printFormattedFileContents(files: string[]): Promise<void> {
    // Use the same logic as buildTree to find the common root
    const absolutePaths = files.map((file) => path.resolve(process.cwd(), file));
    const cwd = process.cwd();
    const anyOutsideCwd = files.some((file) => file.startsWith('../'));

    let commonRoot: string;

    if (anyOutsideCwd) {
      commonRoot = absolutePaths[0];
      if (absolutePaths.length > 1) {
        commonRoot = path.dirname(commonRoot);

        for (const filePath of absolutePaths) {
          while (!filePath.startsWith(commonRoot + path.sep) && commonRoot !== path.dirname(commonRoot)) {
            commonRoot = path.dirname(commonRoot);
          }
        }
      } else {
        commonRoot = path.dirname(commonRoot);
      }

      // Find the repository root by going up until we find .git or reach filesystem root
      let repoRoot = commonRoot;
      let current = repoRoot;

      while (current !== path.dirname(current)) {
        if (fsSync.existsSync(path.join(current, '.git'))) {
          repoRoot = current;
          break;
        }
        // Also check for key project markers
        if (
          fsSync.existsSync(path.join(current, 'CLAUDE.md')) ||
          fsSync.existsSync(path.join(current, '.gitignore')) ||
          (fsSync.existsSync(path.join(current, 'package.json')) &&
            fsSync.existsSync(path.join(current, 'tools')) &&
            fsSync.existsSync(path.join(current, 'protocols')))
        ) {
          repoRoot = current;
          break;
        }
        current = path.dirname(current);
      }

      // Use the repository root if it's not too far from our common root
      const depthFromRepo = path.relative(repoRoot, commonRoot).split(path.sep).length;
      if (depthFromRepo <= 3) {
        commonRoot = repoRoot;
      }
    } else {
      commonRoot = cwd;
    }

    for (const file of files) {
      // Convert to absolute path, then to relative from common root
      const absolutePath = path.resolve(process.cwd(), file);
      const relativeFromRoot = path.relative(commonRoot, absolutePath);
      const languageHint = this.getLanguageHint(file);

      console.log(`\n### ${relativeFromRoot}`);
      console.log(`\`\`\`${languageHint}`);
      try {
        const content = await fs.readFile(file, 'utf-8');
        console.log(content.trimEnd());
      } catch (error) {
        console.log(`// Error reading file: ${error instanceof Error ? error.message : String(error)}`);
      }
      console.log('```');
    }
  }

  async execute(): Promise<void> {
    const gitignoreFiles = this.findGitignoreFiles();
    const ignorePatterns = await this.parseGitignoreFiles(gitignoreFiles);
    const files = await this.findFiles(ignorePatterns);

    if (files.length === 0) {
      console.log('No files found matching the patterns.');
      return;
    }

    const { tree, rootName } = this.buildTree(files);

    console.log('### Directory tree');
    console.log(`${rootName}/`);
    const treeLines = this.generateFormattedTreeLines(tree);
    treeLines.forEach((line) => console.log(line));

    await this.printFormattedFileContents(files);
  }
}
