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
/**
 * Resolves the secrets file path: `VOICE_SERVER_SECRETS_PATH` if set and
 * non-empty, else `~/.voice/secrets.json`.
 */
export declare function resolveSecretsPath(): string;
/**
 * Reads the stored xAI API key from the secrets file.
 *
 * @returns The trimmed key, or undefined when absent/empty/unreadable.
 */
export declare function readStoredKey(): string | undefined;
/**
 * Writes the xAI API key to the secrets file, creating the directory (mode
 * 0700) and file (mode 0600) as needed.
 *
 * @param key - The API key to persist.
 */
export declare function writeStoredKey(key: string): void;
/**
 * Removes the `XAI_API_KEY` field from the secrets file. If the file becomes
 * empty it is deleted entirely. Tolerant of a missing file.
 */
export declare function deleteStoredKey(): void;
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
export declare function validateKey(key: string): Promise<{
    valid: boolean;
    reachable: boolean;
}>;
