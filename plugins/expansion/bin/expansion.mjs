#!/usr/bin/env node
import { createRequire as __banner_createRequire } from 'node:module';import { fileURLToPath as __banner_fileURLToPath } from 'node:url';import { dirname as __banner_dirname } from 'node:path';const require = __banner_createRequire(import.meta.url);const __filename = __banner_fileURLToPath(import.meta.url);const __dirname = __banner_dirname(__filename);

// src/expansion-store.ts
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
function storePath() {
  return join(homedir(), ".expansion.json");
}
function readStore() {
  try {
    const content = readFileSync(storePath(), "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
function writeStore(data) {
  writeFileSync(storePath(), JSON.stringify(data, null, 2));
}
function addExpansion(key, facts) {
  const store = readStore();
  const existing = store[key] ?? [];
  const merged = Array.from(/* @__PURE__ */ new Set([...existing, ...facts]));
  store[key] = merged;
  writeStore(store);
}
function removeExpansion(key) {
  const store = readStore();
  if (!(key in store)) {
    return false;
  }
  delete store[key];
  writeStore(store);
  return true;
}
function getExpansion(key) {
  const store = readStore();
  return store[key];
}
function listKeys() {
  const store = readStore();
  return Object.keys(store).sort();
}
function formatExpansion(key, facts) {
  const bullets = facts.map((f) => `- ${f}`).join("\n");
  return `**${key}**:
${bullets}`;
}

// src/bin/expansion.ts
function parseArgs(argv) {
  if (argv.length === 0) return { action: "usage" };
  if (argv[0] === "--list") return { action: "list" };
  const key = argv[0];
  if (argv.length === 1) return { action: "view", key };
  if (argv[1] === "-d") return { action: "remove", key };
  return { action: "add", key, facts: argv.slice(1) };
}
function run(args) {
  switch (args.action) {
    case "list": {
      const keys = listKeys();
      return keys.join(",");
    }
    case "view": {
      const facts = getExpansion(args.key);
      if (facts === void 0) {
        void process.stderr.write(`*Expansion "${args.key}" does not exist*
`);
        process.exit(1);
      }
      return formatExpansion(args.key, facts);
    }
    case "add": {
      addExpansion(args.key, args.facts);
      return "";
    }
    case "remove": {
      const found = removeExpansion(args.key);
      if (!found) {
        void process.stderr.write(`*Expansion "${args.key}" does not exist*
`);
        process.exit(1);
      }
      return "";
    }
    case "usage": {
      void process.stderr.write(
        "Usage:\n  expansion --list\n  expansion <key>\n  expansion <key> <fact1> [fact2 ...]\n  expansion <key> -d\n"
      );
      process.exit(0);
    }
  }
}
var currentFile = new URL(import.meta.url).pathname;
var scriptArg = process.argv[1];
if (scriptArg && (currentFile === scriptArg || currentFile.endsWith(scriptArg))) {
  const cliArgs = parseArgs(process.argv.slice(2));
  const output = run(cliArgs);
  if (output) void process.stdout.write(`${output}
`);
}
export {
  parseArgs,
  run
};
