/**
 * Environment-driven configuration for the voice MCP server.
 *
 * The MCP server embeds the `createVoiceAgentServer` controller directly
 * in-process — there is no separate daemon and no port+1 control HTTP server.
 * All runtime values come from environment variables so the server can be
 * launched by an MCP client (e.g. Claude Code) over stdio with no arguments.
 */

import { readStoredKey, resolveSecretsPath } from "./secrets.js";

/** Default channel-notification event filter when `VOICE_SERVER_WATCH_TYPES` is unset. */
export const DEFAULT_WATCH_TYPES = [
  "transcript.item",
  "conversation.error",
  "browser.audio.error",
  "html.click",
  "html.message",
] as const;

/** `VOICE` values (trimmed, lower-cased) that disable the server. Anything else enables it. */
const DISABLED_VALUES = new Set(["0", "no", "off", "false"]);

/**
 * Reads an environment variable, treating an empty string OR an unexpanded
 * `${VAR}` placeholder as unset. `.mcp.json` forwards optional vars as
 * `"${VAR}"`; depending on the host, an unset one may arrive empty or as the
 * literal placeholder — both must be ignored rather than used as a value.
 *
 * @param name - Environment variable name.
 * @returns The trimmed value, or undefined when unset/empty/placeholder.
 */
export function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "" || /^\$\{[^}]*\}$/.test(trimmed)) return undefined;
  return trimmed;
}

export interface VoiceMcpConfig {
  /** Whether the server is enabled. `false` only when `VOICE` is an explicit falsy value. */
  enabled: boolean;
  /** xAI API key forwarded to the realtime session (browser-proxied). */
  apiKey: string;
  /** Where {@link apiKey} came from: env var, secrets file, or neither. */
  keySource: "env" | "file" | "none";
  /** Resolved path to the secrets file (whether or not it exists). */
  secretsPath: string;
  /** Port for the browser-facing web/UI + WebSocket server. */
  port: number;
  /** Absolute path for the JSONL diagnostic log, or undefined to disable. */
  logPath: string | undefined;
  /** Event names delivered as `claude/channel` notifications. */
  watchTypes: string[];
}

/**
 * Reads the voice MCP server configuration from the environment.
 *
 * @returns Parsed configuration.
 */
export function readConfig(): VoiceMcpConfig {
  const voiceRaw = readEnv("VOICE");
  const enabled = voiceRaw === undefined || !DISABLED_VALUES.has(voiceRaw.toLowerCase());

  // Key resolution precedence: env var → secrets file → none. `keySource`
  // records which path won so the server can decide whether to expose the
  // Clear-key button (file only).
  const secretsPath = resolveSecretsPath();
  const envKey = readEnv("XAI_API_KEY");
  let apiKey: string;
  let keySource: VoiceMcpConfig["keySource"];
  if (envKey !== undefined) {
    apiKey = envKey;
    keySource = "env";
  } else {
    const storedKey = readStoredKey();
    if (storedKey !== undefined) {
      apiKey = storedKey;
      keySource = "file";
    } else {
      apiKey = "";
      keySource = "none";
    }
  }

  const portRaw = readEnv("VOICE_SERVER_HTTP_PORT");
  const portParsed = portRaw !== undefined ? parseInt(portRaw, 10) : Number.NaN;
  const port = Number.isNaN(portParsed) ? 3000 : portParsed;

  const logPath = readEnv("VOICE_SERVER_LOG_PATH");

  const watchRaw = readEnv("VOICE_SERVER_WATCH_TYPES");
  const watchTypes = watchRaw !== undefined ? watchRaw.split(/\s+/) : [...DEFAULT_WATCH_TYPES];

  return { enabled, apiKey, keySource, secretsPath, port, logPath, watchTypes };
}
