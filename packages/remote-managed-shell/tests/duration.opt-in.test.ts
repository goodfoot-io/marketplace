import { describe, expect, it } from "vitest";
import { ProcessManager } from "../src/process-manager.js";

describe.skipIf(process.env.REMOTE_SHELL_DURATION !== "1")("ten-minute silent-process recovery", () => {
  it("keeps an unlimited silent process observable for ten real minutes", async () => {
    const manager = new ProcessManager({ pty: false });
    try {
      const started = await manager.execCommand({
        expected_server_instance_id: manager.instanceId,
        operation_id: "duration-silent-600",
        cmd: "sleep 600",
        login: true,
        tty: false,
        yield_time_ms: 25,
        timeout_ms: null,
        max_output_bytes: 16_384,
      });
      expect(started.status).toBe("running");
      await new Promise((resolve) => setTimeout(resolve, 600_100));
      const observed = await manager.readProcess({
        session_id: String(started.session_id),
        cursor: String(started.next_cursor),
        wait_ms: 1_000,
        max_output_bytes: 16_384,
      });
      expect(observed.status).toBe("exited");
      expect(observed.exit_code).toBe(0);
    } finally {
      await manager.shutdown();
    }
  }, 620_000);
});
