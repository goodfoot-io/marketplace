/**
 * Yarn serializes a single matching bin as a string during installation, while
 * npm expects the explicit map at publish time. Normalize only in npm's
 * prepublishOnly lifecycle, before its final manifest validation and packing.
 * Ordinary builds and yarn pack must not rewrite the checked-in manifest.
 */
import { readFileSync, writeFileSync } from "node:fs";

const manifestPath = "package.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const target = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.["agent-hooks"];
if (manifest.name !== "@goodfoot/agent-hooks" || target !== "dist/cli.js") {
  throw new Error("Refusing to publish: unexpected agent-hooks CLI entry point");
}
if (manifest.publishConfig?.bin !== undefined) {
  throw new Error("Refusing to publish: publishConfig.bin is not supported by npm");
}
manifest.bin = {
  ...(typeof manifest.bin === "object" ? manifest.bin : {}),
  "agent-hooks": target,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
