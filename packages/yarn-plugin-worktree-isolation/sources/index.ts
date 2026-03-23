/**
 * Yarn Plugin: Worktree Isolation
 *
 * This plugin isolates git worktrees by removing external symlinks before yarn
 * install proceeds. When working in a git worktree, yarn may create symlinks
 * pointing back to the main repository's node_modules and .yarn directories.
 * This can cause unintended modifications to the main workspace during installs.
 *
 * The plugin uses the `validateProject` hook which runs before yarn begins
 * installation. When it detects a git worktree environment, it checks for and
 * removes any symlinks that point outside the project root.
 *
 * Environment Variables:
 * - WORKTREE_ISOLATION_DISABLE=1: Disables the plugin entirely
 * - WORKTREE_ISOLATION_VERBOSE=1: Enables verbose logging
 *
 * @packageDocumentation
 */

import type { Plugin, Hooks, Project } from '@yarnpkg/core';
import type { PortablePath } from '@yarnpkg/fslib';
import fs from 'fs';
import path from 'path';
import { MessageName } from '@yarnpkg/core';

/**
 * Workspace information used to locate node_modules directories.
 */
interface WorkspaceInfo {
  cwd: PortablePath;
}

/**
 * Report interface for the validateProject hook.
 */
interface ValidationReport {
  reportWarning: (name: MessageName, message: string) => void;
}

/**
 * Project interface for the validateProject hook.
 */
interface ValidationProject {
  cwd: PortablePath;
  workspaces: WorkspaceInfo[];
}

/**
 * Checks if a file path is a symbolic link pointing to a location outside the project root.
 *
 * @param filePath - The path to check
 * @param projectRoot - The root directory of the project
 * @returns `true` if the path is a symlink pointing outside the project, `false` otherwise
 */
export function isExternalSymlink(filePath: string, projectRoot: string): boolean {
  try {
    const stats = fs.lstatSync(filePath);
    if (!stats.isSymbolicLink()) {
      return false;
    }
    const target = fs.realpathSync(filePath);
    const resolvedProjectRoot = fs.realpathSync(projectRoot);
    return !target.startsWith(resolvedProjectRoot);
  } catch {
    return false;
  }
}

/**
 * Checks if the given directory is a git worktree by examining the .git file.
 *
 * In a git worktree, .git is a file (not a directory) containing a gitdir reference.
 * In a normal git repository, .git is a directory.
 *
 * @param projectRoot - The root directory of the project to check
 * @returns `true` if the directory is a git worktree, `false` otherwise
 */
