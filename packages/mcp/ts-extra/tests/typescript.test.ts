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

    describe('analysis tool', () => {
      it('should analyze TypeScript files and return YAML format', async () => {
        const result = await client.callTool({
          name: 'analysis',
          arguments: {
            files: ['tests/fixtures/sample-types.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);

        // Verify YAML structure
        expect(textContent).toContain('files:');
        expect(textContent).toContain('path:');
        expect(textContent).toContain('items:');
        expect(textContent).toContain('summary:');

        // Verify it contains expected types
        expect(textContent).toContain('kind: interface');
        expect(textContent).toContain('name: User');
        expect(textContent).toContain('kind: type');
        expect(textContent).toContain('name: UserId');
        expect(textContent).toContain('kind: class');
        expect(textContent).toContain('name: UserService');
        expect(textContent).toContain('kind: enum');
        expect(textContent).toContain('name: UserRole');
        expect(textContent).toContain('kind: function');
        expect(textContent).toContain('name: calculateComplexity');
      });

      it('should include properties for interfaces', async () => {
        const result = await client.callTool({
          name: 'analysis',
          arguments: {
            files: ['tests/fixtures/sample-types.ts']
          }
        });

        const textContent = extractTextContent(result);

        // Verify interface properties are included
        expect(textContent).toContain('properties:');
        expect(textContent).toContain('id: string');
        expect(textContent).toContain('name: string');
        expect(textContent).toContain('email: string');
      });

      it('should include members for classes', async () => {
        const result = await client.callTool({
          name: 'analysis',
          arguments: {
            files: ['tests/fixtures/sample-types.ts']
          }
        });

        const textContent = extractTextContent(result);

        // Verify class members are included
        expect(textContent).toContain('members:');
        expect(textContent).toContain('private users (property)');
        expect(textContent).toContain('public addUser (method)');
        expect(textContent).toContain('public getUser (method)');
      });

      it('should include enum members', async () => {
        const result = await client.callTool({
          name: 'analysis',
          arguments: {
            files: ['tests/fixtures/sample-types.ts']
          }
        });

        const textContent = extractTextContent(result);

        // Verify enum members are included
        expect(textContent).toContain("Admin = 'admin'");
        expect(textContent).toContain("User = 'user'");
        expect(textContent).toContain("Guest = 'guest'");
      });

      it('should calculate cyclomatic complexity for functions', async () => {
        const result = await client.callTool({
          name: 'analysis',
          arguments: {
            files: ['tests/fixtures/sample-types.ts']
          }
        });

        const textContent = extractTextContent(result);

        // Verify complexity is calculated (should be > 1 due to if/else)
        expect(textContent).toContain('complexity:');
      });

      it('should include function parameters and return types', async () => {
        const result = await client.callTool({
          name: 'analysis',
          arguments: {
            files: ['tests/fixtures/sample-types.ts']
          }
        });

        const textContent = extractTextContent(result);

        // Verify function details
        expect(textContent).toContain('parameters:');
        expect(textContent).toContain('value: number');
        expect(textContent).toContain('returnType: string');
      });

      it('should track exported status', async () => {
        const result = await client.callTool({
          name: 'analysis',
          arguments: {
            files: ['tests/fixtures/sample-types.ts']
          }
        });

        const textContent = extractTextContent(result);

        // All items in sample file are exported
        expect(textContent).toContain('exported: true');
      });

      it('should include summary counts', async () => {
        const result = await client.callTool({
          name: 'analysis',
          arguments: {
            files: ['tests/fixtures/sample-types.ts']
          }
        });

        const textContent = extractTextContent(result);

        // Verify summary section
        expect(textContent).toContain('summary:');
        expect(textContent).toContain('total:');
        expect(textContent).toMatch(/classes: \d+/);
        expect(textContent).toMatch(/enums: \d+/);
        expect(textContent).toMatch(/functions: \d+/);
        expect(textContent).toMatch(/interfaces: \d+/);
        expect(textContent).toMatch(/methods: \d+/);
        expect(textContent).toMatch(/types: \d+/);
      });

      it('should support glob patterns', async () => {
        const result = await client.callTool({
          name: 'analysis',
          arguments: {
            files: ['tests/fixtures/**/*.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        expect(textContent).toContain('files:');
        expect(textContent).toContain('summary:');
      });

      it('should validate missing arguments', async () => {
        await expect(
          client.callTool({
            name: 'analysis',
            arguments: {}
          })
        ).rejects.toThrow('files must be an array');
      });

      it('should validate empty files array', async () => {
        await expect(
          client.callTool({
            name: 'analysis',
            arguments: {
              files: []
            }
          })
        ).rejects.toThrow('files array cannot be empty');
      });

      it('should validate files array contains only strings', async () => {
        await expect(
          client.callTool({
            name: 'analysis',
            arguments: {
              files: ['src/**/*.ts', 123, null]
            }
          })
        ).rejects.toThrow('All files elements must be strings');
      });

      it('should validate missing arguments object', async () => {
        await expect(
          client.callTool({
            name: 'analysis'
          })
        ).rejects.toThrow('Missing or invalid arguments object');
      });

      it('should handle non-existent files gracefully', async () => {
        const result = await client.callTool({
          name: 'analysis',
          arguments: {
            files: ['nonexistent/**/*.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        // Should return empty results
        expect(textContent).toContain('files:');
        expect(textContent).toContain('summary:');
        expect(textContent).toContain('total: 0');
      });
    });

    describe('types tool', () => {
      it('should extract types from valid TypeScript file', async () => {
        const result = await client.callTool({
          name: 'types',
          arguments: {
            paths: ['tests/fixtures/type-exports.ts']
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const typeResults = JSON.parse(textContent) as Array<{ file: string; exports: Array<{ name: string }> }>;

        expect(Array.isArray(typeResults)).toBe(true);
        expect(typeResults.length).toBe(1);

        const fileResult = typeResults[0];
        expect(fileResult.file).toContain('type-exports.ts');
        expect(Array.isArray(fileResult.exports)).toBe(true);

        // Should export Config interface
        const configExport = fileResult.exports.find((e) => e.name === 'Config');
        expect(configExport).toBeDefined();
        expect(configExport?.name).toBe('Config');

        // Should export UserId type alias
        const userIdExport = fileResult.exports.find((e) => e.name === 'UserId');
        expect(userIdExport).toBeDefined();

        // Should export Status type alias
        const statusExport = fileResult.exports.find((e) => e.name === 'Status');
        expect(statusExport).toBeDefined();

        // Should export fetchData function
        const fetchDataExport = fileResult.exports.find((e) => e.name === 'fetchData');
        expect(fetchDataExport).toBeDefined();

        // Should export API_VERSION constant
        const apiVersionExport = fileResult.exports.find((e) => e.name === 'API_VERSION');
        expect(apiVersionExport).toBeDefined();

        // Should export Priority enum
        const priorityExport = fileResult.exports.find((e) => e.name === 'Priority');
        expect(priorityExport).toBeDefined();

        // Should export DataStore class
        const dataStoreExport = fileResult.exports.find((e) => e.name === 'DataStore');
        expect(dataStoreExport).toBeDefined();
      });

      it('should include declaration and simplified forms', async () => {
        const result = await client.callTool({
          name: 'types',
          arguments: {
            paths: ['tests/fixtures/type-exports.ts']
          }
        });

        const textContent = extractTextContent(result);
        const typeResults = JSON.parse(textContent) as Array<{
          file: string;
          exports: Array<{ name: string; declaration?: string; simplified?: unknown }>;
        }>;

        const fileResult = typeResults[0];

        // Check that exports have both declaration and simplified forms
        const configExport = fileResult.exports.find((e) => e.name === 'Config');
        expect(configExport?.declaration).toBeDefined();
        expect(configExport?.simplified).toBeDefined();

        // Check UserId type has declaration
        const userIdExport = fileResult.exports.find((e) => e.name === 'UserId');
        expect(userIdExport?.declaration).toBeDefined();
        expect(userIdExport?.declaration).toContain('type UserId');
      });

      it('should support typeFilters parameter', async () => {
        const result = await client.callTool({
          name: 'types',
          arguments: {
            paths: ['tests/fixtures/type-exports.ts'],
            typeFilters: ['Config', 'UserId']
          }
        });

        const textContent = extractTextContent(result);
        const typeResults = JSON.parse(textContent) as Array<{ file: string; exports: Array<{ name: string }> }>;

        expect(typeResults.length).toBe(1);
        const fileResult = typeResults[0];

        // Should only include filtered types
        expect(fileResult.exports.length).toBe(2);
        expect(fileResult.exports.some((e) => e.name === 'Config')).toBe(true);
        expect(fileResult.exports.some((e) => e.name === 'UserId')).toBe(true);
        expect(fileResult.exports.some((e) => e.name === 'Status')).toBe(false);
        expect(fileResult.exports.some((e) => e.name === 'fetchData')).toBe(false);
      });

      it('should handle multiple file paths', async () => {
        const result = await client.callTool({
          name: 'types',
          arguments: {
            paths: ['tests/fixtures/type-exports.ts', 'tests/fixtures/sample-types.ts']
          }
        });

        const textContent = extractTextContent(result);
        const typeResults = JSON.parse(textContent) as Array<{ file: string; exports: Array<{ name: string }> }>;

        expect(typeResults.length).toBe(2);
        expect(typeResults[0].file).toContain('type-exports.ts');
        expect(typeResults[1].file).toContain('sample-types.ts');
      });

      it('should validate missing arguments', async () => {
        await expect(
          client.callTool({
            name: 'types',
            arguments: {}
          })
        ).rejects.toThrow('paths must be an array');
      });

      it('should validate empty paths array', async () => {
        await expect(
          client.callTool({
            name: 'types',
            arguments: {
              paths: []
            }
          })
        ).rejects.toThrow('paths array cannot be empty');
      });

      it('should validate paths array contains only strings', async () => {
        await expect(
          client.callTool({
            name: 'types',
            arguments: {
              paths: ['src/**/*.ts', 123, null]
            }
          })
        ).rejects.toThrow('All paths elements must be strings');
      });

      it('should validate missing arguments object', async () => {
        await expect(
          client.callTool({
            name: 'types'
          })
        ).rejects.toThrow('Missing or invalid arguments object');
      });

      it('should validate pwd is a string when provided', async () => {
        await expect(
          client.callTool({
            name: 'types',
            arguments: {
              paths: ['src/**/*.ts'],
              pwd: 123
            }
          })
        ).rejects.toThrow('pwd must be a string');
      });

      it('should validate typeFilters is an array when provided', async () => {
        await expect(
          client.callTool({
            name: 'types',
            arguments: {
              paths: ['src/**/*.ts'],
              typeFilters: 'Config'
            }
          })
        ).rejects.toThrow('typeFilters must be an array');
      });

      it('should validate typeFilters array contains only strings', async () => {
        await expect(
          client.callTool({
            name: 'types',
            arguments: {
              paths: ['src/**/*.ts'],
              typeFilters: ['Config', 123, null]
            }
          })
        ).rejects.toThrow('All typeFilters elements must be strings');
      });

      it('should handle non-existent files gracefully', async () => {
        const result = await client.callTool({
          name: 'types',
          arguments: {
            paths: ['nonexistent/file.ts']
          }
        });

        const textContent = extractTextContent(result);
        const typeResults = JSON.parse(textContent) as Array<{ file: string; exports: Array<{ name: string }> }>;

        // Should return empty results for non-existent files
        expect(Array.isArray(typeResults)).toBe(true);
        expect(typeResults.length).toBe(0);
      });

      it('should accept optional pwd parameter', async () => {
        const result = await client.callTool({
          name: 'types',
          arguments: {
            paths: ['tests/fixtures/type-exports.ts'],
            pwd: process.cwd()
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = extractTextContent(result);
        const typeResults = JSON.parse(textContent) as Array<{ file: string; exports: Array<{ name: string }> }>;

        expect(typeResults.length).toBeGreaterThan(0);
      });
    });
  });
});
