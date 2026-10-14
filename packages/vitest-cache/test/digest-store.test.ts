/**
 * Verify digest store cache behavior with isolated temporary fixtures.
 *
 * @summary Verify digest store cache behavior with isolated temporary fixtures.
 */

import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { DigestStore } from '../src/digest-store.ts';

// A record is trusted only once the file's mtime/ctime is at least the racy
// window (2s) older than the moment it was recorded. chmod always updates
// ctime, so proving "a chmod-only change is not trusted" needs the original
// record to have genuinely aged past that window first -- otherwise the racy
// check alone would force a rehash regardless of what this test is after.
function sleepPastRacyWindow() {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2100);
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'digest-store-mode-'));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

test('a chmod-only change on a file changes fileDigest and is not trusted', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'digest-store-file-mode-'));
  try {
    const file = path.join(root, 'tool');
    writeFileSync(file, '#!/bin/sh\necho hi\n', { mode: 0o644 });
    sleepPastRacyWindow();

    const first = new DigestStore(folder);
    const before = first.fileDigest(file);
    expect(first.stats.computed).toBe(1);
    expect(first.stats.reused).toBe(0);

    chmodSync(file, 0o755);

    const second = new DigestStore(folder);
    const after = second.fileDigest(file);
    expect(after).not.toBe(before);
    expect(second.stats.computed).toBe(1);
    expect(second.stats.reused).toBe(0);
  } finally {
    rmSync(folder, { force: true, recursive: true });
  }
});

test('a chmod-only change on a file inside a tree changes treeDigest and is not trusted', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'digest-store-tree-mode-'));
  try {
    const file = path.join(root, 'tool');
    writeFileSync(file, '#!/bin/sh\necho hi\n', { mode: 0o644 });
    sleepPastRacyWindow();

    const first = new DigestStore(folder);
    const before = first.treeDigest(root);
    expect(first.stats.computed).toBe(1);
    expect(first.stats.reused).toBe(0);

    chmodSync(file, 0o755);

    const second = new DigestStore(folder);
    const after = second.treeDigest(root);
    expect(after).not.toBe(before);
    expect(second.stats.computed).toBe(1);
    expect(second.stats.reused).toBe(0);
  } finally {
    rmSync(folder, { force: true, recursive: true });
  }
});

test('a chmod-only change on a subdirectory changes treeDigest and is not trusted', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'digest-store-subdir-mode-'));
  try {
    const sub = path.join(root, 'bin');
    mkdirSync(sub, { mode: 0o755 });
    writeFileSync(path.join(sub, 'tool'), '#!/bin/sh\necho hi\n');
    sleepPastRacyWindow();

    const first = new DigestStore(folder);
    const before = first.treeDigest(root);
    expect(first.stats.computed).toBe(1);
    expect(first.stats.reused).toBe(0);

    chmodSync(sub, 0o700);

    const second = new DigestStore(folder);
    const after = second.treeDigest(root);
    expect(after).not.toBe(before);
    expect(second.stats.computed).toBe(1);
    expect(second.stats.reused).toBe(0);
  } finally {
    rmSync(folder, { force: true, recursive: true });
  }
});

test('a record written in the v1 schema is rejected and rehashed', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'digest-store-schema-'));
  try {
    const file = path.join(root, 'tool');
    writeFileSync(file, '#!/bin/sh\necho hi\n', { mode: 0o755 });
    sleepPastRacyWindow();

    const first = new DigestStore(folder);
    const originalDigest = first.treeDigest(root);
    expect(first.stats.computed).toBe(1);

    // Simulate a record a pre-mode-hashing (schema 1) store left on disk: same
    // stat signature, so a stat-only check would call it trustworthy, but its
    // digest predates mode coverage and must not be served as-is.
    const [recordName] = readdirSync(folder);
    const recordPath = path.join(folder, recordName);
    const v1Record = JSON.parse(readFileSync(recordPath, 'utf8'));
    expect(v1Record.schema).toBe(3);
    writeFileSync(recordPath, JSON.stringify({ ...v1Record, schema: 1 }));

    const second = new DigestStore(folder);
    const after = second.treeDigest(root);
    expect(after).toBe(originalDigest);
    expect(second.stats.computed).toBe(1);
    expect(second.stats.reused).toBe(0);

    const rewritten = JSON.parse(readFileSync(recordPath, 'utf8'));
    expect(rewritten.schema).toBe(3);
  } finally {
    rmSync(folder, { force: true, recursive: true });
  }
});

