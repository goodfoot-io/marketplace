/**
 * The helper owns the inherited terminal descriptor. A blocked stdout sink
 * therefore blocks this process, while the manager remains responsive and
 * bounded by its own IPC queue.
 */

let failed = false;

process.stdout.on("error", () => {
  failed = true;
  process.send?.({ failed: true });
});

process.on("message", (message: unknown) => {
  if (!message || typeof message !== "object" || !("text" in message) || typeof message.text !== "string") return;
  if (failed) {
    process.send?.({ failed: true });
    return;
  }
  process.stdout.write(message.text, (error?: Error | null) => {
    if (error) {
      failed = true;
      process.send?.({ failed: true });
    } else {
      process.send?.({ ack: true });
    }
  });
});

process.on("disconnect", () => process.exit(0));
