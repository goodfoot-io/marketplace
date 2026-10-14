/**
 * Exercise worker lifecycle and shared resource budgets using real processes and I/O.
 * @summary Verify cancellation, fatal failures, idle exit and permit ownership recovery.
 */

import { closeSync, ftruncateSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { afterEach, expect, test } from 'vitest';
import { filesystemBudget, filesystemMetadata, withFilesystemStream } from '../src/filesystem-batch.ts';
import { FingerprintPool } from '../src/fingerprint-pool.ts';
import { FingerprintRuntime } from '../src/fingerprint-runtime.ts';
import { integrationTestTimeout, runScript } from '../test/child-process.ts';

const roots: string[] = [];
const pools: FingerprintPool[] = [];
const runtimes: FingerprintRuntime[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'vc-'));
  roots.push(root);
  return root;
}
function installed(root: string, size: number) {
  const directory = path.join(root, 'node_modules/tool');
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'package.json'), '{"name":"tool","version":"1.0.0"}');
  const descriptor = openSync(path.join(directory, 'large'), 'w');
  try {
    ftruncateSync(descriptor, size);
  } finally {
    closeSync(descriptor);
  }
  writeFileSync(
    path.join(root, 'node_modules/.yarn-state.yml'),
    '"tool@npm:1.0.0":\n  locations:\n    - "node_modules/tool"\n'
  );
  writeFileSync(path.join(root, 'yarn.lock'), '"tool@npm:1.0.0":\n  resolution: "tool@npm:1.0.0"\n');
}
function child(source: string, args: string[] = [], expectedCode = 0): Promise<string> {
  return runScript(source, args, expectedCode);
}
afterEach(async () => {
  await Promise.all([
    ...pools.splice(0).map((pool) => pool.dispose()),
    ...runtimes.splice(0).map((runtime) => runtime.dispose())
  ]);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('shared slots enforce host and actual worker bounds and drain started streams on close', {
  timeout: integrationTestTimeout
}, async () => {
  const root = fixture();
  installed(root, 64 * 1024 * 1024);
  const slots = new Int32Array(filesystemBudget);
  const metadataHeld: (() => void)[] = [];
  const streamsHeld: (() => void)[] = [];
  const host = [
    ...Array.from({ length: 32 }, () =>
      filesystemMetadata(async () => {
        await lstat(path.join(root, 'node_modules/tool/large'));
        await new Promise<void>((resolve) => {
          metadataHeld.push(resolve);
        });
      })
    ),
    ...Array.from({ length: 3 }, () =>
      withFilesystemStream(async () => {
        const handle = await open(path.join(root, 'node_modules/tool/large'), 'r');
        try {
          await handle.read(Buffer.alloc(4096), 0, 4096, 0);
          await new Promise<void>((resolve) => {
            streamsHeld.push(resolve);
          });
        } finally {
          await handle.close();
        }
      })
    )
  ];
  const pool = new FingerprintPool();
  pools.push(pool);
  const phase = { kind: 'closure', phase: 1, root, folder: null, paths: [], toolchain: ['tool'], toolchainRoot: root };
  const started = pool.run('closure', { ...phase, kind: 'closure' });
  const queued = pool.run('closure', { ...phase, kind: 'closure', phase: 2 });
  const settled = Promise.allSettled([started, queued]);
  let maximumMetadata = 0;
  let maximumStreams = 0;
  let observedStream = false;
  const deadline = Date.now() + 45000;
  try {
    while (!observedStream && Date.now() < deadline) {
      maximumMetadata = Math.max(maximumMetadata, Array.from(slots.slice(0, 32)).filter(Boolean).length);
      maximumStreams = Math.max(maximumStreams, Array.from(slots.slice(32, 36)).filter(Boolean).length);
      // Release host metadata after proving the closure is blocked by the same budget.
      if (metadataHeld.length === 32 && streamsHeld.length === 3) {
        const metadata = metadataHeld.splice(0);
        for (const release of metadata) release();
      }
      observedStream = Array.from(slots.slice(32, 36)).some((owner) => owner > 1);
      await setImmediate();
    }
    expect(observedStream).toBe(true);
    expect(maximumMetadata).toBe(32);
    expect(maximumStreams).toBeLessThanOrEqual(4);
    await pool.dispose();
    expect((await settled).every((result) => result.status === 'rejected')).toBe(true);
    expect(Array.from(slots.slice(0, 36)).every((owner) => owner === 0 || owner === 1)).toBe(true);
  } finally {
    for (const release of [...metadataHeld.splice(0), ...streamsHeld.splice(0)]) release();
    await Promise.all(host);
  }
  expect(Array.from(slots.slice(0, 36)).every((owner) => owner === 0)).toBe(true);
  const restored = new FingerprintRuntime(root, null);
  runtimes.push(restored);
  await expect(restored.closure(restored.phase(), [], ['tool'], root)).resolves.toMatch(/^[a-f0-9]{64}$/);
});

test('pooled large-file hashing keeps the main event loop responsive and shifts thread CPU', async () => {
  const root = fixture();
  installed(root, 64 * 1024 * 1024);
  const runtimeSource = new URL('../src/fingerprint-runtime.ts', import.meta.url).href;
  const originalSource = new URL('../src/fingerprint.ts', import.meta.url).href;
  const storeSource = new URL('../src/digest-store.ts', import.meta.url).href;
  const measurement: {
    equal: boolean;
    baseline: { mainCpu: number; totalCpu: number; beats: number; maximumGap: number };
    worker: { mainCpu: number; totalCpu: number; beats: number; maximumGap: number };
  } = JSON.parse(
    await child(`
    import { FingerprintRuntime } from ${JSON.stringify(runtimeSource)};
    import { FingerprintPhase } from ${JSON.stringify(originalSource)};
    import { DigestStore } from ${JSON.stringify(storeSource)};
    import { setTimeout as pause } from 'node:timers/promises';
    const root = ${JSON.stringify(root)};
    const runtime = new FingerprintRuntime(root, null);
    await runtime.local(runtime.phase(), [], [], [], {});
    async function measure(operation) {
      let beats = 0;
      let maximumGap = 0;
      let previous = performance.now();
      const timer = setInterval(() => {
        const current = performance.now();
        maximumGap = Math.max(maximumGap, current - previous);
        previous = current;
        beats++;
      }, 1);
      await pause(10);
      beats = 0;
      maximumGap = 0;
      previous = performance.now();
      const main = process.threadCpuUsage();
      const total = process.cpuUsage();
      const digest = await operation();
      const mainUsed = process.threadCpuUsage(main);
      const totalUsed = process.cpuUsage(total);
      const activeBeats = beats;
      await pause(3);
      clearInterval(timer);
      return {digest, mainCpu:mainUsed.user+mainUsed.system, totalCpu:totalUsed.user+totalUsed.system, beats:activeBeats, maximumGap};
    }
    const files = ['node_modules/tool/large'];
    smokeCheckpoint('baseline hash');const baseline = await measure(() => new FingerprintPhase(root, {store:new DigestStore(null)}).graphDigest(files));
    smokeCheckpoint('worker hash');const worker = await measure(async () => (await runtime.local(runtime.phase(), files, [], [], {})).inputDigest);
    smokeCheckpoint('disposing workers');await runtime.dispose();smokeCheckpoint('workers disposed');
    console.log(JSON.stringify({equal:baseline.digest===worker.digest, baseline, worker}));
  `)
  );
  expect(measurement.equal).toBe(true);
  expect(measurement.baseline.beats).toBeGreaterThan(0);
  expect(measurement.worker.beats).toBeGreaterThan(0);
  expect(measurement.worker.mainCpu).toBeLessThan(measurement.baseline.mainCpu / 2);
  expect(measurement.worker.totalCpu).toBeGreaterThan(measurement.worker.mainCpu);
  expect(measurement.baseline.maximumGap).toBeGreaterThan(0);
  expect(measurement.worker.maximumGap).toBeGreaterThan(0);
});
