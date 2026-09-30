import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Bundling the CommonJS TypeScript 6 API into an ESM hook leaves references
// to Node's CommonJS globals. Initialize them before that dependency loads.
const runtime = globalThis as typeof globalThis & {
  require?: NodeRequire;
  __filename?: string;
  __dirname?: string;
};
runtime.require ??= createRequire(import.meta.url);
runtime.__filename ??= fileURLToPath(import.meta.url);
runtime.__dirname ??= path.dirname(runtime.__filename);
