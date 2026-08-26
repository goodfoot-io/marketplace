#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile, chmod } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse --outdir argument
let outdir = join(__dirname, '../../plugins-claude/goodfoot/bin');
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--outdir=')) {
    outdir = arg.slice('--outdir='.length);
    if (!outdir.startsWith('/')) {
      outdir = join(__dirname, outdir);
    }
  }
}

const entryPoints = [
  { in: 'src/metrics.ts', out: 'typescript-metrics' }
];

await esbuild.build({
  entryPoints: entryPoints.map((e) => ({
    in: join(__dirname, e.in),
    out: e.out
  })),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outdir: outdir,
  outExtension: { '.js': '.mjs' },
  external: [],
  minify: false,
  treeShaking: true,
  preserveSymlinks: true,
  logLevel: 'info',
  banner: {
    js: `import { createRequire as __banner_createRequire } from 'node:module';import { fileURLToPath as __banner_fileURLToPath } from 'node:url';import { dirname as __banner_dirname } from 'node:path';const require = __banner_createRequire(import.meta.url);const __filename = __banner_fileURLToPath(import.meta.url);const __dirname = __banner_dirname(__filename);`
  }
});

// Add shebangs to all output files
for (const entry of entryPoints) {
  const outputPath = join(outdir, entry.out + '.mjs');
  let content = await readFile(outputPath, 'utf-8');

  // Remove any existing shebangs
  content = content.replace(/^#!\/usr\/bin\/env[^\n]*\n/gm, '');

  // Add shebang at the top
  content = '#!/usr/bin/env node\n' + content;

  await writeFile(outputPath, content, 'utf-8');

  // Make executable
  await chmod(outputPath, 0o755);

  console.log(`Created ${entry.out}.mjs at ${outputPath}`);
}
