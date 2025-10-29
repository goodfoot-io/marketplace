import type { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('codebase server', () => {
  const serverPath = path.join(process.cwd(), 'build/dist/src/codebase.js');
  let client: Client | null = null;

  beforeEach(async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath]
    });
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
  });

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    }
  });

  describe('tool listing', () => {
    it('should list the ask tool', async () => {
      const result = await client!.listTools();

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]).toMatchObject({
        name: 'ask',
        description: expect.stringContaining('Searches and analyzes codebases') as unknown,
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: expect.stringContaining('INSTEAD OF') as unknown
            }
          },
          required: ['question']
        }
      });
    });
  });

  describe('ask tool', () => {
    it('should error on missing question', async () => {
      await expect(
        client!.callTool({
          name: 'ask',
          arguments: {}
        })
      ).rejects.toThrow('question is required');
    });

    it('should error on unknown tool', async () => {
      await expect(
        client!.callTool({
          name: 'unknown-tool',
          arguments: {}
        })
      ).rejects.toThrow('Unknown tool');
    });

    // Note: We can't easily test the actual question-answering functionality
    // because it depends on the Claude Code SDK and would require API access.
    // In a production environment, you might want to:
    // 1. Mock the Claude Code SDK query function
    // 2. Use a test API key with limited scope
    // 3. Test with a simple question that doesn't require actual API calls

    it.skip('should handle a simple test question (requires Claude Code SDK runtime)', async () => {
      // This test is skipped because it requires the full Claude Code SDK runtime
      // which spawns an actual Claude agent process

      const result = await client!.callTool({
        name: 'ask',
        arguments: {
          question: 'What is the purpose of this codebase?'
        }
      });

      // If we get here, the tool executed without error
      expect(result.content).toHaveLength(1);
      const textContent = (result.content as TextContent[])[0];
      expect(textContent).toMatchObject({
        type: 'text',
        text: expect.any(String) as unknown
      });

      // The response should contain some text
      expect(textContent.text.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for API calls

    it.skip('should log Q&A pairs to reports/.codebase-questions directory (requires Claude Code SDK runtime)', async () => {
      // This test is skipped because it requires the full Claude Code SDK runtime
      const testQuestion = 'Test question for logging verification';
      const logDir = path.join('/workspace', 'reports', '.codebase-questions');

      // Clean up any existing log files before test
      try {
        const files = await fs.readdir(logDir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            await fs.unlink(path.join(logDir, file));
          }
        }
      } catch {
        // Directory might not exist yet, that's fine
      }

      // Make the API call
      await client!.callTool({
        name: 'ask',
        arguments: {
          question: testQuestion
        }
      });

      // Check that a log file was created
      const files = await fs.readdir(logDir);
      const mdFiles = files.filter((f) => f.endsWith('.md'));
      expect(mdFiles).toHaveLength(1);

      // Verify the content format
      const logContent = await fs.readFile(path.join(logDir, mdFiles[0]), 'utf-8');
      expect(logContent).toContain(`> ${testQuestion}`);
      expect(logContent.split('\n\n').length).toBeGreaterThanOrEqual(2); // Question and answer sections
    }, 30000);
  });
});
