import { type ChildProcess, spawn } from "node:child_process";
import { closeSync } from "node:fs";
import { connect, type Socket } from "node:net";
import { members } from "./group-probe.js";

interface Command {
  bash: string;
  cmd: string;
  login: boolean;
  cwd: string;
  env?: NodeJS.ProcessEnv;
}
let socket: Socket | undefined;
let child: ChildProcess | undefined;
let terminal = false;
let started = false;
let timer: NodeJS.Timeout | undefined;
function send(value: unknown): void {
  if (socket) socket.write(`${JSON.stringify(value)}\n`);
  else if (process.connected) process.send?.(value);
}
function finish(): void {
  clearInterval(timer);
  socket?.end();
  process.disconnect?.();
  process.exit(0);
}
function check(): void {
  if (!terminal) return;
  const living = members(process.pid);
  if (living && !living.some((member) => member.pid !== process.pid)) {
    send({ type: "scope_empty" });
    setTimeout(finish, 10).unref();
  }
}
function receive(value: unknown): void {
  const message = value as { type?: string; command?: Command };
  if (message.type === "start" && message.command && !started) {
    started = true;
    const { bash, cmd, login, cwd, env: suppliedEnv } = message.command;
    const env = { ...(suppliedEnv ?? process.env) };
    delete env.MANAGED_SCOPE_SOCKET;
    delete env.MANAGED_SCOPE_KEY;
    try {
      child = spawn(bash, [login ? "-lc" : "-c", cmd], { cwd, env, stdio: [0, 1, 2] });
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
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(signal, () => {});
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
