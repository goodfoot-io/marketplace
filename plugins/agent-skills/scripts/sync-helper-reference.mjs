import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderHelperReferenceMarkdown } from "@goodfoot/agent-skills/helper-reference";

const referenceUrl = new URL("../skills/reference/helper-reference.md", import.meta.url);
const referencePath = fileURLToPath(referenceUrl);
const beginMarker = "<!-- BEGIN GENERATED AGENT-SKILLS HELPER REFERENCE -->";
const endMarker = "<!-- END GENERATED AGENT-SKILLS HELPER REFERENCE -->";

const current = await readFile(referenceUrl, "utf8");
const begin = current.indexOf(beginMarker);
const end = current.indexOf(endMarker);

if (begin < 0 || end < 0 || end <= begin) {
  throw new Error(`Generated helper-reference markers are missing or out of order in ${referencePath}`);
}

const generated = renderHelperReferenceMarkdown();
const expected = `${current.slice(0, begin + beginMarker.length)}\n\n${generated}\n${current.slice(end)}`;

if (process.argv.includes("--check")) {
  if (current !== expected) {
    console.error(`Generated helper reference is stale: ${referencePath}`);
    process.exitCode = 1;
  }
} else if (current !== expected) {
  await writeFile(referenceUrl, expected);
}
