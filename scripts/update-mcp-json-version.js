#!/usr/bin/env node

/**
 * Updates package version references in .mcp.json files
 * Usage: node update-mcp-json-version.js <mcp-file-path> <package-name> <version> <temp-file-path>
 */

const fs = require('fs');

const [, , filePath, packageName, version, tempFile] = process.argv;

if (!filePath || !packageName || !version || !tempFile) {
  console.error('Usage: node update-mcp-json-version.js <mcp-file-path> <package-name> <version> <temp-file-path>');
  process.exit(2);
}

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(content);

  let modified = false;

  // Update mcpServers args arrays
  if (json.mcpServers) {
    for (const [key, server] of Object.entries(json.mcpServers)) {
      if (server.args && Array.isArray(server.args)) {
        for (let i = 0; i < server.args.length; i++) {
          const arg = server.args[i];
          // Match package name with @latest or @version pattern
          const regex = new RegExp(`^${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(@latest|@[0-9]+\\.[0-9]+\\.[0-9]+)?$`);
          if (regex.test(arg)) {
            server.args[i] = `${packageName}@${version}`;
            modified = true;
          }
        }
      }
    }
  }

  if (modified) {
    // Write with proper formatting (2 space indentation)
    fs.writeFileSync(tempFile, JSON.stringify(json, null, 2) + '\n', 'utf8');
    process.exit(0);
  } else {
    process.exit(1);
  }
} catch (error) {
  console.error('Error processing JSON:', error.message);
  process.exit(2);
}
