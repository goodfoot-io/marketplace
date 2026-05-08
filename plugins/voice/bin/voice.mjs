#!/usr/bin/env node
import { createRequire as __banner_createRequire } from 'node:module';import { fileURLToPath as __banner_fileURLToPath } from 'node:url';import { dirname as __banner_dirname } from 'node:path';const require = __banner_createRequire(import.meta.url);const __filename = __banner_fileURLToPath(import.meta.url);const __dirname = __banner_dirname(__filename);

// src/cli/index.ts
import { spawn, spawnSync } from "node:child_process";
import { readFileSync as readFileSync2, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// src/cli/args.ts
import { readFileSync } from "node:fs";
function parseArgs(argv) {
  const args = argv.slice(2);
  const positional = [];
  const flags = {};
  let i = 0;
  let command = "";
  let subcommand;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== void 0 && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  if (positional.length > 0) {
    command = positional[0];
  }
  if (positional.length > 1) {
    subcommand = positional[1];
  }
  return { command, subcommand, positional: positional.slice(2), flags };
}
function getGrandparentPid() {
  try {
    const status = readFileSync(`/proc/${process.ppid}/status`, "utf8");
    const match = status.match(/^PPid:\s+(\d+)/m);
    if (match) return parseInt(match[1], 10);
  } catch (_err) {
  }
  return process.ppid;
}
function getPort(flags) {
  const p = flags["port"];
  if (typeof p === "string") {
    const n = parseInt(p, 10);
    if (!isNaN(n)) return n;
  }
  return 2e4 + getGrandparentPid() % 1e4;
}
function getString(flags, key) {
  const v = flags[key];
  if (typeof v === "string") return v;
  return void 0;
}
function getBoolean(flags, key) {
  return flags[key] === true || flags[key] === "true";
}
async function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").trim()));
    process.stdin.on("error", reject);
  });
}

