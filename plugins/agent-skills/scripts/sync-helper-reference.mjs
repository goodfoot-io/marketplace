import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderHelperReferenceMarkdown } from "@goodfoot/agent-skills/helper-reference";

// The source template, not the generated tree. `plugins/agent-skills/skills/`
// is agent-skills bundler output, and the build swaps that whole directory: a
// splice into it is discarded by the next build, while a splice after a build
// mutates generated output and reads as drift. Splicing into the template
// instead makes `sync; build` the only meaningful order, so the build stays
// reproducible and `--check` measures template freshness rather than a race.
const referenceUrl = new URL(
  "../../../skills-src/agent-skills/reference/helper-reference.md.eta",
  import.meta.url,
);
const referencePath = fileURLToPath(referenceUrl);
const beginMarker = "<!-- BEGIN GENERATED AGENT-SKILLS HELPER REFERENCE -->";
const endMarker = "<!-- END GENERATED AGENT-SKILLS HELPER REFERENCE -->";
const beginRanges = "  # BEGIN GENERATED AGENT-SKILLS SUPPRESSION RANGES";
const endRanges = "  # END GENERATED AGENT-SKILLS SUPPRESSION RANGES";

// Rules the generated table necessarily trips: it names every platform's root
// variable, conventions file, and agent-reference dialect because cataloguing
// them is its subject. Nothing hand-authored reaches these rows, so the range
// covers the table rather than individual rows — a new helper shifts the rows
// but not the fact that the whole table is machine-generated. A helper that
// trips some further rule fails lint rather than passing silently.
const generatedRules = ["cross-dialect-reference", "literal-platform-prose", "plugin-root-variable"];

const spliceBetween = (content, open, close, replacement, label) => {
  const begin = content.indexOf(open);
  const end = content.indexOf(close);
  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error(`${label} markers are missing or out of order in ${referencePath}`);
  }
  return `${content.slice(0, begin + open.length)}\n${replacement}${content.slice(end)}`;
};

const current = await readFile(referenceUrl, "utf8");
const generated = renderHelperReferenceMarkdown();
const withTable = spliceBetween(current, beginMarker, endMarker, `\n${generated}\n`, "Generated helper-reference");

// Lint suppression lines are body-relative: the front-config is stripped before
// the body is numbered, so the block emitted here cannot shift the range it
// describes no matter how many entries it holds.
const frontConfigEnd = withTable.indexOf("-->");
if (frontConfigEnd < 0) throw new Error(`Front-config is missing in ${referencePath}`);
const body = withTable.slice(frontConfigEnd + "-->".length);
// The marker's own line, then the blank line the splice keeps after it.
const tableStart = body.slice(0, body.indexOf(beginMarker)).split("\n").length + 2;
const tableEnd = tableStart + generated.trimEnd().split("\n").length - 1;

const ranges = generatedRules
  .map((rule) => `  - rule: ${rule}\n    lines: [${tableStart}, ${tableEnd}]\n`)
  .join("");
const expected = spliceBetween(withTable, beginRanges, endRanges, ranges, "Generated suppression-range");

if (process.argv.includes("--check")) {
  if (current !== expected) {
    console.error(`Generated helper reference is stale: ${referencePath}`);
    process.exitCode = 1;
  }
} else if (current !== expected) {
  await writeFile(referenceUrl, expected);
}
