/**
 * Template resolver with priority-based loading strategy
 * Determines which template source to use based on reference format
 */

import * as path from 'node:path';
import { fetchGitHubTemplate } from './github-fetcher.js';
import { loadFileTemplate, loadPackagedTemplate, loadLocalTemplate } from './template-loader.js';
import { WrapperTemplate } from './types/wrapper.js';

/**
 * Resolves a template reference to a loaded WrapperTemplate
 * Uses priority-based resolution strategy:
 * 1. Absolute paths → loadFileTemplate
 * 2. Relative paths (starts with ./ or ../) → loadFileTemplate
 * 3. Packaged templates (exists in src/templates/) → loadPackagedTemplate
 * 4. Local templates (exists in $CLAUDE_CONFIG_DIR/mcp-wrapper-templates/) → loadLocalTemplate
 * 5. GitHub templates (owner/repo format) → fetchGitHubTemplate
 *
 * Fail-fast strategy: First matching source attempts load
 * Throws on validation failure without trying next source
 *
 * @param reference - Template reference (path, name, or GitHub repo)
 * @returns Validated WrapperTemplate
 * @throws Error if template not found or validation fails
 *
 * @example
 * // Absolute path
 * await resolveTemplate('/path/to/template.json')
 *
 * @example
 * // Relative path
 * await resolveTemplate('./templates/custom.json')
 *
 * @example
 * // Packaged template
 * await resolveTemplate('github')
 *
 * @example
 * // Local template
 * await resolveTemplate('my-custom-template')
 *
 * @example
 * // GitHub template
 * await resolveTemplate('owner/repo')
 * await resolveTemplate('owner/repo@branch')
 * await resolveTemplate('owner/repo/path/to/template.json')
 */
export async function resolveTemplate(reference: string): Promise<WrapperTemplate> {
  // 1. Check for absolute paths
  if (path.isAbsolute(reference)) {
    try {
      return await loadFileTemplate(reference);
    } catch (error) {
      throw new Error(
        `Template '${reference}' from absolute path failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // 2. Check for relative paths (starts with ./ or ../)
  if (reference.startsWith('./') || reference.startsWith('../')) {
    try {
      return await loadFileTemplate(reference);
    } catch (error) {
      throw new Error(
        `Template '${reference}' from relative path failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // 3. Check for packaged templates
  try {
    // Use loadPackagedTemplate which will check if file exists
    return await loadPackagedTemplate(reference);
  } catch (packagingError) {
    // Check if it's a "not found" error vs validation error
    // Validation errors should not fall through to next source
    const errorMessage = packagingError instanceof Error ? packagingError.message : String(packagingError);

    // If it's a validation error (not a "not found" error), fail immediately
    if (
      errorMessage.includes('Invalid JSON') ||
      errorMessage.includes('Invalid wrapper template') ||
      errorMessage.includes('stdio transport requires') ||
      errorMessage.includes('http transport requires')
    ) {
      throw new Error(`Template '${reference}' from packaged templates failed: ${errorMessage}`);
    }

    // Not found in packaged templates, try local templates
  }

  // 4. Check for local templates
  try {
    return await loadLocalTemplate(reference);
  } catch (localError) {
    // Check if it's a "not found" error vs validation error
    const errorMessage = localError instanceof Error ? localError.message : String(localError);

    // If it's a validation error (not a "not found" error), fail immediately
    if (
      errorMessage.includes('Invalid JSON') ||
      errorMessage.includes('Invalid wrapper template') ||
      errorMessage.includes('stdio transport requires') ||
      errorMessage.includes('http transport requires')
    ) {
      throw new Error(`Template '${reference}' from local templates failed: ${errorMessage}`);
    }

    // Not found in local templates, try GitHub
  }

  // 5. Try GitHub template (owner/repo format)
  try {
    return await fetchGitHubTemplate(reference);
  } catch (githubError) {
    throw new Error(
      `Template '${reference}' from GitHub failed: ${githubError instanceof Error ? githubError.message : 'Unknown error'}`
    );
  }
}
