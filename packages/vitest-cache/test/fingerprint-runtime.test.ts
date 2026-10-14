/**
 * Exercise the production fingerprint proxy against real files and persistent workers.
 * @summary Verify byte parity, phase freshness, admission bounds and failure reuse.
 */
import { hash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { afterEach, expect, test } from 'vitest';
import { DigestStore } from '../src/digest-store.ts';
import { FingerprintPhase, inputsDigest } from '../src/fingerprint.ts';
import { FingerprintPool, fingerprintQueueLimit } from '../src/fingerprint-pool.ts';
import { FingerprintRuntime } from '../src/fingerprint-runtime.ts';

const roots: string[] = [];
const runtimes: FingerprintRuntime[] = [];
const pools: FingerprintPool[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'vc-'));
  roots.push(root);
  return root;
}
function runtime(root: string) {
  const value = new FingerprintRuntime(root, path.join(root, 'digests'));
  runtimes.push(value);
  return value;
}
function installed(root: string) {
  const directory = path.join(root, 'node_modules/tool');
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'package.json'), '{"name":"tool","version":"1.0.0"}');
  writeFileSync(path.join(directory, 'index.js'), 'export const value = 1;');
  writeFileSync(
    path.join(root, 'node_modules/.yarn-state.yml'),
    '"tool@npm:1.0.0":\n  locations:\n    - "node_modules/tool"\n'
  );
  writeFileSync(path.join(root, 'yarn.lock'), '"tool@npm:1.0.0":\n  resolution: "tool@npm:1.0.0"\n');
  return directory;
}
afterEach(async () => {
  await Promise.all([
    ...runtimes.splice(0).map((value) => value.dispose()),
    ...pools.splice(0).map((value) => value.dispose())
  ]);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('pooled local and installed jobs preserve exact binary, Unicode, mode and symlink framing', async () => {
  const root = fixture();
  const directory = installed(root);
  mkdirSync(path.join(root, 'inputs'));
  writeFileSync(path.join(root, 'inputs/é雪'), Buffer.from([0, 255, 4, 13, 10]));
  chmodSync(path.join(root, 'inputs/é雪'), 0o755);
  mkdirSync(path.join(root, 'inputs/empty'));
  symlinkSync('é雪', path.join(root, 'inputs/link'));
  writeFileSync(path.join(directory, 'é雪'), Buffer.from([7, 0, 252]));
  symlinkSync('é雪', path.join(directory, 'link'));
  const proxy = runtime(root);
  const phase = proxy.phase();
  const declarations = ['inputs/**'];
  const execution = { selected: ['é雪'], flags: [], environment: [['EXAMPLE', '雪']] };
  const original = new FingerprintPhase(root, { store: new DigestStore(null) });
  const [local, closure] = await Promise.all([
    proxy.local(phase, ['absent'], declarations, [], execution),
    proxy.closure(phase, [], ['tool'], root)
  ]);
  expect(local.inputs).toEqual(await original.inputDigests(['absent'], declarations));
  expect(local.inputDigest).toBe(inputsDigest(local.inputs, declarations));
  expect(local.execution).toBe(hash('sha256', JSON.stringify(execution), 'hex'));
  expect(closure).toBe(await original.packages().closure([], ['tool'], root));
  const key = [local.execution, local.inputDigest, closure, null];
  expect(await proxy.json([execution, key])).toEqual(
    [execution, key].map((value) => hash('sha256', JSON.stringify(value), 'hex'))
  );
  expect(await proxy.release(phase)).toBe(local.inputs.size);
});

test.each(['bytes', 'mode', 'membership', 'link'])(
  'fresh local phases observe %s changes without retaining earlier stat observations',
  async (mutation) => {
    const root = fixture();
    mkdirSync(path.join(root, 'inputs'));
    writeFileSync(path.join(root, 'inputs/first'), 'first');
    writeFileSync(path.join(root, 'inputs/other'), 'other');
    symlinkSync('first', path.join(root, 'inputs/link'));
    const proxy = runtime(root);
    const observe = async () => {
      const phase = proxy.phase();
      const result = await proxy.local(phase, [], ['inputs/**'], [], {});
      await proxy.release(phase);
      return result.inputDigest;
    };
    const before = await observe();
    expect(await observe()).toBe(before);
    if (mutation === 'bytes') writeFileSync(path.join(root, 'inputs/first'), 'equal');
    else if (mutation === 'mode') chmodSync(path.join(root, 'inputs/first'), 0o755);
    else if (mutation === 'membership') writeFileSync(path.join(root, 'inputs/new'), 'new');
    else {
      unlinkSync(path.join(root, 'inputs/link'));
      symlinkSync('other', path.join(root, 'inputs/link'));
    }
    expect(await observe()).not.toBe(before);
  }
);

test.each(['bytes', 'mode', 'membership', 'link', 'lock', 'manifest', 'state', 'retarget', 'replacement'])(
  'fresh installed phases observe %s changes after warm snapshot reuse',
  async (mutation) => {
    const root = fixture();
    const directory = installed(root);
    writeFileSync(path.join(directory, 'first'), 'first');
    writeFileSync(path.join(directory, 'other'), 'other');
    symlinkSync('first', path.join(directory, 'link'));
    const proxy = runtime(root);
    const observe = async () => {
      const phase = proxy.phase();
      try {
        return await proxy.closure(phase, [], ['tool'], root);
      } finally {
        await proxy.release(phase);
      }
    };
    const before = await observe();
    expect(await observe()).toBe(before);
    if (mutation === 'bytes') writeFileSync(path.join(directory, 'first'), 'equal');
    else if (mutation === 'mode') chmodSync(path.join(directory, 'first'), 0o755);
    else if (mutation === 'membership') writeFileSync(path.join(directory, 'new'), 'new');
    else if (mutation === 'link') {
      unlinkSync(path.join(directory, 'link'));
      symlinkSync('other', path.join(directory, 'link'));
    } else if (mutation === 'lock') {
      writeFileSync(
        path.join(root, 'yarn.lock'),
        '"tool@npm:1.0.0":\n  resolution: "tool@npm:1.0.0"\n  checksum: changed\n'
      );
    } else if (mutation === 'state') {
      writeFileSync(
        path.join(root, 'node_modules/.yarn-state.yml'),
        '"tool@npm:2.0.0":\n  locations:\n    - "node_modules/tool"\n'
      );
      await expect(observe()).rejects.toThrow('missing exact Yarn lock entry');
      writeFileSync(
        path.join(root, 'node_modules/.yarn-state.yml'),
        '"tool@npm:1.0.0":\n  locations:\n    - "node_modules/tool"\n'
      );
      expect(await observe()).toBe(before);
      return;
    } else if (mutation === 'retarget' || mutation === 'replacement') {
      renameSync(directory, path.join(root, 'original'));
      const target = mutation === 'retarget' ? path.join(root, 'replacement') : directory;
      mkdirSync(target);
      writeFileSync(path.join(target, 'package.json'), '{"name":"tool","version":"1.0.0"}');
      writeFileSync(path.join(target, 'index.js'), 'export const changed = true;');
      if (mutation === 'retarget') symlinkSync(target, directory);
    } else {
      writeFileSync(path.join(directory, 'package.json'), '{"name":"tool","dependencies":{"missing":"*"}}');
      await expect(observe()).rejects.toThrow('unresolved required dependency missing');
      writeFileSync(path.join(directory, 'package.json'), '{"name":"tool","version":"1.0.0"}');
      expect(await observe()).toBe(before);
      return;
    }
    expect(await observe()).not.toBe(before);
  }
);

test('workers observe real executable bytes and live PATH changes between phases', async () => {
  const root = fixture();
  const savedPath = process.env.PATH;
  for (const [name, bytes] of [
    ['first', 'first'],
    ['other', 'other']
  ]) {
    mkdirSync(path.join(root, name));
    writeFileSync(path.join(root, name, 'vc-tool'), bytes, { mode: 0o755 });
  }
  const proxy = runtime(root);
  const observe = async () => {
    const phase = proxy.phase();
    const result = await proxy.local(phase, [], [], ['vc-tool'], {});
    await proxy.release(phase);
    return result.executables;
  };
  try {
    process.env.PATH = path.join(root, 'first');
    const before = await observe();
    expect(await observe()).toBe(before);
    writeFileSync(path.join(root, 'first/vc-tool'), 'equal');
    expect(await observe()).not.toBe(before);
    process.env.PATH = path.join(root, 'other');
    expect(await observe()).not.toBe(before);
  } finally {
    if (savedPath === undefined) delete process.env.PATH;
    else process.env.PATH = savedPath;
  }
});

test('bounded FIFO admission batches small hashes and continues after operation errors', async () => {
  const pool = new FingerprintPool();
  pools.push(pool);
  const completed: number[] = [];
  const requests = Array.from({ length: fingerprintQueueLimit + 1 }, (_, index) =>
    pool.run('local', { kind: 'json', values: [index, `small-${index}`] }).then((value) => {
      completed.push(index);
      return value;
    })
  );
  await expect(pool.run('local', { kind: 'json', values: ['overflow'] })).rejects.toThrow('queue is full');
  expect(await Promise.all(requests)).toEqual(
    Array.from({ length: fingerprintQueueLimit + 1 }, (_, index) =>
      [index, `small-${index}`].map((value) => hash('sha256', JSON.stringify(value), 'hex'))
    )
  );
  expect(completed).toEqual(Array.from({ length: fingerprintQueueLimit + 1 }, (_, index) => index));
  await expect(pool.run('local', { kind: 'json', values: [1n] })).rejects.toThrow('BigInt');
  await expect(pool.run('local', { kind: 'json', values: ['restored'] })).resolves.toEqual([
    hash('sha256', JSON.stringify('restored'), 'hex')
  ]);
});

test('failed local observations do not memoize rejection or stale positive results', async () => {
  const root = fixture();
  mkdirSync(path.join(root, 'inputs'));
  symlinkSync('.', path.join(root, 'inputs/cycle'));
  const proxy = runtime(root);
  const phase = proxy.phase();
  for (let retry = 0; retry < 2; retry++)
    await expect(proxy.local(phase, [], ['inputs/**'], [], {})).rejects.toThrow('symlink cycle');
  unlinkSync(path.join(root, 'inputs/cycle'));
  writeFileSync(path.join(root, 'inputs/fixed'), 'fixed');
  const value = await proxy.local(phase, [], ['inputs/**'], [], {});
  expect(value.inputs.size).toBe(1);
  expect(await proxy.release(phase)).toBe(1);
});

test('warm pooled closure rereads metadata while reusing completed digests without reading file bytes', async () => {
  const root = fixture();
  installed(root);
  const proxy = runtime(root);
  // Preserve the real two-second racy guard; never forge metadata timestamps.
  await setTimeout(2100);
  const first = proxy.phase();
  const digest = await proxy.closure(first, [], ['tool'], root);
  await proxy.release(first);
  const cold = proxy.stats;
  expect(cold.computed).toBe(1);
  expect(cold.bytesRead).toBeGreaterThan(0);
  const second = proxy.phase();
  expect(await proxy.closure(second, [], ['tool'], root)).toBe(digest);
  await proxy.release(second);
  const warm = proxy.stats;
  expect(warm.reused - cold.reused).toBe(1);
  expect(warm.filesStatted - cold.filesStatted).toBeGreaterThan(0);
  expect(warm.bytesRead - cold.bytesRead).toBe(0);
  expect(warm.computed - cold.computed).toBe(0);
  expect(warm.directoriesRead - cold.directoriesRead).toBe(0);
});
