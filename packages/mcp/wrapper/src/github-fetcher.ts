/**
 * GitHub template fetcher
 * Downloads templates from GitHub repositories using raw.githubusercontent.com
 */

import { WrapperTemplate, validateWrapperTemplate } from './types/wrapper.js';

/**
 * Parses a GitHub reference into owner, repo, branch, and path components
 *
 * Format: owner/repo[@branch][/path/to/file.json]
 * Examples:
 * - "owner/repo" → { owner: "owner", repo: "repo", branch: "main", path: "template.json" }
 * - "owner/repo@develop" → { owner: "owner", repo: "repo", branch: "develop", path: "template.json" }
 * - "owner/repo/templates/custom.json" → { owner: "owner", repo: "repo", branch: "main", path: "templates/custom.json" }
 * - "owner/repo@feature/config/template.json" → { owner: "owner", repo: "repo", branch: "feature", path: "config/template.json" }
 */
interface ParsedGitHubReference {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

function parseGitHubReference(reference: string): ParsedGitHubReference {
  if (!reference || reference === '/') {
    throw new Error('Invalid GitHub reference format. Expected: owner/repo[@branch][/path/to/file.json]');
  }

  const segments = reference.split('/');

  if (segments.length < 2 || !segments[0] || !segments[1]) {
    throw new Error('Invalid GitHub reference format. Expected: owner/repo[@branch][/path/to/file.json]');
  }

  const owner = segments[0];
  let repo: string;
  let branch = 'main';

  // Check if repo has branch specifier (repo@branch)
  const repoSegment = segments[1];
  if (repoSegment.includes('@')) {
    const repoParts = repoSegment.split('@');
    repo = repoParts[0];
    branch = repoParts[1] || 'main';
  } else {
    repo = repoSegment;
  }

  // Path is everything after owner/repo
  const path = segments.length > 2 ? segments.slice(2).join('/') : 'template.json';

  return { owner, repo, branch, path };
}

/**
 * Fetches a GitHub template from raw.githubusercontent.com
 *
 * @param reference - GitHub reference in format: owner/repo[@branch][/path/to/file.json]
 * @returns Validated WrapperTemplate
 * @throws Error if template not found, network error, invalid JSON, or validation fails
 */
export async function fetchGitHubTemplate(reference: string): Promise<WrapperTemplate> {
  // Parse the GitHub reference
  const parsed = parseGitHubReference(reference);

  // Build raw.githubusercontent.com URL
  const url = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/${parsed.path}`;

  try {
    // Fetch template with User-Agent header for GitHub compliance
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MCP-Wrapper/1.0'
      }
    });

    // Check for HTTP errors
    if (!response.ok) {
      throw new Error(`GitHub template not found: ${reference} (${response.status} ${response.statusText})`);
    }

    // Parse JSON
    let jsonData: unknown;
    try {
      jsonData = await response.json();
    } catch (error) {
      throw new Error(`Invalid JSON in GitHub template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Validate template structure
    const template = validateWrapperTemplate(jsonData);

    return template;
  } catch (error) {
    // Re-throw our own errors as-is
    if (error instanceof Error && error.message.startsWith('GitHub template not found:')) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('Invalid JSON in GitHub template:')) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('Invalid wrapper template:')) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('Invalid GitHub reference format')) {
      throw error;
    }

    // Wrap network and other errors
    throw new Error(`Failed to fetch GitHub template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
