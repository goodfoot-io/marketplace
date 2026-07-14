import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HOOK_FACTORY_TO_EVENT } from "../src/constants.js";

// The vendored Codex schema snapshot lives here and is refreshed by
// scripts/snapshot-codex-schemas.ts. These tests guard against it drifting out
// of sync with the hand-maintained event set in src/types.ts — either an event
// gaining types without a schema, or a snapshotted schema without matching types.
const schemaDir = path.resolve(fileURLToPath(import.meta.url), "../../src/schema/generated");

function toKebabCase(eventName: string): string {
  return eventName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

const eventNames = [...new Set(Object.values(HOOK_FACTORY_TO_EVENT))].sort();

describe("schema coverage", () => {
  it("ships an input and output schema for every hook event", () => {
    for (const eventName of eventNames) {
      const base = toKebabCase(eventName);
      for (const kind of ["input", "output"] as const) {
        const file = path.join(schemaDir, `${base}.command.${kind}.schema.json`);
        expect(fs.existsSync(file), `missing ${kind} schema for ${eventName} (${file})`).toBe(true);
      }
    }
  });

  it("has no snapshotted schema files for unknown events", () => {
    const knownBases = new Set(eventNames.map(toKebabCase));
    const orphaned = [
      ...new Set(
        fs
          .readdirSync(schemaDir)
          .filter((entry) => entry.endsWith(".schema.json"))
          .map((entry) => entry.replace(/\.command\.(input|output)\.schema\.json$/, "")),
      ),
    ]
      .filter((base) => !knownBases.has(base))
      .sort();
    expect(orphaned).toEqual([]);
  });
});