export function isGitWorktree(projectRoot: string): boolean {
  const gitPath = path.join(projectRoot, '.git');
  try {
    const stats = fs.statSync(gitPath);
    if (stats.isFile()) {
      const content = fs.readFileSync(gitPath, 'utf8');
      return content.startsWith('gitdir:');
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Removes a symbolic link at the given path.
 *
 * @param filePath - The path of the symlink to remove
 * @param verbose - If true, logs the removal to console
 * @returns `true` if the symlink was successfully removed, `false` otherwise
 */
export function removeSymlink(filePath: string, verbose: boolean): boolean {
  try {
    const stats = fs.lstatSync(filePath);
    if (stats.isSymbolicLink()) {
      const target = fs.readlinkSync(filePath);
      fs.unlinkSync(filePath);
      if (verbose) {
        console.log(`[worktree-isolation] Removed symlink: ${filePath} -> ${target}`);
      }
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Finds all node_modules directories in the project and its workspaces.
 *
 * @param projectRoot - The root directory of the project
 * @param workspaces - Array of workspace objects with cwd properties, or null
 * @returns Array of paths to node_modules directories
 */
export function findWorkspaceNodeModules(projectRoot: string, workspaces: WorkspaceInfo[] | null): string[] {
  const nodeModulesPaths = [path.join(projectRoot, 'node_modules')];
  if (workspaces) {
    for (const workspace of workspaces) {
      const workspaceNodeModules = path.join(workspace.cwd, 'node_modules');
      nodeModulesPaths.push(workspaceNodeModules);
    }
  }
  return nodeModulesPaths;
}

/**
 * Creates a symlink at `symlinkPath` pointing (relatively) to `rootNodeModules`.
 *
 * Uses a relative target so the symlink remains valid regardless of where the
 * worktree is mounted.
 *
 * @param symlinkPath - The path where the new symlink should be created
 * @param rootNodeModules - The worktree's own root node_modules directory
 * @param verbose - If true, logs the creation to console
 * @returns `true` if the symlink was successfully created, `false` otherwise
 */
export function createInternalSymlink(symlinkPath: string, rootNodeModules: string, verbose: boolean): boolean {
  try {
    const symlinkDir = path.dirname(symlinkPath);
    const relativeTarget = path.relative(symlinkDir, rootNodeModules);
    fs.symlinkSync(relativeTarget, symlinkPath);
    if (verbose) {
      console.log(`[worktree-isolation] Created symlink: ${symlinkPath} -> ${relativeTarget}`);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Workspace node_modules paths that were removed during validateProject and
 * should be re-symlinked after install completes.
 */
const pendingResymlinks: { symlinkPath: string; projectRoot: string }[] = [];

/**
 * The plugin hooks implementation.
 */
const hooks: Hooks = {
  validateProject(project: ValidationProject, report: ValidationReport): void {
    if (process.env.WORKTREE_ISOLATION_DISABLE === '1') {
      return;
    }
    const verbose = process.env.WORKTREE_ISOLATION_VERBOSE === '1';
    const projectRoot = project.cwd;

    if (!isGitWorktree(projectRoot)) {
      if (verbose) {
        console.log('[worktree-isolation] Not a git worktree, skipping');
      }
      return;
    }

    if (verbose) {
      console.log(`[worktree-isolation] Detected git worktree at: ${projectRoot}`);
    }

    let unlinkedCount = 0;
    const unlinkedPaths: string[] = [];

    const yarnDir = path.join(projectRoot, '.yarn');
    if (isExternalSymlink(yarnDir, projectRoot)) {
      if (removeSymlink(yarnDir, verbose)) {
        unlinkedCount++;
        unlinkedPaths.push('.yarn');
      }
    }

    const nodeModulesPaths = findWorkspaceNodeModules(projectRoot, project.workspaces);
    for (const nodeModulesPath of nodeModulesPaths) {
      if (isExternalSymlink(nodeModulesPath, projectRoot)) {
        if (removeSymlink(nodeModulesPath, verbose)) {
          unlinkedCount++;
          const relativePath = path.relative(projectRoot, nodeModulesPath);
          unlinkedPaths.push(relativePath);
          // Skip the root node_modules — Yarn will regenerate it. Only
          // per-workspace node_modules need to be re-symlinked afterward.
          if (nodeModulesPath !== path.join(projectRoot, 'node_modules')) {
            pendingResymlinks.push({ symlinkPath: nodeModulesPath, projectRoot });
          }
        }
      }
    }

    if (unlinkedCount > 0) {
      const message = `Worktree isolation: Removed ${unlinkedCount} symlink(s) to prevent modifying main workspace: ${unlinkedPaths.join(', ')}`;
      report.reportWarning(MessageName.UNNAMED, message);
      console.log(`[worktree-isolation] ${message}`);
    }
  },

  afterAllInstalled(project: Project): void {
    if (process.env.WORKTREE_ISOLATION_DISABLE === '1') {
      pendingResymlinks.length = 0;
      return;
    }
    if (pendingResymlinks.length === 0) {
      return;
    }

    const verbose = process.env.WORKTREE_ISOLATION_VERBOSE === '1';

    for (const { symlinkPath, projectRoot } of pendingResymlinks) {
      // Only create the symlink if Yarn didn't already populate the directory.
      if (fs.existsSync(symlinkPath)) {
        continue;
      }
      const rootNodeModules = path.join(projectRoot, 'node_modules');
      createInternalSymlink(symlinkPath, rootNodeModules, verbose);
    }

    pendingResymlinks.length = 0;
  }
};

/**
 * The Yarn plugin definition.
 */
const plugin: Plugin<Hooks> = {
  hooks
};

export default plugin;
