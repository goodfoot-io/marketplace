/**
 * Exercise bounded hashing and failure cleanup against real filesystem inputs.
 * @summary Verify large effective file bytes without file-sized allocations.
 */

import { createHash } from 'node:crypto';
import { chmodSync, closeSync, ftruncateSync, mkdirSync, mkdtempSync, openSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { DigestStore } from '../src/digest-store.ts';
import { runScript } from '../test/child-process.ts';

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'digest-stream-'));
  roots.push(root);
  return root;
}
function largeFile(file: string, size: number) {
  const descriptor = openSync(file, 'w', 0o644);
  try {
    ftruncateSync(descriptor, size);
  } finally {
    closeSync(descriptor);
  }
}
function zeros(hash: ReturnType<typeof createHash>, size: number) {
  const chunk = Buffer.alloc(1024 * 1024);
  for (let offset = 0; offset < size; offset += chunk.length)
    hash.update(chunk.subarray(0, Math.min(chunk.length, size - offset)));
  return hash;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('a 256 MiB binary uses bounded real read memory in an isolated process', async () => {
  const root = fixture();
  const file = path.join(root, 'binary');
  const size = 256 * 1024 * 1024;
  largeFile(file, size);
  const source = new URL('../src/digest-store.ts', import.meta.url).href;
  const output = await runScript(`
    import { DigestStore } from ${JSON.stringify(source)};
    const before = process.memoryUsage().arrayBuffers;
    const rssBefore = process.resourceUsage().maxRSS;
    const store = new DigestStore(null);
    const digest = await store.fileDigest(${JSON.stringify(file)});
    console.log(JSON.stringify({digest, bytes: store.stats.bytesRead, allocated: process.memoryUsage().arrayBuffers - before, peakRssKiB: process.resourceUsage().maxRSS - rssBefore}));
  `);
  const result: { digest: string; bytes: number; allocated: number; peakRssKiB: number } = JSON.parse(output);
  expect(result.digest).toBe(zeros(createHash('sha256').update('420\0'), size).digest('hex'));
  expect(result.bytes).toBe(size);
  expect(result.allocated).toBeLessThan(8 * 1024 * 1024);
  expect(result.peakRssKiB).toBeLessThan(32 * 1024);
});

test.each(
  ['mode', 'content', 'replacement'].flatMap((mutation) => [
    { mutation, tree: false },
    { mutation, tree: true }
  ])
)(
  'real concurrent $mutation mutation (tree=$tree) fails closed and releases descriptors',
  async ({ mutation, tree }) => {
    const root = fixture();
    const file = path.join(root, 'binary');
    largeFile(file, 256 * 1024 * 1024);
    const directory = path.join(root, 'tree');
    mkdirSync(directory);
    symlinkSync(file, path.join(directory, 'binary'));
    const source = new URL('../src/digest-store.ts', import.meta.url).href;
    const output = await runScript(`
    import fs from 'node:fs';
    import { Worker } from 'node:worker_threads';
    import { DigestStore } from ${JSON.stringify(source)};
    const state = new Int32Array(new SharedArrayBuffer(12));
    const worker = new Worker(\`
      const fs = require('node:fs');
      const {workerData} = require('node:worker_threads');
      const state = new Int32Array(workerData.state);
      fs.chmodSync(workerData.file, 0o755);
      Atomics.store(state, 0, 1); Atomics.notify(state, 0);
      Atomics.wait(state, 1, 0);
      let value = 0;
      while (Atomics.load(state, 1) === 1) {
        if (workerData.mutation === 'mode') {
          fs.chmodSync(workerData.file, 0o644);
          fs.chmodSync(workerData.file, 0o755);
        } else if (workerData.mutation === 'content') {
          const descriptor = fs.openSync(workerData.file, 'r+');
          try { fs.writeSync(descriptor, Buffer.from([value++ % 256]), 0, 1, 0); }
          finally { fs.closeSync(descriptor); }
        } else {
          const temporary = workerData.file + '.replacement';
          const descriptor = fs.openSync(temporary, 'w');
          try { fs.ftruncateSync(descriptor, 256 * 1024 * 1024); }
          finally { fs.closeSync(descriptor); }
          fs.renameSync(temporary, workerData.file);
        }
      }
      Atomics.store(state, 2, 1); Atomics.notify(state, 2);
      Atomics.wait(state, 2, 1);
    \`, {eval: true, execArgv: [], workerData: {state: state.buffer, mutation: ${JSON.stringify(mutation)}, file: ${JSON.stringify(file)}}});
    if (Atomics.wait(state, 0, 0, 10000) === 'timed-out') throw new Error('mutation worker did not start');
    const before = fs.readdirSync('/proc/self/fd').length;
    Atomics.store(state, 1, 1); Atomics.notify(state, 1);
    const store = new DigestStore(null);
    let failed = false;
    try { ${tree ? `await store.treeDigest(${JSON.stringify(directory)})` : `await store.fileDigest(${JSON.stringify(file)})`}; } catch (error) { failed = /changed while hashing/.test(error.message); }
    Atomics.store(state, 1, 2);
    if (Atomics.wait(state, 2, 0, 10000) === 'timed-out') throw new Error('mutation worker did not stop');
    const after = fs.readdirSync('/proc/self/fd').length;
    await worker.terminate();
    console.log(JSON.stringify({failed, before, after, memo: store.fileMemo.size + store.treeMemo.size, pending: store.pendingTrees.size, records: store.memory.size}));
  `);
    const result: { failed: boolean; before: number; after: number; memo: number; records: number; pending: number } =
      JSON.parse(output);
    expect(result.failed).toBe(true);
    expect(result.after).toBe(result.before);
    expect(result.memo).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.records).toBe(0);
  }
);

test('real cold installed-tree streaming continues event-loop heartbeats while hashing bytes', async () => {
  const tree = fixture();
  chmodSync(tree, 0o700);
  const size = 128 * 1024 * 1024;
  largeFile(path.join(tree, 'binary'), size);
  const expected = zeros(
    createHash('sha256').update('vitest-tree-digest-v3\0.\0directory\0' + '448\0binary\0file\0' + '420\0'),
    size
  )
    .update('\0')
    .digest('hex');
  let pulses = 0;
  const heartbeat = setInterval(() => {
    pulses++;
  }, 1);
  const store = new DigestStore(null);
  try {
    expect(await store.treeDigest(tree)).toBe(expected);
  } finally {
    clearInterval(heartbeat);
  }
  expect(pulses).toBeGreaterThan(2);
  expect(store.stats.bytesRead).toBe(size);
});
