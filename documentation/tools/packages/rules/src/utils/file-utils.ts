import * as fs from 'fs/promises';
import * as path from 'path';

// Re-export enhanced error handling
export { shouldSuppressError, categorizeError, safeFileOperation } from './error-utils.js';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

export async function readDirectory(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

export async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export function resolveProjectPath(workspacePath: string, ...segments: string[]): string {
  return path.join(workspacePath, ...segments);
}

export async function createDirectory(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
  await fs.mkdir(dirPath, { recursive: options?.recursive ?? true });
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}
