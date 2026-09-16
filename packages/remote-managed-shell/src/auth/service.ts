import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import {
  type AuthInfo,
  bearerAuthChallengeResponse,
  buildOAuthProtectedResourceMetadata,
  getOAuthProtectedResourceMetadataUrl,
  isJsonContentType,
  OAuthError,
  OAuthErrorCode,
  type OAuthMetadata,
  oauthMetadataResponse,
  requireBearerAuth,
} from "@modelcontextprotocol/server";
import { isLocalOrSpecialHostname } from "../config.js";

export type AuthMode = "local" | "public";

export interface AuthServiceOptions {
  mode: AuthMode;
  /** The canonical public identity, without the `/mcp` suffix. */
  baseUrl: string | URL;
  now?: () => number;
  fetch?: typeof globalThis.fetch;
  resolve?: (hostname: string) => Promise<readonly string[]>;
  limits?: Partial<AuthLimits>;
}

export interface AuthLimits {
  clientCacheEntries: number;
  clientCacheTtlMs: number;
  clientFetchTimeoutMs: number;
  clientDocumentBytes: number;
  maxPendingAuthorization: number;
  maxCodes: number;
  codeTtlMs: number;
  maxAccessTokens: number;
  accessTokenTtlMs: number;
  maxRefreshTokens: number;
  refreshTokenTtlMs: number;
  consentAttemptsPerMinute: number;
  globalConsentAttemptsPerMinute: number;
  tokenAttemptsPerMinute: number;
  globalTokenAttemptsPerMinute: number;
  maxMetadataFetches: number;
}

const DEFAULT_LIMITS: AuthLimits = {
  clientCacheEntries: 32,
  clientCacheTtlMs: 60 * 60_000,
  clientFetchTimeoutMs: 5_000,
  clientDocumentBytes: 64 * 1024,
  maxPendingAuthorization: 64,
  maxCodes: 32,
  codeTtlMs: 60_000,
  maxAccessTokens: 64,
  accessTokenTtlMs: 60 * 60_000,
  maxRefreshTokens: 64,
  refreshTokenTtlMs: 30 * 24 * 60 * 60_000,
  consentAttemptsPerMinute: 10,
  globalConsentAttemptsPerMinute: 100,
  tokenAttemptsPerMinute: 30,
  globalTokenAttemptsPerMinute: 300,
  maxMetadataFetches: 8,
};

interface ClientDocument {
  readonly clientId: string;
  readonly redirectUris: readonly string[];
  readonly expiresAt: number;
}

interface PendingAuthorization {
  readonly params: AuthorizationParams;
  readonly client: ClientDocument;
  readonly expiresAt: number;
}

interface AuthorizationParams {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly responseType: "code";
  readonly codeChallenge: string;
  readonly codeChallengeMethod: "S256";
  readonly resource: string;
  readonly scope: readonly string[];
  readonly state?: string;
}

interface AuthorizationCode {
  readonly params: AuthorizationParams;
  readonly expiresAt: number;
  used: boolean;
}

interface AccessToken {
  readonly clientId: string;
  readonly resource: string;
  readonly scopes: readonly string[];
  readonly expiresAt: number;
  readonly refreshToken?: string;
}

interface RefreshToken {
  readonly clientId: string;
  readonly resource: string;
  readonly scopes: readonly string[];
  readonly expiresAt: number;
  used: boolean;
}

/**
 * The in-memory OAuth 2.1 half of the service. It deliberately has no
 * reference to the process manager; the caller supplies its `authenticate`
 * result to the MCP resource-server route.
 */
export class AuthService {
  readonly mode: AuthMode;
  readonly issuer: string;
  /** Canonical resource indicator accepted in authorization and token calls. */
  readonly resource: string;
  readonly mcpEndpoint: string;
  readonly startupSecret: string;
  readonly authorizationUrl: URL;
  readonly protectedResourceMetadataUrl: string;

