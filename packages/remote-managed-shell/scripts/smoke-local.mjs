#!/usr/bin/env node
/**
 * Starts the built server on loopback and drives the real five-tool surface
 * through the MCP SDK client. The server authenticates nobody, so the smoke
 * needs no credential: it asserts the endpoint the server itself serves, and
 * nothing else.
 */

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EXPECTED_TOOLS = ["exec_command", "read_process", "write_stdin", "terminate_process", "list_processes"];
const READY_TIMEOUT_MS = 15_000;

export async function startLocalProcess({ command = "built", port = 0, readyFile } = {}) {
  const generatedReadyFile = readyFile ?? join(await mkdtemp(join(tmpdir(), "remote-managed-shell-smoke-")), "ready.json");
  const args = [`--port=${port}`, `--ready-file=${generatedReadyFile}`];
  const child = command === "dev"
    ? spawn("yarn", ["run", "dev", ...args], { cwd: PACKAGE_ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"] })
    : spawn(process.execPath, [join(PACKAGE_ROOT, "build/dist/src/main.js"), ...args], { cwd: PACKAGE_ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.resume();
  child.stderr.resume();

  try {
    const ready = await waitForReady(generatedReadyFile, child, READY_TIMEOUT_MS);
    if (ready.pid <= 0 || ready.stage !== "ready" || !ready.endpoint.endsWith("/mcp")) {
      throw new Error("local server readiness record is invalid");
    }
    return { child, ready, readyFile: generatedReadyFile };
  } catch (error) {
    await stopLocalProcess(child);
    await rm(generatedReadyFile, { force: true }).catch(() => {});
    throw error;
  }
}

export async function stopLocalProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try { process.kill(-child.pid, "SIGTERM"); } catch (error) { if (error?.code !== "ESRCH") throw error; }
  const exited = await waitForChildExit(child, 5_000);
  if (!exited) {
    try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error?.code !== "ESRCH") throw error; }
    await waitForChildExit(child, 2_000);
  }
}

export async function runSdkSmoke(endpoint) {
  const client = new Client({ name: "remote-managed-shell-smoke", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint));
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    if (names.length !== EXPECTED_TOOLS.length || EXPECTED_TOOLS.some((name) => !names.includes(name))) throw new Error("tools/list did not return the five-tool surface");
    const discovery = await client.callTool({ name: "list_processes", arguments: { include_completed: true, limit: 50 } });
    const discoveryResult = structured(discovery);
    if (discoveryResult.result_kind !== "listing" || typeof discoveryResult.server_instance_id !== "string") throw new Error("list_processes discovery result was invalid");
    const operationId = `smoke-${randomBytes(8).toString("hex")}`;
    const execution = await client.callTool({ name: "exec_command", arguments: {
      expected_server_instance_id: discoveryResult.server_instance_id,
      operation_id: operationId,
      cmd: "printf '%s' smoke-local-output",
      login: false,
      tty: false,
      yield_time_ms: 10_000,
      timeout_ms: null,
      max_output_bytes: 16_384,
    } });
    const executionResult = structured(execution);
    if (executionResult.result_kind !== "process" || typeof executionResult.session_id !== "string") throw new Error("exec_command did not return an accepted process");
    const read = await client.callTool({ name: "read_process", arguments: { session_id: executionResult.session_id, cursor: "start", wait_ms: 2_000, max_output_bytes: 16_384 } });
    const readResult = structured(read);
    const output = readResult.output?.map((event) => event.data).join("") ?? "";
    if (readResult.result_kind !== "process" || !output.includes("smoke-local-output")) throw new Error("read_process did not return command output");
    const listing = await client.callTool({ name: "list_processes", arguments: { operation_id: operationId, include_completed: true, limit: 50 } });
    const listingResult = structured(listing);
    if (listingResult.result_kind !== "listing" || !listingResult.processes?.some((process) => process.session_id === executionResult.session_id)) throw new Error("list_processes did not recover the execution");
    return { tools: names, operationId, sessionId: executionResult.session_id, status: readResult.status };
  } finally {
    await client.close().catch(() => {});
  }
}

function structured(result) {
  if (result?.isError) throw new Error("MCP tool call returned an error");
  const value = result?.structuredContent;
  if (!value || typeof value !== "object") throw new Error("MCP tool call omitted structured content");
  return value;
}

async function waitForReady(path, child, timeout) {
  return waitFor(async () => {
    try {
      const parsed = JSON.parse(await readFile(path, "utf8"));
      if (parsed.stage === "ready" && typeof parsed.pid === "number" && typeof parsed.endpoint === "string") {
        process.kill(parsed.pid, 0);
        return parsed;
      }
    } catch {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error("local server exited before readiness");
    }
    return undefined;
  }, child, timeout);
}

async function waitFor(check, child, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("local server exited before smoke setup completed");
    const result = await check();
    if (result !== undefined && result !== false) return result;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timed out waiting for local server readiness");
}

function waitForChildExit(child, timeout) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout);
    child.once("close", () => { clearTimeout(timer); resolve(true); });
  });
}

async function main() {
  let running;
  try {
    running = await startLocalProcess();
    const result = await runSdkSmoke(running.ready.endpoint);
    console.log(`PASS: local MCP smoke against ${running.ready.endpoint} (${result.tools.length} tools, ${result.status})`);
  } catch (error) {
    console.error(`FAIL: local smoke: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  } finally {
    if (running) await stopLocalProcess(running.child).catch(() => {});
    if (running) await rm(running.readyFile, { force: true }).catch(() => {});
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
