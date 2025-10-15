#!/usr/bin/env node

const { build } = require('esbuild');
const path = require('path');
const fs = require('fs');

const scripts = [
  {
    name: 'print-dependencies',
    entry: './bin/print-dependencies.ts',
    outfile: './dist/print-dependencies.js'
  },
  {
    name: 'print-filesystem', 
    entry: './bin/print-filesystem.ts',
    outfile: './dist/print-filesystem.js'
  },
  {
    name: 'print-inverse-dependencies',
    entry: './bin/print-inverse-dependencies.ts',
    outfile: './dist/print-inverse-dependencies.js'
  },
  {
    name: 'print-similar-sections',
    entry: './bin/print-similar-sections.ts',
    outfile: './dist/print-similar-sections.js'
  }
];

async function bundleScript(script) {
  console.log(`Bundling ${script.name}...`);
  
  try {
    await build({
      entryPoints: [script.entry],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: script.outfile,
      format: 'cjs',
      minify: false,
      sourcemap: false,
      define: {
        'process.env.PROJECT_CWD': 'undefined'
      },
      // Mark Node.js built-ins and problematic dependencies as external
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
        // Vue compiler template engines (not needed for our tools)
        'velocityjs',
        'dustjs-linkedin',
        'atpl',
        'liquor',
        'twig',
        'eco',
        'jazz',
        'jqtpl',
        'hamljs',
        'hamlet',
        'haml-coffee',
        'whiskers',
        'coffee-script',
        'hogan.js',
        'templayed',
        'handlebars',
        'underscore',
        // 'lodash', // Don't mark lodash as external - it's needed by glob-gitignore
        'walrus',
        'mustache',
        'just',
        'ect',
        'mote',
        'toffee',
        'dot',
        'bracket-template',
        'ractive',
        'htmling',
        'babel-core',
        'plates',
        'vash',
        'slm',
        'marko',
        'teacup/lib/express',
        'squirrelly',
        'twing',
        'react',
        'react-dom/server'
      ],
      banner: {
        js: '#!/usr/bin/env node'
      }
    });
    
    // Post-process to remove duplicate shebang
    let content = fs.readFileSync(script.outfile, 'utf8');
    // Remove the original tsx shebang if present
    if (content.startsWith('#!/usr/bin/env tsx\n')) {
      content = content.replace('#!/usr/bin/env tsx\n', '');
      fs.writeFileSync(script.outfile, content);
    }
    
    // Make the output file executable
    fs.chmodSync(script.outfile, '755');
    
    console.log(`✓ Bundled ${script.name} to ${script.outfile}`);
  } catch (error) {
    console.error(`✗ Failed to bundle ${script.name}:`, error);
    process.exit(1);
  }
}

async function main() {
  // Ensure dist directory exists
  if (!fs.existsSync('./dist')) {
    fs.mkdirSync('./dist');
  }
  
  // Bundle all scripts
  for (const script of scripts) {
    await bundleScript(script);
  }
  
  console.log('\n✓ All scripts bundled successfully!');
  console.log('\nBundled executables are in ./dist/');
  console.log('You can copy these anywhere and run them with just Node.js installed.');
}

main().catch(console.error);