import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('typescript server', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    // Start the server and connect the client
    const scriptPath = new URL('../build/dist/src/typescript.js', import.meta.url).pathname;
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
  });

  describe('tool listing', () => {
    it('should list all four tools', async () => {
      const result = await client.listTools();

      expect(result.tools).toHaveLength(4);

      const toolNames = result.tools.map((tool) => tool.name);
      expect(toolNames).toEqual(['dependencies', 'inverse-dependencies', 'analysis', 'types']);
    });

    it('should have proper schema for dependencies tool', async () => {
      const result = await client.listTools();
      const dependenciesTool = result.tools.find((tool) => tool.name === 'dependencies');

      expect(dependenciesTool).toBeDefined();
      expect(dependenciesTool?.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          targetGlobs: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['targetGlobs']
      });
    });

    it('should have proper schema for inverse-dependencies tool', async () => {
      const result = await client.listTools();
      const inverseDependenciesTool = result.tools.find((tool) => tool.name === 'inverse-dependencies');

      expect(inverseDependenciesTool).toBeDefined();
      expect(inverseDependenciesTool?.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          targetGlobs: {
            type: 'array',
            items: { type: 'string' }
          },
          projectPath: {
            type: 'string'
          }
        },
        required: ['targetGlobs']
      });
    });

    it('should have proper schema for analysis tool', async () => {
      const result = await client.listTools();
      const analysisTool = result.tools.find((tool) => tool.name === 'analysis');

      expect(analysisTool).toBeDefined();
      expect(analysisTool?.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['files']
      });
    });

    it('should have proper schema for types tool', async () => {
      const result = await client.listTools();
      const typesTool = result.tools.find((tool) => tool.name === 'types');

      expect(typesTool).toBeDefined();
      expect(typesTool?.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: { type: 'string' }
          },
          pwd: {
            type: 'string'
          },
          typeFilters: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['paths']
      });
    });
  });

  describe('tool invocation', () => {
    it('should error on unknown tool', async () => {
      await expect(
        client.callTool({
          name: 'unknown-tool',
          arguments: {}
        })
      ).rejects.toThrow('Unknown tool');
    });

    it('should return not implemented error for dependencies tool', async () => {
      await expect(
        client.callTool({
          name: 'dependencies',
          arguments: {
            targetGlobs: ['src/**/*.ts']
          }
        })
      ).rejects.toThrow('dependencies tool not yet implemented');
    });

    it('should return not implemented error for inverse-dependencies tool', async () => {
      await expect(
        client.callTool({
          name: 'inverse-dependencies',
          arguments: {
            targetGlobs: ['src/**/*.ts']
          }
        })
      ).rejects.toThrow('inverse-dependencies tool not yet implemented');
    });

    it('should return not implemented error for analysis tool', async () => {
      await expect(
        client.callTool({
          name: 'analysis',
          arguments: {
            files: ['src/**/*.ts']
          }
        })
      ).rejects.toThrow('analysis tool not yet implemented');
    });

    it('should return not implemented error for types tool', async () => {
      await expect(
        client.callTool({
          name: 'types',
          arguments: {
            paths: ['src/typescript.ts']
          }
        })
      ).rejects.toThrow('types tool not yet implemented');
    });
  });
});
