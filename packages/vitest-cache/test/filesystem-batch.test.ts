/**
 * Exercise bounded, ordered batches using actual asynchronous filesystem reads.
 * @summary Verify shared concurrency and complete error draining.
 */
import { lstat, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  batchedMap,
  filesystemBatchSize,
  filesystemMetadata,
  filesystemStreamLimit,
  withFilesystemStream
} from '../src/filesystem-batch.ts';

test('concurrent batches share a bound, preserve order and drain reads before rejecting', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'filesystem-batch-'));
  try {
    const filenames: string[] = [];
    for (let index = 0; index < 100; index++) {
      const filename = path.join(root, String(index));
      await writeFile(filename, String(index));
      filenames.push(filename);
    }
    let active = 0;
    let maximum = 0;
    let completed = 0;
    const observe = (filename: string) =>
      filesystemMetadata(async () => {
        active++;
        maximum = Math.max(maximum, active);
        try {
          return await readFile(filename, 'utf8');
        } finally {
          active--;
          completed++;
        }
      });
    const values = await Promise.all([batchedMap(filenames, observe), batchedMap(filenames, observe)]);
    expect(values).toEqual([
      filenames.map((filename) => path.basename(filename)),
      filenames.map((filename) => path.basename(filename))
    ]);
    expect(maximum).toBe(filesystemBatchSize);
    expect(active).toBe(0);
    completed = 0;
    await expect(batchedMap([path.join(root, 'missing'), ...filenames], observe)).rejects.toMatchObject({
      code: 'ENOENT'
    });
    expect(active).toBe(0);
    expect(completed).toBe(filesystemBatchSize);
    expect(await batchedMap(filenames.slice(0, 2), observe)).toEqual(['0', '1']);
    completed = 0;
    await expect(
      batchedMap(filenames, (filename) => {
        if (filename === filenames[16]) throw new Error('synchronous observer failure');
        return observe(filename);
      })
    ).rejects.toThrow('synchronous observer failure');
    expect(active).toBe(0);
    expect(completed).toBe(filesystemBatchSize - 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('stream slots bound real descriptors across concurrent callers and release failed operations', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'filesystem-streams-'));
  const filename = path.join(root, 'bytes');
  try {
    await writeFile(filename, Buffer.alloc(1024 * 1024));
    let active = 0;
    let maximum = 0;
    const stream = async () => {
      const handle = await open(filename, 'r');
      active++;
      maximum = Math.max(maximum, active);
      try {
        const buffer = Buffer.alloc(1024 * 1024);
        await handle.read(buffer, 0, buffer.length, 0);
        throw new Error('after real read');
      } finally {
        await handle.close();
        active--;
      }
    };
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => withFilesystemStream(stream)));
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(maximum).toBe(filesystemStreamLimit);
    expect(active).toBe(0);
    await expect(withFilesystemStream(() => readFile(filename))).resolves.toHaveLength(1024 * 1024);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('metadata and stream queues drain independently in FIFO order using real IO', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'vc-'));
  const filename = path.join(root, 'bytes');
  await writeFile(filename, 'owned bytes');
  const metadataRelease: (() => void)[] = [];
  const streamRelease: (() => void)[] = [];
  const metadataAcquired: number[] = [];
  const streamsAcquired: number[] = [];
  const heldMetadata = Array.from({ length: filesystemBatchSize }, () =>
    filesystemMetadata(async () => {
      await lstat(filename);
      await new Promise<void>((resolve) => metadataRelease.push(resolve));
    })
  );
  const heldStreams = Array.from({ length: filesystemStreamLimit }, () =>
    withFilesystemStream(async () => {
      const handle = await open(filename, 'r');
      try {
        await handle.read(Buffer.alloc(1), 0, 1, 0);
        await new Promise<void>((resolve) => streamRelease.push(resolve));
      } finally {
        await handle.close();
      }
    })
  );
  // A real timer bounds fixture acquisition without controlling filesystem observations.
  const deadline = Date.now() + 2000;
  while (
    (metadataRelease.length !== filesystemBatchSize || streamRelease.length !== filesystemStreamLimit) &&
    Date.now() < deadline
  )
    await new Promise<void>((resolve) => setImmediate(resolve));
  const queuedMetadata = Array.from({ length: 5 }, (_, index) =>
    filesystemMetadata(async () => {
      metadataAcquired.push(index);
      return (await lstat(filename)).isFile();
    })
  );
  const queuedStreams = Array.from({ length: 5 }, (_, index) =>
    withFilesystemStream(async () => {
      streamsAcquired.push(index);
      const handle = await open(filename, 'r');
      try {
        const bytes = Buffer.alloc(1);
        await handle.read(bytes, 0, 1, 0);
        return bytes.toString();
      } finally {
        await handle.close();
      }
    })
  );
  try {
    expect(metadataRelease).toHaveLength(filesystemBatchSize);
    expect(streamRelease).toHaveLength(filesystemStreamLimit);
    metadataRelease.shift()?.();
    expect(await Promise.all(queuedMetadata)).toEqual(Array(5).fill(true));
    expect(metadataAcquired).toEqual([0, 1, 2, 3, 4]);
    expect(streamsAcquired).toEqual([]);
    streamRelease.shift()?.();
    expect(await Promise.all(queuedStreams)).toEqual(Array(5).fill('o'));
    expect(streamsAcquired).toEqual([0, 1, 2, 3, 4]);
  } finally {
    for (const release of [...metadataRelease, ...streamRelease]) release();
    await Promise.allSettled([...heldMetadata, ...heldStreams, ...queuedMetadata, ...queuedStreams]);
    await rm(root, { recursive: true, force: true });
  }
});
