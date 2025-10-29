import { isDirectory, readDirectory, resolveProjectPath } from './file-utils.js';

export const ROOT_DIRECTORIES = ['active', 'published', 'archive'] as const;
export type RootDirectory = (typeof ROOT_DIRECTORIES)[number];

/**
 * Iterates through all stories in all root directories
 * Skips non-existent directories and hidden files
 */
export async function* iterateStories(
  workspacePath: string,
  contentDirs: readonly string[] = ROOT_DIRECTORIES
): AsyncGenerator<{ rootDir: string; storySlug: string; storyPath: string }> {
  for (const rootDir of contentDirs) {
    const rootPath = resolveProjectPath(workspacePath, rootDir);
    if (!(await isDirectory(rootPath))) continue;

    const stories = await readDirectory(rootPath);

    for (const story of stories) {
      if (story.startsWith('.')) continue;

      const storyPath = resolveProjectPath(rootPath, story);
      if (await isDirectory(storyPath)) {
        yield { rootDir, storySlug: story, storyPath };
      }
    }
  }
}

/**
 * Checks if a story slug follows the naming convention
 * (lowercase letters and numbers with hyphens only)
 */
export function isValidStorySlug(slug: string): boolean {
  // Check format: lowercase letters and numbers with hyphens
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/**
 * Determines if a directory name should be treated as a story
 * (e.g., excludes _templates directories)
 */
export function isStoryDirectory(dirName: string): boolean {
  return !dirName.startsWith('.') && !dirName.startsWith('_');
}

/**
 * Checks if a directory has story-like content structure
 * A directory is considered a story if it has multiple key subdirectories
 */
export async function hasStoryStructure(storyPath: string): Promise<boolean> {
  const requiredDirs = ['agents', 'sources', 'essay'];
  let foundCount = 0;

  for (const dir of requiredDirs) {
    const dirPath = resolveProjectPath(storyPath, dir);
    if (await isDirectory(dirPath)) {
      foundCount++;
    }
  }

  // Consider it a story if it has at least 2 of the required directories
  return foundCount >= 2;
}

/**
 * Gets the expected state for a story based on its directory
 */
export function getExpectedState(rootDir: RootDirectory): string {
  switch (rootDir) {
    case 'published':
      return 'published';
    case 'archive':
      return 'archived';
    default:
      return 'assigned';
  }
}
