import { spawn, type ChildProcess } from 'child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

describe('StreamableHttpDaemon', () => {
  const serverPath = path.join(process.cwd(), 'build/dist/src/example-http-server.js');
  let daemonDir: string;
  let daemonPort: number;
  let serverUrl: string;
  let serverProcesses: ChildProcess[] = [];
  let clients: Client[] = [];

  beforeEach(async () => {
    daemonDir = await mkdtemp(path.join(tmpdir(), 'mcp-daemon-test-'));
    const reservation = createServer();
    await new Promise<void>((resolve, reject) => {
      reservation.once('error', reject);
      reservation.listen(0, '127.0.0.1', resolve);
    });
    try {
      const address = reservation.address();
      if (address === null || typeof address === 'string') {
        throw new Error('Expected an owned TCP port');
      }
      daemonPort = address.port;
      serverUrl = `http://127.0.0.1:${daemonPort}/mcp`;
    } finally {
      await new Promise<void>((resolve, reject) => reservation.close((error) => (error ? reject(error) : resolve())));
    }
  });

  const startServerProcess = async (childTimeout = 9000): Promise<{ process: ChildProcess; output: string[] }> => {
    const output: string[] = [];
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: childTimeout,
      killSignal: 'SIGKILL',
      env: { ...process.env, DEBUG: 'true', MCP_DAEMON_DIR: daemonDir, MCP_DAEMON_PORT: String(daemonPort) }
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
    clients.push(client);
    await client.connect(transport);
    return client;
  };

  afterEach(async () => {
    try {
      for (const client of clients) {
        await client.close();
      }
    } finally {
      for (const proc of serverProcesses) {
        if (proc.pid && proc.exitCode === null && proc.signalCode === null) {
          // Graceful shutdown first, then force-kill if it stalls. A lingering
          // daemon would occupy the owned test port and corrupt the next test
          // ("should reuse existing server when port is already in use" would
          // connect to the zombie instead of starting a fresh main). Note that
          // `proc.killed` cannot gate the SIGKILL — it flips on the first kill()
          // call — so wait for the exit event (or timeout) instead.
          const exited = new Promise<void>((resolve) => proc.once('exit', () => resolve()));
          proc.kill('SIGTERM');
          await Promise.race([exited, new Promise((resolve) => global.setTimeout(resolve, 500))]);
          if (proc.exitCode === null && proc.signalCode === null) {
            proc.kill('SIGKILL');
            await Promise.race([exited, new Promise((resolve) => global.setTimeout(resolve, 500))]);
          }
        }
      }
      serverProcesses = [];
      clients = [];
      await rm(daemonDir, { recursive: true, force: true });
    }
  });

  describe('single server instance', () => {
    it('should start a server and handle requests', async () => {
      await startServerProcess();
      const client = await createClient();
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(2);
      expect(tools.tools[0]).toMatchObject({
        name: 'greet',
        description: 'Returns a greeting message'
      });
      const result = await client.callTool({ name: 'greet', arguments: { name: 'Alice' } });
      expect(result.content).toHaveLength(1);
      expect(result.content).toEqual([
        expect.objectContaining({
          type: 'text',
          text: 'Hello, Alice! Welcome to the example MCP server.'
        })
      ]);
    }, 10000);

    it('should handle add tool correctly', async () => {
      await startServerProcess();
      const client = await createClient();
      const result = await client.callTool({ name: 'add', arguments: { a: 5, b: 3 } });
      expect(result.content).toHaveLength(1);
      expect(result.content).toEqual([{ type: 'text', text: '5 + 3 = 8' }]);
    }, 10000);
  });

  describe('daemon behavior with multiple processes', () => {
    it('should reuse existing server when port is already in use', async () => {
      const { output: output1 } = await startServerProcess(15000);
      await new Promise((resolve) => global.setTimeout(resolve, 1000));

      const { output: output2 } = await startServerProcess(15000);
      await new Promise((resolve) => global.setTimeout(resolve, 1000));

      const stdout1 = output1.join('');
      expect(stdout1).toContain('Started HTTP server');

      const stdout2 = output2.join('');
      expect(stdout2).toContain('Connected to existing server');

      const client1 = await createClient();
      const client2 = await createClient();
      const result1 = await client1.callTool({ name: 'greet', arguments: { name: 'Client1' } });
      const result2 = await client2.callTool({ name: 'greet', arguments: { name: 'Client2' } });
      expect(result1.content).toEqual([
        expect.objectContaining({ type: 'text', text: 'Hello, Client1! Welcome to the example MCP server.' })
      ]);
      expect(result2.content).toEqual([
        expect.objectContaining({ type: 'text', text: 'Hello, Client2! Welcome to the example MCP server.' })
      ]);
    }, 20000);

    it('should keep server alive while any client process is running', async () => {
      // Start two processes - first becomes main, second connects to it
      const { output: output1 } = await startServerProcess(15000);
      await new Promise((resolve) => global.setTimeout(resolve, 1000));
      const { output: output2 } = await startServerProcess(15000);
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
      expect(result.content).toEqual([{ type: 'text', text: '10 + 20 = 30' }]);
    }, 20000);
  });

  describe('error handling', () => {
    it('should handle unknown tool gracefully', async () => {
      await startServerProcess();
      const client = await createClient();
      await expect(client.callTool({ name: 'unknown-tool', arguments: {} })).rejects.toThrow('Unknown tool');
    }, 10000);

    it('should validate tool parameters', async () => {
      await startServerProcess();
      const client = await createClient();
      await expect(client.callTool({ name: 'greet', arguments: {} })).rejects.toThrow('name is required');
    }, 10000);
  });
});
