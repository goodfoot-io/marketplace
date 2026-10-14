/**
 * Verify key change cache behavior with isolated temporary fixtures.
 *
 * @summary Verify key change cache behavior with isolated temporary fixtures.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { DigestStore } from '../src/digest-store.ts';
import { FingerprintPhase, inputsDigest } from '../src/fingerprint.ts';
import { describeKeyChange, type KeyEntry } from '../src/key-change.ts';

const roots: string[] = [];

afterEach(() => {
  for (let root = roots.pop(); root !== undefined; root = roots.pop()) rmSync(root, { recursive: true, force: true });
});

function repository(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-key-change-'));
  roots.push(root);
  for (const [relative, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), content);
  }
  return root;
}

/**
 * A key entry as `keyFor` builds it, from a fresh fingerprinting phase over `root`.
 *
 * @param root - Temporary repository root.
 * @param files - Selected fixture graph files.
 * @param declarations - Declared input text.
 * @param execution - Execution component seed.
 * @returns Synthetic key/components/input digests for diagnostic assertions.
 */
async function entry(
  root: string,
  files: string[],
  declarations: string[],
  execution = 'execution'
): Promise<KeyEntry> {
  const phase = new FingerprintPhase(root, { store: new DigestStore(null) });
  const inputs = await phase.inputDigests(files, declarations);
  const components = {
    invocation: 'invocation',
    execution,
    inputs: inputsDigest(inputs, declarations),
    packages: 'packages',
    executables: null
  };
  return { key: JSON.stringify(components), identity: 'fixture\0probe.test.ts', components, inputs };
}

test('an input file edited between keying and publication is named in the key change', async () => {
  const root = repository({ 'probe.test.ts': 'export {};\n', 'data/a.txt': 'a\n', 'data/b.txt': 'b\n' });
  const before = await entry(root, ['probe.test.ts'], ['data/**']);
  writeFileSync(path.join(root, 'data/b.txt'), 'changed\n');
  const after = await entry(root, ['probe.test.ts'], ['data/**']);

  expect(after.key).not.toBe(before.key);
  expect(describeKeyChange(before, after)).toBe('inputs: data/b.txt');
});

test('an input added or removed during the run is named in the key change', async () => {
  const root = repository({ 'probe.test.ts': 'export {};\n', 'data/a.txt': 'a\n' });
  const before = await entry(root, ['probe.test.ts'], ['data/**']);
  writeFileSync(path.join(root, 'data/added.txt'), 'new\n');
  rmSync(path.join(root, 'data/a.txt'));
  const after = await entry(root, ['probe.test.ts'], ['data/**']);

  expect(describeKeyChange(before, after)).toBe('inputs: data/a.txt, data/added.txt');
});

test('a changed declaration with the same files, and a changed non-input component, are each named', async () => {
  const root = repository({ 'probe.test.ts': 'export {};\n', 'data/a.txt': 'a\n' });
  const before = await entry(root, ['probe.test.ts'], ['data/**']);
  const declarationsChanged = await entry(root, ['probe.test.ts'], ['data/**', 'data/a.txt']);
  const executionChanged = await entry(root, ['probe.test.ts'], ['data/**'], 'another execution');

  expect(describeKeyChange(before, declarationsChanged)).toBe('inputs: declared globs');
  expect(describeKeyChange(before, executionChanged)).toBe('execution');
});
