/**
 * Tests for GitHub template fetcher
 * Uses real HTTP server instead of mocks
 */

import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fetchGitHubTemplate } from '../src/github-fetcher.js';
import { WrapperTemplate } from '../src/types/wrapper.js';

describe('fetchGitHubTemplate', () => {
  let server: Server;
  let serverUrl: string;
  let requestHandler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;

  beforeEach((done) => {
    // Create real HTTP server
    server = createServer((req, res) => {
      if (requestHandler) {
        requestHandler(req, res);
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    server.listen(0, () => {
      const address = server.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterEach((done) => {
    requestHandler = null;
    server.close(() => {
      done();
    });
  });

  describe('GitHub reference parsing', () => {
    it('should parse basic owner/repo reference with default branch and path', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Test Template',
          description: 'A test template',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      };

      let requestPath = '';
      requestHandler = (req, res) => {
        requestPath = req.url || '';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      // Override fetch to use our test server
      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result: WrapperTemplate = await fetchGitHubTemplate('owner/repo');
        expect(requestPath).toBe('/template.json');
        expect(result).toEqual(mockTemplate);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should parse reference with custom branch', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Test Template',
          description: 'A test template',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      };

      let requestPath = '';
      requestHandler = (req, res) => {
        requestPath = req.url || '';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/develop', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result: WrapperTemplate = await fetchGitHubTemplate('owner/repo@develop');
        expect(requestPath).toBe('/template.json');
        expect(result).toEqual(mockTemplate);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should parse reference with custom path', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Test Template',
          description: 'A test template',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      };

      let requestPath = '';
      requestHandler = (req, res) => {
        requestPath = req.url || '';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result: WrapperTemplate = await fetchGitHubTemplate('owner/repo/templates/custom.json');
        expect(requestPath).toBe('/templates/custom.json');
        expect(result).toEqual(mockTemplate);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should parse reference with both custom branch and path', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Test Template',
          description: 'A test template',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      };

      let requestPath = '';
      requestHandler = (req, res) => {
        requestPath = req.url || '';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/feature-branch', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result = await fetchGitHubTemplate('owner/repo@feature-branch/config/template.json');
        expect(requestPath).toBe('/config/template.json');
        expect(result).toEqual(mockTemplate);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle deep nested paths', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Test Template',
          description: 'A test template',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      };

      let requestPath = '';
      requestHandler = (req, res) => {
        requestPath = req.url || '';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result = await fetchGitHubTemplate('owner/repo/path/to/nested/template.json');
        expect(requestPath).toBe('/path/to/nested/template.json');
        expect(result).toEqual(mockTemplate);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle branch names with hyphens and underscores', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Test Template',
          description: 'A test template',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      };

      requestHandler = (req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/feature-test_123', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result = await fetchGitHubTemplate('owner/repo@feature-test_123');
        expect(result).toEqual(mockTemplate);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('successful template fetching', () => {
    it('should fetch and validate a valid template', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'GitHub MCP',
          description: 'Official GitHub MCP server',
          version: '1.0.0',
          author: 'Anthropic'
        },
        name: 'github',
        transport: 'http',
        url: 'https://api.github.com',
        headers: {
          Authorization: 'token ${GITHUB_TOKEN}'
        },
        env: {
          GITHUB_TOKEN: '${GITHUB_TOKEN}'
        }
      };

      requestHandler = (req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/anthropic/mcp-templates/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result = await fetchGitHubTemplate('anthropic/mcp-templates');
        expect(result).toEqual(mockTemplate);
        expect(result.metadata.name).toBe('GitHub MCP');
        expect(result.transport).toBe('http');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should preserve environment variable placeholders', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Test Template',
          description: 'Template with env vars',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'http',
        url: 'https://api.example.com',
        headers: {
          Authorization: 'Bearer ${API_TOKEN}',
          'X-Custom': '${CUSTOM_HEADER}'
        },
        env: {
          API_TOKEN: '${API_TOKEN}',
          DATABASE_URL: '${DATABASE_URL}'
        }
      };

      requestHandler = (req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result = await fetchGitHubTemplate('owner/repo');
        expect(result.headers?.Authorization).toBe('Bearer ${API_TOKEN}');
        expect(result.headers?.['X-Custom']).toBe('${CUSTOM_HEADER}');
        expect(result.env?.API_TOKEN).toBe('${API_TOKEN}');
        expect(result.env?.DATABASE_URL).toBe('${DATABASE_URL}');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should include User-Agent header in request', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Test Template',
          description: 'A test template',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      };

      let receivedUserAgent = '';
      requestHandler = (req, res) => {
        receivedUserAgent = req.headers['user-agent'] || '';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        await fetchGitHubTemplate('owner/repo');
        expect(receivedUserAgent).toMatch(/MCP-Wrapper/);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error for 404 not found', async () => {
      requestHandler = (req, res) => {
        res.statusCode = 404;
        res.statusMessage = 'Not Found';
        res.end('Not Found');
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        await expect(fetchGitHubTemplate('owner/repo')).rejects.toThrow(
          'GitHub template not found: owner/repo (404 Not Found)'
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw descriptive error for network failures', async () => {
      const originalFetch = global.fetch;
      global.fetch = () => {
        return Promise.reject(new Error('Network error'));
      };

      try {
        await expect(fetchGitHubTemplate('owner/repo')).rejects.toThrow(
          'Failed to fetch GitHub template: Network error'
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw descriptive error for invalid JSON', async () => {
      requestHandler = (req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end('<html>Not JSON</html>');
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        await expect(fetchGitHubTemplate('owner/repo')).rejects.toThrow('Invalid JSON in GitHub template');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw descriptive error for template validation failures', async () => {
      const invalidTemplate = {
        // Missing metadata
        name: 'test-server',
        transport: 'stdio'
        // Missing required command for stdio
      };

      requestHandler = (req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(invalidTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        await expect(fetchGitHubTemplate('owner/repo')).rejects.toThrow('Invalid wrapper template');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle other HTTP error codes', async () => {
      requestHandler = (req, res) => {
        res.statusCode = 500;
        res.statusMessage = 'Internal Server Error';
        res.end('Internal Server Error');
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        await expect(fetchGitHubTemplate('owner/repo')).rejects.toThrow(
          'GitHub template not found: owner/repo (500 Internal Server Error)'
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle rate limiting (403)', async () => {
      requestHandler = (req, res) => {
        res.statusCode = 403;
        res.statusMessage = 'Forbidden';
        res.end('Forbidden');
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        await expect(fetchGitHubTemplate('owner/repo')).rejects.toThrow(
          'GitHub template not found: owner/repo (403 Forbidden)'
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw error for invalid reference format (no owner)', async () => {
      await expect(fetchGitHubTemplate('repo')).rejects.toThrow('Invalid GitHub reference format');
    });

    it('should throw error for empty reference', async () => {
      await expect(fetchGitHubTemplate('')).rejects.toThrow('Invalid GitHub reference format');
    });

    it('should throw error for invalid reference with only slash', async () => {
      await expect(fetchGitHubTemplate('/')).rejects.toThrow('Invalid GitHub reference format');
    });
  });

  describe('edge cases', () => {
    it('should handle template with minimal metadata', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Minimal',
          description: 'Minimal template',
          version: '1.0.0'
          // No author
        },
        name: 'minimal-server',
        transport: 'stdio',
        command: 'node',
        args: ['index.js']
      };

      requestHandler = (req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result = await fetchGitHubTemplate('owner/repo');
        expect(result).toEqual(mockTemplate);
        expect(result.metadata.author).toBeUndefined();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle HTTP template with headers', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'HTTP Template',
          description: 'Template with HTTP transport',
          version: '1.0.0'
        },
        name: 'http-server',
        transport: 'http',
        url: 'https://api.example.com',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json'
        }
      };

      requestHandler = (req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result = await fetchGitHubTemplate('owner/repo');
        expect(result).toEqual(mockTemplate);
        expect(result.headers).toEqual({
          Authorization: 'Bearer token',
          'Content-Type': 'application/json'
        });
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle template with system prompt configuration', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Template with Prompt',
          description: 'Template with system prompt',
          version: '1.0.0'
        },
        name: 'prompt-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        systemPrompt: {
          type: 'text',
          content: 'You are a helpful assistant.'
        }
      };

      requestHandler = (req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner/repo/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result = await fetchGitHubTemplate('owner/repo');
        expect(result).toEqual(mockTemplate);
        expect(result.systemPrompt).toEqual({
          type: 'text',
          content: 'You are a helpful assistant.'
        });
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle special characters in owner and repo names', async () => {
      const mockTemplate: WrapperTemplate = {
        metadata: {
          name: 'Test Template',
          description: 'A test template',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      };

      let requestPath = '';
      requestHandler = (req, res) => {
        requestPath = req.url || '';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockTemplate));
      };

      const originalFetch = global.fetch;
      global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        const path = urlString.replace('https://raw.githubusercontent.com/owner-123/repo_name/main', '');
        const response = await originalFetch(`${serverUrl}${path}`, init);
        return response;
      };

      try {
        const result = await fetchGitHubTemplate('owner-123/repo_name');
        expect(requestPath).toBe('/template.json');
        expect(result).toEqual(mockTemplate);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
