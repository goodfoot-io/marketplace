/**
 * Verify digest store cache behavior with isolated temporary fixtures.
 *
 * @summary Verify digest store cache behavior with isolated temporary fixtures.
 */
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    expect(v1Record.schema).toBe(2);
    writeFileSync(recordPath, JSON.stringify({ ...v1Record, schema: 1 }));

    const second = new DigestStore(folder);
    const after = second.treeDigest(root);
    expect(after).toBe(originalDigest);
    expect(second.stats.computed).toBe(1);
    expect(second.stats.reused).toBe(0);

    const rewritten = JSON.parse(readFileSync(recordPath, 'utf8'));
    expect(rewritten.schema).toBe(2);
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
