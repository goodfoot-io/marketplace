import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ReadyFile, type RunningServer, startServer } from "../src/serve.js";
import { TOOL_NAMES } from "../src/server.js";

describe("authenticated server over real HTTP", () => {
  let server: RunningServer;
  let directory: string;
  let metadataServer: ReturnType<typeof createHttpServer>;
  let clientId: string;
  let redirectUri: string;

  beforeAll(async () => {
    metadataServer = createHttpServer((request, response) => {
      if (request.url !== "/client.json") {
        response.writeHead(404).end();
        return;
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ client_id: clientId, redirect_uris: [redirectUri] }));
    });
    await new Promise<void>((resolve) => metadataServer.listen(0, "127.0.0.1", resolve));
    const address = metadataServer.address();
    if (address === null || typeof address === "string") throw new Error("metadata server did not bind");
    clientId = `http://127.0.0.1:${address.port}/client.json`;
    redirectUri = `http://127.0.0.1:${address.port}/callback`;
    directory = await mkdtemp(join(tmpdir(), "remote-managed-shell-http-"));
    server = await startServer({ mode: "local", port: 0, readyFile: join(directory, "ready.json") });
  });

  afterAll(async () => {
    await server?.close();
    await new Promise<void>((resolve, reject) => metadataServer?.close((error) => (error ? reject(error) : resolve())));
    await rm(directory, { recursive: true, force: true });
  });

  it("publishes a secret-free live readiness record and health facts", async () => {
    const text = await readFile(server.readyFile, "utf8");
    const ready = JSON.parse(text) as ReadyFile;
    expect(ready.serverInstanceId).toBe(server.serverInstanceId);
    expect(ready.stage).toBe("ready");
    expect(ready.port).toBe(server.port);
    expect(ready.capabilities.tools).toBe(5);
    expect(text).not.toContain(server.startupSecret);
    const health = await fetch(new URL("/healthz", server.endpoint));
    expect(health.status).toBe(200);
    expect(JSON.stringify(await health.json())).not.toContain(server.startupSecret);
  });

  it("challenges an anonymous MCP request with protected-resource discovery", async () => {
    const response = await initialize(server);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
  });

  it("serves mutually consistent discovery documents over HTTP", async () => {
    const authorization = await fetch(new URL("/.well-known/oauth-authorization-server", server.authorizationUrl));
    const protectedResource = await fetch(
      new URL("/.well-known/oauth-protected-resource/mcp", server.authorizationUrl),
    );
    expect(authorization.status).toBe(200);
    expect(protectedResource.status).toBe(200);
    const authorizationDocument = (await authorization.json()) as Record<string, unknown>;
    const resourceDocument = (await protectedResource.json()) as Record<string, unknown>;
    expect(authorizationDocument).toMatchObject({
      issuer: server.authorizationUrl.origin,
      code_challenge_methods_supported: ["S256"],
      client_id_metadata_document_supported: true,
    });
    expect(authorizationDocument).not.toHaveProperty("registration_endpoint");
    expect(resourceDocument.resource).toBe(server.endpoint.href);
    expect(resourceDocument.authorization_servers).toEqual([server.authorizationUrl.origin]);
  });

  it("challenges an unknown bearer and bounds request bodies", async () => {
    const unknown = await initialize(server, "unknown-instance-token");
    expect(unknown.status).toBe(401);
    expect(unknown.headers.get("www-authenticate")).toContain("invalid_token");

    const oversized = await fetch(server.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(524_289),
    });
    expect(oversized.status).toBe(413);
  });

  it("runs the exact five-tool surface through OAuth and the SDK client", async () => {
    const accessToken = await obtainToken();
    const client = new Client({ name: "integration", version: "0.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(server.endpoint, {
        requestInit: { headers: { authorization: `Bearer ${accessToken}` } },
      }),
    );
    try {
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
      for (const tool of listed.tools)
        expect(tool._meta?.securitySchemes).toEqual([{ type: "oauth2", scopes: ["mcp"] }]);

      const discovery = await client.callTool({ name: "list_processes", arguments: {} });
      const listing = discovery.structuredContent as Record<string, unknown>;
      expect(listing.server_instance_id).toBe(server.serverInstanceId);
      const started = await client.callTool({
        name: "exec_command",
        arguments: {
          expected_server_instance_id: server.serverInstanceId,
          operation_id: "http-integration-1",
          cmd: "printf 'out'; printf 'err' >&2; exit 7",
          yield_time_ms: 2_000,
        },
      });
      const process = started.structuredContent as Record<string, unknown>;
      expect(process.session_id).toEqual(expect.any(String));
      expect(process.exit_code).toBe(7);
      expect(
        (process.output as Array<{ stream: string; data: string }>).map((event) => [event.stream, event.data]),
      ).toEqual(
        expect.arrayContaining([
          ["stdout", "out"],
          ["stderr", "err"],
        ]),
      );
      const recovered = await client.callTool({
        name: "list_processes",
        arguments: { operation_id: "http-integration-1" },
      });
      expect((recovered.structuredContent as { operation: { session_id: string } }).operation.session_id).toBe(
        process.session_id,
      );
    } finally {
      await client.close();
    }
  });

  it("preserves a replacement readiness claim when the older instance closes", async () => {
    const readyFile = join(directory, "replacement-ready.json");
    const first = await startServer({ mode: "local", port: 0, readyFile });
    const second = await startServer({ mode: "local", port: 0, readyFile });
    try {
      await first.close();
      const ready = JSON.parse(await readFile(readyFile, "utf8")) as ReadyFile;
      expect(ready.serverInstanceId).toBe(second.serverInstanceId);
      expect(ready.pid).toBe(process.pid);
    } finally {
      await first.close();
      await second.close();
    }
  });

  it("invalidates a prior instance token with a fresh OAuth challenge after restart", async () => {
    const readyFile = join(directory, "restart-ready.json");
    const first = await startServer({ mode: "local", port: 0, readyFile });
    let second: RunningServer | undefined;
    try {
      const oldToken = await obtainToken(first);
      await first.close();
      second = await startServer({ mode: "local", port: 0, readyFile });
      const response = await initialize(second, oldToken);
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
    } finally {
      await first.close();
      await second?.close();
    }
  });

  async function obtainToken(target: RunningServer = server): Promise<string> {
    const verifier = "integration-verifier-that-is-long-enough-0123456789";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorize = new URL(target.authorizationUrl);
    authorize.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: target.endpoint.href,
      scope: "mcp offline_access",
    }).toString();
    const page = await fetch(authorize);
    expect(page.status).toBe(200);
    const requestId = (await page.text()).match(/name="request_id" value="([^"]+)"/)?.[1];
    if (!requestId) throw new Error("authorization form did not carry request identity");
    const consent = await fetch(target.authorizationUrl, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ request_id: requestId, secret: target.startupSecret }),
    });
    expect(consent.status).toBe(302);
    const location = consent.headers.get("location");
    if (!location) throw new Error("authorization response had no redirect");
    const code = new URL(location).searchParams.get("code");
    if (!code) throw new Error("authorization response had no code");
    const token = await fetch(new URL("/token", target.authorizationUrl), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        resource: target.endpoint.href,
      }),
    });
    expect(token.status).toBe(200);
    const body = (await token.json()) as { access_token?: string };
    if (!body.access_token) throw new Error("token response had no access token");
    return body.access_token;
  }

  function initialize(target: RunningServer, bearer?: string): Promise<Response> {
    return fetch(target.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(bearer === undefined ? {} : { authorization: `Bearer ${bearer}` }),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "probe", version: "0" } },
      }),
    });
  }
});
