/**
 * Verify native metadata against real Node observations and physical mutations.
 * @summary Exercise symlink targets, nanoseconds, owned inputs and error recovery.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { constants, tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import type { StatEntry } from '../src/digest-store.ts';
import { verifyNativeMetadata } from '../src/native-metadata.ts';

/**
 * Observe one physical metadata baseline with Node's authoritative nanosecond API.
 * @param root - Owned fixture directory.
 * @param relative - Logical member name, optionally an effective-target marker.
 * @returns Canonical physical metadata.
 */
function observe(root: string, relative: string): StatEntry {
  const target = relative.endsWith('\0target');
  const filename = path.join(root, target ? relative.slice(0, -7) : relative);
  const stat = fs.lstatSync(target ? fs.realpathSync.native(filename) : filename, { bigint: true });
  return {
    relative,
    type: stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other',
    dev: String(stat.dev),
    ino: String(stat.ino),
    size: String(stat.size),
    mode: String(stat.mode),
    mtimeNs: String(stat.mtimeNs),
    ctimeNs: String(stat.ctimeNs)
  };
}

test('native observations match Node and detect same-size writes, modes, inode replacement and membership', async () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'native-metadata-'));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'one');
    const initial = [observe(root, '.'), observe(root, 'file')];
    expect(await verifyNativeMetadata(root, initial)).toEqual({ matches: true, checked: 2 });
    fs.writeFileSync(file, 'two');
    expect((await verifyNativeMetadata(root, initial)).matches).toBe(false);
    const beforeMode = [observe(root, 'file')];
    fs.chmodSync(file, 0o600);
    expect((await verifyNativeMetadata(root, beforeMode)).matches).toBe(false);
    const beforeReplace = [observe(root, 'file')];
    fs.renameSync(file, path.join(root, 'old'));
    fs.writeFileSync(file, 'two');
    expect((await verifyNativeMetadata(root, beforeReplace)).matches).toBe(false);
    const beforeMember = [observe(root, '.')];
    fs.writeFileSync(path.join(root, 'new'), 'new');
    expect((await verifyNativeMetadata(root, beforeMember)).matches).toBe(false);
    fs.unlinkSync(file);
    expect(await verifyNativeMetadata(root, beforeReplace)).toEqual({ matches: false, checked: 0 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('checks logical symlink metadata and freshly resolved effective target', async () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'native-target-'));
  try {
    fs.writeFileSync(path.join(root, 'a'), 'one');
    fs.writeFileSync(path.join(root, 'b'), 'two');
    fs.symlinkSync('a', path.join(root, 'link'));
    const baseline = [observe(root, 'link'), observe(root, 'link\0target')];
    expect(await verifyNativeMetadata(root, baseline)).toEqual({ matches: true, checked: 2 });
    fs.writeFileSync(path.join(root, 'a'), 'new');
    expect((await verifyNativeMetadata(root, baseline)).matches).toBe(false);
    const fresh = [observe(root, 'link'), observe(root, 'link\0target')];
    fs.unlinkSync(path.join(root, 'link'));
    fs.symlinkSync('b', path.join(root, 'link'));
    expect((await verifyNativeMetadata(root, fresh)).matches).toBe(false);
    fs.unlinkSync(path.join(root, 'b'));
    expect(
      (await verifyNativeMetadata(root, [{ ...baseline[0], ...observe(root, 'a'), relative: 'link\0target' }])).matches
    ).toBe(false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects forged type and numeric overflow and compares negative timestamp bits exactly', async () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'native-ranges-'));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'one');
    fs.utimesSync(file, new Date(-1000), new Date(-1000));
    expect(fs.lstatSync(file, { bigint: true }).mtimeNs).toBe(-1000000000n);
    const baseline = observe(root, 'file');
    expect((await verifyNativeMetadata(root, [baseline])).matches).toBe(true);
    expect((await verifyNativeMetadata(root, [{ ...baseline, type: 'directory' }])).matches).toBe(false);
    expect(
      (await verifyNativeMetadata(root, [{ ...baseline, ino: String(BigInt(baseline.ino) + (1n << 64n)) }])).matches
    ).toBe(false);
    expect((await verifyNativeMetadata(root, [{ ...baseline, mtimeNs: String(1n << 63n) }])).matches).toBe(false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('concurrent batches drain filesystem errors and recover; native boundary rejects malformed inputs', async () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'native-error-'));
  try {
    fs.writeFileSync(path.join(root, 'file'), 'one');
    const baseline = observe(root, 'file');
    const members = Array.from({ length: 96 }, () => baseline);
    const results = await Promise.all(Array.from({ length: 40 }, () => verifyNativeMetadata(root, members)));
    expect(results.every((result) => result.matches && result.checked === 96)).toBe(true);
    fs.symlinkSync('loop', path.join(root, 'loop'));
    await expect(verifyNativeMetadata(root, [{ ...baseline, relative: 'loop\0target' }])).rejects.toMatchObject({
      nativeErrno: constants.errno.ELOOP
    });
    expect((await verifyNativeMetadata(root, [baseline])).matches).toBe(true);
    const loaded: unknown = createRequire(import.meta.url)('../build/Release/metadata.node');
    if (typeof loaded !== 'object' || loaded === null || !('check' in loaded) || typeof loaded.check !== 'function')
      throw new Error('Invalid addon');
    const check = loaded.check;
    const empty: unknown = check([], Buffer.alloc(0), Buffer.alloc(0));
    expect(await empty).toEqual({ matches: true, checked: 0 });
    expect(() => check(['file\0tail'], Buffer.alloc(1), Buffer.alloc(48))).toThrow();
    expect(() => check(Array(33).fill('file'), Buffer.alloc(33), Buffer.alloc(33 * 48))).toThrow();
    const fields = ['dev', 'ino', 'size', 'mode', 'mtimeNs', 'ctimeNs'];
    const bytes = Buffer.alloc(48);
    for (const [index, field] of fields.entries()) {
      if (!(field in baseline)) throw new Error('Missing field');
      const value: unknown = Reflect.get(baseline, field);
      if (typeof value !== 'string') throw new Error('Invalid field');
      bytes.writeBigUInt64LE(BigInt.asUintN(64, BigInt(value)), index * 8);
    }
    const paths = [path.join(root, 'file')];
    const targets = Buffer.alloc(1);
    const pending: unknown = check(paths, targets, bytes);
    bytes.fill(0);
    targets[0] = 1;
    paths[0] = path.join(root, 'missing');
    expect(await pending).toEqual({ matches: true, checked: 1 });
    const transferable = Buffer.from(new ArrayBuffer(96));
    for (let row = 0; row < 2; row++) {
      const stat = fs.lstatSync(path.join(root, 'file'), { bigint: true });
      const values = [stat.dev, stat.ino, stat.size, stat.mode, stat.mtimeNs, stat.ctimeNs];
      for (const [index, value] of values.entries())
        transferable.writeBigUInt64LE(BigInt.asUintN(64, value), row * 48 + index * 8);
    }
    const getterPaths = [path.join(root, 'file'), path.join(root, 'file')];
    Object.defineProperty(getterPaths, '0', {
      get() {
        structuredClone(transferable.buffer, { transfer: [transferable.buffer] });
        return path.join(root, 'file');
      }
    });
    const detached: unknown = check(getterPaths, Buffer.alloc(2), transferable);
    expect(await detached).toEqual({ matches: true, checked: 2 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('permission-denied observations reject after draining and recover after access restoration', async () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'native-permission-'));
  const directory = path.join(root, 'private');
  try {
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'file'), 'one');
    const baseline = observe(root, 'private/file');
    fs.chmodSync(directory, 0);
    await expect(verifyNativeMetadata(root, [baseline, { ...baseline, relative: 'missing' }])).rejects.toMatchObject({
      nativeErrno: constants.errno.EACCES
    });
    fs.chmodSync(directory, 0o700);
    expect(await verifyNativeMetadata(root, [baseline])).toEqual({ matches: true, checked: 1 });
    expect(await verifyNativeMetadata(root, [{ ...baseline, relative: 'private/file/child' }])).toEqual({
      matches: false,
      checked: 0
    });
  } finally {
    fs.chmodSync(directory, 0o700);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
