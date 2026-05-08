#!/usr/bin/env node
import * as esbuild from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFile, writeFile, chmod } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const outdir = join(__dirname, "../../plugins/voice/bin");

const entryPoints = [
  { in: "src/cli/index.ts", out: "voice" },
  { in: "src/cli/daemon.ts", out: "daemon" },
];

await esbuild.build({
  entryPoints: entryPoints.map((e) => ({ in: join(__dirname, e.in), out: e.out })),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outdir,
  outExtension: { ".js": ".mjs" },
  minify: false,
  treeShaking: true,
  loader: { ".html": "text" },
  logLevel: "info",
  banner: {
    js: `import { createRequire as __banner_createRequire } from 'node:module';import { fileURLToPath as __banner_fileURLToPath } from 'node:url';import { dirname as __banner_dirname } from 'node:path';const require = __banner_createRequire(import.meta.url);const __filename = __banner_fileURLToPath(import.meta.url);const __dirname = __banner_dirname(__filename);`,
  },
});

for (const entry of entryPoints) {
  const outputPath = join(outdir, entry.out + ".mjs");
  let content = await readFile(outputPath, "utf-8");
  content = content.replace(/^#!\/usr\/bin\/env[^\n]*\n/gm, "");
  content = "#!/usr/bin/env node\n" + content;
  await writeFile(outputPath, content, "utf-8");
  await chmod(outputPath, 0o755);
  console.log(`Built ${entry.out}.mjs → ${outputPath}`);
}
