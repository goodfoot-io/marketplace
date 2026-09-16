import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/index.js";

const clientId = "http://127.0.0.1:43123/client.json";
const redirectUri = "http://127.0.0.1:43123/callback";

function makeAuth(now = Date.now()) {
  return new AuthService({
    mode: "local",
    baseUrl: "http://127.0.0.1:38147",
    now: () => now,
    resolve: async () => ["127.0.0.1"],
    fetch: async () =>
      new Response(JSON.stringify({ client_id: clientId, redirect_uris: [redirectUri] }), {
        headers: { "content-type": "application/json" },
      }),
  });
}

function challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function authorizationRequest(service: AuthService, verifier = "test-verifier") {
  const url = new URL(service.authorizationUrl);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: challenge(verifier),
    code_challenge_method: "S256",
    resource: service.resource,
    scope: "mcp offline_access",
    state: "state-1",
  }).toString();
  return { url, verifier };
}

async function completeAuthorization(service: AuthService, verifier = "test-verifier") {
  const request = authorizationRequest(service, verifier);
  const form = await service.route(new Request(request.url));
  expect(form?.status).toBe(200);
  const html = await form?.text();
  const requestId = html?.match(/name="request_id" value="([^"]+)"/)?.[1];
  expect(requestId).toBeTruthy();
  const consent = await service.route(
    new Request(service.authorizationUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ request_id: requestId as string, secret: service.startupSecret }).toString(),
    }),
  );
  expect(consent?.status).toBe(302);
  const location = consent?.headers.get("location");
  expect(location).toBeTruthy();
  return { code: new URL(location as string).searchParams.get("code") as string, verifier };
}

