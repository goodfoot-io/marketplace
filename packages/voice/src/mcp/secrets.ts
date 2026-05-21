/**
 * Secrets-file helpers for the voice MCP server.
 *
 * The xAI API key may be supplied via the `XAI_API_KEY` environment variable
 * or persisted to a JSON secrets file (default `~/.voice/secrets.json`). These
 * helpers read, write, and delete that file, and validate a candidate key
 * against the xAI API. They import ONLY node builtins so they can be reused
 * from any MCP-server context without dragging in the controller.
 *
 * @module voice/mcp/secrets
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Env var holding an override path for the secrets file. */
const SECRETS_PATH_ENV = "VOICE_SERVER_SECRETS_PATH";

/** Default secrets file location when the env override is unset. */
const DEFAULT_SECRETS_PATH = join(homedir(), ".voice", "secrets.json");

/** xAI endpoint used to validate a candidate API key. */
const XAI_API_KEY_URL = "https://api.x.ai/v1/api-key";

/** Timeout for the validation request. */
const VALIDATE_TIMEOUT_MS = 10_000;

/** Persisted secrets-file shape. */
interface SecretsFile {
  XAI_API_KEY?: string;
}

/**
 * Resolves the secrets file path: `VOICE_SERVER_SECRETS_PATH` if set and
 * non-empty, else `~/.voice/secrets.json`.
 */
export function resolveSecretsPath(): string {
  const override = process.env[SECRETS_PATH_ENV]?.trim();
  // Ignore empty or an unexpanded `${VAR}` placeholder (an unset var forwarded
  // by `.mcp.json` may arrive either way) and fall back to the default.
  if (override !== undefined && override !== "" && !/^\$\{[^}]*\}$/.test(override)) return override;
  return DEFAULT_SECRETS_PATH;
}

/** Parse the secrets file, tolerating a missing or malformed file. */
function readSecretsFile(path: string): SecretsFile {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SecretsFile;
    }
    return {};
  } catch {
    // Missing/invalid/unreadable file → treat as no stored key.
    return {};
  }
}

/**
 * Reads the stored xAI API key from the secrets file.
 *
 * @returns The trimmed key, or undefined when absent/empty/unreadable.
 */
export function readStoredKey(): string | undefined {
  const file = readSecretsFile(resolveSecretsPath());
  const key = typeof file.XAI_API_KEY === "string" ? file.XAI_API_KEY.trim() : "";
  return key !== "" ? key : undefined;
}

/**
 * Writes the xAI API key to the secrets file, creating the directory (mode
 * 0700) and file (mode 0600) as needed.
 *
 * @param key - The API key to persist.
 */
export function writeStoredKey(key: string): void {
  const path = resolveSecretsPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const file = readSecretsFile(path);
  file.XAI_API_KEY = key;
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
}

/**
 * Removes the `XAI_API_KEY` field from the secrets file. If the file becomes
 * empty it is deleted entirely. Tolerant of a missing file.
 */
export function deleteStoredKey(): void {
  const path = resolveSecretsPath();
  if (!existsSync(path)) return;
  const file = readSecretsFile(path);
  delete file.XAI_API_KEY;
  if (Object.keys(file).length === 0) {
    rmSync(path, { force: true });
    return;
  }
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
}

/**
 * Validates a candidate xAI API key against the xAI API.
 *
 * - `2xx` → `{ valid: true, reachable: true }`
 * - any `4xx` → `{ valid: false, reachable: true }` (xAI returns `400` for a
 *   rejected key on this endpoint, not `401`)
 * - `5xx`, network error, or timeout → `{ valid: false, reachable: false }`
 *
 * @param key - The candidate API key.
 * @returns Whether the key is valid and whether xAI was reachable.
 */
export async function validateKey(key: string): Promise<{ valid: boolean; reachable: boolean }> {
  try {
    const response = await fetch(XAI_API_KEY_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(VALIDATE_TIMEOUT_MS),
    });
    if (response.ok) return { valid: true, reachable: true };
    // A 4xx means we reached xAI and it rejected the key. A 5xx is a server-side
    // problem, so report it as unreachable (retry) rather than "key is bad".
    if (response.status >= 400 && response.status < 500) return { valid: false, reachable: true };
    return { valid: false, reachable: false };
  } catch {
    return { valid: false, reachable: false };
  }
}
