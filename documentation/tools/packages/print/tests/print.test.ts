import * as fsSync from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import { parseCommandLineArgs } from '../src/bin/print-cli.js';
import { FilePrinter } from '../src/lib/FilePrinter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FilePrinter', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  let originalCwd: string;
  let originalArgv: string[];

  beforeEach(() => {
    originalCwd = process.cwd();
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.argv = originalArgv;
  });

  describe('constructor', () => {
    it('should create FilePrinter with options', () => {
      const options = { includes: ['**/*.ts'], excludes: ['node_modules/**'] };
      const printer = new FilePrinter(options);
      expect(printer).toBeInstanceOf(FilePrinter);
    });
  });

  describe('findGitignoreFiles', () => {
    it('should find .gitignore files in workspace', () => {
      const projectDir = path.join(fixturesDir, 'simple-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*'], excludes: [] });
      const gitignoreFiles = printer.findGitignoreFiles();

      // Should find at least the local .gitignore (may also find parent .gitignore files)
      expect(gitignoreFiles.length).toBeGreaterThanOrEqual(1);
      expect(gitignoreFiles.some((file) => file === '.gitignore')).toBe(true);
    });

    it('should return empty array when no .gitignore files exist', () => {
      // Create a temporary directory without .gitignore
      const tempDir = path.join(fixturesDir, 'temp-no-gitignore');
      if (!fsSync.existsSync(tempDir)) {
        fsSync.mkdirSync(tempDir);
      }
      process.chdir(tempDir);

      const printer = new FilePrinter({ includes: ['**/*'], excludes: [] });
      const gitignoreFiles = printer.findGitignoreFiles();

      // May find parent .gitignore files
      const localGitignoreFiles = gitignoreFiles.filter((file) => !file.startsWith('..'));
      expect(localGitignoreFiles).toEqual([]);

      // Clean up
      process.chdir(fixturesDir);
      fsSync.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('parseGitignoreFiles', () => {
    it('should parse gitignore patterns correctly', async () => {
      const projectDir = path.join(fixturesDir, 'simple-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*'], excludes: ['custom/**'] });
      const gitignoreFiles = printer.findGitignoreFiles();
      const patterns = await printer.parseGitignoreFiles(gitignoreFiles);

      expect(patterns).toContain('custom/**');
      expect(patterns).toContain('node_modules/');
      expect(patterns).toContain('*.log');

      // Should always include .git patterns
      expect(patterns).toContain('.git');
      expect(patterns).toContain('.git/**');
      expect(patterns).toContain('**/.git');
      expect(patterns).toContain('**/.git/**');
    });

    it('should handle missing gitignore files gracefully', async () => {
      const printer = new FilePrinter({ includes: ['**/*'], excludes: [] });
      const patterns = await printer.parseGitignoreFiles(['/nonexistent/.gitignore']);
      expect(patterns).toEqual(['.git', '.git/**', '**/.git', '**/.git/**', '.eslintcache', '**/.eslintcache']);
    });

    it('should always ignore .git directories even without gitignore files', async () => {
      const printer = new FilePrinter({ includes: ['**/*'], excludes: [] });
      const patterns = await printer.parseGitignoreFiles([]);

      expect(patterns).toContain('.git');
      expect(patterns).toContain('.git/**');
      expect(patterns).toContain('**/.git');
      expect(patterns).toContain('**/.git/**');
      expect(patterns).toContain('.eslintcache');
      expect(patterns).toContain('**/.eslintcache');
    });
  });

  describe('findFiles', () => {
    it('should find files matching include patterns', async () => {
      const projectDir = path.join(fixturesDir, 'simple-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      const files = await printer.findFiles([]);

      expect(files).toHaveLength(3); // file1.ts, src/component.ts, src/utils.ts
      expect(files.some((f) => f.endsWith('file1.ts'))).toBe(true);
      expect(files.some((f) => f.endsWith('src/component.ts'))).toBe(true);
      expect(files.some((f) => f.endsWith('src/utils.ts'))).toBe(true);
      expect(files.some((f) => f.endsWith('.md'))).toBe(false);
    });

    it('should exclude files matching ignore patterns', async () => {
      const projectDir = path.join(fixturesDir, 'complex-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      const gitignorePatterns = await printer.parseGitignoreFiles(printer.findGitignoreFiles());
      const files = await printer.findFiles(gitignorePatterns);

      // Should not include node_modules
      expect(files.some((f) => f.includes('node_modules'))).toBe(false);

      // Should include src files
      expect(files.some((f) => f.includes('src/index.ts'))).toBe(true);
    });

    it('should return sorted file list', async () => {
      const projectDir = path.join(fixturesDir, 'simple-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      const files = await printer.findFiles([]);

      // Check files are sorted
      const sortedFiles = [...files].sort();
      expect(files).toEqual(sortedFiles);
    });

    it('should handle relative path exclusions correctly', async () => {
      const projectDir = path.join(fixturesDir, 'complex-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: ['tests/**'] });
      const gitignorePatterns = await printer.parseGitignoreFiles(printer.findGitignoreFiles());
      const files = await printer.findFiles(gitignorePatterns);

      expect(files.some((f) => f.includes('tests/'))).toBe(false);
      expect(files.some((f) => f.includes('src/'))).toBe(true);
    });
  });

  describe('buildTree', () => {
    it('should build correct tree structure from file paths', async () => {
      const projectDir = path.join(fixturesDir, 'simple-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      const files = await printer.findFiles([]);
      const { tree, rootName } = printer.buildTree(files);

      expect(tree['file1.ts']).toBe(null);
      expect(tree.src).toBeDefined();
      expect((tree.src as Record<string, unknown>)['component.ts']).toBe(null);
      expect((tree.src as Record<string, unknown>)['utils.ts']).toBe(null);
      expect(rootName).toBe('simple-project');
    });

    it('should handle empty file list', () => {
      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      const { tree, rootName } = printer.buildTree([]);
      expect(tree).toEqual({});
      expect(rootName).toBeDefined();
    });

    it('should handle complex nested structure', async () => {
      const projectDir = path.join(fixturesDir, 'complex-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      const files = await printer.findFiles([]);
      const { tree, rootName } = printer.buildTree(files);

      expect(tree.src).toBeDefined();
      expect((tree.src as Record<string, unknown>).components).toBeDefined();
      expect((tree.src as Record<string, unknown>).utils).toBeDefined();
      expect((tree.src as Record<string, unknown>).services).toBeDefined();
      expect(rootName).toBe('complex-project');
    });
  });

  describe('generateFormattedTreeLines', () => {
    it('should generate correctly formatted tree lines', () => {
      const tree = {
        'file1.ts': null,
        src: {
          'file2.ts': null,
          utils: {
            'file3.ts': null
          }
        }
      };

      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      const lines = printer.generateFormattedTreeLines(tree);

      expect(lines).toContain('├─ file1.ts');
      expect(lines).toContain('└─ src/');
      expect(lines).toContain('   ├─ file2.ts');
      expect(lines).toContain('   └─ utils/');
      expect(lines).toContain('      └─ file3.ts');
    });

    it('should handle empty tree', () => {
      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      const lines = printer.generateFormattedTreeLines({});
      expect(lines).toEqual([]);
    });

    it('should handle single file tree', () => {
      const tree = { 'single.ts': null };
      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      const lines = printer.generateFormattedTreeLines(tree);

      expect(lines).toEqual(['└─ single.ts']);
    });
  });

  describe('getLanguageHint', () => {
    it('should return correct language hints for common file extensions', () => {
      const printer = new FilePrinter({ includes: [], excludes: [] });

      expect(printer.getLanguageHint('file.ts')).toBe('ts');
      expect(printer.getLanguageHint('file.tsx')).toBe('ts');
      expect(printer.getLanguageHint('file.js')).toBe('javascript');
      expect(printer.getLanguageHint('file.mjs')).toBe('javascript');
      expect(printer.getLanguageHint('file.cjs')).toBe('javascript');
      expect(printer.getLanguageHint('file.md')).toBe('markdown');
      expect(printer.getLanguageHint('file.json')).toBe('json');
      expect(printer.getLanguageHint('file.yaml')).toBe('yaml');
      expect(printer.getLanguageHint('file.yml')).toBe('yaml');
      expect(printer.getLanguageHint('file.py')).toBe('python');
      expect(printer.getLanguageHint('file.rb')).toBe('ruby');
      expect(printer.getLanguageHint('file.go')).toBe('go');
      expect(printer.getLanguageHint('file.rs')).toBe('rust');
      expect(printer.getLanguageHint('file.java')).toBe('java');
      expect(printer.getLanguageHint('file.c')).toBe('c');
      expect(printer.getLanguageHint('file.cpp')).toBe('cpp');
      expect(printer.getLanguageHint('file.h')).toBe('c');
      expect(printer.getLanguageHint('file.sh')).toBe('bash');
      expect(printer.getLanguageHint('file.sql')).toBe('sql');
      expect(printer.getLanguageHint('file.xml')).toBe('xml');
      expect(printer.getLanguageHint('file.html')).toBe('html');
      expect(printer.getLanguageHint('file.css')).toBe('css');
      expect(printer.getLanguageHint('file.scss')).toBe('scss');
    });

    it('should return the extension for unknown file types', () => {
      const printer = new FilePrinter({ includes: [], excludes: [] });
      expect(printer.getLanguageHint('file.unknown')).toBe('unknown');
      expect(printer.getLanguageHint('file.xyz')).toBe('xyz');
    });

    it('should handle files without extensions', () => {
      const printer = new FilePrinter({ includes: [], excludes: [] });
      expect(printer.getLanguageHint('README')).toBe('');
      expect(printer.getLanguageHint('Makefile')).toBe('');
    });
  });

  describe('printFormattedFileContents', () => {
    let consoleSpy: jest.SpiedFunction<typeof console.log>;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should print file contents with correct formatting', async () => {
      const projectDir = path.join(fixturesDir, 'simple-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/file1.ts'], excludes: [] });
      const files = await printer.findFiles([]);
      await printer.printFormattedFileContents(files);

      expect(consoleSpy).toHaveBeenCalledWith('\n### file1.ts');
      expect(consoleSpy).toHaveBeenCalledWith('```ts');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('export function hello()'));
      expect(consoleSpy).toHaveBeenCalledWith('```');
    });

    it('should handle multiple files', async () => {
      const projectDir = path.join(fixturesDir, 'simple-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      const files = await printer.findFiles([]);
      await printer.printFormattedFileContents(files);

      // Should print all TypeScript files
      expect(consoleSpy).toHaveBeenCalledWith('\n### file1.ts');
      expect(consoleSpy).toHaveBeenCalledWith('\n### src/component.ts');
      expect(consoleSpy).toHaveBeenCalledWith('\n### src/utils.ts');
    });
  });

  describe('execute', () => {
    let consoleSpy: jest.SpiedFunction<typeof console.log>;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should execute complete print workflow', async () => {
      const projectDir = path.join(fixturesDir, 'simple-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*.ts'], excludes: [] });
      await printer.execute();

      // Should print directory tree
      expect(consoleSpy).toHaveBeenCalledWith('### Directory tree');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('simple-project'));

      // Should print file contents
      expect(consoleSpy).toHaveBeenCalledWith('\n### file1.ts');
      expect(consoleSpy).toHaveBeenCalledWith('\n### src/component.ts');
      expect(consoleSpy).toHaveBeenCalledWith('\n### src/utils.ts');
    });

    it('should handle no files found', async () => {
      const projectDir = path.join(fixturesDir, 'empty-project');
      process.chdir(projectDir);

      const printer = new FilePrinter({ includes: ['**/*.nonexistent'], excludes: [] });
      await printer.execute();

      expect(consoleSpy).toHaveBeenCalledWith('No files found matching the patterns.');
    });
  });
});

describe('parseCommandLineArgs', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('should parse include patterns correctly', () => {
    const options = parseCommandLineArgs(['**/*.ts', 'src/**/*.js']);

    expect(options.includes).toEqual(['**/*.ts', 'src/**/*.js']);
    expect(options.excludes).toEqual([]);
  });

  it('should parse exclude patterns correctly', () => {
    const options = parseCommandLineArgs(['**/*.ts', '--exclude', 'node_modules/**', '--exclude', '*.test.ts']);

    expect(options.includes).toEqual(['**/*.ts']);
    expect(options.excludes).toEqual(['node_modules/**', '*.test.ts']);
  });

  it('should handle short exclude flag', () => {
    const options = parseCommandLineArgs(['**/*.ts', '-e', 'node_modules/**']);

    expect(options.includes).toEqual(['**/*.ts']);
    expect(options.excludes).toEqual(['node_modules/**']);
  });

  it('should handle single exclude pattern', () => {
    const options = parseCommandLineArgs(['**/*.ts', '--exclude', 'node_modules/**']);

    expect(options.includes).toEqual(['**/*.ts']);
    expect(options.excludes).toEqual(['node_modules/**']);
  });

  it('should use default pattern when no patterns provided', () => {
    const options = parseCommandLineArgs([]);

    expect(options.includes).toEqual(['**/*']);
    expect(options.excludes).toEqual([]);
  });
});
