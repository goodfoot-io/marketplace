import { build, type BuildOptions } from 'esbuild';
import * as path from 'node:path';
import * as fs from 'node:fs';

interface Script {
  name: string;
  entry: string;
  outfile: string;
}

const scripts: Script[] = [
  {
    name: 'append-server',
    entry: './src/append.ts',
    outfile: './dist/append-server.js'
  },
  {
    name: 'codebase-server',
    entry: './src/codebase.ts',
    outfile: './dist/codebase-server.js'
  },
  {
    name: 'test-agent-server',
    entry: './src/test-agent.ts',
    outfile: './dist/test-agent-server.js'
  },
  {
    name: 'browser-server',
    entry: './src/browser.ts',
    outfile: './dist/browser-server.js'
  }
];

async function bundleScript(script: Script): Promise<void> {
  console.log(`Bundling ${script.name}...`);

  try {
    const buildOptions: BuildOptions = {
      entryPoints: [script.entry],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: script.outfile,
      format: 'esm',
      minify: false,
      sourcemap: false,
      banner: {
        js: '#!/usr/bin/env node'
      },
      // Mark only Node.js built-ins as external, bundle all third-party dependencies
      external: [
        'fs',
        'fs/promises',
        'path',
        'child_process',
        'util',
        'os',
        'crypto',
        'stream',
        'events',
        'http',
        'https',
        'url',
        'querystring',
        'zlib',
        'assert',
        'buffer',
        'process',
        'node:fs',
        'node:fs/promises',
        'node:path',
        'node:child_process',
        'node:util',
        'node:os',
        'node:crypto',
        'node:stream',
        'node:events',
        'node:http',
        'node:https',
        'node:url',
        'node:querystring',
        'node:zlib',
        'node:assert',
        'node:buffer',
        'node:process',
        '@anthropic-ai/claude-code'
      ]
    };

    await build(buildOptions);

    // Post-process the bundled file
    let bundledContent = await fs.promises.readFile(script.outfile, 'utf8');

    // Remove duplicate shebangs (keep only the first one)
    const lines = bundledContent.split('\n');
    const filteredLines = [];
    let shebangFound = false;

    for (const line of lines) {
      if (line.startsWith('#!/usr/bin/env')) {
        if (!shebangFound) {
          filteredLines.push(line);
          shebangFound = true;
        }
        // Skip duplicate shebangs
      } else {
        filteredLines.push(line);
      }
    }

    bundledContent = filteredLines.join('\n');

    // Replace the conditional startup with unconditional startup
    bundledContent = bundledContent.replace(
      /if \(import\.meta\.url === `file:\/\/\$\{process\.argv\[1\]\}`\) \{[\s\S]*?\n\}\n/,
      '// Auto-start server when bundled\nstartServer().catch((error) => { console.error("Failed to start server:", error); process.exit(1); });\n'
    );

    await fs.promises.writeFile(script.outfile, bundledContent);

    // Make the output file executable
    await fs.promises.chmod(script.outfile, '755');

    console.log(`✓ Bundled ${script.name} to ${script.outfile}`);
  } catch (error) {
    console.error(`✗ Failed to bundle ${script.name}:`, error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  // Ensure dist directory exists
  if (!fs.existsSync('./dist')) {
    await fs.promises.mkdir('./dist');
  }

  // Bundle all scripts
  for (const script of scripts) {
    await bundleScript(script);
  }

  console.log('\n✓ All scripts bundled successfully!');
  console.log('\nBundled executables are in ./dist/');
  console.log('You can run the servers with:');
  console.log('  - Append server: ./dist/append-server.js');
  console.log('  - Codebase server: ./dist/codebase-server.js');
  console.log('  - Test Agent server: ./dist/test-agent-server.js');
  console.log('  - Browser server: ./dist/browser-server.js');
}

main().catch(console.error);
