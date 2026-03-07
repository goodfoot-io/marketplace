import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type ExpansionData = Record<string, string[]>;

function storePath(): string {
  return join(homedir(), ".expansion.json");
}

export function readStore(): ExpansionData {
  try {
    const content = readFileSync(storePath(), "utf-8");
    return JSON.parse(content) as ExpansionData;
  } catch {
    return {};
  }
}

export function writeStore(data: ExpansionData): void {
  writeFileSync(storePath(), JSON.stringify(data, null, 2));
}

export function addExpansion(key: string, facts: string[]): void {
  const store = readStore();
  const existing = store[key] ?? [];
  const merged = Array.from(new Set([...existing, ...facts]));
  store[key] = merged;
  writeStore(store);
}

export function removeExpansion(key: string): boolean {
  const store = readStore();
  if (!(key in store)) {
    return false;
  }
  delete store[key];
  writeStore(store);
  return true;
}

export function getExpansion(key: string): string[] | undefined {
  const store = readStore();
  return store[key];
}

export function listKeys(): string[] {
  const store = readStore();
  return Object.keys(store).sort();
}

export function formatExpansion(key: string, facts: string[]): string {
  const bullets = facts.map((f) => `- ${f}`).join("\n");
  return `**${key}**:\n${bullets}`;
}
