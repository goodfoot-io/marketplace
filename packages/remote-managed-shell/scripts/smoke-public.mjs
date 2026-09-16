#!/usr/bin/env node

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const publicBase = process.env.REMOTE_MANAGED_SHELL_PUBLIC_URL ?? process.env.PUBLIC_URL;
const accessToken = process.env.REMOTE_MANAGED_SHELL_PUBLIC_TOKEN ?? process.env.MCP_TOKEN;

async function main() {
  if (!publicBase) {
    console.log("NOT RUN: REMOTE_MANAGED_SHELL_PUBLIC_URL is unset; an operator-managed reachable HTTPS endpoint is required");
    return;
  }
  if (!accessToken) {
    console.log("NOT RUN: REMOTE_MANAGED_SHELL_PUBLIC_TOKEN is unset; provide a short-lived OAuth access token in memory");
    return;
  }
  let base;
  try {
    base = new URL(publicBase);
    if (base.protocol !== "https:") throw new Error("public URL must use HTTPS");
    base.pathname = `${base.pathname.replace(/\/+$/u, "")}/mcp`;
    base.search = "";
    base.hash = "";
  } catch {
    console.error("FAIL: public smoke URL is not an absolute HTTPS URL");
    process.exitCode = 1;
    return;
  }

  const client = new Client({ name: "remote-managed-shell-public-smoke", version: "0.1.0" });
  try {
    const transport = new StreamableHTTPClientTransport(base, { authProvider: { token: async () => accessToken } });
    await client.connect(transport);
    const listed = await client.listTools();
    const expected = ["exec_command", "read_process", "write_stdin", "terminate_process", "list_processes"];
    const names = listed.tools.map((tool) => tool.name);
    if (names.length !== expected.length || expected.some((name) => !names.includes(name))) throw new Error("public endpoint did not return the five-tool surface");
    console.log(`PASS: public endpoint is reachable and authenticated (${names.length} tools)`);
  } catch (error) {
    console.error(`FAIL: public endpoint smoke: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => {});
  }
}

await main();