  private readonly clock: () => number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly resolveHostname: (hostname: string) => Promise<readonly string[]>;
  private readonly limits: AuthLimits;
  private readonly clients = new Map<string, ClientDocument>();
  private readonly pending = new Map<string, PendingAuthorization>();
  private readonly codes = new Map<string, AuthorizationCode>();
  private readonly accessTokens = new Map<string, AccessToken>();
  private readonly refreshTokens = new Map<string, RefreshToken>();
  private readonly consentAttempts = new Map<string, number[]>();
  private globalConsentAttempts: number[] = [];
  private readonly tokenAttempts = new Map<string, number[]>();
  private globalTokenAttempts: number[] = [];
  private metadataFetches = 0;
  private closed = false;

  readonly oauthMetadata: OAuthMetadata;
  readonly protectedResourceMetadata;
  private readonly bearerGate: (request: Request) => Promise<AuthInfo | Response>;

  constructor(options: AuthServiceOptions) {
    this.mode = options.mode;
    const base = canonicalBase(options.baseUrl, options.mode);
    this.issuer = base;
    this.mcpEndpoint = appendPath(base, "/mcp");
    this.resource = this.mcpEndpoint;
    this.authorizationUrl = new URL(appendPath(base, "/authorize"));
    this.startupSecret = randomToken(32);
    this.clock = options.now ?? Date.now;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.resolveHostname =
      options.resolve ??
      (async (hostname) => (await lookup(hostname, { all: true, verbatim: true })).map((item) => item.address));
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };

