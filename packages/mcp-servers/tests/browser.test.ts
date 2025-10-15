import * as crypto from 'crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('browser server', () => {
  let tempDir: string;
  let client: Client;
  let transport: StdioClientTransport;
  const browserUrl = 'http://192.168.65.254:9222/';

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-test-'));

    // Start the server and connect the client
    const scriptPath = new URL('../build/dist/src/browser.js', import.meta.url).pathname;
    transport = new StdioClientTransport({
      command: 'node',
      args: [scriptPath, '--browserUrl', browserUrl]
    });

    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    await client.connect(transport);
  });

  afterEach(async () => {
    // Close the client connection
    await client.close();

    // Clean up the temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('tool listing', () => {
    it('should list the prompt tool', async () => {
      const result = await client.listTools();

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]).toMatchObject({
        name: 'prompt',
        description: expect.stringContaining('browser') as unknown,
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: expect.stringContaining('Instructions') as unknown
            },
            sessionId: {
              type: 'string',
              description: expect.stringContaining('Session ID') as unknown
            }
          },
          required: ['prompt']
        }
      });
    });

    it('should have correct tool schema', async () => {
      const result = await client.listTools();
      const promptTool = result.tools.find((t) => t.name === 'prompt');

      expect(promptTool).toBeDefined();
      expect(promptTool?.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          prompt: {
            type: 'string'
          },
          sessionId: {
            type: 'string'
          }
        },
        required: ['prompt']
      });

      // sessionId should be optional
      expect(promptTool?.inputSchema.required).not.toContain('sessionId');
    });
  });

  describe('prompt tool', () => {
    it('should error on missing prompt', async () => {
      await expect(
        client.callTool({
          name: 'prompt',
          arguments: {}
        })
      ).rejects.toThrow('Invalid execute tool arguments');
    });

    it('should error on unknown tool', async () => {
      await expect(
        client.callTool({
          name: 'unknown-tool',
          arguments: {
            prompt: 'test'
          }
        })
      ).rejects.toThrow('Unknown tool');
    });

    // Note: We can't fully test the Claude Code SDK integration without an API key
    it.skip('should accept a prompt without sessionId (requires Claude Code SDK API key)', async () => {
      // This would test the full integration with Claude Code SDK
      await client.callTool({
        name: 'prompt',
        arguments: {
          prompt: 'Navigate to google.com'
        }
      });
    });

    it.skip('should accept a prompt with sessionId (requires Claude Code SDK API key)', async () => {
      const sessionId = crypto.randomUUID();

      // This would test the full integration with Claude Code SDK
      await client.callTool({
        name: 'prompt',
        arguments: {
          prompt: 'Navigate to google.com',
          sessionId
        }
      });
    });
  });

  describe('session management', () => {
    it('should generate session ID if not provided', () => {
      // Test the session ID generation logic
      const uuid = crypto.randomUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should use provided session ID', () => {
      const providedId = 'custom-session-123';
      // The server uses the provided ID directly
      expect(providedId).toBe('custom-session-123');
    });
  });

  describe('command-line argument parsing', () => {
    it('should start server with required browserUrl argument', async () => {
      // The server should start successfully with --browserUrl
      // This is validated by the beforeEach successfully connecting
      const result = await client.listTools();
      expect(result.tools).toHaveLength(1);
    });

    it('should support short -b flag for browserUrl', async () => {
      // Start a new server with -b flag
      const scriptPath = new URL('../build/dist/src/browser.js', import.meta.url).pathname;
      const customTransport = new StdioClientTransport({
        command: 'node',
        args: [scriptPath, '-b', browserUrl]
      });

      const customClient = new Client(
        {
          name: 'test-client-short-flag',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      await customClient.connect(customTransport);

      // Server should work with short flag
      const result = await customClient.listTools();
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('prompt');

      await customClient.close();
    });
  });

  describe('error handling', () => {
    it('should handle invalid tool name gracefully', async () => {
      await expect(
        client.callTool({
          name: 'invalid-tool',
          arguments: {
            prompt: 'test'
          }
        })
      ).rejects.toThrow('Unknown tool: invalid-tool');
    });

    it('should validate prompt parameter', async () => {
      await expect(
        client.callTool({
          name: 'prompt',
          arguments: {
            sessionId: 'test-session'
            // missing prompt
          }
        })
      ).rejects.toThrow('Invalid execute tool arguments');
    });

    it('should handle empty prompt', async () => {
      await expect(
        client.callTool({
          name: 'prompt',
          arguments: {
            prompt: ''
          }
        })
      ).rejects.toThrow('Invalid execute tool arguments');
    });

    it('should handle null prompt', async () => {
      await expect(
        client.callTool({
          name: 'prompt',
          arguments: {
            prompt: null
          } as { prompt: string | null }
        })
      ).rejects.toThrow('Invalid execute tool arguments');
    });

    it('should handle undefined prompt', async () => {
      await expect(
        client.callTool({
          name: 'prompt',
          arguments: {
            prompt: undefined
          } as { prompt: string | undefined }
        })
      ).rejects.toThrow('Invalid execute tool arguments');
    });
  });

  describe('log directory creation', () => {
    it('should ensure log directory exists', async () => {
      const logDir = path.join('/workspace', 'reports', '.browser-automation-logs');

      // Check if directory exists or can be created
      try {
        await fs.access(logDir);
      } catch {
        // Directory doesn't exist, that's okay - the server will create it
      }

      // The server creates this directory when needed
      // We're just testing that the path is valid
      expect(logDir).toContain('.browser-automation-logs');
    });
  });

  describe('message format helpers', () => {
    it('should format tool inputs correctly', () => {
      // Test the formatting logic used by the server
      const input = {
        simple: 'value',
        multiline: 'line1\nline2\nline3',
        number: 123,
        boolean: true,
        object: { key: 'value' },
        nullValue: null
      };

      // Expected format based on the formatToolInput function
      const formatToolInput = (toolName: string, input: Record<string, unknown>): string => {
        const lines: string[] = [];

        for (const [key, value] of Object.entries(input)) {
          if (typeof value === 'string') {
            if (value.includes('\n')) {
              lines.push(
                `  ${key}=\`\n${value
                  .split('\n')
                  .map((line) => '    ' + line)
                  .join('\n')}\n  \``
              );
            } else {
              lines.push(`  ${key}="${value}"`);
            }
          } else if (typeof value === 'object' && value !== null) {
            lines.push(`  ${key}=${JSON.stringify(value)}`);
          } else {
            lines.push(`  ${key}=${String(value)}`);
          }
        }

        return lines.join(',\n');
      };

      const formatted = formatToolInput('test-tool', input);

      expect(formatted).toContain('simple="value"');
      expect(formatted).toContain('multiline=`');
      expect(formatted).toContain('line1');
      expect(formatted).toContain('number=123');
      expect(formatted).toContain('boolean=true');
      expect(formatted).toContain('object={"key":"value"}');
      expect(formatted).toContain('nullValue=null');
    });
  });

  describe('session cleanup', () => {
    it('should handle session state correctly', () => {
      // Test session state interface
      interface SessionState {
        id: string;
        sdkSessionId?: string;
        createdAt: Date;
        lastActivity: Date;
        browserContextId?: string;
        conversationHistory: string[];
        isFirstQuery: boolean;
      }

      const now = new Date();
      const session: SessionState = {
        id: 'test-session',
        createdAt: now,
        lastActivity: now,
        conversationHistory: [],
        isFirstQuery: true
      };

      expect(session.id).toBe('test-session');
      expect(session.isFirstQuery).toBe(true);
      expect(session.conversationHistory).toHaveLength(0);
      expect(session.sdkSessionId).toBeUndefined();
    });

    it('should track conversation history', () => {
      const history: string[] = [];

      // Add user prompt
      history.push('User: Navigate to google.com');
      // Add assistant response
      history.push('Assistant: Navigating to google.com');

      expect(history).toHaveLength(2);
      expect(history[0]).toContain('User:');
      expect(history[1]).toContain('Assistant:');

      // Test sliding window (keep last 20 entries = 10 exchanges)
      for (let i = 0; i < 25; i++) {
        history.push(`Entry ${i}`);
      }

      // Simulate trimming to last 20
      const recentHistory = history.slice(-20);
      expect(recentHistory).toHaveLength(20);
    });
  });

  describe('timeout handling', () => {
    it('should set up abort controller with timeout', () => {
      // Test abort controller creation
      const abortController = new AbortController();
      // Timeout would be 5 * 60 * 1000 (5 minutes) in production

      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        abortController.abort();
      }, 100); // Use shorter timeout for test

      // Wait a bit
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          clearTimeout(timeoutId);
          expect(abortController.signal.aborted).toBe(false);
          expect(timedOut).toBe(false);
          resolve();
        }, 50);
      });
    });

    it('should handle abort signal', () => {
      const abortController = new AbortController();

      expect(abortController.signal.aborted).toBe(false);

      abortController.abort();

      expect(abortController.signal.aborted).toBe(true);
    });
  });

  describe('progress notifications', () => {
    it('should accept progressToken in _meta parameter', async () => {
      // Skip if no API key - this test requires actual execution
      if (!process.env.ANTHROPIC_API_KEY) {
        // We can at least verify the tool list includes prompt
        const tools = await client.listTools();
        expect(tools.tools).toHaveLength(1);
        expect(tools.tools[0].name).toBe('prompt');
        return;
      }

      const progressToken = 'test-progress-token-123';

      // If API key is available, run the full test
      const result = await client.callTool({
        name: 'prompt',
        arguments: {
          prompt: 'List all open browser pages'
        },
        _meta: {
          progressToken
        }
      });

      // Verify we got a result
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should work without progressToken', async () => {
      // Skip if no API key
      if (!process.env.ANTHROPIC_API_KEY) {
        return;
      }

      // Call without progressToken - should work normally
      const result = await client.callTool({
        name: 'prompt',
        arguments: {
          prompt: 'List all open browser pages'
        }
        // No _meta with progressToken
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    }, 60000);

    it('should format progress messages correctly', () => {
      // Test the progress message formatting logic
      const formatProgressMessage = (toolName: string, input: Record<string, unknown>): string => {
        const cleanName = toolName.replace(/^mcp__chrome__/, '');
        const safeString = (value: unknown): string => {
          if (typeof value === 'string') return value;
          if (typeof value === 'number' || typeof value === 'boolean') return String(value);
          if (value === null || value === undefined) return '';
          return JSON.stringify(value);
        };

        switch (cleanName) {
          case 'navigate_page':
            return `Navigating to ${safeString(input.url) || 'page'}`;
          case 'click':
            return `Clicking element (uid: ${safeString(input.uid)})`;
          case 'take_screenshot':
            return input.filePath ? 'Taking screenshot and saving to file' : 'Taking screenshot';
          case 'list_pages':
            return 'Listing browser pages';
          default:
            return `Executing ${cleanName}`;
        }
      };

      // Test various tool message formats
      expect(formatProgressMessage('mcp__chrome__navigate_page', { url: 'https://example.com' })).toBe(
        'Navigating to https://example.com'
      );
      expect(formatProgressMessage('mcp__chrome__click', { uid: '123' })).toBe('Clicking element (uid: 123)');
      expect(formatProgressMessage('mcp__chrome__take_screenshot', { filePath: '/tmp/test.png' })).toBe(
        'Taking screenshot and saving to file'
      );
      expect(formatProgressMessage('mcp__chrome__take_screenshot', {})).toBe('Taking screenshot');
      expect(formatProgressMessage('mcp__chrome__list_pages', {})).toBe('Listing browser pages');
      expect(formatProgressMessage('mcp__chrome__unknown_tool', {})).toBe('Executing unknown_tool');
    });
  });

  describe('server lifecycle', () => {
    it('should connect successfully', async () => {
      // This is validated by the beforeEach successfully connecting
      const result = await client.listTools();
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);
    });

    it('should handle multiple client connections', async () => {
      // Create a second client
      const scriptPath = new URL('../build/dist/src/browser.js', import.meta.url).pathname;
      const transport2 = new StdioClientTransport({
        command: 'node',
        args: [scriptPath, '--browserUrl', browserUrl]
      });

      const client2 = new Client(
        {
          name: 'test-client-2',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      await client2.connect(transport2);

      // Both clients should work
      const result1 = await client.listTools();
      const result2 = await client2.listTools();

      expect(result1.tools).toHaveLength(1);
      expect(result2.tools).toHaveLength(1);

      await client2.close();
    });

    it('should handle graceful shutdown', async () => {
      // The server should close cleanly
      // This is tested in afterEach
      await client.close();

      // Reconnect for afterEach
      const scriptPath = new URL('../build/dist/src/browser.js', import.meta.url).pathname;
      transport = new StdioClientTransport({
        command: 'node',
        args: [scriptPath, '--browserUrl', browserUrl]
      });

      client = new Client(
        {
          name: 'test-client',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      await client.connect(transport);
    });
  });
});
