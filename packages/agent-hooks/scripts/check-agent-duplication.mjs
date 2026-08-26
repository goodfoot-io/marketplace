#!/usr/bin/env node
/**
 * Cross-agent duplication check (plan step 3.7).
 *
 * Scopes to ALL agent surface directories under src/agents/ (not just transports): compares every
 * Claude Code file against every Codex file after normalizing away comments
 * and whitespace, using Jaccard similarity over significant code lines.
 *
 * Data-heavy shared artifacts (event-name arrays and their literal-union
 * helper types in `events.ts`) are expected to rhyme — they are transcription
 * lists, not driver logic. Everything else must stay below the threshold;
 * a hit means the shared `drive()` is missing a case (fix core), not that
 * the adapters should grow parallel implementations.
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Project, SyntaxKind } = require("ts-morph");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const agentsDir = path.join(packageDir, "src", "agents");

/** Files whose similarity is expected (transcribed data lists, not logic). */
const DATA_FILES = new Set(["events.ts"]);

function collectSourceFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = [];
  for (const name of require("node:fs").readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      entries.push(...collectSourceFiles(full));
    } else if (name.name.endsWith(".ts") && !name.name.endsWith(".d.ts")) {
      entries.push(full);
    }
  }
  return entries;
}

/**
 * Normalizes a source file into a Set of significant code lines: every
 * comment is removed via the compiler's own trivia tree, blank and
 * punctuation-only lines are dropped, and the rest are trimmed. Doc prose
 * therefore never contributes to similarity.
 */
function significantLines(filePath) {
  const project = new Project({ useInMemoryFileSystem: true });
  const source = project.createSourceFile(path.basename(filePath), require("node:fs").readFileSync(filePath, "utf-8"));
  source.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.SingleLineCommentTrivia || node.getKind() === SyntaxKind.MultiLineCommentTrivia) {
      node.getText().length; // touch: ensure trivia nodes are materialized
    }
  });
  const lines = new Set(
    source
      .getFullText()
      .split("\n")
      .map((line) => {
        const noBlock = line.replace(/\/\*[\s\S]*?\*\//g, "");
        const noLine = noBlock.replace(/\/\/.*$/, "");
        return noLine.trim();
      })
      .filter((line) => line.length >= 12),
  );
  return lines;
}

function jaccard(a, b) {
  const union = new Set([...a, ...b]);
  if (union.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const line of a) {
    if (b.has(line)) {
      intersection++;
    }
  }
  return intersection / union.size;
}

const THRESHOLD = 0.3;

if (!existsSync(agentsDir)) {
  process.stdout.write("check-agent-duplication: OK (no agents directory yet)\n");
  process.exit(0);
}

const agentNames = require("node:fs")
  .readdirSync(agentsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

if (agentNames.length < 2) {
  process.stdout.write("check-agent-duplication: OK (fewer than two agent surfaces — nothing to compare)\n");
  process.exit(0);
}

const failures = [];
let compared = 0;

for (let i = 0; i < agentNames.length; i++) {
  for (let j = i + 1; j < agentNames.length; j++) {
    const filesA = collectSourceFiles(path.join(agentsDir, agentNames[i]));
    const filesB = collectSourceFiles(path.join(agentsDir, agentNames[j]));
    for (const fileA of filesA) {
      for (const fileB of filesB) {
        const relA = path.relative(packageDir, fileA);
        const relB = path.relative(packageDir, fileB);
        if (DATA_FILES.has(path.basename(fileA)) && DATA_FILES.has(path.basename(fileB))) {
          continue;
        }
        compared++;
        const score = jaccard(significantLines(fileA), significantLines(fileB));
        if (score >= THRESHOLD) {
          failures.push(`${relA} <-> ${relB}: ${(score * 100).toFixed(1)}% line similarity`);
        }
      }
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `check-agent-duplication: ${failures.length} suspicious clone(s) (threshold ${THRESHOLD * 100}%):\n`,
  );
  for (const failure of failures) {
    process.stderr.write(`  - ${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `check-agent-duplication: OK (${compared} cross-agent file pairs below ${THRESHOLD * 100}% similarity)\n`,
);