    this.oauthMetadata = {
      issuer: this.issuer,
      authorization_endpoint: this.authorizationUrl.href,
      token_endpoint: appendPath(base, "/token"),
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
      scopes_supported: ["mcp", "offline_access"],
    };
    this.protectedResourceMetadata = buildOAuthProtectedResourceMetadata({
      oauthMetadata: this.oauthMetadata,
      resourceServerUrl: new URL(this.resource),
      scopesSupported: ["mcp"],
      resourceName: "Remote managed shell",
    });
    this.protectedResourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(new URL(this.resource));
    this.bearerGate = requireBearerAuth({
      verifier: { verifyAccessToken: (token) => this.verifyAccessToken(token) },
      requiredScopes: ["mcp"],
      resourceMetadataUrl: this.protectedResourceMetadataUrl,
    });
  }

  /** Handles discovery and the two browser-facing OAuth endpoints. */
  async route(request: Request): Promise<Response | undefined> {
    if (this.closed)
      return this.oauthErrorResponse(OAuthErrorCode.ServerError, "Authorization service is unavailable", 503);
    const url = new URL(request.url);
    const pathname = trimSlash(url.pathname);

    if (pathname === "/.well-known/oauth-authorization-server") {
      const response = oauthMetadataResponse(request, {
        oauthMetadata: this.oauthMetadata,
        resourceServerUrl: new URL(this.resource),
        scopesSupported: ["mcp"],
        resourceName: "Remote managed shell",
      });
      if (response) return response;
    }
    // Serve the path-aware form too. The SDK builder is still the source of
    // the document; this extra route is needed because this service's resource
    // indicator is its canonical issuer rather than the `/mcp` child path.
    const resourceMetadataPath = new URL(this.protectedResourceMetadataUrl).pathname;
    if (pathname === "/.well-known/oauth-protected-resource" || pathname === trimSlash(resourceMetadataPath)) {
      return metadataResponse(request, this.protectedResourceMetadata);
    }
    if (pathname === trimSlash(new URL(this.authorizationUrl).pathname)) return this.handleAuthorize(request, url);
    if (pathname === trimSlash(new URL(this.oauthMetadata.token_endpoint).pathname)) return this.handleToken(request);
    return undefined;
  }

  /** Applies the SDK bearer gate and verifies this instance's audience. */
  authenticate(request: Request): Promise<AuthInfo | Response> {
    const authorization = request.headers.get("authorization");
    if (authorization !== null && !/^Bearer [^\s]+$/i.test(authorization)) {
      return Promise.resolve(
        bearerAuthChallengeResponse(
          new OAuthError(OAuthErrorCode.InvalidToken, "Invalid Authorization header format"),
          {
            requiredScopes: ["mcp"],
            resourceMetadataUrl: this.protectedResourceMetadataUrl,
          },
        ),
      );
    }
    return this.bearerGate(request);
  }

  /** Stops accepting credentials and drops all in-memory authorization state. */
  async close(): Promise<void> {
    this.closed = true;
    this.clients.clear();
    this.pending.clear();
    this.codes.clear();
    this.accessTokens.clear();
    this.refreshTokens.clear();
    this.consentAttempts.clear();
    this.globalConsentAttempts = [];
    this.tokenAttempts.clear();
    this.globalTokenAttempts = [];
  }

  private async handleAuthorize(request: Request, url: URL): Promise<Response> {
    if (request.method === "GET") {
      this.prune();
      const params = await this.readAuthorizationParams(url.searchParams);
      if (params instanceof Response) return params;
      const client = await this.loadClient(params.clientId);
      if (client instanceof Response) return client;
      if (!client.redirectUris.includes(params.redirectUri))
        return this.oauthErrorResponse(OAuthErrorCode.InvalidRedirectUri, "Authorization request denied");
      if (this.pending.size >= this.limits.maxPendingAuthorization)
        return this.oauthErrorResponse(OAuthErrorCode.TooManyRequests, "Authorization request denied", 429);
      const requestId = randomToken(18);
      this.pending.set(requestId, { params, client, expiresAt: this.clock() + this.limits.codeTtlMs });
      return new Response(renderConsentForm(this.authorizationUrl.pathname, requestId, params), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (request.method !== "POST")
      return this.oauthErrorResponse(OAuthErrorCode.MethodNotAllowed, "Method not allowed", 405);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
      return this.oauthErrorResponse(OAuthErrorCode.InvalidRequest, "Authorization request denied");
    }
    const body = new URLSearchParams(await request.text());
    const requestId = body.get("request_id");
    const pending = requestId === null ? undefined : this.pending.get(requestId);
    if (requestId === null || !pending || pending.expiresAt <= this.clock()) {
      if (requestId) this.pending.delete(requestId);
      return this.oauthErrorResponse(OAuthErrorCode.InvalidRequest, "Authorization request denied");
    }
    this.pending.delete(requestId);
    const params = pending.params;
    const secret = body.get("secret") ?? "";
    if (!this.takeConsentAttempt(params.clientId))
      return this.oauthErrorResponse(OAuthErrorCode.TooManyRequests, "Authorization request denied", 429);
    if (!constantTimeEqual(secret, this.startupSecret))
      return this.authorizationFailure(params, OAuthErrorCode.AccessDenied);
    if (this.codes.size >= this.limits.maxCodes)
      return this.authorizationFailure(params, OAuthErrorCode.TemporarilyUnavailable);
    const code = randomToken(32);
    this.codes.set(code, { params, expiresAt: this.clock() + this.limits.codeTtlMs, used: false });
    const redirect = new URL(params.redirectUri);
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("iss", this.issuer);
    if (params.state !== undefined) redirect.searchParams.set("state", params.state);
    return Response.redirect(redirect.href, 302);
  }

  private async readAuthorizationParams(search: URLSearchParams): Promise<AuthorizationParams | Response> {
    const clientId = search.get("client_id");
    const redirectUri = search.get("redirect_uri");
    const responseType = search.get("response_type");
    const challenge = search.get("code_challenge");
    const challengeMethod = search.get("code_challenge_method");
    const resource = search.get("resource");
    if (!clientId || !redirectUri || responseType !== "code" || !challenge || challengeMethod !== "S256" || !resource) {
      return this.oauthErrorResponse(OAuthErrorCode.InvalidRequest, "Authorization request denied");
    }
    if (resource !== this.resource)
      return this.oauthErrorResponse(OAuthErrorCode.InvalidTarget, "Authorization request denied");
    const scopeResult = parseScope(search.get("scope"));
    if (scopeResult instanceof Response)
      return this.oauthErrorResponse(OAuthErrorCode.InvalidScope, "Authorization request denied");
    if (!isAbsoluteUrl(redirectUri))
      return this.oauthErrorResponse(OAuthErrorCode.InvalidRedirectUri, "Authorization request denied");
    if (!isValidClientIdUrl(clientId, this.mode))
      return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
    return {
      clientId,
      redirectUri,
      responseType: "code",
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
      resource,
      scope: scopeResult,
      ...(search.get("state") === null ? {} : { state: search.get("state") ?? undefined }),
    };
  }

  private async handleToken(request: Request): Promise<Response> {
    if (request.method !== "POST")
      return this.oauthErrorResponse(OAuthErrorCode.MethodNotAllowed, "Method not allowed", 405);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
      return this.oauthErrorResponse(OAuthErrorCode.InvalidRequest, "Token request denied");
    }
    const form = new URLSearchParams(await request.text());
    const grantType = form.get("grant_type");
    const clientId = form.get("client_id");
    const resource = form.get("resource");
    if (!this.takeTokenAttempt(clientId))
      return this.oauthErrorResponse(OAuthErrorCode.TooManyRequests, "Token request denied", 429);
    if (!clientId || resource !== this.resource)
      return this.oauthErrorResponse(OAuthErrorCode.InvalidGrant, "Token request denied");
    if (grantType === "authorization_code") return this.exchangeCode(form, clientId, resource);
    if (grantType === "refresh_token") return this.exchangeRefresh(form, clientId, resource);
    return this.oauthErrorResponse(OAuthErrorCode.UnsupportedGrantType, "Token request denied");
  }

  private async exchangeCode(form: URLSearchParams, clientId: string, resource: string): Promise<Response> {
    const codeValue = form.get("code");
    const verifier = form.get("code_verifier");
    const redirectUri = form.get("redirect_uri");
    if (!codeValue || !verifier || !redirectUri)
      return this.oauthErrorResponse(OAuthErrorCode.InvalidGrant, "Token request denied");
    const code = this.codes.get(codeValue);
    if (!code || code.used || code.expiresAt <= this.clock())
      return this.oauthErrorResponse(OAuthErrorCode.InvalidGrant, "Token request denied");
    code.used = true;
    if (
      code.params.clientId !== clientId ||
      code.params.redirectUri !== redirectUri ||
      !verifyPkce(verifier, code.params.codeChallenge)
    ) {
      return this.oauthErrorResponse(OAuthErrorCode.InvalidGrant, "Token request denied");
    }
    this.codes.delete(codeValue);
    return this.issueTokens(clientId, resource, code.params.scope);
  }

  private async exchangeRefresh(form: URLSearchParams, clientId: string, resource: string): Promise<Response> {
    const value = form.get("refresh_token");
    if (!value) return this.oauthErrorResponse(OAuthErrorCode.InvalidGrant, "Token request denied");
    const token = this.refreshTokens.get(value);
    if (
      !token ||
      token.used ||
      token.expiresAt <= this.clock() ||
      token.clientId !== clientId ||
      token.resource !== resource
    ) {
      return this.oauthErrorResponse(OAuthErrorCode.InvalidGrant, "Token request denied");
    }
    if (this.refreshTokens.size >= this.limits.maxRefreshTokens && !this.refreshTokens.has(value)) {
      return this.oauthErrorResponse(OAuthErrorCode.TemporarilyUnavailable, "Token request denied", 503);
    }
    token.used = true;
    this.refreshTokens.delete(value);
    return this.issueTokens(clientId, resource, token.scopes);
  }

  private issueTokens(clientId: string, resource: string, scopes: readonly string[]): Response {
    if (
      this.accessTokens.size >= this.limits.maxAccessTokens ||
      (scopes.includes("offline_access") && this.refreshTokens.size >= this.limits.maxRefreshTokens)
    ) {
      return this.oauthErrorResponse(OAuthErrorCode.TemporarilyUnavailable, "Token request denied", 503);
    }
    const accessToken = randomToken(32);
    const accessExpiry = this.clock() + this.limits.accessTokenTtlMs;
    let refreshToken: string | undefined;
    if (scopes.includes("offline_access")) {
      refreshToken = randomToken(32);
      this.refreshTokens.set(refreshToken, {
        clientId,
        resource,
        scopes,
        expiresAt: this.clock() + this.limits.refreshTokenTtlMs,
        used: false,
      });
    }
    this.accessTokens.set(accessToken, { clientId, resource, scopes, expiresAt: accessExpiry, refreshToken });
    return Response.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: Math.max(1, Math.floor(this.limits.accessTokenTtlMs / 1000)),
        ...(refreshToken === undefined ? {} : { refresh_token: refreshToken }),
        scope: scopes.join(" "),
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  private async loadClient(clientId: string): Promise<ClientDocument | Response> {
    this.prune();
    const cached = this.clients.get(clientId);
    if (cached && cached.expiresAt > this.clock()) return cached;
    if (this.metadataFetches >= this.limits.maxMetadataFetches)
      return this.oauthErrorResponse(OAuthErrorCode.TemporarilyUnavailable, "Authorization request denied", 503);
    this.metadataFetches += 1;
    try {
      const parsed = validateClientIdUrl(clientId, this.mode);
      if (parsed instanceof Response)
        return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
      if (isSpecialAddress(parsed.hostname) && !(this.mode === "local" && parsed.hostname === "127.0.0.1"))
        return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
      let addresses: readonly string[];
      try {
        addresses = await this.resolveHostname(parsed.hostname);
      } catch {
        // A resolver failure means the client identity could not be checked, so
        // it is refused like any other unverifiable document rather than
        // escaping as an opaque request error.
        return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
      }
      if (
        addresses.length === 0 ||
        addresses.some((address) => isSpecialAddress(address) && !(this.mode === "local" && address === "127.0.0.1"))
      )
        return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.limits.clientFetchTimeoutMs);
      let response: Response;
      try {
        response = await this.fetchImpl(clientId, { redirect: "error", signal: controller.signal });
        if (
          response.redirected ||
          (response.status >= 300 && response.status < 400) ||
          !response.ok ||
          !isJsonContentType(response.headers.get("content-type"))
        )
          return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
        const raw = await readBoundedBody(response, this.limits.clientDocumentBytes);
        if (raw === undefined)
          return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
        return this.parseClientDocument(clientId, raw);
      } catch {
        return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      this.metadataFetches -= 1;
    }
  }

  private parseClientDocument(clientId: string, raw: string): ClientDocument | Response {
    let document: unknown;
    try {
      document = JSON.parse(raw);
    } catch {
      return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
    }
    if (!document || typeof document !== "object")
      return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
    const record = document as Record<string, unknown>;
    if (record.client_id !== clientId)
      return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
    const rawUris = Array.isArray(record.redirect_uris)
      ? record.redirect_uris
      : record.redirect_uri === undefined
        ? []
        : [record.redirect_uri];
    if (rawUris.length === 0 || rawUris.some((value) => typeof value !== "string" || !isAbsoluteUrl(value)))
      return this.oauthErrorResponse(OAuthErrorCode.InvalidClientMetadata, "Authorization request denied");
    const client: ClientDocument = {
      clientId,
      redirectUris: rawUris as string[],
      expiresAt: this.clock() + this.limits.clientCacheTtlMs,
    };
    while (this.clients.size >= this.limits.clientCacheEntries)
      this.clients.delete(this.clients.keys().next().value as string);
    this.clients.set(clientId, client);
    return client;
  }

  private async verifyAccessToken(token: string): Promise<AuthInfo> {
    this.prune();
    const record = this.accessTokens.get(token);
    if (!record || record.expiresAt <= this.clock())
      throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid access token");
    if (record.resource !== this.resource) throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid access token");
    return {
      token,
      clientId: record.clientId,
      scopes: [...record.scopes],
      expiresAt: Math.floor(record.expiresAt / 1000),
      resource: new URL(record.resource),
      extra: { issuer: this.issuer },
    };
  }

  private authorizationFailure(params: AuthorizationParams, code: OAuthErrorCode): Response {
    const redirect = new URL(params.redirectUri);
    redirect.searchParams.set("error", code);
    redirect.searchParams.set("error_description", "Authorization request denied");
    redirect.searchParams.set("iss", this.issuer);
    if (params.state !== undefined) redirect.searchParams.set("state", params.state);
    return Response.redirect(redirect.href, 302);
  }

  private takeConsentAttempt(clientId: string): boolean {
    const now = this.clock();
    this.globalConsentAttempts = this.globalConsentAttempts.filter((timestamp) => timestamp + 60_000 > now);
    if (this.globalConsentAttempts.length >= this.limits.globalConsentAttemptsPerMinute) return false;
    const attempts = (this.consentAttempts.get(clientId) ?? []).filter((timestamp) => timestamp + 60_000 > now);
    if (attempts.length >= this.limits.consentAttemptsPerMinute) return false;
    attempts.push(now);
    this.consentAttempts.set(clientId, attempts);
    this.globalConsentAttempts.push(now);
    return true;
  }

  private takeTokenAttempt(clientId: string | null): boolean {
    const now = this.clock();
    this.globalTokenAttempts = this.globalTokenAttempts.filter((timestamp) => timestamp + 60_000 > now);
    if (this.globalTokenAttempts.length >= this.limits.globalTokenAttemptsPerMinute) return false;
    this.globalTokenAttempts.push(now);

    // Keep per-client buckets only for syntactically valid identities, and
    // bound their count so malformed-client floods cannot grow this registry.
    if (clientId === null || !isValidClientIdUrl(clientId, this.mode)) return true;
    const attempts = (this.tokenAttempts.get(clientId) ?? []).filter((timestamp) => timestamp + 60_000 > now);
    if (attempts.length >= this.limits.tokenAttemptsPerMinute) return false;
    if (!this.tokenAttempts.has(clientId) && this.tokenAttempts.size >= this.limits.clientCacheEntries) return true;
    attempts.push(now);
    this.tokenAttempts.set(clientId, attempts);
    return true;
  }

  private prune(): void {
    const now = this.clock();
    for (const [key, value] of this.clients) if (value.expiresAt <= now) this.clients.delete(key);
    for (const [key, value] of this.pending) if (value.expiresAt <= now) this.pending.delete(key);
    for (const [key, value] of this.codes) if (value.expiresAt <= now) this.codes.delete(key);
    for (const [key, value] of this.accessTokens) if (value.expiresAt <= now) this.accessTokens.delete(key);
    for (const [key, value] of this.refreshTokens) if (value.expiresAt <= now) this.refreshTokens.delete(key);
    this.globalTokenAttempts = this.globalTokenAttempts.filter((timestamp) => timestamp + 60_000 > now);
    for (const [key, attempts] of this.tokenAttempts) {
      const current = attempts.filter((timestamp) => timestamp + 60_000 > now);
      if (current.length === 0) this.tokenAttempts.delete(key);
      else this.tokenAttempts.set(key, current);
    }
  }

  private oauthErrorResponse(code: OAuthErrorCode | string, description: string, status = 400): Response {
    return Response.json(
      { error: code, error_description: description, iss: this.issuer },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}

function canonicalBase(input: string | URL, mode: AuthMode): string {
  const url = new URL(input.toString());
  if (url.username || url.password || url.search || url.hash)
    throw new Error("OAuth base URL must not contain credentials, query, or fragment");
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if (mode === "local" && (url.protocol !== "http:" || url.hostname !== "127.0.0.1"))
    throw new Error("Local OAuth identity must be http://127.0.0.1");
  if (mode === "public" && (url.protocol !== "https:" || isLocalOrSpecialHostname(url.hostname))) {
    throw new Error("Public OAuth identity must use HTTPS and a public host");
  }
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443"))
    url.port = "";
  url.pathname = trimSlash(url.pathname);
  return url.href.replace(/\/$/, "");
}

function appendPath(base: string, suffix: string): string {
  const url = new URL(base);
  const pathname = trimSlash(url.pathname);
  url.pathname = pathname === "/" ? suffix : `${pathname}${suffix}`;
  return url.href;
}

function trimSlash(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = createHash("sha256").update(left).digest();
  const rightBytes = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftBytes, rightBytes);
}

function verifyPkce(verifier: string, challenge: string): boolean {
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

function parseScope(value: string | null): readonly string[] | Response {
  const scopes = (value ?? "mcp").split(/\s+/).filter(Boolean);
  if (scopes.length === 0 || scopes.some((scope) => scope !== "mcp" && scope !== "offline_access"))
    return new Response(
      JSON.stringify({ error: OAuthErrorCode.InvalidScope, error_description: "Authorization request denied" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  if (!scopes.includes("mcp"))
    return new Response(
      JSON.stringify({ error: OAuthErrorCode.InvalidScope, error_description: "Authorization request denied" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  return [...new Set(scopes)];
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return Boolean(url.protocol && url.hostname);
  } catch {
    return false;
  }
}

function isValidClientIdUrl(value: string, mode: AuthMode): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || (mode === "local" && url.protocol === "http:" && url.hostname === "127.0.0.1")) &&
      url.pathname !== "/" &&
      url.pathname.length > 0 &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function validateClientIdUrl(value: string, mode: AuthMode): Response | URL {
  if (!isValidClientIdUrl(value, mode))
    return new Response(
      JSON.stringify({
        error: OAuthErrorCode.InvalidClientMetadata,
        error_description: "Authorization request denied",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  return new URL(value);
}

function isSpecialAddress(address: string): boolean {
  return isLocalOrSpecialHostname(address);
}

async function readBoundedBody(response: Response, limit: number): Promise<string | undefined> {
  if (!response.body) {
    const text = await response.text();
    return Buffer.byteLength(text) <= limit ? text : undefined;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(item.value);
    }
  } catch {
    return undefined;
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(output);
}

function metadataResponse(request: Request, metadata: unknown): Response {
  if (request.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, HEAD, OPTIONS" },
    });
  if (request.method !== "GET" && request.method !== "HEAD")
    return Response.json(
      { error: OAuthErrorCode.MethodNotAllowed, error_description: "Method not allowed" },
      { status: 405, headers: { allow: "GET, HEAD, OPTIONS", "access-control-allow-origin": "*" } },
    );
  const response = Response.json(metadata, { headers: { "access-control-allow-origin": "*" } });
  return request.method === "HEAD"
    ? new Response(null, { status: response.status, headers: response.headers })
    : response;
}

function renderConsentForm(action: string, requestId: string, params: AuthorizationParams): string {
  const hidden = (name: string, value: string): string =>
    `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
  const fields = [
    hidden("request_id", requestId),
    hidden("client_id", params.clientId),
    hidden("redirect_uri", params.redirectUri),
    hidden("response_type", params.responseType),
    hidden("code_challenge", params.codeChallenge),
    hidden("code_challenge_method", params.codeChallengeMethod),
    hidden("resource", params.resource),
    hidden("scope", params.scope.join(" ")),
    params.state === undefined ? "" : hidden("state", params.state),
  ].join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Authorize remote shell</title></head><body><h1>Authorize remote shell</h1><p>Enter the startup secret printed by the server.</p><form method="post" action="${escapeHtml(action)}">${fields}<label>Startup secret <input name="secret" type="password" autocomplete="off" required></label><button type="submit">Authorize</button></form></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
