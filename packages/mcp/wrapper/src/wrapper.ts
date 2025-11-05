#!/usr/bin/env node
/**
 * MCP wrapper server - Generic wrapper for multiple MCP servers with dynamic tool discovery
 */

import type { ServerConfig } from './types/wrapper.js';

/**
 * Parse CLI arguments to extract multiple wrapped server configurations
 *
 * Expected format:
 *   -- server-name --transport stdio|http <args...> -- next-server ...
 *
 * Examples:
 *   -- clickup --transport stdio npx -y @hauptsache.net/clickup-mcp
 *   -- hugging-face --transport http https://huggingface.co/mcp
 *   -- hf --transport http https://huggingface.co/mcp -- clickup --transport stdio npx -y @hauptsache.net/clickup-mcp
 *
 * @param argv - Process arguments (typically process.argv)
 * @returns Array of ServerConfig objects
 * @throws Error if arguments are invalid or no servers configured
 */
export function parseCliArguments(argv: string[]): ServerConfig[] {
  // Find where the first "--" separator starts (after script name)
  const firstSeparatorIndex = argv.indexOf('--');

  if (firstSeparatorIndex === -1) {
    throw new Error(
      'No server configurations provided. Expected format: -- <server-name> --transport stdio|http <args...>'
    );
  }

  // Extract everything after the first "--"
  const allArgs = argv.slice(firstSeparatorIndex + 1);

  // Split by "--" to get individual server configurations
  const serverGroups: string[][] = [];
  let currentGroup: string[] = [];

  for (const arg of allArgs) {
    if (arg === '--') {
      if (currentGroup.length > 0) {
        serverGroups.push(currentGroup);
        currentGroup = [];
      }
    } else {
      currentGroup.push(arg);
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    serverGroups.push(currentGroup);
  }

  if (serverGroups.length === 0) {
    throw new Error(
      'No server configurations provided. Expected format: -- <server-name> --transport stdio|http <args...>'
    );
  }

  // Parse each server group
  const configs: ServerConfig[] = [];

  for (const group of serverGroups) {
    if (group.length === 0) {
      continue;
    }

    // First arg is the server name
    const name = group[0];
    if (!name) {
      throw new Error('Server name is required as first argument after "--"');
    }

    // Server name cannot start with "--" (it's not a flag)
    if (name.startsWith('--')) {
      throw new Error(`Server name cannot start with "--". Received: "${name}"`);
    }

    // Find --transport flag (default to stdio if not specified)
    const transportIndex = group.indexOf('--transport');
    let transport: 'stdio' | 'http' = 'stdio';
    let remainingArgs: string[];

    if (transportIndex !== -1) {
      // Transport flag found
      if (transportIndex + 1 >= group.length) {
        throw new Error(`Server "${name}": --transport flag requires a value (stdio or http)`);
      }

      const transportValue = group[transportIndex + 1];
      if (transportValue !== 'stdio' && transportValue !== 'http') {
        throw new Error(`Server "${name}": Invalid transport type "${transportValue}". Expected "stdio" or "http"`);
      }

      transport = transportValue;

      // Remaining args are everything after the transport value
      remainingArgs = group.slice(transportIndex + 2);
    } else {
      // No transport flag, everything after name is args (default to stdio)
      remainingArgs = group.slice(1);
    }

    // Build config based on transport type
    if (transport === 'stdio') {
      // For stdio: first remaining arg is command, rest are args
      if (remainingArgs.length === 0) {
        throw new Error(`Server "${name}": stdio transport requires at least a command`);
      }

      const command = remainingArgs[0];
      const args = remainingArgs.slice(1);

      configs.push({
        name,
        transport: 'stdio',
        command,
        args
      });
    } else {
      // For HTTP: remaining arg should be a URL
      if (remainingArgs.length === 0) {
        throw new Error(`Server "${name}": http transport requires a URL`);
      }

      const url = remainingArgs[0];

      // Basic URL validation
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error(`Server "${name}": Invalid URL "${url}". Must start with http:// or https://`);
      }

      configs.push({
        name,
        transport: 'http',
        url
      });
    }
  }

  if (configs.length === 0) {
    throw new Error('No valid server configurations parsed');
  }

  return configs;
}

/**
 * Main entry point for the wrapper server
 */
export async function main(): Promise<void> {
  console.error('MCP wrapper server starting...');

  const configs = parseCliArguments(process.argv);
  console.error(`Parsed ${configs.length} server configuration(s):`, JSON.stringify(configs, null, 2));
  // Implementation will be added in subsequent tasks

  await Promise.resolve(); // Placeholder to satisfy async requirement
}

// Auto-start when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
