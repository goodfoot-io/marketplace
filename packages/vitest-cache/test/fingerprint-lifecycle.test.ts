/**
 * Exercise worker lifecycle and shared resource budgets using real processes and I/O.
 * @summary Verify cancellation, fatal failures, idle exit and permit ownership recovery.
 */
import { spawn } from 'node:child_process';
import { closeSync, ftruncateSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import { filesystemBudget, filesystemMetadata, withFilesystemStream } from '../src/filesystem-batch.ts';
import { FingerprintPool } from '../src/fingerprint-pool.ts';
import { FingerprintRuntime } from '../src/fingerprint-runtime.ts';

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
  const entry = path.join(fixture(), 'child.mjs');
  writeFileSync(entry, source);
  return new Promise((resolve, reject) => {
    const process0 = spawn(process.execPath, [...args, entry], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    let errors = '';
    const timeout = setTimeout(() => {
      process0.kill('SIGKILL');
      reject(new Error('fingerprint child did not exit'));
    }, 15000);
    process0.stdout.on('data', (bytes: Buffer) => {
      output += bytes.toString();
    });
    process0.stderr.on('data', (bytes: Buffer) => {
      errors += bytes.toString();
    });
    process0.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    process0.on('close', (code) => {
      clearTimeout(timeout);
      if (code === expectedCode && !errors) resolve(output);
      else reject(new Error(`fingerprint child failed (${code}): ${errors}`));
    });
  });
}
afterEach(async () => {
  await Promise.all([
    ...pools.splice(0).map((pool) => pool.dispose()),
    ...runtimes.splice(0).map((runtime) => runtime.dispose())
  ]);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('shared slots enforce host and actual worker bounds and drain started streams on close', {
  timeout: 15000
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
  const deadline = Date.now() + 10000;
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

test.each(['src', 'dist'])('idle %s workers permit process exit without explicit disposal', async (directory) => {
  const extension = directory === 'src' ? 'ts' : 'js';
  const source = new URL(`../${directory}/fingerprint-runtime.${extension}`, import.meta.url).href;
  const root = fixture();
  expect(
    await child(`import { FingerprintRuntime } from ${JSON.stringify(source)};
    const runtime = new FingerprintRuntime(${JSON.stringify(root)}, null);
    const phase = runtime.phase();
    await runtime.local(phase, [], [], [], {});
    await runtime.release(phase);
    console.log('idle');`)
  ).toBe('idle\n');
});

test('inherited loader failures reject active and queued work, then a fresh controller recovers', async () => {
  const root = fixture();
  const loader = path.join(root, 'fail-worker.cjs');
  writeFileSync(
    loader,
    "if (require('node:worker_threads').workerData?.budget && process.env.VC_WORKER_FAULT === '1') throw new Error('owned worker startup failure');\n"
  );
  const source = new URL('../src/fingerprint-pool.ts', import.meta.url).href;
  expect(
    await child(
      `import { FingerprintPool } from ${JSON.stringify(source)};
    process.env.VC_WORKER_FAULT = '1';
    const pool = new FingerprintPool();
    const results = await Promise.allSettled([
      pool.run('local', {kind: 'json', values: ['one']}),
      pool.run('local', {kind: 'json', values: ['two']}),
      pool.run('closure', {kind: 'json', values: ['three']})
    ]);
    if (results.some(result => result.status !== 'rejected')) throw new Error('failed worker returned a positive result');
    await pool.dispose();
    try { pool.assertHealthy(); throw new Error('failure was forgotten'); }
    catch (error) { if (!error.message.includes('owned worker startup failure')) throw error; }
    delete process.env.VC_WORKER_FAULT;
    const restored = new FingerprintPool();
    await restored.run('local', {kind: 'json', values: ['restored']});
    await restored.dispose();
    console.log('recovered');`,
      ['--require', loader]
    )
  ).toBe('recovered\n');
});

test.each(['metadata', 'stream'])(
  'fatal exit while an actual %s permit is held rejects queued work and recovers ownership',
  async (kind) => {
    const root = fixture();
    installed(root, 128 * 1024 * 1024);
    const loader = path.join(root, 'exit-worker.cjs');
    const budget = new URL('../src/filesystem-batch.ts', import.meta.url).href;
    writeFileSync(
      loader,
      `if (require('node:worker_threads').workerData?.budget && process.env.VC_WORKER_FAULT === '1') {
    const data = require('node:worker_threads').workerData;
    const slots = new Int32Array(data.budget);
    const indices = ${JSON.stringify(kind)} === 'stream' ? [32,33,34,35] : Array.from({length:32}, (_,index) => index);
    function observe() {
      if (indices.some(index => Atomics.load(slots,index) === data.slot)) process.exit(19);
      setImmediate(observe).unref();
    }
    setImmediate(observe).unref();
  }\n`
    );
    const source = new URL('../src/fingerprint-pool.ts', import.meta.url).href;
    expect(
      await child(
        `import { FingerprintPool } from ${JSON.stringify(source)};
    import { filesystemBudget } from ${JSON.stringify(budget)};
    process.env.VC_WORKER_FAULT = '1';
    const pool = new FingerprintPool();
    const command = {kind:'closure', phase:1, root:${JSON.stringify(root)}, folder:null, paths:[], toolchain:['tool'], toolchainRoot:${JSON.stringify(root)}};
    const results = await Promise.allSettled([pool.run('closure',command), pool.run('closure',command)]);
    if (results.some(result => result.status !== 'rejected')) throw new Error('fatal exit returned a positive result');
    await pool.dispose();
    if ([...new Int32Array(filesystemBudget).slice(0,36)].some(Boolean)) throw new Error('terminated worker leaked permits');
    delete process.env.VC_WORKER_FAULT;
    const restored = new FingerprintPool();
    await restored.run('closure',command);
    await restored.dispose();
    console.log('recovered');`,
        ['--require', loader]
      )
    ).toBe('recovered\n');
  }
);

test.each(['digest', 'duplicate'])(
  'a real worker with a corrupted %s payload permanently poisons the runtime',
  async (corruption) => {
    const root = fixture();
    writeFileSync(path.join(root, 'input'), 'input');
    const loader = path.join(root, 'corrupt-worker.cjs');
    writeFileSync(
      loader,
      `if (require('node:worker_threads').workerData?.budget) {
    const port = require('node:worker_threads').parentPort;
    const send = port.postMessage.bind(port);
    port.postMessage = response => {
      if ('value' in response) {
        if (${JSON.stringify(corruption)} === 'digest') response.value = ['invalid'];
        else if (response.value && response.value.inputs) response.value.inputs.push(response.value.inputs[0]);
      }
      send(response);
    };
  }\n`
    );
    const source = new URL('../src/fingerprint-runtime.ts', import.meta.url).href;
    expect(
      await child(
        `import { FingerprintRuntime } from ${JSON.stringify(source)};
    const runtime = new FingerprintRuntime(${JSON.stringify(root)}, null);
    try {
      if (${JSON.stringify(corruption)} === 'digest') await runtime.json(['actual worker hash']);
      else await runtime.local(runtime.phase(), ['input'], [], [], {});
      throw new Error('corrupted worker returned a positive result');
    } catch (error) {
      if (!error.message.includes('invalid fingerprint worker')) throw error;
    }
    try { await runtime.json(['subsequent']); throw new Error('poisoned runtime returned a positive result'); }
    catch (error) { if (!error.message.includes('invalid fingerprint worker')) throw error; }
    try { await runtime.dispose(); throw new Error('publication was not vetoed'); }
    catch (error) { if (!error.message.includes('invalid fingerprint worker')) throw error; }
    console.log('poisoned');`,
        ['--require', loader]
      )
    ).toBe('poisoned\n');
  }
);

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
    const baseline = await measure(() => new FingerprintPhase(root, {store:new DigestStore(null)}).graphDigest(files));
    const worker = await measure(async () => (await runtime.local(runtime.phase(), files, [], [], {})).inputDigest);
    await runtime.dispose();
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

test('serialized reporter runs retain healthy workers while reobserving inputs, environment and executables', {
  timeout: 20000
}, async () => {
  const root = mkdtempSync(fileURLToPath(new URL('../.retained-runtime-', import.meta.url)));
  roots.push(root);
  const repository = fileURLToPath(new URL('../../../', import.meta.url));
  const relative = path.relative(repository, root).split(path.sep).join('/');
  for (const [name, bytes] of [
    ['first', 'first'],
    ['other', 'other']
  ]) {
    mkdirSync(path.join(root, name));
    writeFileSync(path.join(root, name, 'vc-tool'), bytes, { mode: 0o755 });
  }
  writeFileSync(path.join(root, 'input'), 'first');
  writeFileSync(path.join(root, 'package.json'), '{"name":"retained-runtime-fixture","type":"module"}');
  writeFileSync(path.join(root, 'example.test.ts'), "import { test } from 'vitest'; test('example', () => {});\n");
  writeFileSync(
    path.join(root, 'vitest.config.mjs'),
    `import { withTestOutput } from '../dist/test-output-policy.mjs';
    export default withTestOutput({test:{include:['example.test.ts']}}, {fallback:[],all:[${JSON.stringify(`${relative}/input`)}],executables:{all:['vc-tool']}});`
  );
  const controller = new URL('../dist/index.js', import.meta.url).href;
  const runtime = new URL('../dist/fingerprint-runtime.js', import.meta.url).href;
  const consumer = new URL('../node_modules/vitest/dist/node.js', import.meta.url).href;
  const output = await child(`
    import { createVitest } from ${JSON.stringify(consumer)};
    import { ContentCacheReporter, ContentCacheSequencer } from ${JSON.stringify(controller)};
    import { FingerprintRuntime } from ${JSON.stringify(runtime)};
    import fs from 'node:fs/promises';
    import path from 'node:path';
    const root=${JSON.stringify(root)};
    const savedPath=process.env.PATH;
    process.env.PATH=path.join(root,'first')+path.delimiter+savedPath;
    delete process.env.DISABLE_TEST_CACHE;
    const observed=[];
    const original=FingerprintRuntime.prototype.local;
    FingerprintRuntime.prototype.local=async function(...args) {
      const value=await original.apply(this,args);
      observed.push({runtime:this,...value});
      return value;
    };
    const ctx=await createVitest('test',{root,config:path.join(root,'vitest.config.mjs'),watch:false});
    const reporter=new ContentCacheReporter(); ctx.config.reporters=[reporter]; reporter.onInit(ctx);
    const sequencer=new ContentCacheSequencer(ctx);
    const specifications=await ctx.globTestSpecifications();
    if(specifications.length!==1) throw new Error('fixture selection changed');
    const run=async()=>{await reporter.onTestRunStart(specifications);await sequencer.sort(specifications);return observed.at(-1);};
    try {
      const first=await run();
      await fs.writeFile(path.join(root,'input'),'equal');
      const input=await run();
      ctx.projects[0].config.env={...ctx.projects[0].config.env,VC_SELECTED:'changed'};
      process.env.PATH=path.join(root,'other')+path.delimiter+savedPath;
      const environment=await run();
      if(first.runtime!==input.runtime || first.runtime!==environment.runtime) throw new Error('healthy workers were replaced');
      if(first.inputDigest===input.inputDigest) throw new Error('retained input observations were stale');
      if(input.execution===environment.execution || input.executables===environment.executables) throw new Error('retained environment or executable observations were stale');
      const savedRoot=ctx.config.root;
      const missingRoot=path.join(root,'absent-repository');
      const savedWarn=console.warn; let missingWarnings=0;
      console.warn=(...args)=>{
        if(args.length===1 && args[0]==='vitest cache: spawn git ENOENT; running without the cache') missingWarnings++;
        else savedWarn(...args);
      };
      try {ctx.config.root=missingRoot;await reporter.onTestRunStart(specifications);}
      finally {ctx.config.root=savedRoot;console.warn=savedWarn;}
      if(first.runtime.reusable || missingWarnings!==1) throw new Error('failed repository discovery retained workers');
      const recovered=await run();
      if(recovered.runtime===first.runtime) throw new Error('failed runtime was reused');
      process.env.DISABLE_TEST_CACHE='true'; await reporter.onTestRunStart(specifications);
      if(recovered.runtime.reusable) throw new Error('no-cache transition retained workers');
      delete process.env.DISABLE_TEST_CACHE;
      const restored=await run();
      if(restored.runtime===recovered.runtime) throw new Error('retired runtime was reused');
      await ctx.close();
      if(restored.runtime.reusable) throw new Error('context close retained workers');
      console.log('retained and revalidated');
    } finally {
      FingerprintRuntime.prototype.local=original;
      process.env.PATH=savedPath;
      await ctx.close();
    }
  `);
  expect(output).toBe('vitest cache: not used (DISABLE_TEST_CACHE=true)\nretained and revalidated\n');
});

test('final global teardown failure vetoes the positive stage from a later real runner invocation', {
  timeout: 20000
}, async () => {
  const root = mkdtempSync(fileURLToPath(new URL('../.retained-teardown-', import.meta.url)));
  roots.push(root);
  writeFileSync(path.join(root, 'package.json'), '{"name":"retained-teardown-fixture","type":"module"}');
  writeFileSync(
    path.join(root, 'example.test.ts'),
    "import { test, expect } from 'vitest'; test('real passing body', () => expect(1).toBe(1));\n"
  );
  writeFileSync(
    path.join(root, 'setup.mjs'),
    "export default () => async () => { throw new Error('owned final teardown failure'); };\n"
  );
  writeFileSync(
    path.join(root, 'vitest.config.mjs'),
    "import { withTestOutput } from '../dist/test-output-policy.mjs'; export default withTestOutput({test:{include:['example.test.ts'],globalSetup:['./setup.mjs']}},{fallback:[]});\n"
  );
  const controller = new URL('../dist/index.js', import.meta.url).href;
  const runtime = new URL('../dist/fingerprint-runtime.js', import.meta.url).href;
  const consumer = new URL('../node_modules/vitest/dist/node.js', import.meta.url).href;
  const output = await child(
    `
    import { createVitest } from ${JSON.stringify(consumer)};
    import { ContentCacheReporter, ContentCacheSequencer } from ${JSON.stringify(controller)};
    import { FingerprintRuntime } from ${JSON.stringify(runtime)};
    import fs from 'node:fs/promises';
    import path from 'node:path';
    const root=${JSON.stringify(root)};
    const acknowledgement=path.join(root,'acknowledgement.json');
    process.env.GOODFOOT_VITEST_FORCE='1';
    process.env.GOODFOOT_VITEST_CACHE_ACK=acknowledgement;
    delete process.env.DISABLE_TEST_CACHE;
    const keys=[];
    const original=FingerprintRuntime.prototype.jsonOne;
    FingerprintRuntime.prototype.jsonOne=async function(value) {
      const digest=await original.call(this,value);
      if(Array.isArray(value) && value.length===5) keys.push(digest);
      return digest;
    };
    const ctx=await createVitest('test',{root,config:path.join(root,'vitest.config.mjs'),watch:false});
    const reporter=new ContentCacheReporter();
    ctx.config.reporters=[reporter]; ctx.reporters=[reporter];
    ctx.config.sequence.sequencer=ContentCacheSequencer;
    for(const project of ctx.projects) project.config.sequence.sequencer=ContentCacheSequencer;
    let closeErrors=0, vetoes=0;
    const originalError=ctx.logger.error.bind(ctx.logger);
    ctx.logger.error=(...args)=>{
      if(args.length===2 && args[0]==='error during close' && args[1] instanceof Error && args[1].message==='owned final teardown failure') {closeErrors++;return;}
      originalError(...args);
    };
    const originalWarn=console.warn;
    console.warn=(...args)=>{
      if(args.length===1 && args[0]==='vitest cache: results not recorded because global teardown failed') {vetoes++;return;}
      originalWarn(...args);
    };
    try {
      await ctx.start(); await ctx.start();
      if(keys.length!==6 || new Set(keys).size!==1) throw new Error('later run did not revalidate a stable positive result');
      await ctx.close();
      let published=false;
      try {await fs.stat(acknowledgement);published=true;} catch(error) {if(error.code!=='ENOENT')throw error;}
      if(published || closeErrors!==1 || vetoes!==2) throw new Error('later positive stage escaped final teardown veto');
      console.log('later stage vetoed');
    } finally {
      console.warn=originalWarn;
      FingerprintRuntime.prototype.jsonOne=original;
      await ctx.close();
    }
  `,
    [],
    1
  );
  expect(output.trim().split('\n').pop()).toBe('later stage vetoed');
});
