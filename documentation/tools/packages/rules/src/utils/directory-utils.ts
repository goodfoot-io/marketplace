import { isDirectory, readDirectory, resolveProjectPath } from './file-utils.js';

/**
 * Required directories for every story
 */
export const REQUIRED_STORY_DIRECTORIES = [
  'agents',
  'agents/messages',
  'agents/performance-reviews',
  'sources',
  'sources/documents',
  'sources/interviews',
  'sources/data',
  'sources/synthesis',
  'sources/archives',
  'essay'
] as const;

/**
 * Required subdirectories for templates
 */
export const TEMPLATE_SUBDIRECTORIES = ['personas', 'rubrics', 'workflows'] as const;

/**
 * Checks if all required story directories exist
 * Returns list of missing directories
 */
export async function getMissingStoryDirectories(storyPath: string): Promise<string[]> {
  const missing: string[] = [];

  for (const requiredDir of REQUIRED_STORY_DIRECTORIES) {
    const dirPath = resolveProjectPath(storyPath, requiredDir);
    if (!(await isDirectory(dirPath))) {
      missing.push(requiredDir);
    }
  }

  return missing;
}

/**
 * Finds all files matching a glob pattern (simplified)
 */
export async function findFiles(dirPath: string, pattern: string): Promise<string[]> {
  const results: string[] = [];

  // Handle complex patterns like */reviews/**/*.md
  if (pattern.includes('/')) {
    const parts = pattern.split('/');

    // For patterns like */essay.md or */reviews/**/*.md or */workspace/*.md
    if (parts[0] === '*' && parts.length >= 2) {
      if (await isDirectory(dirPath)) {
        const dirs = await readDirectory(dirPath);
        for (const dir of dirs) {
          if (dir.startsWith('.')) continue;
          const subPath = resolveProjectPath(dirPath, dir);
          if (await isDirectory(subPath)) {
            // Recursively search with the remaining pattern
            const remainingPattern = parts.slice(1).join('/');
            const subResults = await findFiles(subPath, remainingPattern);
            results.push(...subResults);
          }
        }
      }
      return results;
    }

    // For patterns like workspace/*.md (direct subdirectory with wildcard)
    if (parts.length === 2 && parts[0] !== '**' && parts[1].startsWith('*.')) {
      const subDir = parts[0];
      const filePattern = parts[1];
      const searchPath = resolveProjectPath(dirPath, subDir);

      if (await isDirectory(searchPath)) {
        const extension = filePattern.substring(1);
        const items = await readDirectory(searchPath);
        for (const item of items) {
          if (item.endsWith(extension)) {
            results.push(resolveProjectPath(searchPath, item));
          }
        }
      }
      return results;
    }

    // For patterns like reviews/**/*.md
    if (parts[0] !== '**' && parts.includes('**')) {
      const beforeStars = parts.slice(0, parts.indexOf('**')).join('/');
      const afterStars = parts.slice(parts.indexOf('**') + 1).join('/');
      const searchPath = resolveProjectPath(dirPath, beforeStars);

      if (await isDirectory(searchPath)) {
        // Find all files matching the extension in the entire subtree
        const extension = afterStars.startsWith('*.') ? afterStars.substring(1) : null;
        if (extension) {
          for await (const { path } of findFilesRecursive(searchPath, (f) => f.endsWith(extension))) {
            results.push(path);
          }
        }
      }
      return results;
    }
  }

  // Handle simple patterns like "*.md" or "*.{md,yaml}"
  const isMatch = (filename: string): boolean => {
    if (pattern === '**/*.md') {
      return filename.endsWith('.md');
    } else if (pattern === '*.md') {
      return filename.endsWith('.md');
    } else if (pattern === '*.{md,yaml}') {
      return filename.endsWith('.md') || filename.endsWith('.yaml');
    } else if (pattern.startsWith('*.')) {
      const ext = pattern.substring(1);
      return filename.endsWith(ext);
    }
    return false;
  };

  // For recursive patterns
  if (pattern === '**/*.md' || pattern.startsWith('**/')) {
    for await (const { path } of findFilesRecursive(dirPath, isMatch)) {
      results.push(path);
    }
  } else {
    // For non-recursive patterns
    if (await isDirectory(dirPath)) {
      const items = await readDirectory(dirPath);
      for (const item of items) {
        if (isMatch(item)) {
          results.push(resolveProjectPath(dirPath, item));
        }
      }
    }
  }

  return results;
}

/**
 * Recursively finds all files in a directory matching a pattern
 */
export async function* findFilesRecursive(
  dirPath: string,
  pattern: (filename: string) => boolean
): AsyncGenerator<{ path: string; filename: string }> {
  if (!(await isDirectory(dirPath))) return;

  const items = await readDirectory(dirPath);

  for (const item of items) {
    const itemPath = resolveProjectPath(dirPath, item);

    if (await isDirectory(itemPath)) {
      // Skip hidden directories
      if (!item.startsWith('.')) {
        yield* findFilesRecursive(itemPath, pattern);
      }
    } else if (pattern(item)) {
      yield { path: itemPath, filename: item };
    }
  }
}

/**
 * Checks if a templates directory exists in an inappropriate location
 */
export async function findDuplicateTemplatesDirs(workspacePath: string): Promise<string[]> {
  const duplicates: string[] = [];
  const contentDirs = ['active', 'review', 'published', 'archive'];

  for (const contentDir of contentDirs) {
    const contentPath = resolveProjectPath(workspacePath, contentDir);
    if (await isDirectory(contentPath)) {
      // Check for _templates at content level
      const templatesPath = resolveProjectPath(contentPath, '_templates');
      if (await isDirectory(templatesPath)) {
        duplicates.push(`${contentDir}/_templates`);
      }

      // Check inside story directories
      const stories = await readDirectory(contentPath);
      for (const story of stories) {
        if (story.startsWith('.')) continue;
        const storyPath = resolveProjectPath(contentPath, story);
        if (await isDirectory(storyPath)) {
          const storyTemplates = resolveProjectPath(storyPath, '_templates');
          if (await isDirectory(storyTemplates)) {
            duplicates.push(`${contentDir}/${story}/_templates`);
          }
        }
      }
    }
  }

  return duplicates;
}
