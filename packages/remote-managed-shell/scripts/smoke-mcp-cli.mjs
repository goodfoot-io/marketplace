#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { access, constants, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performLoopbackOAuth, startLocalProcess, stopLocalProcess } from "./smoke-local.mjs";
import { spawn } from "node:child_process";

const INSPECTOR_VERSION = "2.6.0";
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const INSPECTOR = process.env.MCP_INSPECTOR ?? process.env.INSPECTOR;

async function runInspector(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [INSPECTOR, ...args], { cwd: PACKAGE_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-512_000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-64_000); });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function inspectorArgs(endpoint, method, token, extra = []) {
  return [
    "--cli",
    "--transport", "http",
    "--server-url", endpoint,
    "--method", method,
    "--connect-timeout", "5000",
    "--format", "json",
    ...(token === undefined ? [] : ["--header", `Authorization: Bearer ${token}`]),
    ...extra,
  ];
}

function parseJson(result) {
  try { return JSON.parse(result.stdout); } catch { throw new Error("Inspector did not return JSON"); }
}

function toolResult(result) {
  const json = parseJson(result);
  if (!json.result || typeof json.result !== "object") throw new Error("Inspector returned no result");
  return json.result.structuredContent ?? json.result;
}

async function main() {
  if (!INSPECTOR) {
    console.log(`NOT RUN: MCP_INSPECTOR is unset; install pinned @modelcontextprotocol/inspector@${INSPECTOR_VERSION} in a throwaway project and set its launcher path`);
    return;
  }
  try {
    await access(INSPECTOR, constants.R_OK);
  } catch {
    console.log(`NOT RUN: MCP_INSPECTOR does not point to a readable Inspector launcher (${INSPECTOR_VERSION})`);
    return;
  }

  let running;
  try {
    running = await startLocalProcess({ command: "dev", port: 38147 });
    const oauth = await performLoopbackOAuth({ endpoint: running.ready.endpoint, authorizationUrl: new URL(`${running.ready.issuer}/authorize`), startupSecret: running.startupSecret, includeRefresh: false });
    const unauthenticated = await runInspector(inspectorArgs(running.ready.endpoint, "initialize", undefined, ["--stored-auth-only"]));
    if (unauthenticated.code !== 3) throw new Error(`unauthenticated Inspector probe exited ${unauthenticated.code ?? "without a code"}; expected 3`);

    const initialized = await runInspector(inspectorArgs(running.ready.endpoint, "initialize", oauth.access_token));
    if (initialized.code !== 0) throw new Error(`authenticated Inspector initialize exited ${initialized.code ?? "without a code"}`);
    const listed = await runInspector(inspectorArgs(running.ready.endpoint, "tools/list", oauth.access_token));
    if (listed.code !== 0) throw new Error(`Inspector tools/list exited ${listed.code ?? "without a code"}`);
    const listedResult = parseJson(listed)?.result;
    const names = listedResult?.tools?.map((tool) => tool.name) ?? [];
    const expected = ["exec_command", "read_process", "write_stdin", "terminate_process", "list_processes"];
    if (names.length !== expected.length || expected.some((name) => !names.includes(name))) throw new Error("Inspector tools/list did not return the five-tool surface");

    const discoveryCall = await runInspector(inspectorArgs(running.ready.endpoint, "tools/call", oauth.access_token, ["--tool-name", "list_processes", "--tool-args-json", JSON.stringify({ include_completed: true, limit: 50 })]));
    if (discoveryCall.code !== 0) throw new Error(`Inspector list_processes exited ${discoveryCall.code ?? "without a code"}`);
    const discovery = toolResult(discoveryCall);
    const operationId = `inspector-${randomBytes(8).toString("hex")}`;
    const execCall = await runInspector(inspectorArgs(running.ready.endpoint, "tools/call", oauth.access_token, ["--tool-name", "exec_command", "--tool-args-json", JSON.stringify({
      expected_server_instance_id: discovery.server_instance_id,
      operation_id: operationId,
      cmd: "printf '%s' smoke-inspector-output",
      login: false,
      tty: false,
      yield_time_ms: 10_000,
      timeout_ms: null,
      max_output_bytes: 16_384,
    })]));
    if (execCall.code !== 0) throw new Error(`Inspector exec_command exited ${execCall.code ?? "without a code"}`);
    const execution = toolResult(execCall);
    if (typeof execution.session_id !== "string") throw new Error("Inspector exec_command omitted session_id");
    const readCall = await runInspector(inspectorArgs(running.ready.endpoint, "tools/call", oauth.access_token, ["--tool-name", "read_process", "--tool-args-json", JSON.stringify({ session_id: execution.session_id, cursor: "start", wait_ms: 2_000, max_output_bytes: 16_384 })]));
    if (readCall.code !== 0) throw new Error(`Inspector read_process exited ${readCall.code ?? "without a code"}`);
    const read = toolResult(readCall);
    if (!(read.output ?? []).some((event) => event.data?.includes("smoke-inspector-output"))) throw new Error("Inspector read_process omitted command output");
    const listCall = await runInspector(inspectorArgs(running.ready.endpoint, "tools/call", oauth.access_token, ["--tool-name", "list_processes", "--tool-args-json", JSON.stringify({ operation_id: operationId, include_completed: true, limit: 50 })]));
    if (listCall.code !== 0) throw new Error(`Inspector list_processes recovery exited ${listCall.code ?? "without a code"}`);
    const listing = toolResult(listCall);
    if (!(listing.processes ?? []).some((process) => process.session_id === execution.session_id)) throw new Error("Inspector list_processes did not recover the execution");
    console.log(`PASS: Inspector ${INSPECTOR_VERSION} OAuth boundary and five-tool CLI smoke`);
  } catch (error) {
    console.error(`FAIL: MCP Inspector smoke: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  } finally {
    if (running) await stopLocalProcess(running.child).catch(() => {});
    if (running) await rm(running.readyFile, { force: true }).catch(() => {});
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
