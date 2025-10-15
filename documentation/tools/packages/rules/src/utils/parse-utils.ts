/**
 * Utilities for parsing common file formats
 */

/**
 * Parses a simple key-value file format (like .status files)
 * Returns array of key-value pairs to preserve order and duplicates
 */
export function parseKeyValueFile(content: string): Array<{ key: string; value: string }> {
  const lines = content.split('\n').filter((line) => line.trim());
  const entries: Array<{ key: string; value: string }> = [];

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      entries.push({ key, value });
    }
  }

  return entries;
}

/**
 * Creates a violation object helper
 */
import type { RuleViolation } from '../types.js';
import { RULE_CODES } from '../rule-codes.js';

export function createViolation(
  ruleKey: keyof typeof RULE_CODES,
  description: string,
  location: string,
  severity: 'error' | 'warning' = 'error'
): RuleViolation {
  const ruleInfo = RULE_CODES[ruleKey];
  return {
    code: ruleInfo.code,
    title: ruleInfo.title,
    description,
    location,
    severity
  };
}

/**
 * Checks if content starts with required source attribution
 */
export function hasSourceAttribution(content: string): boolean {
  const lines = content.split('\n').slice(0, 10);
  return lines.some((line) => {
    const lowerLine = line.toLowerCase();
    return lowerLine.includes('source:') && line.includes('http');
  });
}
