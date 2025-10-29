import type { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

describe('StreamableHttpDaemon', () => {
  const serverPath = path.join(process.cwd(), 'build/dist/src/example-http-server.js');
  const serverUrl = 'http://127.0.0.1:47127/mcp';
  let serverProcesses: ChildProcess[] = [];

  const startServerProcess = async (): Promise<{ process: ChildProcess; output: string[] }> => {
    const output: string[] = [];
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DEBUG: 'true' }
    });
    serverProcesses.push(serverProcess);

    // Capture output from the start
    serverProcess.stdout?.on('data', (data: Buffer) => {
      output.push(data.toString());
    });
    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error('Server stderr:', data.toString());
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = global.setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 5000);

      const checkOutput = () => {
        const fullOutput = output.join('');
        if (fullOutput.includes('Started HTTP server') || fullOutput.includes('Connected to existing server')) {
          global.clearTimeout(timeout);
          resolve();
        }
      };

      serverProcess.stdout?.on('data', checkOutput);
      serverProcess.on('error', (error) => {
        global.clearTimeout(timeout);
        reject(error);
      });
    });

    return { process: serverProcess, output };
  };

  const createClient = async (): Promise<Client> => {
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    return client;
  };

  afterEach(async () => {
    for (const proc of serverProcesses) {
      if (proc.pid && !proc.killed) {
        proc.kill('SIGTERM');
        await new Promise((resolve) => global.setTimeout(resolve, 500));
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }
    }
    serverProcesses = [];
    await new Promise((resolve) => global.setTimeout(resolve, 1000));
  });

  describe('single server instance', () => {
    it('should start a server and handle requests', async () => {
      await startServerProcess();
      const client = await createClient();
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(2);
      expect(tools.tools[0]).toMatchObject({
        name: 'greet',
        description: expect.stringContaining('greeting') as unknown
      });
      const result = await client.callTool({ name: 'greet', arguments: { name: 'Alice' } });
      expect(result.content).toHaveLength(1);
      const content = (result.content as TextContent[])[0];
      expect(content).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Hello, Alice') as unknown
      });
      await client.close();
    }, 10000);

    it('should handle add tool correctly', async () => {
      await startServerProcess();
      const client = await createClient();
      const result = await client.callTool({ name: 'add', arguments: { a: 5, b: 3 } });
      expect(result.content).toHaveLength(1);
      const content = (result.content as TextContent[])[0];
      expect(content).toMatchObject({ type: 'text', text: '5 + 3 = 8' });
      await client.close();
    }, 10000);
  });

  describe('daemon behavior with multiple processes', () => {
    it('should reuse existing server when port is already in use', async () => {
      const { output: output1 } = await startServerProcess();
      await new Promise((resolve) => global.setTimeout(resolve, 1000));

      const { output: output2 } = await startServerProcess();
      await new Promise((resolve) => global.setTimeout(resolve, 1000));

      const stdout1 = output1.join('');
      expect(stdout1).toContain('Started HTTP server');

      const stdout2 = output2.join('');
      expect(stdout2).toContain('Connected to existing server');

      const client1 = await createClient();
      const client2 = await createClient();
      const result1 = await client1.callTool({ name: 'greet', arguments: { name: 'Client1' } });
      const result2 = await client2.callTool({ name: 'greet', arguments: { name: 'Client2' } });
      const content1 = (result1.content as TextContent[])[0];
      const content2 = (result2.content as TextContent[])[0];
      expect(content1).toMatchObject({ type: 'text', text: expect.stringContaining('Client1') as unknown });
      expect(content2).toMatchObject({ type: 'text', text: expect.stringContaining('Client2') as unknown });
      await client1.close();
      await client2.close();
    }, 20000);

    it('should keep server alive while any client process is running', async () => {
      // Start two processes - first becomes main, second connects to it
      const { output: output1 } = await startServerProcess();
      await new Promise((resolve) => global.setTimeout(resolve, 1000));
      const { output: output2 } = await startServerProcess();
      await new Promise((resolve) => global.setTimeout(resolve, 1000));

      // Verify setup
      expect(output1.join('')).toContain('Started HTTP server');
      expect(output2.join('')).toContain('Connected to existing server');

      // Create a client
      const client = await createClient();

      // Kill the SECOND process (the non-main one)
      const secondProcess = serverProcesses[1];
      if (secondProcess.pid) {
        secondProcess.kill('SIGTERM');
      }
      await new Promise((resolve) => global.setTimeout(resolve, 1000));

      // Server should still be running (main process still alive)
      const result = await client.callTool({ name: 'add', arguments: { a: 10, b: 20 } });
      const content = (result.content as TextContent[])[0];
      expect(content).toMatchObject({ type: 'text', text: '10 + 20 = 30' });
      await client.close();
    }, 20000);
  });

  describe('error handling', () => {
    it('should handle unknown tool gracefully', async () => {
      await startServerProcess();
      const client = await createClient();
      await expect(client.callTool({ name: 'unknown-tool', arguments: {} })).rejects.toThrow('Unknown tool');
      await client.close();
    }, 10000);

    it('should validate tool parameters', async () => {
      await startServerProcess();
      const client = await createClient();
      await expect(client.callTool({ name: 'greet', arguments: {} })).rejects.toThrow('name is required');
      await client.close();
    }, 10000);
  });
});
