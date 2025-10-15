import type { Rule } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dynamically loads all rule modules from the rules directory
 */
export async function loadRules(): Promise<Map<string, Rule>> {
  const rules = new Map<string, Rule>();
  const rulesDir = path.join(__dirname, 'rules');

  try {
    const files = await fs.readdir(rulesDir);

    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        const ruleName = path.basename(file, path.extname(file));

        // Skip non-rule files (just check if it's a TypeScript/JavaScript file)
        // All .ts/.js files in the rules directory are assumed to be valid rules

        try {
          // Dynamic import
          const modulePath = `./rules/${file}`;
          const module = (await import(modulePath)) as { default: Rule };
          const rule: Rule = module.default;

          // Validate the rule has required properties
          if (rule && rule.code && typeof rule.check === 'function') {
            rules.set(rule.code, rule);
          } else {
            console.warn(`Rule ${ruleName} is missing required properties`);
          }
        } catch (error) {
          console.error(`Failed to load rule ${ruleName}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to read rules directory:', error);
  }

  return rules;
}

/**
 * Gets a specific rule by code
 */
export async function getRule(code: string): Promise<Rule | null> {
  try {
    const module = (await import(`./rules/${code}.js`)) as { default: Rule };
    return module.default;
  } catch {
    return null;
  }
}
