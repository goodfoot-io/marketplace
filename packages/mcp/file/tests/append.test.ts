import type { TextContent } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('append server', () => {
  let tempDir: string;
  let client: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'append-test-'));

    // Start the server and connect the client
    const scriptPath = new URL('../build/dist/src/append.js', import.meta.url).pathname;
    transport = new StdioClientTransport({
      command: 'node',
      args: [scriptPath]
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
    it('should list the append tool', async () => {
      const result = await client.listTools();

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]).toMatchObject({
        name: 'append',
        description: expect.stringContaining('Appends content to a file') as unknown,
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the file'
            },
            content: {
              type: 'string',
              description: 'Text content to append'
            }
          },
          required: ['file_path', 'content']
        }
      });
    });
  });

  describe('append tool', () => {
    it('should create a new file if it does not exist', async () => {
      const filePath = path.join(tempDir, 'new-file.txt');
      const content = 'Hello, World!';

      const result = await client.callTool({
        name: 'append',
        arguments: {
          file_path: filePath,
          content
        }
      });

      expect(result.content).toHaveLength(1);
      const textContent = (result.content as TextContent[])[0];
      expect(textContent).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Successfully appended') as unknown
      });

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should append to an existing file', async () => {
      const filePath = path.join(tempDir, 'existing-file.txt');
      const initialContent = 'First line\n';
      const appendContent = 'Second line';

      await fs.writeFile(filePath, initialContent);

      const result = await client.callTool({
        name: 'append',
        arguments: {
          file_path: filePath,
          content: appendContent
        }
      });

      const textContent = (result.content as TextContent[])[0];
      expect(textContent).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Successfully appended') as unknown
      });

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(initialContent + appendContent);
    });

    it('should add a newline if the file does not end with one', async () => {
      const filePath = path.join(tempDir, 'no-newline.txt');
      const initialContent = 'No newline at end';
      const appendContent = 'New line';

      await fs.writeFile(filePath, initialContent);

      await client.callTool({
        name: 'append',
        arguments: {
          file_path: filePath,
          content: appendContent
        }
      });

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(initialContent + '\n' + appendContent);
    });

    it('should not add extra newline if file already ends with one', async () => {
      const filePath = path.join(tempDir, 'has-newline.txt');
      const initialContent = 'Has newline at end\n';
      const appendContent = 'Next line';

      await fs.writeFile(filePath, initialContent);

      await client.callTool({
        name: 'append',
        arguments: {
          file_path: filePath,
          content: appendContent
        }
      });

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(initialContent + appendContent);
    });

    it('should create parent directories if they do not exist', async () => {
      const filePath = path.join(tempDir, 'nested', 'dir', 'file.txt');
      const content = 'Content in nested directory';

      const result = await client.callTool({
        name: 'append',
        arguments: {
          file_path: filePath,
          content
        }
      });

      const textContent = (result.content as TextContent[])[0];
      expect(textContent).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Successfully appended') as unknown
      });

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should handle empty content', async () => {
      const filePath = path.join(tempDir, 'empty-content.txt');
      const initialContent = 'Initial';

      await fs.writeFile(filePath, initialContent);

      await client.callTool({
        name: 'append',
        arguments: {
          file_path: filePath,
          content: ''
        }
      });

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(initialContent + '\n');
    });

    it('should report correct byte count', async () => {
      const filePath = path.join(tempDir, 'byte-count.txt');
      const content = 'Test 测试'; // Mix of ASCII and UTF-8

      const result = await client.callTool({
        name: 'append',
        arguments: {
          file_path: filePath,
          content
        }
      });

      const expectedBytes = Buffer.byteLength(content, 'utf8');
      const textContent = (result.content as TextContent[])[0];
      expect(textContent).toMatchObject({
        type: 'text',
        text: expect.stringContaining(`${expectedBytes} bytes`) as unknown
      });
    });

    it('should error on relative paths', async () => {
      await expect(
        client.callTool({
          name: 'append',
          arguments: {
            file_path: 'relative/path.txt',
            content: 'content'
          }
        })
      ).rejects.toThrow('file_path must be an absolute path');
    });

    it('should error on missing file_path', async () => {
      await expect(
        client.callTool({
          name: 'append',
          arguments: {
            content: 'content'
          }
        })
      ).rejects.toThrow('file_path is required');
    });

    it('should error on missing content', async () => {
      await expect(
        client.callTool({
          name: 'append',
          arguments: {
            file_path: path.join(tempDir, 'file.txt')
          }
        })
      ).rejects.toThrow('content is required');
    });

    it('should error on unknown tool', async () => {
      await expect(
        client.callTool({
          name: 'unknown-tool',
          arguments: {}
        })
      ).rejects.toThrow('Unknown tool');
    });
  });
});
