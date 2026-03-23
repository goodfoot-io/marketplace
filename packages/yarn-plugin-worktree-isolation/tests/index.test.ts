import fs from 'fs';
import os from 'os';
import path from 'path';
import { isExternalSymlink, isGitWorktree, removeSymlink, findWorkspaceNodeModules, createInternalSymlink } from '../sources/index.js';

describe('yarn-plugin-worktree-isolation', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yarn-plugin-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('isGitWorktree', () => {
    it('returns false when .git does not exist', () => {
      expect(isGitWorktree(tempDir)).toBe(false);
    });

    it('returns false when .git is a directory (normal repo)', () => {
      const gitDir = path.join(tempDir, '.git');
      fs.mkdirSync(gitDir);
      expect(isGitWorktree(tempDir)).toBe(false);
    });

    it('returns true when .git is a file starting with "gitdir:"', () => {
      const gitFile = path.join(tempDir, '.git');
      fs.writeFileSync(gitFile, 'gitdir: /some/path/to/.git/worktrees/my-worktree');
      expect(isGitWorktree(tempDir)).toBe(true);
    });

    it('returns false when .git is a file with other content', () => {
      const gitFile = path.join(tempDir, '.git');
      fs.writeFileSync(gitFile, 'some other content that is not a gitdir reference');
      expect(isGitWorktree(tempDir)).toBe(false);
    });
  });

  describe('isExternalSymlink', () => {
    it('returns false for non-existent path', () => {
      const nonExistent = path.join(tempDir, 'does-not-exist');
      expect(isExternalSymlink(nonExistent, tempDir)).toBe(false);
    });

    it('returns false for regular file', () => {
      const regularFile = path.join(tempDir, 'regular-file.txt');
      fs.writeFileSync(regularFile, 'content');
      expect(isExternalSymlink(regularFile, tempDir)).toBe(false);
    });

    it('returns false for directory', () => {
      const directory = path.join(tempDir, 'some-directory');
      fs.mkdirSync(directory);
      expect(isExternalSymlink(directory, tempDir)).toBe(false);
    });

    it('returns false for symlink pointing inside project root', () => {
      const targetDir = path.join(tempDir, 'target');
      fs.mkdirSync(targetDir);
      const symlinkPath = path.join(tempDir, 'internal-link');
      fs.symlinkSync(targetDir, symlinkPath);
      expect(isExternalSymlink(symlinkPath, tempDir)).toBe(false);
    });

    it('returns true for symlink pointing outside project root', () => {
      // Create an external directory outside tempDir
      const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'external-'));
      try {
        const symlinkPath = path.join(tempDir, 'external-link');
        fs.symlinkSync(externalDir, symlinkPath);
        expect(isExternalSymlink(symlinkPath, tempDir)).toBe(true);
      } finally {
        fs.rmSync(externalDir, { recursive: true, force: true });
      }
    });
  });

  describe('removeSymlink', () => {
    it('returns false for non-existent path', () => {
      const nonExistent = path.join(tempDir, 'does-not-exist');
      expect(removeSymlink(nonExistent, false)).toBe(false);
    });

    it('returns false for regular file (does not remove it)', () => {
      const regularFile = path.join(tempDir, 'regular-file.txt');
      fs.writeFileSync(regularFile, 'content');
      expect(removeSymlink(regularFile, false)).toBe(false);
      // Verify file still exists
      expect(fs.existsSync(regularFile)).toBe(true);
    });

    it('returns true for symlink and removes it', () => {
      const targetDir = path.join(tempDir, 'target');
      fs.mkdirSync(targetDir);
      const symlinkPath = path.join(tempDir, 'link-to-remove');
      fs.symlinkSync(targetDir, symlinkPath);

      expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
      expect(removeSymlink(symlinkPath, false)).toBe(true);
      expect(fs.existsSync(symlinkPath)).toBe(false);
    });

    it('works correctly with verbose=true (symlink still removed)', () => {
      const targetDir = path.join(tempDir, 'target');
      fs.mkdirSync(targetDir);
      const symlinkPath = path.join(tempDir, 'verbose-link');
      fs.symlinkSync(targetDir, symlinkPath);

      // Capture console.log output
      const originalLog = console.log;
      const logMessages: string[] = [];
      console.log = (message: string) => logMessages.push(message);

      try {
        expect(removeSymlink(symlinkPath, true)).toBe(true);
        expect(fs.existsSync(symlinkPath)).toBe(false);
        expect(logMessages.some((msg) => msg.includes('[worktree-isolation]'))).toBe(true);
        expect(logMessages.some((msg) => msg.includes('Removed symlink'))).toBe(true);
      } finally {
        console.log = originalLog;
      }
    });

    it('works correctly with verbose=false', () => {
      const targetDir = path.join(tempDir, 'target');
      fs.mkdirSync(targetDir);
      const symlinkPath = path.join(tempDir, 'quiet-link');
      fs.symlinkSync(targetDir, symlinkPath);

      // Capture console.log output
      const originalLog = console.log;
      const logMessages: string[] = [];
      console.log = (message: string) => logMessages.push(message);

      try {
        expect(removeSymlink(symlinkPath, false)).toBe(true);
        expect(fs.existsSync(symlinkPath)).toBe(false);
        // No log messages should be output when verbose is false
        expect(logMessages.length).toBe(0);
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('createInternalSymlink', () => {
    it('creates a relative symlink pointing to rootNodeModules', () => {
      const rootNodeModules = path.join(tempDir, 'node_modules');
      fs.mkdirSync(rootNodeModules);
      const workspaceDir = path.join(tempDir, 'packages', 'foo');
      fs.mkdirSync(workspaceDir, { recursive: true });
      const symlinkPath = path.join(workspaceDir, 'node_modules');

      expect(createInternalSymlink(symlinkPath, rootNodeModules, false)).toBe(true);
      expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
      // Target should be relative, not absolute
      expect(fs.readlinkSync(symlinkPath)).toBe('../../node_modules');
      // Resolving the symlink should reach the root node_modules
      expect(fs.realpathSync(symlinkPath)).toBe(fs.realpathSync(rootNodeModules));
    });

    it('returns false when symlink already exists', () => {
      const rootNodeModules = path.join(tempDir, 'node_modules');
      fs.mkdirSync(rootNodeModules);
      const workspaceDir = path.join(tempDir, 'packages', 'foo');
      fs.mkdirSync(workspaceDir, { recursive: true });
      const symlinkPath = path.join(workspaceDir, 'node_modules');
      fs.symlinkSync(rootNodeModules, symlinkPath);

      expect(createInternalSymlink(symlinkPath, rootNodeModules, false)).toBe(false);
    });

    it('returns false when parent directory does not exist', () => {
      const rootNodeModules = path.join(tempDir, 'node_modules');
      fs.mkdirSync(rootNodeModules);
      const symlinkPath = path.join(tempDir, 'nonexistent', 'node_modules');

      expect(createInternalSymlink(symlinkPath, rootNodeModules, false)).toBe(false);
    });

    it('logs when verbose is true', () => {
      const rootNodeModules = path.join(tempDir, 'node_modules');
      fs.mkdirSync(rootNodeModules);
      const workspaceDir = path.join(tempDir, 'packages', 'bar');
      fs.mkdirSync(workspaceDir, { recursive: true });
      const symlinkPath = path.join(workspaceDir, 'node_modules');

      const originalLog = console.log;
      const logMessages: string[] = [];
      console.log = (message: string) => logMessages.push(message);

      try {
        expect(createInternalSymlink(symlinkPath, rootNodeModules, true)).toBe(true);
        expect(logMessages.some((msg) => msg.includes('[worktree-isolation]'))).toBe(true);
        expect(logMessages.some((msg) => msg.includes('Created symlink'))).toBe(true);
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('findWorkspaceNodeModules', () => {
    it('returns only root node_modules when workspaces is null', () => {
      const result = findWorkspaceNodeModules(tempDir, null);
      expect(result).toEqual([path.join(tempDir, 'node_modules')]);
    });

    it('returns only root node_modules when workspaces is empty array', () => {
      const result = findWorkspaceNodeModules(tempDir, []);
      expect(result).toEqual([path.join(tempDir, 'node_modules')]);
    });

    it('returns root + workspace node_modules paths', () => {
      const workspaceDir = path.join(tempDir, 'packages', 'my-package');
      const result = findWorkspaceNodeModules(tempDir, [{ cwd: workspaceDir as never }]);
      expect(result).toEqual([path.join(tempDir, 'node_modules'), path.join(workspaceDir, 'node_modules')]);
    });

    it('handles multiple workspaces correctly', () => {
      const workspace1 = path.join(tempDir, 'packages', 'package-a');
      const workspace2 = path.join(tempDir, 'packages', 'package-b');
      const workspace3 = path.join(tempDir, 'apps', 'web');

      const result = findWorkspaceNodeModules(tempDir, [
        { cwd: workspace1 as never },
        { cwd: workspace2 as never },
        { cwd: workspace3 as never }
      ]);

      expect(result).toEqual([
        path.join(tempDir, 'node_modules'),
        path.join(workspace1, 'node_modules'),
        path.join(workspace2, 'node_modules'),
        path.join(workspace3, 'node_modules')
      ]);
    });
  });
});
