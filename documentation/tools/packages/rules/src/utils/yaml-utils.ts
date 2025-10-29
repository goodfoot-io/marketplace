import * as yaml from 'js-yaml';
import { readFile } from './file-utils.js';

export function extractYamlFrontmatter(content: string): { frontmatter: string | null; body: string } {
  const yamlRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(yamlRegex);

  if (match) {
    return {
      frontmatter: match[1],
      body: content.slice(match[0].length)
    };
  }

  return {
    frontmatter: null,
    body: content
  };
}

export function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
}

export function parseYaml(content: string): unknown {
  return yaml.load(content);
}

export async function readYamlFile(filePath: string): Promise<unknown> {
  try {
    const content = await readFile(filePath);
    const parsed: unknown = yaml.load(content);
    return parsed;
  } catch (error) {
    // Gracefully handle file not found or parsing errors
    console.error(`Error reading or parsing YAML file at ${filePath}:`, error);
    throw error;
  }
}