describe("AuthService", () => {
  it("rejects special-use identities even when constructed directly in public mode", () => {
    for (const baseUrl of [
      "https://127.0.0.1",
      "https://[::ffff:127.0.0.1]",
      "https://[2002:7f00:1::1]",
      "https://100.64.0.1",
    ]) {
      expect(() => new AuthService({ mode: "public", baseUrl })).toThrow();
    }
  });

  it("canonicalizes identity and serves mutually consistent discovery metadata", async () => {
    const service = makeAuth();
    expect(service.issuer).toBe("http://127.0.0.1:38147");
    expect(service.mcpEndpoint).toBe("http://127.0.0.1:38147/mcp");
    expect(service.resource).toBe(service.mcpEndpoint);

    const asResponse = await service.route(
      new Request("http://127.0.0.1:38147/.well-known/oauth-authorization-server"),
    );
    const as = (await asResponse?.json()) as Record<string, unknown>;
    expect(as.issuer).toBe(service.issuer);
    expect(as.authorization_endpoint).toBe(`${service.issuer}/authorize`);
    expect(as.token_endpoint).toBe(`${service.issuer}/token`);
    expect(as.registration_endpoint).toBeUndefined();
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.client_id_metadata_document_supported).toBe(true);
    expect(as.authorization_response_iss_parameter_supported).toBe(true);

    const protectedResponse = await service.route(
      new Request("http://127.0.0.1:38147/.well-known/oauth-protected-resource/mcp"),
    );
    const protectedMetadata = (await protectedResponse?.json()) as Record<string, unknown>;
    expect(protectedMetadata.resource).toBe(service.resource);
    expect(protectedMetadata.authorization_servers).toEqual([service.issuer]);
    expect(protectedMetadata.scopes_supported).toEqual(["mcp"]);
  });

  it("completes S256 authorization code, bearer authentication, refresh, and single-use checks", async () => {
    const service = makeAuth();
    const { code, verifier } = await completeAuthorization(service);
    const tokenResponse = await service.route(
      new Request(service.oauthMetadata.token_endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: verifier,
          resource: service.resource,
        }).toString(),
      }),
    );
    expect(tokenResponse?.status).toBe(200);
    const tokens = (await tokenResponse?.json()) as { access_token: string; refresh_token: string; expires_in: number };
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
    expect(tokens.expires_in).toBeGreaterThan(0);

    const missing = await service.authenticate(new Request(service.mcpEndpoint));
    expect(missing).toBeInstanceOf(Response);
    expect((missing as Response).status).toBe(401);
    expect((missing as Response).headers.get("www-authenticate")).toContain("resource_metadata=");

    const authenticated = await service.authenticate(
      new Request(service.mcpEndpoint, { headers: { authorization: `Bearer ${tokens.access_token}` } }),
    );
    expect(authenticated).not.toBeInstanceOf(Response);
    expect((authenticated as { clientId: string }).clientId).toBe(clientId);

    const refreshResponse = await service.route(
      new Request(service.oauthMetadata.token_endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
          client_id: clientId,
          resource: service.resource,
        }).toString(),
      }),
    );
    expect(refreshResponse?.status).toBe(200);
    const refreshed = (await refreshResponse?.json()) as { access_token: string };
    expect(refreshed.access_token).not.toBe(tokens.access_token);

    const replay = await service.route(
      new Request(service.oauthMetadata.token_endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: verifier,
          resource: service.resource,
        }).toString(),
      }),
    );
    expect(replay?.status).toBe(400);
    if (!replay) throw new Error("token route did not handle the replay request");
    expect((await replay.json()).error).toBe("invalid_grant");
  });

  it("rejects wrong secret and PKCE without disclosing which parameter failed", async () => {
    const service = makeAuth();
    const { url } = authorizationRequest(service);
    const form = await service.route(new Request(url));
    const html = await form?.text();
    const requestId = html?.match(/name="request_id" value="([^"]+)"/)?.[1] as string;
    const wrong = await service.route(
      new Request(service.authorizationUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ request_id: requestId, secret: "wrong" }).toString(),
      }),
    );
    expect(wrong?.status).toBe(302);
    const wrongLocation = new URL(wrong?.headers.get("location") as string);
    expect(wrongLocation.searchParams.get("error")).toBe("access_denied");
    expect(wrongLocation.searchParams.get("iss")).toBe(service.issuer);
    expect(wrongLocation.href).not.toContain(service.startupSecret);

    const { code } = await completeAuthorization(service);
    const failed = await service.route(
      new Request(service.oauthMetadata.token_endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: "wrong",
          resource: service.resource,
        }).toString(),
      }),
    );
    expect(failed?.status).toBe(400);
    if (!failed) throw new Error("token route did not handle the PKCE request");
    expect((await failed.json()).error).toBe("invalid_grant");
  });

  it("rejects private metadata in public mode and accepts only loopback metadata in local mode", async () => {
    const publicService = new AuthService({
      mode: "public",
      baseUrl: "https://shell.example.net",
      resolve: async () => ["127.0.0.1"],
      fetch: async () => new Response("{}"),
    });
    const url = new URL(publicService.authorizationUrl);
    url.search = new URLSearchParams({
      client_id: "https://client.example/client.json",
      redirect_uri: redirectUri,
      response_type: "code",
      code_challenge: "abc",
      code_challenge_method: "S256",
      resource: publicService.resource,
    }).toString();
    const response = await publicService.route(new Request(url));
    expect(response?.status).toBe(400);
    if (!response) throw new Error("authorization route did not handle the metadata request");
    expect((await response.json()).error).toBe("invalid_client_metadata");
  });

  it("refuses a client identity whose hostname does not resolve", async () => {
    for (const mode of ["local", "public"] as const) {
      let fetches = 0;
      const service = new AuthService({
        mode,
        baseUrl: mode === "local" ? "http://127.0.0.1:38147" : "https://shell.example.net",
        resolve: async () => {
          throw new Error("getaddrinfo ENOTFOUND client.example.net");
        },
        fetch: async () => {
          fetches += 1;
          return new Response("{}", { headers: { "content-type": "application/json" } });
        },
      });
      const url = new URL(service.authorizationUrl);
      url.search = new URLSearchParams({
        client_id: mode === "local" ? clientId : "https://client.example.net/client.json",
        redirect_uri: redirectUri,
        response_type: "code",
        code_challenge: "abc",
        code_challenge_method: "S256",
        resource: service.resource,
      }).toString();
      const response = await service.route(new Request(url));
      expect(response?.status).toBe(400);
      if (!response) throw new Error("authorization route did not handle the unresolvable client identity");
      expect(await response.json()).toMatchObject({
        error: "invalid_client_metadata",
        iss: service.issuer,
      });
      expect(fetches).toBe(0);
    }
  });

  it("returns insufficient_scope for an otherwise valid token", async () => {
    const service = makeAuth();
    const records = (service as unknown as { accessTokens: Map<string, unknown> }).accessTokens;
    records.set("scope-token", {
      clientId,
      resource: service.resource,
      scopes: ["offline_access"],
      expiresAt: Date.now() + 60_000,
    });
    const response = await service.authenticate(
      new Request(service.mcpEndpoint, { headers: { authorization: "Bearer scope-token" } }),
    );
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(403);
    expect((await (response as Response).json()).error).toBe("insufficient_scope");
    expect((response as Response).headers.get("www-authenticate")).toContain("insufficient_scope");
  });

  it("rate-limits token attempts per client and globally", async () => {
    let now = 1_000;
    const service = new AuthService({
      mode: "local",
      baseUrl: "http://127.0.0.1:38147",
      now: () => now,
      limits: { tokenAttemptsPerMinute: 1, globalTokenAttemptsPerMinute: 2 },
    });
    const request = () =>
      service.route(
        new Request(service.oauthMetadata.token_endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            resource: service.resource,
          }),
        }),
      );
    expect((await request())?.status).toBe(400);
    expect((await request())?.status).toBe(429);
    now += 60_001;
    expect((await request())?.status).toBe(400);
  });
});
