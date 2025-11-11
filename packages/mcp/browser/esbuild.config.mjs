#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Build chrome-proxy as a standalone bundle
await esbuild.build({
  entryPoints: [join(__dirname, 'src/chrome-proxy.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: join(__dirname, 'build/bundle/chrome-proxy.mjs'),
  external: [],
  minify: false,
  sourcemap: 'inline',
  treeShaking: true,
  logLevel: 'info'
});

// Post-process: Add shebang and remove source shebang comments
const bundlePath = join(__dirname, 'build/bundle/chrome-proxy.mjs');
let content = await readFile(bundlePath, 'utf-8');

// Remove any existing shebangs in the bundle content
content = content.replace(/^#!\/usr\/bin\/env node\n/gm, '');

// Add single shebang at the top
content = '#!/usr/bin/env node\n' + content;

await writeFile(bundlePath, content, 'utf-8');

console.log('✓ chrome-proxy standalone bundle created at build/bundle/chrome-proxy.mjs');
