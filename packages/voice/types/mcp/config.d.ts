/**
 * Environment-driven configuration for the voice MCP server.
 *
 * The MCP server embeds the `createVoiceAgentServer` controller directly
 * in-process — there is no separate daemon and no port+1 control HTTP server.
 * All runtime values come from environment variables so the server can be
 * launched by an MCP client (e.g. Claude Code) over stdio with no arguments.
 */
/** Default channel-notification event filter when `VOICE_SERVER_WATCH_TYPES` is unset. */
export declare const DEFAULT_WATCH_TYPES: readonly ["transcript.item", "conversation.error", "browser.audio.error", "html.click", "html.message"];
/**
 * Reads an environment variable, treating an empty string OR an unexpanded
 * `${VAR}` placeholder as unset. `.mcp.json` forwards optional vars as
 * `"${VAR}"`; depending on the host, an unset one may arrive empty or as the
 * literal placeholder — both must be ignored rather than used as a value.
 *
 * @param name - Environment variable name.
 * @returns The trimmed value, or undefined when unset/empty/placeholder.
 */
export declare function readEnv(name: string): string | undefined;
export interface VoiceMcpConfig {
    /**
     * Whether the server is enabled. Resolution precedence:
     * `VOICE` (runtime override) → `VOICE_SERVER_START_BY_DEFAULT` → built-in
     * default (start). A falsy value at the winning level disables the server.
     */
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
export declare function readConfig(): VoiceMcpConfig;
