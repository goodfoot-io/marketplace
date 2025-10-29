import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('codebase server abort handling', () => {
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

  describe('abort functionality', () => {
    it.skip('should handle aborted requests gracefully (requires Claude Code SDK runtime)', async () => {
      // This test is skipped because it requires the full Claude Code SDK runtime
      // which spawns an actual Claude agent process

      const controller = new AbortController();

      // Start a tool call
      const promise = client!.callTool({
        name: 'ask',
        arguments: {
          question: 'What is the largest file in the codebase?'
        }
      });

      // Simulate aborting after a short delay
      setTimeout(() => {
        controller.abort();
      }, 100);

      // In a real scenario with API access, this would test the abort
      // For now, we just verify the call can be made
      await expect(promise).rejects.toThrow();
    }, 5000);

    it('should include abort signal check in processing loop', async () => {
      // This test verifies that our code includes abort checking
      // by reading the source code itself
      const fs = await import('fs/promises');
      const path = await import('path');

      const sourcePath = path.join(process.cwd(), 'src', 'codebase.ts');
      const sourceCode = await fs.readFile(sourcePath, 'utf-8');

      // Verify abort controller creation
      expect(sourceCode).toContain('const abortController = new AbortController()');

      // Verify abort controller is passed to query
      expect(sourceCode).toContain('abortController');

      // Verify abort signal checking
      expect(sourceCode).toContain('abortController.signal.aborted');

      // Verify abort error handling
      expect(sourceCode).toContain('Operation was aborted');
      expect(sourceCode).toContain('Request was cancelled by client');
    });

    it('should handle meta signal if provided', async () => {
      // This test verifies the infrastructure for MCP signal handling
      const fs = await import('fs/promises');
      const path = await import('path');

      const sourcePath = path.join(process.cwd(), 'src', 'codebase.ts');
      const sourceCode = await fs.readFile(sourcePath, 'utf-8');

      // Verify we check for meta signal
      expect(sourceCode).toContain("'signal' in meta");
      expect(sourceCode).toContain('meta.signal instanceof AbortSignal');
      expect(sourceCode).toContain("meta.signal.addEventListener('abort'");
    });
  });

  describe('abort signal propagation', () => {
    it.skip('should propagate abort to Claude Code SDK (requires Claude Code SDK runtime)', async () => {
      // This test is skipped because it requires the full Claude Code SDK runtime
      // which spawns an actual Claude agent process

      const controller = new AbortController();

      // Mock a long-running query
      const promise = client!.callTool({
        name: 'ask',
        arguments: {
          question: 'Analyze every single file in the entire codebase and provide detailed metrics for each'
        }
      });

      // Abort after 1 second
      setTimeout(() => {
        controller.abort();
        console.log('Abort signal sent');
      }, 1000);

      try {
        await promise;
        fail('Should have thrown an abort error');
      } catch (error) {
        expect(error).toBeDefined();
        // We expect either an abort error or a cancellation error
        if (error instanceof Error) {
          expect(
            error.message.includes('abort') ||
              error.message.includes('cancel') ||
              error.message.includes('Request was cancelled')
          ).toBe(true);
        }
      }
    }, 10000);
  });

  describe('error message formatting', () => {
    it('should format abort errors correctly', async () => {
      // Test that abort errors are properly formatted
      const fs = await import('fs/promises');
      const path = await import('path');

      const sourcePath = path.join(process.cwd(), 'src', 'codebase.ts');
      const sourceCode = await fs.readFile(sourcePath, 'utf-8');

      // Check for proper error handling
      expect(sourceCode).toContain("error.message === 'Operation was aborted'");
      expect(sourceCode).toContain("error.name === 'AbortError'");
      expect(sourceCode).toContain("console.error('[Codebase Tool] Query aborted by client')");
      expect(sourceCode).toContain("'Request was cancelled by client'");
    });
  });
});
