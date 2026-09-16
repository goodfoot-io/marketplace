import { monitorEventLoopDelay } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { ProcessManager } from "../src/process-manager.js";

describe.skipIf(process.env.REMOTE_SHELL_SOAK !== "1")("one-hour mixed workload", () => {
  it("maintains bounded control latency and memory", async () => {
    const manager = new ProcessManager({ pty: false });
    const loop = monitorEventLoopDelay({ resolution: 20 });
    loop.enable();
    const started = Date.now();
    let operations = 0;
    let worstControlMs = 0;
    try {
      while (Date.now() - started < 3_600_000) {
        const before = performance.now();
        const result = await manager.execCommand({
          expected_server_instance_id: manager.instanceId,
          operation_id: `soak-${operations}`,
          cmd: operations % 5 === 0 ? "sleep 0.2; printf quiet" : "printf 'line-%s\\n' {1..50}",
          login: true,
          tty: false,
          yield_time_ms: 1_000,
          timeout_ms: 10_000,
          max_output_bytes: 16_384,
        });
        worstControlMs = Math.max(worstControlMs, performance.now() - before);
        expect(result.session_id).toEqual(expect.any(String));
        operations += 1;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const listing = await manager.listProcesses({ include_completed: true, limit: 100 });
      const rss = process.memoryUsage().rss;
      expect(operations).toBeGreaterThan(100);
      expect(worstControlMs).toBeLessThan(5_000);
      expect(loop.percentile(99) / 1e6).toBeLessThan(500);
      expect(rss).toBeLessThan(1_073_741_824);
      expect(listing.health).toBeDefined();
    } finally {
      loop.disable();
      await manager.shutdown();
    }
  }, 3_660_000);
});
