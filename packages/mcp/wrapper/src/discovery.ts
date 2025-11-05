/**
 * Tool discovery system with caching
 */

import type { ServerConfig, AggregatedTools } from './types/wrapper.js';

/**
 * Discover tools from wrapped MCP servers
 */
export function discoverTools(_configs: ServerConfig[]): Promise<AggregatedTools> {
  // Implementation will be added in subsequent tasks
  return Promise.resolve({
    allTools: [],
    allowedTools: [],
    description: 'Multi-tool agent (no tools discovered yet)'
  });
}
