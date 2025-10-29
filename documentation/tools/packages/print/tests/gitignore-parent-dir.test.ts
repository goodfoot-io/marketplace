import { mkdir, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilePrinter } from '../src/lib/FilePrinter.js';

describe('FilePrinter - Parent Directory .gitignore', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Save original working directory
    originalCwd = process.cwd();

    // Create a temporary directory structure that mimics the issue
    testDir = join(tmpdir(), `print-test-${Date.now()}`);

    // Create structure:
    // testDir/
    //   parent/
    //     .gitignore (contains "node_modules")
    //     project/
    //       tools/
    //         src/
    //           index.ts
    //         node_modules/
    //           some-package/
    //             index.js

    await mkdir(join(testDir, 'parent'), { recursive: true });
    await mkdir(join(testDir, 'parent/project/tools/src'), { recursive: true });
    await mkdir(join(testDir, 'parent/project/tools/node_modules/some-package'), { recursive: true });

    // Create .gitignore in parent directory
    await writeFile(join(testDir, 'parent/.gitignore'), 'node_modules\n.DS_Store\n*.log\n');

    // Create test files
    await writeFile(join(testDir, 'parent/project/tools/src/index.ts'), 'export const hello = "world";\n');
    await writeFile(join(testDir, 'parent/project/tools/node_modules/some-package/index.js'), 'module.exports = {};\n');
  });

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should respect .gitignore from parent directory when running from grandparent', async () => {
    // Change to the parent directory (one level above the project)
    process.chdir(join(testDir, 'parent'));

    const printer = new FilePrinter({
      includes: ['project/tools/**/*.ts', 'project/tools/**/*.js'],
      excludes: []
    });

    // This should call the internal methods that find gitignore files
    const gitignoreFiles = printer.findGitignoreFiles();

    // Should find the .gitignore in current directory
    expect(gitignoreFiles).toContain('.gitignore');

    // Parse gitignore files and check patterns
    const ignorePatterns = await printer.parseGitignoreFiles(gitignoreFiles);
    expect(ignorePatterns).toContain('node_modules');

    // Find files - should exclude node_modules
    const files = await printer.findFiles(ignorePatterns);

    // Should find the TypeScript file
    const tsFiles = files.filter((f) => f.endsWith('.ts'));
    expect(tsFiles).toHaveLength(1);
    expect(tsFiles[0]).toContain('project/tools/src/index.ts');

    // Should NOT find files in node_modules
    const nodeModulesFiles = files.filter((f) => f.includes('node_modules'));
    expect(nodeModulesFiles).toHaveLength(0);
  });

  it('should respect .gitignore when pattern starts with subdirectory', async () => {
    // This test simulates: cd /Users/johnwehr/Desktop && print-filesystem "welcomenewsouls/tools/**/*.ts"
    process.chdir(testDir);

    const printer = new FilePrinter({
      includes: ['parent/project/tools/**/*.ts', 'parent/project/tools/**/*.js'],
      excludes: []
    });

    const gitignoreFiles = printer.findGitignoreFiles();

    // Should find the .gitignore in the parent subdirectory
    const parentGitignore = gitignoreFiles.find((f) => f.includes('parent/.gitignore'));
    expect(parentGitignore).toBeDefined();

    const ignorePatterns = await printer.parseGitignoreFiles(gitignoreFiles);
    const files = await printer.findFiles(ignorePatterns);

    // Should exclude node_modules
    const nodeModulesFiles = files.filter((f) => f.includes('node_modules'));
    expect(nodeModulesFiles).toHaveLength(0);
  });

  it('should find .gitignore files in all directories mentioned in patterns', async () => {
    process.chdir(testDir);

    // Create another project with its own .gitignore
    await mkdir(join(testDir, 'another-project/src'), { recursive: true });
    await writeFile(join(testDir, 'another-project/.gitignore'), 'build/\n');
    await writeFile(join(testDir, 'another-project/src/index.ts'), 'export const foo = "bar";\n');

    const printer = new FilePrinter({
      includes: ['parent/project/**/*.ts', 'another-project/**/*.ts'],
      excludes: []
    });

    const gitignoreFiles = printer.findGitignoreFiles();

    // Should find both .gitignore files
    expect(gitignoreFiles.some((f) => f.includes('parent/.gitignore'))).toBe(true);
    expect(gitignoreFiles.some((f) => f.includes('another-project/.gitignore'))).toBe(true);
  });
});
