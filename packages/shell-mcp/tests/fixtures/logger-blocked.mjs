import { IsolatedLogger } from "../../src/logging/logger.ts";

const logger = new IsolatedLogger(32_768, 32, { logFile: process.env.SHELL_TEST_LOG });
// The test parent intentionally does not drain this process's stdout. The
// isolated helper eventually blocks, exercising the bounded manager queue.
logger.display({ type: "command", session: "fixture", cwd: "/tmp", command: "fixture", label: null, tty: false });
const timer = setInterval(() => {
  for (let i = 0; i < 128; i++) logger.display({ type: "output", session: "fixture", stream: "stdout", text: "x".repeat(4096) });
}, 10);

process.on("message", async (message) => {
  if (message === "diagnostic") logger.log("test.probe", "server", "File writer is independent");
  if (message === "health") process.send?.({ kind: "health", health: logger.health() });
  if (message === "stop") {
    clearInterval(timer);
    await logger.close(100);
    process.send?.({ kind: "closed", health: logger.health() });
    setTimeout(() => process.exit(0), 20);
  }
});

process.on("disconnect", async () => {
  clearInterval(timer);
  await logger.close(20);
  process.exit(0);
});

process.send?.({ kind: "ready" });
