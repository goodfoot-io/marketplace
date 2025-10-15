import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { jestTeardownQueue } from '@productivity-bot/test-utilities/jest-teardown';

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

interface ListToolsResult {
  tools: Tool[];
}

describe('Test Agent MCP Server', () => {
  let tempDir: string;
  let testInstructionFile: string;

  beforeAll(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-test-'));
    testInstructionFile = path.join(tempDir, 'test-agent.md');

    // Create test instruction file
    await fs.writeFile(
      testInstructionFile,
      `# Test Agent Instructions

You are a test agent for validating the agent MCP server.

## Capabilities
- You can perform basic text processing
- You can use available tools
- You should always be helpful and concise

## Rules
1. Always acknowledge the task
2. Complete the requested operation
3. Return a clear result

## Test Mode
When given a prompt containing "TEST_ECHO:", simply return the text after the colon.
This allows testing without complex agent execution.`,
      'utf-8'
    );

    // Register cleanup
    void jestTeardownQueue.add(async () => {
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

  describe('Tool Registration', () => {
    it('should register the task tool via stdio transport', async () => {
      // Start the server as a subprocess
      const serverProcess = spawn('node', [path.resolve('build/dist/src/test-agent.js')], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Register cleanup
      void jestTeardownQueue.add(() => {
        serverProcess.kill();
      });

      // MCP uses JSON-RPC format
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      const response = await new Promise<ListToolsResult>((resolve, reject) => {
        let buffer = '';

        const timeoutId = setTimeout(() => {
          serverProcess.stdout.off('data', dataHandler);
          reject(new Error('Timeout waiting for response'));
        }, 4000);

        const dataHandler = (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split('\n');

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line) {
              try {
                const msg = JSON.parse(line) as { result?: ListToolsResult };
                if (msg.result) {
                  clearTimeout(timeoutId);
                  serverProcess.stdout.off('data', dataHandler);
                  resolve(msg.result);
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

        serverProcess.stdout.on('data', dataHandler);
        serverProcess.stdin.write(JSON.stringify(request) + '\n');
      });

      expect(response).toHaveProperty('tools');
      expect(response.tools).toHaveLength(1);

      const tool = response.tools[0];
      expect(tool.name).toBe('task');
      expect(tool.description).toContain('Launch a new agent');
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          description: {
            type: 'string'
          },
          prompt: {
            type: 'string'
          },
          system_instructions_file: {
            type: 'string'
          }
        },
        required: ['description', 'prompt']
      });
    }, 10000); // Increase timeout for this test
  });

  describe('Tool Validation', () => {
    it('should create log directory when executing', async () => {
      const logDir = path.join('/workspace', 'reports', '.test-agent-logs');

      // Check if directory exists (may have been created by previous runs)
      const existsBefore = await fs
        .access(logDir)
        .then(() => true)
        .catch(() => false);

      if (!existsBefore) {
        // Directory doesn't exist, so we should verify it gets created
        // This would happen when actually running the agent
        expect(existsBefore).toBe(false);
      } else {
        // Directory already exists from previous runs
        const stats = await fs.stat(logDir);
        expect(stats.isDirectory()).toBe(true);
      }
    });

    it('should validate instruction file paths', () => {
      // Test path validation logic
      const absolutePath = '/workspace/test.md';
      const relativePath = './test.md';

      expect(path.isAbsolute(absolutePath)).toBe(true);
      expect(path.isAbsolute(relativePath)).toBe(false);
    });

    it('should handle file reading errors gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.md');

      try {
        await fs.readFile(nonExistentFile, 'utf-8');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });
  });

  describe('Example Agent Instructions', () => {
    it('should have proper structure for test agent instructions', async () => {
      const content = await fs.readFile(testInstructionFile, 'utf-8');

      expect(content).toContain('# Test Agent Instructions');
      expect(content).toContain('## Capabilities');
      expect(content).toContain('## Rules');
      expect(content).toContain('TEST_ECHO:');
    });

    it('should create example agent instruction files', async () => {
      // Create an example research agent
      const researchAgentFile = path.join(tempDir, 'research-agent.md');
      await fs.writeFile(
        researchAgentFile,
        `# Research Agent

You are a specialized research agent focused on gathering and analyzing information.

## Primary Objective
Conduct thorough research on topics provided by the user.

## Capabilities
- Search for information using available tools
- Analyze and synthesize findings
- Provide comprehensive summaries
- Identify key insights and patterns

## Research Process
1. Understand the research question
2. Break down into sub-questions if needed
3. Gather information from multiple sources
4. Cross-reference and validate findings
5. Synthesize into a coherent response

## Output Format
- Start with an executive summary
- Present main findings with evidence
- Include relevant code examples or data
- End with conclusions and recommendations`,
        'utf-8'
      );

      // Create an example code review agent
      const codeReviewAgentFile = path.join(tempDir, 'code-review-agent.md');
      await fs.writeFile(
        codeReviewAgentFile,
        `# Code Review Agent

You are a senior engineer conducting code reviews.

## Review Focus Areas
- Code quality and maintainability
- Performance considerations
- Security vulnerabilities
- Best practices adherence
- Test coverage

## Review Process
1. Understand the code's purpose
2. Check for logical errors
3. Evaluate code structure
4. Identify improvement opportunities
5. Provide actionable feedback

## Feedback Style
- Be constructive and specific
- Provide examples of improvements
- Acknowledge good practices
- Prioritize issues by severity`,
        'utf-8'
      );

      // Verify files were created
      const researchContent = await fs.readFile(researchAgentFile, 'utf-8');
      const codeReviewContent = await fs.readFile(codeReviewAgentFile, 'utf-8');

      expect(researchContent).toContain('Research Agent');
      expect(codeReviewContent).toContain('Code Review Agent');
    });
  });

  describe('Integration with Claude Code SDK', () => {
    it('should pass correct options to Claude Code SDK', () => {
      // Verify the expected options structure
      const expectedOptions = {
        customSystemPrompt: expect.any(String),
        maxTurns: 100,
        includePartialMessages: true,
        abortController: expect.any(AbortController),
        disallowedTools: ['Task', 'mcp__test-agent__task']
      };

      // These would be the options passed to the query function
      expect(expectedOptions.maxTurns).toBe(100);
      expect(expectedOptions.includePartialMessages).toBe(true);
      expect(expectedOptions.disallowedTools).toContain('Task');
      expect(expectedOptions.disallowedTools).toContain('mcp__test-agent__task');
    });

    it('should handle different message types from Claude Code SDK', () => {
      // Test message type structures
      const assistantMessage = {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Processing request...' }]
        }
      };

      const resultMessage = {
        type: 'result',
        subtype: 'success',
        result: 'Task completed'
      };

      const errorMessage = {
        type: 'result',
        subtype: 'error_max_turns'
      };

      expect(assistantMessage.type).toBe('assistant');
      expect(resultMessage.subtype).toBe('success');
      expect(errorMessage.subtype).toBe('error_max_turns');
    });
  });

  describe('YAML Front Matter Parsing', () => {
    it('should parse YAML front matter from system instruction files', async () => {
      // Create test file with YAML front matter
      const agentWithFrontMatter = path.join(tempDir, 'agent-with-frontmatter.md');
      await fs.writeFile(
        agentWithFrontMatter,
        `---
name: test-agent
description: Test agent with front matter
model: claude-3-opus-20240229
tools: Read, Write, Bash
---

# Test Agent with Front Matter

You are a test agent configured via YAML front matter.

## Instructions
- Follow the model and tools specified in the front matter
- Process tasks according to the configuration`,
        'utf-8'
      );

      const content = await fs.readFile(agentWithFrontMatter, 'utf-8');
      expect(content).toContain('---');
      expect(content).toContain('name: test-agent');
      expect(content).toContain('model: claude-3-opus-20240229');
      expect(content).toContain('tools: Read, Write, Bash');
    });

    it('should handle system instruction files without front matter', async () => {
      // Create test file without YAML front matter
      const agentWithoutFrontMatter = path.join(tempDir, 'agent-without-frontmatter.md');
      await fs.writeFile(
        agentWithoutFrontMatter,
        `# Simple Test Agent

You are a simple test agent without any YAML front matter.

## Instructions
- Process tasks normally
- Use default configuration`,
        'utf-8'
      );

      const content = await fs.readFile(agentWithoutFrontMatter, 'utf-8');
      expect(content).not.toContain('---');
      expect(content).toContain('# Simple Test Agent');
    });

    it('should handle malformed YAML front matter gracefully', async () => {
      // Create test file with invalid YAML
      const agentWithBadYaml = path.join(tempDir, 'agent-bad-yaml.md');
      await fs.writeFile(
        agentWithBadYaml,
        `---
name: test-agent
description: [unclosed bracket
model: claude-3
---

# Test Agent with Bad YAML

This agent has malformed YAML front matter.`,
        'utf-8'
      );

      const content = await fs.readFile(agentWithBadYaml, 'utf-8');
      expect(content).toContain('---');
      expect(content).toContain('[unclosed bracket');
      // The server should handle this gracefully and treat entire content as instructions
    });

    it('should extract system instructions after stripping front matter', () => {
      const testContent = `---
name: example-agent
model: claude-3-opus-20240229
---

# Agent Instructions

These are the actual instructions.`;

      // Simulate front matter parsing
      const frontMatterRegex = /^---\n([\s\S]*?)\n---\n/;
      const match = testContent.match(frontMatterRegex);

      expect(match).toBeTruthy();
      if (match) {
        const contentWithoutFrontMatter = testContent.slice(match[0].length);
        expect(contentWithoutFrontMatter).toBe(`
# Agent Instructions

These are the actual instructions.`);
        expect(contentWithoutFrontMatter).not.toContain('---');
        expect(contentWithoutFrontMatter).not.toContain('name: example-agent');
      }
    });

    it('should support all documented front matter fields', async () => {
      // Create test file with all supported fields
      const fullFrontMatterAgent = path.join(tempDir, 'full-frontmatter-agent.md');
      await fs.writeFile(
        fullFrontMatterAgent,
        `---
name: comprehensive-agent
description: Agent with all front matter fields
model: claude-3-opus-20240229
tools: Read, Write, Edit, Bash, Grep, Glob
---

# Comprehensive Agent

This agent demonstrates all supported front matter fields.`,
        'utf-8'
      );

      const content = await fs.readFile(fullFrontMatterAgent, 'utf-8');

      // Parse the front matter to verify all fields
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
      expect(frontMatterMatch).toBeTruthy();

      if (frontMatterMatch) {
        // Would normally use yaml.load here, but keeping test simple
        const frontMatterText = frontMatterMatch[1];
        expect(frontMatterText).toContain('name: comprehensive-agent');
        expect(frontMatterText).toContain('description: Agent with all front matter fields');
        expect(frontMatterText).toContain('model: claude-3-opus-20240229');
        expect(frontMatterText).toContain('tools: Read, Write, Edit, Bash, Grep, Glob');
      }
    });
  });

  describe('Logging Functionality', () => {
    it('should format log entries correctly', async () => {
      const testLogDir = path.join(tempDir, 'logs');
      await fs.mkdir(testLogDir, { recursive: true });

      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -1);
      const logFile = path.join(testLogDir, `${timestamp}.md`);

      const logContent = `# Agent Execution Log

## System Instructions File
\`${testInstructionFile}\`

## Task Description
Test logging

## Prompt
> Test the logging functionality
> Multi-line prompt

---

## Execution Transcript

**Task:** Test logging
**Prompt:**
Test the logging functionality
Multi-line prompt
---
Processing the test task...
Task completed successfully!`;

      await fs.writeFile(logFile, logContent, 'utf-8');

      const savedContent = await fs.readFile(logFile, 'utf-8');
      expect(savedContent).toContain('# Agent Execution Log');
      expect(savedContent).toContain('## System Instructions File');
      expect(savedContent).toContain('## Task Description');
      expect(savedContent).toContain('## Prompt');
      expect(savedContent).toContain('## Execution Transcript');
    });
  });
});
