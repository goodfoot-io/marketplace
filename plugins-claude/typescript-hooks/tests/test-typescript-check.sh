#!/bin/bash

# Test suite for claude-posttooluse-hook-typescript utility

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CHECK_TS="$SCRIPT_DIR/../hooks/bin/typescript-check.mjs"

# Exercise the emitted bundle with the real local TypeScript compiler.
# Unit tests cover parser details; this harness checks the JSON wire contract.
node --input-type=module - "$CHECK_TS" "$SCRIPT_DIR/../../../.." <<'NODE'
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [hook, workspace] = process.argv.slice(2);
const project = mkdtempSync(join(tmpdir(), 'typescript-hook-smoke-'));
const file = join(project, 'src/example.ts');
let passed = 0;
function invoke(input) {
  return JSON.parse(execFileSync(hook, { input: JSON.stringify(input), encoding: 'utf8' }));
}
function check(name, verify) {
  verify();
  passed++;
  console.log(`✓ ${name}`);
}
function input(filePath) {
  return { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: filePath }, tool_result: 'success' };
}
try {
  mkdirSync(join(project, 'src'));
  mkdirSync(join(project, 'build'));
  symlinkSync(join(workspace, 'node_modules'), join(project, 'node_modules'), 'dir');
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'hook-smoke', private: true }));
  writeFileSync(join(project, 'yarn.lock'), '');
  writeFileSync(join(project, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: true, types: [] }, include: ['src/**/*.ts'] }));
  check('Skip non-TypeScript file', () => assert.deepEqual(invoke(input(join(project, 'README.md'))), {}));
  check('Skip missing file', () => assert.deepEqual(invoke(input(join(project, 'missing.ts'))), {}));
  check('Skip missing file path', () => assert.deepEqual(invoke(input(undefined)), {}));
  check('Malformed JSON returns valid empty object', () => assert.deepEqual(JSON.parse(execFileSync(hook, { input: 'invalid json', encoding: 'utf8' })), {}));
  writeFileSync(file, 'export const value: number = 42;\n');
  check('Clean TypeScript produces empty output', () => assert.deepEqual(invoke(input(file)), {}));
  writeFileSync(file, 'export const value: number = "wrong";\n');
  check('Real compiler error becomes YAML context', () => {
    const output = invoke(input(file));
    assert.equal(output.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.match(output.systemMessage, /direct error/);
    const context = output.hookSpecificOutput.additionalContext;
    for (const fragment of ['errors:', 'TS2322', 'context:', '> 1:']) assert.ok(context.includes(fragment), context);
  });
  writeFileSync(file, 'export function run() { try { throw new Error("failure"); } catch {} }\n');
  check('Shared AST scan reports swallowed errors', () => {
    assert.match(invoke(input(file)).hookSpecificOutput.additionalContext, /empty-catch/);
  });
  console.log(`${passed} emitted TypeScript hook checks passed`);
} finally {
  rmSync(project, { recursive: true, force: true });
}
NODE
