/**
 * Settings-file helpers for the voice MCP server.
 *
 * User settings that persist across reloads (currently the avatar's
 * `personality`) are stored in a JSON file (default `~/.voice/settings.json`,
 * overridable with `VOICE_SERVER_SETTINGS_PATH`). These helpers read, write,
 * and clear that file. They import ONLY node builtins so they can be reused
 * from any MCP-server context without dragging in the controller.
 *
 * @module voice/mcp/settings
 */
/**
 * Resolves the settings file path: `VOICE_SERVER_SETTINGS_PATH` if set and
 * non-empty, else `~/.voice/settings.json`.
 */
export declare function resolveSettingsPath(): string;
/**
 * Reads the stored avatar personality.
 *
 * @returns The trimmed personality, or undefined when absent/empty/unreadable.
 */
export declare function readStoredPersonality(): string | undefined;
/**
 * Persists the avatar personality, creating the directory (mode 0700) and file
 * (mode 0600) as needed. Other settings keys are preserved.
 *
 * @param personality - The personality text to persist.
 */
export declare function writeStoredPersonality(personality: string): void;
/**
 * Removes the stored personality (resetting it to the default). Deletes the
 * file if it becomes empty. Tolerant of a missing file.
 */
export declare function deleteStoredPersonality(): void;