// src/cli/control-client.ts
import http from "node:http";
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });
    req.on("error", (err) => {
      if (err.code === "ECONNREFUSED") {
        reject(new Error(`Daemon not running on port ${options.port ?? ""} (ECONNREFUSED)`));
      } else {
        reject(new Error(err.message || err.code || String(err)));
      }
    });
    if (body !== void 0) {
      req.write(body);
    }
    req.end();
  });
}
function makeOptions(controlPort2, method, path, bodyLength) {
  const opts = {
    hostname: "localhost",
    port: controlPort2,
    path,
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (bodyLength !== void 0) {
    opts.headers["Content-Length"] = bodyLength;
  }
  return opts;
}
async function getStatus(controlPort2) {
  return request(makeOptions(controlPort2, "GET", "/status"));
}
async function postJson(controlPort2, path, data) {
  const body = JSON.stringify(data);
  return request(makeOptions(controlPort2, "POST", path, Buffer.byteLength(body)), body);
}
async function postEmpty(controlPort2, path) {
  const body = "{}";
  return request(makeOptions(controlPort2, "POST", path, Buffer.byteLength(body)), body);
}
async function watchOnce(controlPort2, events, after) {
  const eventsParam = events.length > 0 ? `events=${encodeURIComponent(events.join(","))}&` : "";
  const path = `/watch?${eventsParam}after=${after}`;
  return request(makeOptions(controlPort2, "GET", path));
}

// src/cli/index.ts
function printJson(data) {
  process.stdout.write(JSON.stringify(data) + "\n");
}
function fatal(message, code) {
  process.stderr.write(JSON.stringify({ error: message, ...code !== void 0 ? { code } : {} }) + "\n");
  process.exit(1);
}
function controlPort(port2) {
  return port2 + 1;
}
function tmpDir(port2) {
  return `/tmp/voice-${port2}`;
}
function cursorFile(port2) {
  return `${tmpDir(port2)}/cursor`;
}
function readCursor(port2) {
  try {
    const raw = readFileSync2(cursorFile(port2), "utf8").trim();
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}
function writeCursor(port2, cursor) {
  mkdirSync(tmpDir(port2), { recursive: true });
  writeFileSync(cursorFile(port2), String(cursor), "utf8");
}
async function cmdStart(port2, title, model, voice) {
  const instructions = await readStdin();
  try {
    const res = await getStatus(controlPort(port2));
    if (res.statusCode === 200) {
      printJson(JSON.parse(res.body));
      process.exit(0);
    }
  } catch (_err) {
  }
  const thisFile = fileURLToPath(import.meta.url);
  const daemonPath = join(dirname(thisFile), "daemon.mjs");
  const env = {
    ...process.env,
    RVS_PORT: String(port2),
    RVS_API_KEY: process.env["OPENAI_API_KEY"] ?? process.env["RVS_API_KEY"] ?? "",
    RVS_INSTRUCTIONS: instructions,
    ...title !== void 0 ? { RVS_TITLE: title } : {},
    ...model !== void 0 ? { RVS_MODEL: model } : {},
    ...voice !== void 0 ? { RVS_VOICE: voice } : {}
  };
  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: ["ignore", "pipe", "inherit"],
    env
  });
  const startupJson = await new Promise((resolve, reject) => {
    let buf = "";
    const stdout = child.stdout;
    if (stdout === null) {
      reject(new Error("daemon stdout is null"));
      return;
    }
    stdout.setEncoding("utf8");
    stdout.on("data", (chunk) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        resolve(buf.slice(0, nl).trim());
      }
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`daemon exited with code ${code}`));
      }
    });
  });
  child.unref();
  let startupData;
  try {
    startupData = JSON.parse(startupJson);
  } catch {
    fatal(`daemon sent invalid startup JSON: ${startupJson}`);
  }
  await postJson(controlPort(port2), "/client/register", { pid: getGrandparentPid() });
  printJson(startupData);
  process.exit(0);
}
async function cmdStop(port2) {
  const res = await postEmpty(controlPort(port2), "/server/stop");
  printJson(JSON.parse(res.body));
}
async function cmdStatus(port2) {
  const res = await getStatus(controlPort(port2));
  printJson(JSON.parse(res.body));
}
async function cmdOpen(port2) {
  const url = `http://localhost:${port2}`;
  const platform = process.platform;
  const opener = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  spawnSync(opener, [url], { shell: platform === "win32" });
  printJson({ url });
}
async function cmdConversation(port2, action) {
  const allowed = ["start", "pause", "resume", "end", "reset"];
  if (!allowed.includes(action)) {
    fatal(`Unknown conversation action: ${action}. Must be one of: ${allowed.join(", ")}`);
  }
  const res = await postEmpty(controlPort(port2), `/conversation/${action}`);
  printJson(JSON.parse(res.body));
}
async function cmdInject(port2, role, source, triggerResponse) {
  const allowed = ["user", "assistant", "system"];
  if (!allowed.includes(role)) {
    fatal(`Unknown inject role: ${role}. Must be one of: ${allowed.join(", ")}`);
  }
  const text = await readStdin();
  const body = { text };
  if (source !== void 0) body["source"] = source;
  if (role !== "assistant" && triggerResponse) body["triggerResponse"] = true;
  const res = await postJson(controlPort(port2), `/inject/${role}`, body);
  printJson(JSON.parse(res.body));
}
async function cmdCancelTool(port2, callId) {
  const res = await postJson(controlPort(port2), "/tool/cancel", { callId });
  printJson(JSON.parse(res.body));
}
async function cmdAnswer(port2, questionId) {
  const id = parseInt(questionId, 10);
  if (isNaN(id)) {
    fatal(`Invalid questionId: ${questionId}`);
  }
  const answer = await readStdin();
  const res = await postJson(controlPort(port2), "/tool/answer", { questionId: id, answer });
  printJson(JSON.parse(res.body));
}
async function cmdWatch(port2, eventTypes) {
  let cursor = readCursor(port2);
  const pollOnce = async () => {
    const res = await watchOnce(controlPort(port2), eventTypes, cursor);
    const body = res.body.trim();
    if (body.length === 0) return false;
    const lines = body.split("\n").filter(Boolean);
    let maxSeq = cursor;
    for (const line of lines) {
      process.stdout.write(line + "\n");
      try {
        const parsed2 = JSON.parse(line);
        if (parsed2.seq > maxSeq) maxSeq = parsed2.seq;
      } catch (_err) {
      }
    }
    writeCursor(port2, maxSeq);
    cursor = maxSeq;
    return true;
  };
  if (eventTypes.length === 0) {
    eventTypes = ["transcript.item", "question", "conversation.error", "browser.audio.error"];
  }
  const got = await pollOnce();
  if (got) {
    process.exit(0);
  }
  let exiting = false;
  process.on("SIGINT", () => {
    exiting = true;
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    exiting = true;
    process.exit(0);
  });
  const poll = async () => {
    if (exiting) return;
    const got2 = await pollOnce();
    if (got2) {
      process.exit(0);
    } else {
      setTimeout(() => void poll(), 200);
    }
  };
  setTimeout(() => void poll(), 200);
}
var parsed = parseArgs(process.argv);
var port = getPort(parsed.flags);
async function main() {
  switch (parsed.command) {
    case "start": {
      const title = getString(parsed.flags, "title");
      const model = getString(parsed.flags, "model");
      const voice = getString(parsed.flags, "voice");
      await cmdStart(port, title, model, voice);
      break;
    }
    case "stop": {
      await cmdStop(port);
      break;
    }
    case "status": {
      await cmdStatus(port);
      break;
    }
    case "open": {
      await cmdOpen(port);
      break;
    }
    case "conversation": {
      const action = parsed.subcommand;
      if (action === void 0) fatal("Usage: voice conversation <start|pause|resume|end|reset>");
      await cmdConversation(port, action);
      break;
    }
    case "inject": {
      const role = parsed.subcommand;
      if (role === void 0) fatal("Usage: voice inject <user|assistant|system>");
      const source = getString(parsed.flags, "source");
      const triggerResponse = getBoolean(parsed.flags, "trigger-response");
      await cmdInject(port, role, source, triggerResponse);
      break;
    }
    case "cancel-tool": {
      const callId = parsed.subcommand ?? parsed.positional[0];
      if (callId === void 0) fatal("Usage: voice cancel-tool <callId>");
      await cmdCancelTool(port, callId);
      break;
    }
    case "answer": {
      const questionId = parsed.subcommand ?? parsed.positional[0];
      if (questionId === void 0) fatal("Usage: voice answer <questionId>");
      await cmdAnswer(port, questionId);
      break;
    }
    case "watch": {
      const eventTypes = [];
      if (parsed.subcommand !== void 0) eventTypes.push(parsed.subcommand);
      eventTypes.push(...parsed.positional);
      await cmdWatch(port, eventTypes);
      break;
    }
    default: {
      fatal(
        `Unknown command: ${parsed.command || "(none)"}. Available commands: start, stop, status, open, conversation, inject, cancel-tool, answer, watch`
      );
    }
  }
}
main().catch((err) => {
  fatal(err instanceof Error ? err.message : String(err));
});
