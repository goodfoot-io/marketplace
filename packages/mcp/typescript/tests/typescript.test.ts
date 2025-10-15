import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Helper function to extract text content from MCP response
function extractTextContent(result: unknown): string {
  if (!result || typeof result !== 'object' || !('content' in result)) {
    throw new Error('Expected result with content');
  }

  const { content } = result;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('Expected content array');
  }

  const firstContent: unknown = content[0];
  if (!firstContent || typeof firstContent !== 'object' || !('type' in firstContent) || !('text' in firstContent)) {
    throw new Error('Expected text content');
  }

  if (firstContent.type !== 'text') {
    throw new Error('Expected type to be text');
  }

  return String(firstContent.text);
}

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

    describe('dependencies tool', () => {
      it('should return dependencies for valid glob pattern', async () => {
        const result = await client.callTool({
          name: 'dependencies',
          arguments: {
            targetGlobs: ['src/typescript.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const dependencies = JSON.parse(textContent) as string[];

        expect(Array.isArray(dependencies)).toBe(true);
        expect(dependencies.length).toBeGreaterThan(0);
        // Should include the source file itself
        expect(dependencies).toContain('src/typescript.ts');
        // Should include the DependencyFinder
        expect(dependencies).toContain('src/lib/DependencyFinder.ts');
      });

      it('should return empty array for non-existent files', async () => {
        const result = await client.callTool({
          name: 'dependencies',
          arguments: {
            targetGlobs: ['nonexistent/**/*.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const dependencies = JSON.parse(textContent) as string[];

        expect(Array.isArray(dependencies)).toBe(true);
        expect(dependencies.length).toBe(0);
      });

      it('should validate missing arguments', async () => {
        await expect(
          client.callTool({
            name: 'dependencies',
            arguments: {}
          })
        ).rejects.toThrow('targetGlobs must be an array');
      });

      it('should validate empty targetGlobs array', async () => {
        await expect(
          client.callTool({
            name: 'dependencies',
            arguments: {
              targetGlobs: []
            }
          })
        ).rejects.toThrow('targetGlobs array cannot be empty');
      });

      it('should validate targetGlobs array contains only strings', async () => {
        await expect(
          client.callTool({
            name: 'dependencies',
            arguments: {
              targetGlobs: ['src/**/*.ts', 123, null]
            }
          })
        ).rejects.toThrow('All targetGlobs elements must be strings');
      });

      it('should validate missing arguments object', async () => {
        await expect(
          client.callTool({
            name: 'dependencies'
          })
        ).rejects.toThrow('Missing or invalid arguments object');
      });

      it('should handle multiple glob patterns', async () => {
        const result = await client.callTool({
          name: 'dependencies',
          arguments: {
            targetGlobs: ['src/typescript.ts', 'src/lib/DependencyFinder.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const dependencies = JSON.parse(textContent) as string[];

        expect(Array.isArray(dependencies)).toBe(true);
        expect(dependencies.length).toBeGreaterThan(0);
        // Should include both source files
        expect(dependencies).toContain('src/typescript.ts');
        expect(dependencies).toContain('src/lib/DependencyFinder.ts');
      });

      it('should return sorted dependencies', async () => {
        const result = await client.callTool({
          name: 'dependencies',
          arguments: {
            targetGlobs: ['src/**/*.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const dependencies = JSON.parse(textContent) as string[];

        expect(Array.isArray(dependencies)).toBe(true);

        // Verify array is sorted
        const sorted = [...dependencies].sort();
        expect(dependencies).toEqual(sorted);
      });
    });

    describe('inverse-dependencies tool', () => {
      it('should return inverse dependencies for valid glob pattern', async () => {
        const result = await client.callTool({
          name: 'inverse-dependencies',
          arguments: {
            targetGlobs: ['src/lib/DependencyFinder.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const response = JSON.parse(textContent) as { files: string[]; count: number };

        expect(response).toHaveProperty('files');
        expect(response).toHaveProperty('count');
        expect(Array.isArray(response.files)).toBe(true);
        expect(response.count).toBe(response.files.length);
        // Should include typescript.ts which imports DependencyFinder
        expect(response.files).toContain('src/typescript.ts');
      });

      it('should return empty array for files with no dependents', async () => {
        const result = await client.callTool({
          name: 'inverse-dependencies',
          arguments: {
            targetGlobs: ['nonexistent/**/*.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const response = JSON.parse(textContent) as { files: string[]; count: number };

        expect(Array.isArray(response.files)).toBe(true);
        expect(response.files.length).toBe(0);
        expect(response.count).toBe(0);
      });

      it('should validate missing arguments', async () => {
        await expect(
          client.callTool({
            name: 'inverse-dependencies',
            arguments: {}
          })
        ).rejects.toThrow('targetGlobs must be an array');
      });

      it('should validate empty targetGlobs array', async () => {
        await expect(
          client.callTool({
            name: 'inverse-dependencies',
            arguments: {
              targetGlobs: []
            }
          })
        ).rejects.toThrow('targetGlobs array cannot be empty');
      });

      it('should validate targetGlobs array contains only strings', async () => {
        await expect(
          client.callTool({
            name: 'inverse-dependencies',
            arguments: {
              targetGlobs: ['src/**/*.ts', 123, null]
            }
          })
        ).rejects.toThrow('All targetGlobs elements must be strings');
      });

      it('should validate missing arguments object', async () => {
        await expect(
          client.callTool({
            name: 'inverse-dependencies'
          })
        ).rejects.toThrow('Missing or invalid arguments object');
      });

      it('should validate projectPath is a string when provided', async () => {
        await expect(
          client.callTool({
            name: 'inverse-dependencies',
            arguments: {
              targetGlobs: ['src/**/*.ts'],
              projectPath: 123
            }
          })
        ).rejects.toThrow('projectPath must be a string');
      });

      it('should handle multiple glob patterns', async () => {
        const result = await client.callTool({
          name: 'inverse-dependencies',
          arguments: {
            targetGlobs: ['src/lib/DependencyFinder.ts', 'src/lib/InverseDependencyFinder.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const response = JSON.parse(textContent) as { files: string[]; count: number };

        expect(Array.isArray(response.files)).toBe(true);
        expect(response.count).toBe(response.files.length);
        // Should include typescript.ts which imports both
        expect(response.files).toContain('src/typescript.ts');
      });

      it('should return sorted inverse dependencies', async () => {
        const result = await client.callTool({
          name: 'inverse-dependencies',
          arguments: {
            targetGlobs: ['src/lib/DependencyFinder.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const response = JSON.parse(textContent) as { files: string[]; count: number };

        expect(Array.isArray(response.files)).toBe(true);

        // Verify array is sorted
        const sorted = [...response.files].sort();
        expect(response.files).toEqual(sorted);
      });

      it('should accept optional projectPath parameter', async () => {
        const result = await client.callTool({
          name: 'inverse-dependencies',
          arguments: {
            targetGlobs: ['src/lib/DependencyFinder.ts'],
            projectPath: 'tsconfig.json'
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const response = JSON.parse(textContent) as { files: string[]; count: number };

        expect(Array.isArray(response.files)).toBe(true);
        expect(response.count).toBe(response.files.length);
      });
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
