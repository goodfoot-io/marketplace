#!/usr/bin/env node
/**
 * rvs — Realtime Voice Server CLI
 */

import { execFileSync, spawn, spawnSync } from "node:child_process";
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

// Names that count as a shell when walking the ancestor chain. Some platforms
// prefix login shells with `-` (e.g. `-bash`); we strip that before matching.
const SHELL_NAMES = new Set([
  "bash",
  "sh",
  "zsh",
  "dash",
  "fish",
  "ksh",
  "tcsh",
  "csh",
]);

function getProcessInfo(pid: number): { ppid: number; name: string } | null {
  try {
    const out = execFileSync("ps", ["-o", "ppid=,comm=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out.length === 0) return null;
    const match = /^\s*(\d+)\s+(.+)$/.exec(out);
    if (match === null) return null;
    return { ppid: parseInt(match[1], 10), name: match[2].trim() };
  } catch {
    return null;
  }
}

/**
 * Walk up the ancestor chain from `startPid`, skipping shell processes,
 * and return the first non-shell ancestor's PID. Under Claude Code's bash
 * tool this resolves to the Claude process itself, giving the daemon a
 * stable lifetime anchor instead of the ephemeral wrapping shell.
 */
function findNonShellAncestor(startPid: number): number {
  let pid = startPid;
  for (let i = 0; i < 20; i++) {
    const info = getProcessInfo(pid);
    if (info === null) return pid;
    const stripped = info.name.replace(/^-/, "");
    const baseName = stripped.split("/").pop() ?? stripped;
    if (!SHELL_NAMES.has(baseName)) return pid;
    if (info.ppid <= 1) return pid;
    pid = info.ppid;
  }
  return pid;
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
    stdio: ["ignore", "pipe", "ignore"],
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

  const anchorPid = findNonShellAncestor(process.ppid);
  await postJson(controlPort(port), "/client/register", { pid: anchorPid });

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
// `rvs context`
// ---------------------------------------------------------------------------

async function cmdContext(port: number): Promise<void> {
  const text = await readStdin();
  const wrapped = `<context>${text}</context>`;
  const res = await postJson(controlPort(port), "/inject/system", { text: wrapped, triggerResponse: true });
  printJson(JSON.parse(res.body));
}

// ---------------------------------------------------------------------------
// `rvs topics`
// ---------------------------------------------------------------------------

async function cmdTopics(port: number): Promise<void> {
  const text = await readStdin();
  const wrapped = `<topics>${text}</topics>`;
  const res = await postJson(controlPort(port), "/inject/system", { text: wrapped, triggerResponse: true });
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
      try {
        const parsed = JSON.parse(line) as {
          seq: number;
          event: string;
          data?: { item?: { role?: string; source?: string; text?: string } };
        };
        if (parsed.seq > maxSeq) maxSeq = parsed.seq;
        const item = parsed.data?.item;
        if (item !== undefined && parsed.event === "transcript.item") {
          process.stdout.write(
            JSON.stringify({ role: item.role, source: item.source, text: item.text }) + "\n",
          );
        } else {
          process.stdout.write(line + "\n");
        }
      } catch (err: unknown) {
        process.stderr.write(`watch parse error: ${String(err)}\n`);
      }
    }
    writeCursor(port, maxSeq);
    cursor = maxSeq;
    return true;
  };

  // Default to common event types when none specified
  if (eventTypes.length === 0) {
    eventTypes = [
      'transcript.item',
      'wait_for_context',
      'conversation.paused',
      'conversation.resumed',
      'conversation.error',
      'browser.audio.error',
    ];
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
// `voice -h` / `voice --help`
// ---------------------------------------------------------------------------

const HELP_TEXT = `voice — Realtime Voice Server CLI

USAGE
  voice <command> [subcommand] [--flags]

CHANNELS
  You are operating across two channels simultaneously:
    Voice  — transcript.item events from the microphone → steer via
             \`voice topics\` or \`voice context\`
    Text   — messages typed in the chat → reply in text as normal

  Do not cross channels. If the user types here, reply here. If the user
  speaks, steer the voice via topics/context — do not reply in text.

MONITOR LOOP
  Once \`voice start\` reports a URL and the browser is open, run:
    voice watch     (background)

  When notified, immediately restart \`voice watch\` in the background
  before doing any other work — this keeps the loop alive so events are
  never missed while work is in flight. Then dispatch on \`event\`.

  Background-first rule: any substantial work — memory lookups, file
  reads, Agent calls, Bash commands — should run in the background and
  fire in parallel with the next \`voice watch\` call.

SUBROUTINES (event dispatch)
  §TRANSCRIPT
    When: event is \`transcript.item\` and \`data.item.source\` is
    \`"microphone"\`. The user just spoke. Restart \`voice watch\` first,
    then think and fire §TOPICS or §CONTEXT to steer the voice's
    response. Ignore items where source is \`"system"\` — those are your
    own prior injections.

  §CONTEXT
    When: you have background knowledge, facts, or state the voice
    should absorb silently — without speaking it aloud.
    Use \`voice context\` — the voice agent will know but will not say.

  §TOPICS
    When: you want to describe what the voice should talk about next —
    subjects to raise, threads to pick up, directions to steer toward.
    Use \`voice topics\` — the voice will fold them in naturally.
    Describe subject matter, not a script.

  §CONV_ERROR
    When: event is \`conversation.error\`. Tell the user the voice
    conversation hit an error. Show the details from \`data\`. Ask if
    they'd like to try again.

  §AUDIO_ERROR
    When: event is \`browser.audio.error\`. Tell the user there's a
    problem with their audio device. Show \`data.error\`. Ask them to
    check microphone permissions in their browser.

COMMANDS

  voice start [--title T] [--model M] [--voice V] < instructions
    Start the daemon and Realtime session. Reads the system instructions
    for the voice persona from stdin. Prints \`{port,url,createdAt}\` as
    JSON. If a daemon is already running on this port, prints its
    current status and exits 0. The daemon is detached and survives
    until clients disconnect (with grace period) or it is stopped.

  voice stop
    Stop the running daemon and Realtime session.

  voice status
    Print the current daemon status as JSON (server, conversation,
    connected clients, etc.).

  voice open
    Open the browser UI to http://localhost:<port>. Equivalent to the
    URL printed by \`voice start\`.

  voice conversation <start|pause|resume|end|reset>
    Drive the conversation lifecycle.
      start   — begin accepting microphone audio
      pause   — pause the active conversation (audio held)
      resume  — resume from pause
      end     — end the conversation (releases the session)
      reset   — clear conversation history and start fresh

  voice inject <user|assistant|system> [--source S] [--trigger-response] < text
    Inject a message into the conversation. Reads the message text from
    stdin. \`--source\` overrides the default source label. For user/
    system roles, \`--trigger-response\` requests a response immediately.
    Prefer the higher-level \`voice context\` / \`voice topics\` for
    steering — \`inject\` is the low-level primitive.

  voice context < text
    System message wrapped in <context>...</context>. The voice absorbs
    this silently as background knowledge — does NOT speak it aloud.
    Use this for facts, state, names, numbers, definitions.

  voice topics < text
    System message wrapped in <topics>...</topics>. Subjects the voice
    should talk about; the voice will weave them into the conversation
    in its own words. Use this to steer what comes next — describe the
    subject matter, not a script.

  voice cancel-tool <callId>
    Cancel an in-flight tool call by its call ID.

  voice watch [event-types...]
    Stream new events from the daemon as JSONL on stdout. Maintains a
    per-port cursor under /tmp/voice-<port>/cursor so each invocation
    returns only events newer than the last call. Exits as soon as at
    least one event is delivered (intended to be re-run in a loop in
    the background). With no event types, defaults to:
      transcript.item, conversation.error, browser.audio.error
    Pass specific event names to filter, e.g.:
      voice watch transcript.item tool.call.failed

GLOBAL FLAGS
  --port <n>     Override the default port (3000). The control server
                 runs on port+1.
  -h, --help     Show this help.

ENVIRONMENT
  OPENAI_API_KEY     API key forwarded to the daemon as RVS_API_KEY.
  RVS_API_KEY        Alternative to OPENAI_API_KEY.
  USE_SESSION_PORT   When set with CLAUDE_CODE_SESSION_ID, the wrapper
                     derives a per-session port instead of using 3000.
  VOICE_LOG_PATH     If set, the CLI and daemon append JSONL diagnostic
                     records (events + errors) to this path.
                     transcript.delta events are excluded.

REFERENCE GUIDES
  When the browser has not connected or audio is not ready
    → @reference/browser-audio.md
  When starting, pausing, resuming, ending, or restarting a conversation
    → @reference/conversation-lifecycle.md
  When the conversation is long, the avatar seems confused, or context
    needs refreshing
    → @reference/context-management.md
  When the avatar says something wrong, goes off-track, or needs
    redirecting
    → @reference/intervention.md
  When the user signals they are done and the session should end
    → @reference/shutdown.md
  When the server fails to start, becomes unresponsive, or crashes
    → @reference/startup-failure.md
`;

function printHelp(): void {
  process.stdout.write(HELP_TEXT);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const parsed = parseArgs(process.argv);
const port = getPort(parsed.flags);

function isHelpRequested(): boolean {
  if (parsed.flags["help"] === true || parsed.flags["h"] === true) return true;
  if (parsed.command === "" || parsed.command === "-h" || parsed.command === "--help") return true;
  if (parsed.subcommand === "-h" || parsed.subcommand === "--help") return true;
  return parsed.positional.includes("-h") || parsed.positional.includes("--help");
}

async function main(): Promise<void> {
  if (isHelpRequested()) {
    printHelp();
    return;
  }
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
    case "context": {
      await cmdContext(port);
      break;
    }
    case "topics": {
      await cmdTopics(port);
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
        `Unknown command: ${parsed.command || "(none)"}. Available commands: start, stop, status, open, conversation, inject, context, topics, cancel-tool, watch`,
      );
    }
  }
}

process.on("uncaughtException", (err: unknown) => {
  process.stderr.write(`uncaughtException: ${String(err)}\n`);
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  process.stderr.write(`unhandledRejection: ${String(reason)}\n`);
  process.exit(1);
});

main().catch((err: unknown) => {
  fatal(err instanceof Error ? err.message : String(err));
});
