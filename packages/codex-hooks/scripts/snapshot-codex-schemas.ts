import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = process.argv[2] ?? "/tmp/openai-codex";
const sourceSchemaDir = path.join(sourceRoot, "codex-rs", "hooks", "schema", "generated");
const destinationDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/schema/generated");

fs.mkdirSync(destinationDir, { recursive: true });

for (const entry of fs.readdirSync(sourceSchemaDir)) {
  if (!entry.endsWith(".json")) {
    continue;
  }
  fs.copyFileSync(path.join(sourceSchemaDir, entry), path.join(destinationDir, entry));
}

process.stdout.write(`Copied Codex hook schemas from ${sourceSchemaDir} to ${destinationDir}\n`);
