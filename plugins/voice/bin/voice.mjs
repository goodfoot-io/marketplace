#!/usr/bin/env node
import { createRequire as __banner_createRequire } from 'node:module';import { fileURLToPath as __banner_fileURLToPath } from 'node:url';import { dirname as __banner_dirname } from 'node:path';const require = __banner_createRequire(import.meta.url);const __filename = __banner_fileURLToPath(import.meta.url);const __dirname = __banner_dirname(__filename);

// src/cli/index.ts
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync as readFileSync2, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
function getPort(flags) {
  const p = flags.port;
  if (typeof p === "string") {
    const n = parseInt(p, 10);
    if (!Number.isNaN(n)) return n;
  }
  return 3e3;
}
function getString(flags, key) {
  const v = flags[key];
  if (typeof v === "string") return v;
  return void 0;
}
function getBoolean(flags, key) {
  return flags[key] === true || flags[key] === "true";
}
function readStdinSync() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return null;
  }
}
async function readStdinStream() {
  return new Promise((resolve2, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve2(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}
async function readStdin() {
  const sync = readStdinSync();
  if (sync !== null) return sync.trim();
  return (await readStdinStream()).trim();
}
async function readStdinRaw() {
  const sync = readStdinSync();
  if (sync !== null) return sync;
  return readStdinStream();
}

// src/cli/control-client.ts
import http from "node:http";
function request(options, body) {
  return new Promise((resolve2, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve2({
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
  process.stdout.write(`${JSON.stringify(data)}
`);
}
function fatal(message, code) {
  process.stderr.write(`${JSON.stringify({ error: message, ...code !== void 0 ? { code } : {} })}
`);
  process.exit(1);
}
function controlPort(port2) {
  return port2 + 1;
}
var SHELL_NAMES = /* @__PURE__ */ new Set(["bash", "sh", "zsh", "dash", "fish", "ksh", "tcsh", "csh"]);
function getProcessInfo(pid) {
  try {
    const out = execFileSync("ps", ["-o", "ppid=,comm=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    if (out.length === 0) return null;
    const match = /^\s*(\d+)\s+(.+)$/.exec(out);
    if (match === null) return null;
    return { ppid: parseInt(match[1], 10), name: match[2].trim() };
  } catch {
    return null;
  }
}
function findNonShellAncestor(startPid) {
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
    return Number.isNaN(n) ? 0 : n;
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
    VOICE_PORT: String(port2),
    VOICE_API_KEY: process.env.XAI_API_KEY ?? process.env.VOICE_API_KEY ?? "",
    VOICE_INSTRUCTIONS: instructions,
    ...title !== void 0 ? { VOICE_TITLE: title } : {},
    ...model !== void 0 ? { VOICE_MODEL: model } : {},
    ...voice !== void 0 ? { VOICE_VOICE: voice } : {}
  };
  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: ["ignore", "pipe", "ignore"],
    env
  });
  const startupJson = await new Promise((resolve2, reject) => {
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
        resolve2(buf.slice(0, nl).trim());
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
  const anchorPid = findNonShellAncestor(process.ppid);
  await postJson(controlPort(port2), "/client/register", { pid: anchorPid });
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
  if (source !== void 0) body.source = source;
  if (role !== "assistant" && triggerResponse) body.triggerResponse = true;
  const res = await postJson(controlPort(port2), `/inject/${role}`, body);
  printJson(JSON.parse(res.body));
}
async function cmdContext(port2) {
  const text = await readStdin();
  const res = await postJson(controlPort(port2), "/instructions/segment", {
    kind: "context",
    text,
    triggerResponse: true
  });
  printJson(JSON.parse(res.body));
}
async function cmdTopics(port2) {
  const text = await readStdin();
  const res = await postJson(controlPort(port2), "/instructions/segment", {
    kind: "topics",
    text,
    triggerResponse: true
  });
  printJson(JSON.parse(res.body));
}
async function cmdHtml(port2) {
  const pathArg = parsed.subcommand ?? parsed.positional[0];
  let body;
  if (pathArg !== void 0) {
    body = { path: resolve(process.cwd(), pathArg) };
  } else if (process.stdin.isTTY) {
    body = { clear: true };
  } else {
    const raw = await readStdinRaw();
    if (raw.trim().length === 0) {
      body = { clear: true };
    } else {
      body = { html: raw };
    }
  }
  const res = await postJson(controlPort(port2), "/html/set", body);
  const parsed2 = JSON.parse(res.body);
  if (!parsed2.ok) {
    process.stderr.write(
      `${JSON.stringify({ error: parsed2.error?.message ?? "unknown error", code: parsed2.error?.code })}
`
    );
    process.exit(1);
  }
  printJson(parsed2);
}
async function cmdCancelTool(port2, callId) {
  const res = await postJson(controlPort(port2), "/tool/cancel", { callId });
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
      try {
        const parsed2 = JSON.parse(line);
        if (parsed2.seq > maxSeq) maxSeq = parsed2.seq;
        const item = parsed2.data?.item;
        if (item !== void 0 && parsed2.event === "transcript.item") {
          process.stdout.write(`${JSON.stringify({ role: item.role, source: item.source, text: item.text })}
`);
        } else {
          process.stdout.write(`${line}
`);
        }
      } catch (err) {
        process.stderr.write(`watch parse error: ${String(err)}
`);
      }
    }
    writeCursor(port2, maxSeq);
    cursor = maxSeq;
    return true;
  };
  if (eventTypes.length === 0) {
    eventTypes = [
      "transcript.item",
      "wait_for_context",
      "conversation.paused",
      "conversation.resumed",
      "conversation.error",
      "browser.audio.error"
    ];
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
var HELP_TEXT = `voice \u2014 Voice Agent CLI

USAGE
  voice <command> [subcommand] [--flags]

CHANNELS
  You are operating across two channels simultaneously:
    Voice  \u2014 transcript.item events from the microphone \u2192 steer via
             \`voice topics\` or \`voice context\`
    Text   \u2014 messages typed in the chat \u2192 reply in text as normal

  Do not cross channels. If the user types here, reply here. If the user
  speaks, steer the voice via topics/context \u2014 do not reply in text.

MONITOR LOOP
  Once \`voice start\` reports a URL and the browser is open, run:
    voice watch     (background)

  When notified, immediately restart \`voice watch\` in the background
  before doing any other work \u2014 this keeps the loop alive so events are
  never missed while work is in flight. Then dispatch on \`event\`.

  Background-first rule: any substantial work \u2014 memory lookups, file
  reads, Agent calls, Bash commands \u2014 should run in the background and
  fire in parallel with the next \`voice watch\` call.

SUBROUTINES (event dispatch)
  \xA7TRANSCRIPT
    When: event is \`transcript.item\` and \`data.item.source\` is
    \`"microphone"\`. The user just spoke. Restart \`voice watch\` first,
    then think and fire \xA7TOPICS or \xA7CONTEXT to steer the voice's
    response. Ignore items where source is \`"system"\` \u2014 those are your
    own prior injections.

  \xA7CONTEXT
    When: you have background knowledge, facts, or state the voice
    should absorb silently \u2014 without speaking it aloud.
    Use \`voice context\` \u2014 updates the agent's live instructions with a
    <context>...</context> block (latest wins, replaces any prior block).
    The voice agent will know but will not say.

  \xA7TOPICS
    When: you want to describe what the voice should talk about next \u2014
    subjects to raise, threads to pick up, directions to steer toward.
    Use \`voice topics\` \u2014 updates the agent's live instructions with a
    <topics>...</topics> block (latest wins). The voice will fold them
    in naturally. Describe subject matter, not a script.

  \xA7CONV_ERROR
    When: event is \`conversation.error\`. Tell the user the voice
    conversation hit an error. Show the details from \`data\`. Ask if
    they'd like to try again.

  \xA7AUDIO_ERROR
    When: event is \`browser.audio.error\`. Tell the user there's a
    problem with their audio device. Show \`data.error\`. Ask them to
    check microphone permissions in their browser.

COMMANDS

  voice start [--title T] [--model M] [--voice V] < instructions
    Start the daemon and Voice Agent session. Reads the system instructions
    for the voice persona from stdin. Prints \`{port,url,createdAt}\` as
    JSON. If a daemon is already running on this port, prints its
    current status and exits 0. The daemon is detached and survives
    until clients disconnect (with grace period) or it is stopped.

  voice stop
    Stop the running daemon and Voice Agent session.

  voice status
    Print the current daemon status as JSON (server, conversation,
    connected clients, etc.).

  voice open
    Open the browser UI to http://localhost:<port>. Equivalent to the
    URL printed by \`voice start\`.

  voice conversation <start|pause|resume|end|reset>
    Drive the conversation lifecycle.
      start   \u2014 begin accepting microphone audio
      pause   \u2014 pause the active conversation (audio held)
      resume  \u2014 resume from pause
      end     \u2014 end the conversation (releases the session)
      reset   \u2014 clear conversation history and start fresh

  voice inject <user|assistant|system> [--source S] [--trigger-response] < text
    Inject a message into the conversation. Reads the message text from
    stdin. \`--source\` overrides the default source label. For user/
    system roles, \`--trigger-response\` requests a response immediately.
    Prefer the higher-level \`voice context\` / \`voice topics\` for
    steering \u2014 \`inject\` is the low-level primitive.

  voice context < text
    Updates the agent's live instructions with a <context>...</context>
    block (latest invocation replaces any prior block). The voice
    absorbs this silently as background knowledge \u2014 does NOT speak it
    aloud. The avatar will respond to the refresh. Use this for facts,
    state, names, numbers, definitions.

  voice topics < text
    Updates the agent's live instructions with a <topics>...</topics>
    block (latest invocation replaces any prior block). Subjects the
    voice should talk about; the voice will weave them into the
    conversation in its own words. Use this to steer what comes next \u2014
    describe the subject matter, not a script.

  voice html [path]
    Render an HTML document full-viewport behind the voice UI (the voice
    overlays remain above it and stay interactive).
      path given        \u2014 serve the file at that path verbatim; the daemon
                          watches the file and live-reloads on every save.
      piped non-empty   \u2014 \`cat page.html | voice html\` \u2014 sets the stage to
                          the piped document (verbatim, untrimmed).
      piped empty       \u2014 empty or whitespace-only stdin (e.g. /dev/null or
                          closed pipe) \u2014 clears the stage and unmounts the
                          iframe.
      interactive bare  \u2014 \`voice html\` at a terminal with no path arg \u2014
                          clears the stage immediately without reading stdin
                          (no Ctrl-D required).
    Path wins when both a path argument and piped stdin are present.
    IMPORTANT: only absolute URLs or CDN URLs work inside the iframe \u2014
    the daemon serves no asset server, so relative-path <script>/<link>
    references will 404. Use inline styles or CDN links (e.g. Tailwind v4
    + DaisyUI v5 CDN). The iframe is same-origin and unsandboxed.

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
  XAI_API_KEY        xAI API key forwarded to the daemon.
  VOICE_API_KEY      Alternative to XAI_API_KEY.
  USE_SESSION_PORT   When set with CLAUDE_CODE_SESSION_ID, the wrapper
                     derives a per-session port instead of using 3000.
  VOICE_LOG_PATH     If set, the CLI and daemon append JSONL diagnostic
                     records (events + errors) to this path.
                     transcript.delta events are excluded.

REFERENCE GUIDES
  When the browser has not connected or audio is not ready
    \u2192 @reference/browser-audio.md
  When starting, pausing, resuming, ending, or restarting a conversation
    \u2192 @reference/conversation-lifecycle.md
  When the conversation is long, the avatar seems confused, or context
    needs refreshing
    \u2192 @reference/context-management.md
  When the avatar says something wrong, goes off-track, or needs
    redirecting
    \u2192 @reference/intervention.md
  When the user signals they are done and the session should end
    \u2192 @reference/shutdown.md
  When the server fails to start, becomes unresponsive, or crashes
    \u2192 @reference/startup-failure.md
  When rendering HTML full-viewport behind the voice UI
    \u2192 @reference/html-stage.md
`;
function printHelp() {
  process.stdout.write(HELP_TEXT);
}
var parsed = parseArgs(process.argv);
var port = getPort(parsed.flags);
function isHelpRequested() {
  if (parsed.flags.help === true || parsed.flags.h === true) return true;
  if (parsed.command === "" || parsed.command === "-h" || parsed.command === "--help") return true;
  if (parsed.subcommand === "-h" || parsed.subcommand === "--help") return true;
  return parsed.positional.includes("-h") || parsed.positional.includes("--help");
}
async function main() {
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
    case "context": {
      await cmdContext(port);
      break;
    }
    case "topics": {
      await cmdTopics(port);
      break;
    }
    case "html": {
      await cmdHtml(port);
      break;
    }
    case "cancel-tool": {
      const callId = parsed.subcommand ?? parsed.positional[0];
      if (callId === void 0) fatal("Usage: voice cancel-tool <callId>");
      await cmdCancelTool(port, callId);
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
        `Unknown command: ${parsed.command || "(none)"}. Available commands: start, stop, status, open, conversation, inject, context, topics, html, cancel-tool, watch`
      );
    }
  }
}
process.on("uncaughtException", (err) => {
  process.stderr.write(`uncaughtException: ${String(err)}
`);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`unhandledRejection: ${String(reason)}
`);
  process.exit(1);
});
main().catch((err) => {
  fatal(err instanceof Error ? err.message : String(err));
});
