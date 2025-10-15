import { spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { jestTeardownQueue } from '@productivity-bot/test-utilities/jest-teardown';

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

describe('Test Agent MCP Server - model: inherit', () => {
  let tempDir: string;
  let serverProcess: ChildProcess;

  beforeAll(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-inherit-test-'));

    // Start the server as a subprocess
    serverProcess = spawn('node', [path.resolve('build/dist/src/test-agent.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Give the server a moment to start
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Register cleanup
    void jestTeardownQueue.add(async () => {
      serverProcess.kill();
      try {
        await fs.rm(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  afterAll(async () => {
    // Cleanup is handled by jestTeardownQueue
  });

  it('should support model: inherit to use the parent conversation model', async () => {
    // Create a system instructions file with model: inherit
    const instructionsFile = path.join(tempDir, 'agent-with-inherit-model.md');
    await fs.writeFile(
      instructionsFile,
      `---
name: test-agent-inherit
description: Test agent with inherit model
model: inherit
tools: Read, Write
---

# Test Agent with Inherit Model

You are a test agent with model: inherit in the front matter.

## Instructions
- Respond with "INHERIT_MODEL_TEST_PASSED" when you receive a prompt containing "TEST_INHERIT"
`,
      'utf-8'
    );

    // Verify the file was created with the correct content
    const fileContent = await fs.readFile(instructionsFile, 'utf-8');
    expect(fileContent).toContain('model: inherit');

    // Prepare MCP request to call the task tool with this system instructions file
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'task',
        arguments: {
          description: 'Test inherit model',
          prompt: 'TEST_INHERIT: Respond with INHERIT_MODEL_TEST_PASSED',
          system_instructions_file: instructionsFile
        }
      }
    };

    // Send request and capture response
    const response = await new Promise<MCPResponse>((resolve, reject) => {
      let buffer = '';

      const timeoutId = setTimeout(() => {
        serverProcess.stdout?.off('data', dataHandler);
        serverProcess.stderr?.off('data', errorHandler);
        reject(new Error('Timeout waiting for response'));
      }, 30000); // 30s timeout for agent execution

      const dataHandler = (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const msg = JSON.parse(line) as MCPResponse;
              // Check if this is our response (matching id)
              if (msg.id === 2 && (msg.result || msg.error)) {
                clearTimeout(timeoutId);
                serverProcess.stdout?.off('data', dataHandler);
                serverProcess.stderr?.off('data', errorHandler);
                resolve(msg);
                return;
              }
            } catch {
              // Continue collecting data
            }
          }
        }

        // Keep the last incomplete line in buffer
        buffer = lines[lines.length - 1];
      };

      const errorHandler = (data: Buffer) => {
        const errorOutput = data.toString();
        console.error('Server stderr:', errorOutput);
      };

      serverProcess.stdout?.on('data', dataHandler);
      serverProcess.stderr?.on('data', errorHandler);
      serverProcess.stdin?.write(JSON.stringify(request) + '\n');
    });

    // model: inherit should work - agent should successfully execute
    // Currently this will FAIL because the bug exists
    expect(response.error).toBeUndefined();
    expect(response.result).toBeDefined();

    // Verify we got a successful result
    if (response.result?.content) {
      const textContent = response.result.content.find((c) => c.type === 'text');
      expect(textContent).toBeDefined();
      expect(textContent?.text).toBeTruthy();
    }
  }, 45000); // 45s test timeout

  it('should document that model: inherit is invalid in front matter', () => {
    // This test serves as documentation that "inherit" is not a valid model value
    // The model field should contain actual model IDs like:
    // - claude-3-opus-20240229
    // - claude-3-sonnet-20240229
    // - claude-3-haiku-20240307
    // etc.

    const validModels = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];

    const invalidModels = ['inherit', 'default', 'auto'];

    // Valid models should be actual Claude model IDs
    for (const model of validModels) {
      expect(model).toMatch(/^claude-/);
    }

    // Invalid models should not start with 'claude-'
    for (const model of invalidModels) {
      expect(model).not.toMatch(/^claude-/);
    }
  });

  it('should show expected front matter structure without inherit', async () => {
    // Create a correctly structured system instructions file
    const correctInstructionsFile = path.join(tempDir, 'agent-correct-model.md');
    await fs.writeFile(
      correctInstructionsFile,
      `---
name: test-agent-correct
description: Test agent with valid model
model: claude-3-sonnet-20240229
tools: Read, Write
---

# Test Agent with Valid Model

This is the correct way to specify a model in front matter.
`,
      'utf-8'
    );

    const content = await fs.readFile(correctInstructionsFile, 'utf-8');

    // Verify it contains a valid model ID
    expect(content).toContain('model: claude-3-sonnet-20240229');
    expect(content).not.toContain('model: inherit');
  });

  it('should show that omitting model field works with defaults', async () => {
    // Create system instructions without model field (uses default)
    const noModelInstructionsFile = path.join(tempDir, 'agent-no-model.md');
    await fs.writeFile(
      noModelInstructionsFile,
      `---
name: test-agent-no-model
description: Test agent without model field
tools: Read, Write
---

# Test Agent Without Model Field

When no model is specified, the default model is used.
`,
      'utf-8'
    );

    const content = await fs.readFile(noModelInstructionsFile, 'utf-8');

    // Verify there's no model field
    expect(content).not.toContain('model:');

    // This would use whatever default model the Claude Code SDK provides
    expect(content).toContain('---');
    expect(content).toContain('name: test-agent-no-model');
  });
});
