/**
 * Template loader for MCP wrapper templates
 * Loads templates from local, packaged, and file locations
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getClaudeConfigDir } from './agent-id.js';
import { WrapperTemplate, validateWrapperTemplate } from './types/wrapper.js';

/**
 * Ensure a filename has .json extension
 * Handles case-insensitive check to prevent double-extension
 * @param name - Template name with or without extension
 * @returns Name with .json extension
 */
function ensureJsonExtension(name: string): string {
  // Check if already ends with .json (case-insensitive)
  if (name.toLowerCase().endsWith('.json')) {
    // Replace the extension with lowercase .json to normalize
    return name.substring(0, name.length - 5) + '.json';
  }
  return `${name}.json`;
}

/**
 * Load and parse a JSON template file
 * @param filePath - Absolute path to the template file
 * @param errorPrefix - Prefix for error messages (e.g., "Template", "Packaged template")
 * @returns Validated WrapperTemplate
 */
async function loadAndValidateTemplate(filePath: string, errorPrefix: string): Promise<WrapperTemplate> {
  let content: string;

  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    // File not found or read error
    throw new Error(`${errorPrefix} not found: ${filePath}`);
  }

  // Parse JSON
  let jsonData: unknown;
  try {
    jsonData = JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${errorPrefix.toLowerCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate template structure
  const template = validateWrapperTemplate(jsonData);

  return template;
}

/**
 * Load a template from the local Claude configuration directory
 * Location: $CLAUDE_CONFIG_DIR/mcp-wrapper-templates/{name}.json
 *
 * @param name - Template name (with or without .json extension)
 * @returns Validated WrapperTemplate
 * @throws Error if template not found, invalid JSON, or validation fails
 */
export async function loadLocalTemplate(name: string): Promise<WrapperTemplate> {
  const claudeConfigDir = getClaudeConfigDir();
  const templateFileName = ensureJsonExtension(name);
  const templatePath = path.join(claudeConfigDir, 'mcp-wrapper-templates', templateFileName);

  return loadAndValidateTemplate(templatePath, 'Template');
}

/**
 * Load a pre-packaged template from the wrapper's templates directory
 * Location: src/templates/{name}.json or build/templates/{name}.json
 *
 * @param name - Template name (with or without .json extension)
 * @returns Validated WrapperTemplate
 * @throws Error if template not found, invalid JSON, or validation fails
 */
export async function loadPackagedTemplate(name: string): Promise<WrapperTemplate> {
  // Get the directory of the current module
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const templateFileName = ensureJsonExtension(name);

  // Try src/templates/ first (for development), then build/templates/ (for production)
  const srcTemplatePath = path.join(__dirname, 'templates', templateFileName);
  const buildTemplatePath = path.join(__dirname, '..', 'templates', templateFileName);

  // Try src/templates/ first
  try {
    await fs.access(srcTemplatePath);
    return loadAndValidateTemplate(srcTemplatePath, 'Packaged template');
  } catch {
    // If src/templates/ doesn't exist, try build/templates/
    // The access check will throw ENOENT if file doesn't exist
    return loadAndValidateTemplate(buildTemplatePath, 'Packaged template');
  }
}

/**
 * Load a template from a file path (absolute or relative)
 * Relative paths are resolved from the current working directory
 *
 * @param filePath - Absolute or relative path to template file
 * @returns Validated WrapperTemplate
 * @throws Error if template not found, invalid JSON, or validation fails
 */
export async function loadFileTemplate(filePath: string): Promise<WrapperTemplate> {
  // Resolve relative paths to absolute paths
  let absolutePath: string;
  if (path.isAbsolute(filePath)) {
    absolutePath = filePath;
  } else {
    absolutePath = path.resolve(process.cwd(), filePath);
  }

  // Ensure .json extension
  const pathWithExtension = ensureJsonExtension(absolutePath);

  return loadAndValidateTemplate(pathWithExtension, 'Template file');
}