test('an unchanged tree is served from a persistent store', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'digest-store-folder-'));
  try {
    const file = path.join(root, 'tool');
    writeFileSync(file, '#!/bin/sh\necho hi\n', { mode: 0o644 });
    sleepPastRacyWindow();

    const first = new DigestStore(folder);
    const before = first.treeDigest(root);
    expect(first.stats.computed).toBe(1);

    const second = new DigestStore(folder);
    const after = second.treeDigest(root);
    expect(after).toBe(before);
    expect(second.stats.reused).toBe(1);
    expect(second.stats.computed).toBe(0);
  } finally {
    rmSync(folder, { force: true, recursive: true });
  }
});

test('a cold tree hashes bytes and inventories members in one traversal', () => {
  const folder = path.join(root, 'records');
  const tree = path.join(root, 'package');
  mkdirSync(tree);
  mkdirSync(path.join(tree, 'bin'));
  writeFileSync(path.join(tree, 'bin', 'tool'), 'tool', { mode: 0o755 });
  const target = path.join(root, 'target');
  writeFileSync(target, 'linked');
  symlinkSync(target, path.join(tree, 'linked'));
  mkdirSync(path.join(tree, 'node_modules'));
  writeFileSync(path.join(tree, 'node_modules', 'ignored'), 'ignored');
  writeFileSync(path.join(tree, 'ignored.tsbuildinfo'), 'ignored');

  const store = new DigestStore(folder);
  const value = store.treeDigest(tree);
  // Four inventory stats, two small-file verification stats and the pre-walk root stat.
  expect(store.stats).toEqual({ computed: 1, reused: 0, bytesRead: 10, filesStatted: 7, directoriesRead: 2 });
  expect(store.treeSnapshots.get(tree)?.members.map((member) => member.relative)).toEqual([
    'bin',
    'bin/tool',
    'linked',
    'linked\0target'
  ]);
  expect(store.treeDigest(tree)).toBe(value);
  expect(store.stats.filesStatted).toBe(7);

  // A recent persisted record still forces a fresh content read in a new phase.
  const next = new DigestStore(folder);
  expect(next.treeDigest(tree)).toBe(value);
  expect(next.stats.computed).toBe(1);
  expect(next.stats.bytesRead).toBe(10);
});

