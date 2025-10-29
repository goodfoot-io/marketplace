import * as fs from 'fs';
import * as path from 'path';

/**
 * Find the workspace root by looking for .git directory or key markers
 * @param startPath Starting directory to search from (defaults to current working directory)
 * @returns The absolute path to the workspace root
 */
export function findWorkspaceRoot(startPath: string = process.cwd()): string {
  let currentPath = path.resolve(startPath);

  // Walk up the directory tree looking for workspace markers
  while (currentPath !== path.dirname(currentPath)) {
    // Check for .git directory
    if (fs.existsSync(path.join(currentPath, '.git'))) {
      return currentPath;
    }

    // Check for key directories that indicate workspace root
    const hasActiveDir = fs.existsSync(path.join(currentPath, 'active'));
    const hasToolsDir = fs.existsSync(path.join(currentPath, 'tools'));
    const hasProtocolsDir = fs.existsSync(path.join(currentPath, 'protocols'));

    if (hasActiveDir && hasToolsDir && hasProtocolsDir) {
      return currentPath;
    }

    // Move up one directory
    currentPath = path.dirname(currentPath);
  }

  // If we can't find the workspace root, use the current directory
  console.warn('Warning: Could not find workspace root (no .git directory or key markers found)');
  console.warn('Using current directory as workspace root');
  return process.cwd();
}

/**
 * Convert an absolute path to a workspace-relative path
 * @param absolutePath The absolute path to convert
 * @param workspaceRoot The workspace root path
 * @returns The relative path from workspace root
 */
export function toWorkspaceRelativePath(absolutePath: string, workspaceRoot: string): string {
  return path.relative(workspaceRoot, absolutePath);
}

/**
 * Check if a path is within the workspace
 * @param checkPath The path to check
 * @param workspaceRoot The workspace root path
 * @returns True if the path is within the workspace
 */
export function isWithinWorkspace(checkPath: string, workspaceRoot: string): boolean {
  const resolvedPath = path.resolve(checkPath);
  const resolvedWorkspace = path.resolve(workspaceRoot);
  return resolvedPath.startsWith(resolvedWorkspace);
}
