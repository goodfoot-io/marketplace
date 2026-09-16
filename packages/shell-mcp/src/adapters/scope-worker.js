/**
 * One command's process-group anchor. It is started by a bare `node` from
 * `adapter.ts` — deliberately not through a TypeScript loader.
 *
 * The command writes straight into the pipes the manager reads, so the worker's
 * own stderr is the session's stderr until the handoff below. Anything else
 * living in this process must therefore never spawn a helper that inherits
 * stderr: a surviving helper holds the session's stderr pipe open, the manager
 * never sees EOF, and the session can never settle. A loader such as `tsx`
 * does exactly that — it starts an `esbuild` service with `stdio: [...,"inherit"]`
 * on the first uncached transform — which is why this file (and its probe) are
 * plain JavaScript, and why the group it probes must contain only the command.
 */
import { spawn } from "node:child_process";
import { closeSync } from "node:fs";
import { connect } from "node:net";
import { members } from "./group-probe.js";

/** @typedef {{ bash: string, cmd: string, login: boolean, cwd: string, env?: NodeJS.ProcessEnv }} Command */

/** @type {import("node:net").Socket | undefined} */
let socket;
/** @type {import("node:child_process").ChildProcess | undefined} */
let child;
let terminal = false;
let started = false;
/** @type {NodeJS.Timeout | undefined} */
let timer;

/** @param {unknown} value */
function send(value) {
  if (socket) socket.write(`${JSON.stringify(value)}\n`);
  else if (process.connected) process.send?.(value);
}
function finish() {
  clearInterval(timer);
  socket?.end();
  process.disconnect?.();
  process.exit(0);
}
function check() {
  if (!terminal) return;
  const living = members(process.pid);
  if (living && !living.some((member) => member.pid !== process.pid)) {
    send({ type: "scope_empty" });
    setTimeout(finish, 10).unref();
  }
}
/** @param {unknown} value */
function receive(value) {
  const message = /** @type {{ type?: string, command?: Command }} */ (value);
  if (message.type === "start" && message.command && !started) {
    started = true;
    const { bash, cmd, login, cwd, env: suppliedEnv } = message.command;
    const env = { ...(suppliedEnv ?? process.env) };
    delete env.MANAGED_SCOPE_SOCKET;
    delete env.MANAGED_SCOPE_KEY;
    try {
      child = spawn(bash, [login ? "-lc" : "-c", cmd], { cwd, env, stdio: [0, 1, 2] });
      // The command owns the manager's output pipes; this process must stop
      // being a writer on them, or EOF would never mean "no writer left".
      for (const fd of [1, 2]) {
        try {
          closeSync(fd);
        } catch {}
      }
      child.once("spawn", () => send({ type: "leader_started" }));
      child.once("error", (error) => {
        terminal = true;
        send({ type: "failed_to_start", error: error.message });
        check();
      });
      child.once("exit", (code, signal) => {
        terminal = true;
        send({ type: "leader_exit", code, signal });
        check();
      });
      timer = setInterval(check, 100);
      timer.unref();
    } catch (error) {
      terminal = true;
      send({ type: "failed_to_start", error: String(error) });
      check();
    }
  } else if (message.type === "kill_leader" && child && !terminal) child.kill("SIGKILL");
  else if (message.type === "check") check();
}
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(signal, () => {});
if (process.env.MANAGED_SCOPE_SOCKET) {
  socket = connect(process.env.MANAGED_SCOPE_SOCKET);
  socket.on("connect", () => send({ type: "hello", key: process.env.MANAGED_SCOPE_KEY }));
  let input = "";
  socket.on("data", (data) => {
    input += data.toString();
    if (Buffer.byteLength(input) > 262_144) process.exit(2);
    for (;;) {
      const index = input.indexOf("\n");
      if (index < 0) break;
      const line = input.slice(0, index);
      input = input.slice(index + 1);
      try {
        receive(JSON.parse(line));
      } catch {
        process.exit(2);
      }
    }
  });
  socket.on("error", () => process.exit(2));
  socket.on("close", () => {
    try {
      process.kill(-process.pid, "SIGKILL");
    } catch {}
    process.exit(2);
  });
} else {
  process.on("message", receive);
  process.on("disconnect", () => {
    try {
      process.kill(-process.pid, "SIGKILL");
    } catch {}
    process.exit(2);
  });
}