test('fresh processes reuse persistent inventories and freshly detect tree mutations', () => {
  const tree = path.join(root, 'package');
  const folder = path.join(root, 'records');
  const external = path.join(root, 'external');
  mkdirSync(tree);
  mkdirSync(path.join(tree, 'nested'));
  mkdirSync(external);
  writeFileSync(path.join(tree, 'nested', 'file'), 'initial');
  writeFileSync(path.join(external, 'linked'), 'target');
  symlinkSync(external, path.join(tree, 'link'));
  sleepPastRacyWindow();
  const source = new URL('../src/digest-store.ts', import.meta.url).href;
  function observe() {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import { DigestStore } from ${JSON.stringify(source)};
      const store = new DigestStore(process.argv[1]);
      const value = store.treeDigest(process.argv[2]);
      console.log(JSON.stringify({value, ...store.stats}));
    `,
        folder,
        tree
      ],
      { encoding: 'utf8' }
    );
    const observation: unknown = JSON.parse(output);
    return observation;
  }
  const cold = observe();
  expect(cold).toMatchObject({ computed: 1, directoriesRead: 3 });
  const warm = observe();
  expect(warm).toMatchObject({ computed: 0, reused: 1, bytesRead: 0, directoriesRead: 0 });
  const mutations = [
    () => writeFileSync(path.join(tree, 'added'), 'root addition'),
    () => writeFileSync(path.join(tree, 'nested', 'added'), 'nested addition'),
    () => rmSync(path.join(tree, 'nested', 'added')),
    () => rmSync(path.join(tree, 'added')),
    () => chmodSync(path.join(tree, 'nested'), 0o700),
    () => writeFileSync(path.join(tree, 'nested', 'file'), 'changed'),
    () => chmodSync(path.join(tree, 'nested', 'file'), 0o755),
    () => writeFileSync(path.join(external, 'added'), 'linked addition'),
    () => writeFileSync(path.join(external, 'linked'), 'new target'),
    () => {
      rmSync(path.join(tree, 'link'));
      symlinkSync(path.join(tree, 'nested'), path.join(tree, 'link'));
    },
    () => {
      rmSync(path.join(tree, 'nested', 'file'));
      writeFileSync(path.join(tree, 'nested', 'file'), 'replacement');
    },
    () => {
      renameSync(tree, path.join(root, 'old-package'));
      mkdirSync(tree);
      writeFileSync(path.join(tree, 'replacement'), 'root replacement');
    }
  ];
  for (const mutate of mutations) {
    mutate();
    sleepPastRacyWindow();
    expect(observe()).toMatchObject({ computed: 1, value: new DigestStore(null).treeDigest(tree) });
    expect(observe()).toMatchObject({ computed: 0, directoriesRead: 0 });
  }
}, 60_000);

test('malformed inventory fields safely miss and filtered inventories do not persist', () => {
  const tree = path.join(root, 'package');
  const folder = path.join(root, 'records');
  mkdirSync(tree);
  writeFileSync(path.join(tree, 'included'), 'included');
  writeFileSync(path.join(tree, 'excluded'), 'excluded');
  sleepPastRacyWindow();
  const before = new DigestStore(folder).treeDigest(tree);
  const [filename] = readdirSync(folder);
  const recordPath = path.join(folder, filename);
  const original = readFileSync(recordPath, 'utf8');
  for (const relative of ['../escape', '/outside', 'nested/../../escape', 'bad\\name', 'bad\0field']) {
    const record = JSON.parse(original);
    record.inventory.members[0].relative = relative;
    writeFileSync(recordPath, JSON.stringify(record));
    const store = new DigestStore(folder);
    expect(store.treeDigest(tree)).toBe(before);
    expect(store.stats.computed).toBe(1);
  }
  for (const malformed of [
    null,
    [],
    { schema: 3 },
    { ...JSON.parse(original), recordedAtNs: 'invalid' },
    { ...JSON.parse(original), inventory: null },
    {
      ...JSON.parse(original),
      inventory: {
        ...JSON.parse(original).inventory,
        root: { ...JSON.parse(original).inventory.root, type: { toString: null } }
      }
    },
    { ...JSON.parse(original), inventory: { ...JSON.parse(original).inventory, recordedAtNs: 'invalid' } }
  ]) {
    writeFileSync(recordPath, JSON.stringify(malformed));
    const fresh = new DigestStore(folder);
    expect(fresh.treeDigest(tree)).toBe(before);
    expect(fresh.stats.computed).toBe(1);
  }
  const store = new DigestStore(folder);
  const filtered = store.treeDigest(tree, { skip: (name) => name === 'excluded' });
  expect(filtered).not.toBe(before);
  expect(store.treeDigest(tree)).toBe(before);
  expect(new DigestStore(folder).treeDigest(tree)).toBe(before);
});

test('parsed record reuse still observes changed bytes, replacements and unsafe modes', () => {
  const tree = path.join(root, 'package');
  const folder = path.join(root, 'records');
  mkdirSync(tree);
  writeFileSync(path.join(tree, 'file'), 'content');
  new DigestStore(folder).treeDigest(tree);
  const [filename] = readdirSync(folder);
  const id = filename.slice(0, -5);
  const recordPath = path.join(folder, filename);
  const original = readFileSync(recordPath);
  const first = new DigestStore(folder).readRecord(id);
  expect(first).not.toBeNull();
  expect(new DigestStore(folder).readRecord(id)).toBe(first);
  expect(() => {
    if (first) first.digest = '0'.repeat(64);
  }).toThrow(TypeError);
  expect(() => {
    if (first?.inventory) first.inventory.members[0].relative = '../escape';
  }).toThrow(TypeError);
  expect(() => {
    if (first?.inventory) first.inventory.members.push(first.inventory.root);
  }).toThrow(TypeError);
  expect(new DigestStore(folder).readRecord(id)).toBe(first);

  writeFileSync(recordPath, 'not JSON');
  expect(new DigestStore(folder).readRecord(id)).toBeNull();
  expect(new DigestStore(folder).readRecord(id)).toBeNull();
  writeFileSync(recordPath, JSON.stringify({ ...first, digest: '1'.repeat(64) }));
  const changed = new DigestStore(folder).readRecord(id);
  expect(changed?.digest).toBe('1'.repeat(64));
  expect(changed).not.toBe(first);
  expect(new DigestStore(folder).readRecord(id)).toBe(changed);

  chmodSync(recordPath, 0o666);
  expect(new DigestStore(folder).readRecord(id)).toBeNull();
  chmodSync(recordPath, 0o600);
  expect(new DigestStore(folder).readRecord(id)).toBe(changed);
  rmSync(recordPath);
  symlinkSync(path.join(tree, 'file'), recordPath);
  expect(new DigestStore(folder).readRecord(id)).toBeNull();
  rmSync(recordPath);
  writeFileSync(recordPath, original, { mode: 0o600 });
  const replacement = new DigestStore(folder).readRecord(id);
  expect(replacement).toEqual(first);
  expect(replacement).not.toBe(changed);

  const otherFolder = path.join(root, 'other-records');
  mkdirSync(otherFolder, { mode: 0o700 });
  writeFileSync(path.join(otherFolder, filename), original, { mode: 0o600 });
  expect(new DigestStore(otherFolder).readRecord(id)).toEqual(replacement);
  expect(new DigestStore(otherFolder).readRecord(id)).not.toBe(replacement);
});

test('parsed descriptions evict older entries and do not retain oversized sources', () => {
  const folder = path.join(root, 'records');
  mkdirSync(folder, { mode: 0o700 });
  const source = JSON.stringify({
    schema: 3,
    path: root,
    signature: 'a'.repeat(64),
    digest: 'b'.repeat(64),
    recordedAtNs: '0'
  });
  writeFileSync(path.join(folder, 'oldest.json'), source, { mode: 0o600 });
  const store = new DigestStore(folder);
  const first = store.readRecord('oldest');
  expect(first).not.toBeNull();
  for (let index = 0; index < 512; index++) {
    const id = `record-${index}`;
    writeFileSync(path.join(folder, `${id}.json`), source, { mode: 0o600 });
    expect(store.readRecord(id)).not.toBeNull();
  }
  expect(store.readRecord('oldest')).toEqual(first);
  expect(store.readRecord('oldest')).not.toBe(first);
  const substantial = `${source}${' '.repeat(3 * 1024 * 1024)}`;
  writeFileSync(path.join(folder, 'aggregate-a.json'), substantial, { mode: 0o600 });
  const aggregate = store.readRecord('aggregate-a');
  expect(aggregate).not.toBeNull();
  for (const id of ['aggregate-b', 'aggregate-c']) {
    writeFileSync(path.join(folder, `${id}.json`), substantial, { mode: 0o600 });
    expect(store.readRecord(id)).not.toBeNull();
  }
  expect(store.readRecord('aggregate-a')).toEqual(aggregate);
  expect(store.readRecord('aggregate-a')).not.toBe(aggregate);
  const oversized = `${source}${' '.repeat(8 * 1024 * 1024)}`;
  writeFileSync(path.join(folder, 'large.json'), oversized, { mode: 0o600 });
  const large = store.readRecord('large');
  expect(large).not.toBeNull();
  expect(store.readRecord('large')).toEqual(large);
  expect(store.readRecord('large')).not.toBe(large);
});
