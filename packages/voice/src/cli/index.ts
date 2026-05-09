#!/usr/bin/env node
/**
 * rvs — Realtime Voice Server CLI
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getBoolean, getPort, getString, parseArgs, readStdin } from "./args.js";
import { getStatus, postEmpty, postJson, watchOnce } from "./control-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data) + "\n");
}

function fatal(message: string, code?: string): never {
  process.stderr.write(JSON.stringify({ error: message, ...(code !== undefined ? { code } : {}) }) + "\n");
  process.exit(1);
}

function controlPort(port: number): number {
  return port + 1;
}

function tmpDir(port: number): string {
  return `/tmp/voice-${port}`;
}

function cursorFile(port: number): string {
  return `${tmpDir(port)}/cursor`;
}

function readCursor(port: number): number {
  try {
    const raw = readFileSync(cursorFile(port), "utf8").trim();
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

function writeCursor(port: number, cursor: number): void {
  mkdirSync(tmpDir(port), { recursive: true });
  writeFileSync(cursorFile(port), String(cursor), "utf8");
}

// ---------------------------------------------------------------------------
// `rvs start`
// ---------------------------------------------------------------------------

async function cmdStart(
  port: number,
  title: string | undefined,
  model: string | undefined,
  voice: string | undefined,
): Promise<void> {
  const instructions = await readStdin();

  // Check if daemon already running
  try {
    const res = await getStatus(controlPort(port));
    if (res.statusCode === 200) {
      printJson(JSON.parse(res.body));
      process.exit(0);
    }
  } catch (_err: unknown) {
    void _err; // daemon not running, continue
  }

  // Resolve daemon entry point path (dist/cli/daemon.js relative to this file)
  const thisFile = fileURLToPath(import.meta.url);
  const daemonPath = join(dirname(thisFile), "daemon.mjs");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RVS_PORT: String(port),
    RVS_API_KEY: process.env["OPENAI_API_KEY"] ?? process.env["RVS_API_KEY"] ?? "",
    RVS_INSTRUCTIONS: instructions,
    ...(title !== undefined ? { RVS_TITLE: title } : {}),
    ...(model !== undefined ? { RVS_MODEL: model } : {}),
    ...(voice !== undefined ? { RVS_VOICE: voice } : {}),
  };

  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: ["ignore", "pipe", "inherit"],
    env,
  });

  // Wait for the startup JSON line from the daemon's stdout
  const startupJson = await new Promise<string>((resolve, reject) => {
    let buf = "";
    const stdout = child.stdout;
    if (stdout === null) {
      reject(new Error("daemon stdout is null"));
      return;
    }
    stdout.setEncoding("utf8");
    stdout.on("data", (chunk: string) => {
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

  let startupData: { port: number; url: string; createdAt: string };
  try {
    startupData = JSON.parse(startupJson) as { port: number; url: string; createdAt: string };
  } catch {
    fatal(`daemon sent invalid startup JSON: ${startupJson}`);
  }

  await postJson(controlPort(port), "/client/register", { pid: process.ppid });

  printJson(startupData);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// `rvs stop`
// ---------------------------------------------------------------------------

async function cmdStop(port: number): Promise<void> {
  const res = await postEmpty(controlPort(port), "/server/stop");
  printJson(JSON.parse(res.body));
}

// ---------------------------------------------------------------------------
// `rvs status`
// ---------------------------------------------------------------------------

async function cmdStatus(port: number): Promise<void> {
  const res = await getStatus(controlPort(port));
  printJson(JSON.parse(res.body));
}

// ---------------------------------------------------------------------------
// `rvs open`
// ---------------------------------------------------------------------------

async function cmdOpen(port: number): Promise<void> {
  const url = `http://localhost:${port}`;
  const platform = process.platform;
  const opener = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  spawnSync(opener, [url], { shell: platform === "win32" });
  printJson({ url });
}

// ---------------------------------------------------------------------------
// `rvs conversation <action>`
// ---------------------------------------------------------------------------

async function cmdConversation(port: number, action: string): Promise<void> {
  const allowed = ["start", "pause", "resume", "end", "reset"];
  if (!allowed.includes(action)) {
    fatal(`Unknown conversation action: ${action}. Must be one of: ${allowed.join(", ")}`);
  }
  const res = await postEmpty(controlPort(port), `/conversation/${action}`);
  printJson(JSON.parse(res.body));
}

// ---------------------------------------------------------------------------
// `rvs inject <role>`
// ---------------------------------------------------------------------------

async function cmdInject(
  port: number,
  role: string,
  source: string | undefined,
  triggerResponse: boolean,
): Promise<void> {
  const allowed = ["user", "assistant", "system"];
  if (!allowed.includes(role)) {
    fatal(`Unknown inject role: ${role}. Must be one of: ${allowed.join(", ")}`);
  }
  const text = await readStdin();
  const body: Record<string, unknown> = { text };
  if (source !== undefined) body["source"] = source;
  if (role !== "assistant" && triggerResponse) body["triggerResponse"] = true;
  const res = await postJson(controlPort(port), `/inject/${role}`, body);
  printJson(JSON.parse(res.body));
}

// ---------------------------------------------------------------------------
// `rvs say`
// ---------------------------------------------------------------------------

async function cmdSay(port: number): Promise<void> {
  const text = await readStdin();
  const wrapped = `<say>${text}</say>`;
  const res = await postJson(controlPort(port), "/inject/system", { text: wrapped });
  printJson(JSON.parse(res.body));
}

// ---------------------------------------------------------------------------
// `rvs context`
// ---------------------------------------------------------------------------

async function cmdContext(port: number): Promise<void> {
  const text = await readStdin();
  const wrapped = `<context>${text}</context>`;
  const res = await postJson(controlPort(port), "/inject/system", { text: wrapped });
  printJson(JSON.parse(res.body));
}

// ---------------------------------------------------------------------------
// `rvs cancel-tool <callId>`
// ---------------------------------------------------------------------------

async function cmdCancelTool(port: number, callId: string): Promise<void> {
  const res = await postJson(controlPort(port), "/tool/cancel", { callId });
  printJson(JSON.parse(res.body));
}

// ---------------------------------------------------------------------------
// `rvs watch [event-types...]`
// ---------------------------------------------------------------------------

async function cmdWatch(port: number, eventTypes: string[]): Promise<void> {
  let cursor = readCursor(port);

  const pollOnce = async (): Promise<boolean> => {
    const res = await watchOnce(controlPort(port), eventTypes, cursor);
    const body = res.body.trim();
    if (body.length === 0) return false;

    const lines = body.split("\n").filter(Boolean);
    let maxSeq = cursor;
    for (const line of lines) {
      process.stdout.write(line + "\n");
      try {
        const parsed = JSON.parse(line) as { seq: number };
        if (parsed.seq > maxSeq) maxSeq = parsed.seq;
      } catch (_err: unknown) {
        void _err; // skip malformed JSONL lines
      }
    }
    writeCursor(port, maxSeq);
    cursor = maxSeq;
    return true;
  };

  // Default to common event types when none specified
  if (eventTypes.length === 0) {
    eventTypes = ['transcript.item', 'conversation.error', 'browser.audio.error'];
  }

  // First attempt
  const got = await pollOnce();
  if (got) {
    process.exit(0);
  }

  // Poll every 200ms
  let exiting = false;
  process.on("SIGINT", () => {
    exiting = true;
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    exiting = true;
    process.exit(0);
  });

  const poll = async (): Promise<void> => {
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const parsed = parseArgs(process.argv);
const port = getPort(parsed.flags);

async function main(): Promise<void> {
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
      if (action === undefined) fatal("Usage: voice conversation <start|pause|resume|end|reset>");
      await cmdConversation(port, action);
      break;
    }
    case "inject": {
      const role = parsed.subcommand;
      if (role === undefined) fatal("Usage: voice inject <user|assistant|system>");
      const source = getString(parsed.flags, "source");
      const triggerResponse = getBoolean(parsed.flags, "trigger-response");
      await cmdInject(port, role, source, triggerResponse);
      break;
    }
    case "say": {
      await cmdSay(port);
      break;
    }
    case "context": {
      await cmdContext(port);
      break;
    }
    case "cancel-tool": {
      const callId = parsed.subcommand ?? parsed.positional[0];
      if (callId === undefined) fatal("Usage: voice cancel-tool <callId>");
      await cmdCancelTool(port, callId);
      break;
    }
    case "watch": {
      // Event types come from subcommand + remaining positional args
      const eventTypes: string[] = [];
      if (parsed.subcommand !== undefined) eventTypes.push(parsed.subcommand);
      eventTypes.push(...parsed.positional);
      await cmdWatch(port, eventTypes);
      break;
    }
    default: {
      fatal(
        `Unknown command: ${parsed.command || "(none)"}. Available commands: start, stop, status, open, conversation, inject, say, context, cancel-tool, watch`,
      );
    }
  }
}

main().catch((err: unknown) => {
  fatal(err instanceof Error ? err.message : String(err));
});
