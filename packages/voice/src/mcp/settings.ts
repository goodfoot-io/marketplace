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

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Env var holding an override path for the settings file. */
const SETTINGS_PATH_ENV = "VOICE_SERVER_SETTINGS_PATH";

/** Default settings file location when the env override is unset. */
const DEFAULT_SETTINGS_PATH = join(homedir(), ".voice", "settings.json");

/** Persisted settings-file shape. */
interface SettingsFile {
  personality?: string;
}

/**
 * Resolves the settings file path: `VOICE_SERVER_SETTINGS_PATH` if set and
 * non-empty, else `~/.voice/settings.json`.
 */
export function resolveSettingsPath(): string {
  const override = process.env[SETTINGS_PATH_ENV]?.trim();
  // Ignore empty or an unexpanded `${VAR}` placeholder and fall back to default.
  if (override !== undefined && override !== "" && !/^\$\{[^}]*\}$/.test(override)) return override;
  return DEFAULT_SETTINGS_PATH;
}

/** Parse the settings file, tolerating a missing or malformed file. */
function readSettingsFile(path: string): SettingsFile {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SettingsFile;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Reads the stored avatar personality.
 *
 * @returns The trimmed personality, or undefined when absent/empty/unreadable.
 */
export function readStoredPersonality(): string | undefined {
  const file = readSettingsFile(resolveSettingsPath());
  const value = typeof file.personality === "string" ? file.personality.trim() : "";
  return value !== "" ? value : undefined;
}

/**
 * Persists the avatar personality, creating the directory (mode 0700) and file
 * (mode 0600) as needed. Other settings keys are preserved.
 *
 * @param personality - The personality text to persist.
 */
export function writeStoredPersonality(personality: string): void {
  const path = resolveSettingsPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const file = readSettingsFile(path);
  file.personality = personality;
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
}

/**
 * Removes the stored personality (resetting it to the default). Deletes the
 * file if it becomes empty. Tolerant of a missing file.
 */
export function deleteStoredPersonality(): void {
  const path = resolveSettingsPath();
  if (!existsSync(path)) return;
  const file = readSettingsFile(path);
  delete file.personality;
  if (Object.keys(file).length === 0) {
    rmSync(path, { force: true });
    return;
  }
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
}
