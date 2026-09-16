import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type TranscriptEvent, TranscriptStore } from "../src/output/transcript-store.js";

const stores: TranscriptStore[] = [];
afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

function event(seq: number, stream: TranscriptEvent["stream"], text: string, start: number): TranscriptEvent {
  const bytes = Buffer.from(text, "utf8");
  return { seq, stream, start, text, bytes, raw: bytes };
}

describe("TranscriptStore", () => {
  it("reads spooled events after memory eviction with stream and partial offsets", async () => {
    const root = await mkdtemp(join(tmpdir(), "remote-transcript-test-"));
    const store = new TranscriptStore({
      memoryPerSession: 4,
      memoryGlobal: 4,
      diskPerSession: 4096,
      diskGlobal: 4096,
      segmentBytes: 64,
      segmentEvents: 1,
      maxSegments: 64,
      pendingBytes: 4096,
      pendingEntries: 32,
      root,
    });
    stores.push(store);
    store.append("s", event(1, "stdout", "hello", 0));
    store.append("s", event(2, "stderr", "world", 5));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const page = await store.page("s", 2, 20, 128);
    expect(page.output).toEqual([
      { seq: 1, stream: "stdout", offset: 2, data: "llo" },
      { seq: 2, stream: "stderr", offset: 0, data: "world" },
    ]);
    expect((await readdir(root)).length).toBeGreaterThanOrEqual(1);
  });

  it("reports degraded state and bounded loss when pending storage is full", async () => {
    const root = await mkdtemp(join(tmpdir(), "remote-transcript-test-"));
    const store = new TranscriptStore({
      memoryPerSession: 1,
      memoryGlobal: 1,
      diskPerSession: 1,
      diskGlobal: 1,
      segmentBytes: 64,
      segmentEvents: 1,
      maxSegments: 1,
      pendingBytes: 1,
      pendingEntries: 1,
      root,
    });
    stores.push(store);
    store.append("s", event(1, "terminal", "hello", 0));
    expect(store.health("s").status).toBe("degraded");
    expect(store.outputLoss("s")).toBeGreaterThan(0);
  });

  it("keeps replacement characters pageable when the byte budget is one code point", async () => {
    const root = await mkdtemp(join(tmpdir(), "remote-transcript-test-"));
    const store = new TranscriptStore({
      memoryPerSession: 4096,
      memoryGlobal: 4096,
      diskPerSession: 4096,
      diskGlobal: 4096,
      segmentBytes: 64,
      segmentEvents: 8,
      maxSegments: 64,
      pendingBytes: 4096,
      pendingEntries: 32,
      root,
    });
    stores.push(store);
    store.append("s", {
      seq: 1,
      stream: "stdout",
      start: 0,
      text: "�x",
      bytes: Buffer.from("�x"),
      raw: Buffer.from([0xff, 0x78]),
    });
    const page = await store.page("s", 0, 3, 128);
    expect(page.output[0]).toMatchObject({ data: "�" });
    expect(page.position).toBe(3);
  });

  it("turns a failed spool root into explicit degraded health without an unhandled write rejection", async () => {
    const parent = await mkdtemp(join(tmpdir(), "remote-transcript-test-"));
    const root = join(parent, "blocked");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(root, "file");
    const store = new TranscriptStore({
      memoryPerSession: 4096,
      memoryGlobal: 4096,
      diskPerSession: 4096,
      diskGlobal: 4096,
      segmentBytes: 64,
      segmentEvents: 8,
      maxSegments: 64,
      pendingBytes: 4096,
      pendingEntries: 32,
      root,
    });
    stores.push(store);
    store.append("s", event(1, "stderr", "still-readable", 0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.health("s")).toMatchObject({ status: "degraded", pendingBytes: 0 });
    expect((await store.page("s", 0, 100, 128)).output[0]).toMatchObject({ data: "still-readable" });
  });
});
