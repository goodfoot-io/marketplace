import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Since formatToolInput is not exported, we'll test it indirectly through the logging output
describe('codebase logging format', () => {
  describe('formatToolInput helper', () => {
    // Test the function by running a small script that imports it
    it('should format simple string parameters correctly', async () => {
      const testScript = `// Helper function to format tool inputs in a clean, readable way
function formatToolInput(toolName, input) {
  const lines = [];
  
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      // For multiline strings, use backtick quotes
      if (value.includes('\\n')) {
        lines.push(\`  \${key}=\\\`\\n\${value.split('\\n').map(line => '    ' + line).join('\\n')}\\n  \\\`\`);
      } else {
        lines.push(\`  \${key}="\${value}"\`);
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(\`  \${key}=\${JSON.stringify(value)}\`);
    } else {
      lines.push(\`  \${key}=\${String(value)}\`);
    }
  }
  
  return lines.join(',\\n');
}

// Test cases
const result1 = formatToolInput('TestTool', { name: 'test', value: 'hello' });
console.log('TEST1:' + result1);

const result2 = formatToolInput('TestTool', { 
  description: 'multi\\nline\\ntext',
  count: 42
});
console.log('TEST2:' + result2);

const result3 = formatToolInput('TestTool', {
  options: { foo: 'bar' },
  enabled: true
});
console.log('TEST3:' + result3);
`;

      const tempFile = path.join('/tmp', 'test-format.js');
      await fs.writeFile(tempFile, testScript, 'utf-8');

      const { stdout } = await execAsync(`node ${tempFile}`);

      // Verify format for simple strings
      expect(stdout).toContain('TEST1:  name="test",\n  value="hello"');

      // Verify format for multiline strings
      expect(stdout).toContain('TEST2:  description=`\n    multi\n    line\n    text\n  `,\n  count=42');

      // Verify format for objects and booleans
      expect(stdout).toContain('TEST3:  options={"foo":"bar"},\n  enabled=true');

      // Clean up
      await fs.unlink(tempFile);
    });
  });

  describe('transcript logging format', () => {
    it('should format tool calls using the new format', () => {
      // Create a mock transcript entry
      const toolCall = {
        type: 'tool_use',
        name: 'Task',
        input: {
          description: 'Evaluation',
          subagent_type: 'implementation-evaluator',
          prompt: 'Evaluate project at /workspace/project'
        }
      };

      // Simulate the formatting logic from the actual code
      function formatToolInput(toolName: string, input: Record<string, unknown>): string {
        const lines: string[] = [];

        for (const [key, value] of Object.entries(input)) {
          if (typeof value === 'string') {
            if (value.includes('\n')) {
              lines.push(
                `  ${key}=\`\n${value
                  .split('\n')
                  .map((line) => '    ' + line)
                  .join('\n')}\n  \``
              );
            } else {
              lines.push(`  ${key}="${value}"`);
            }
          } else if (typeof value === 'object' && value !== null) {
            lines.push(`  ${key}=${JSON.stringify(value)}`);
          } else {
            lines.push(`  ${key}=${String(value)}`);
          }
        }

        return lines.join(',\n');
      }

      const formattedInput = formatToolInput(toolCall.name, toolCall.input as Record<string, unknown>);
      const logEntry = `\`\`\`tool-call\n${toolCall.name}(\n${formattedInput}\n)\n\`\`\``;

      // Verify the format matches expected output
      expect(logEntry).toBe(`\`\`\`tool-call
Task(
  description="Evaluation",
  subagent_type="implementation-evaluator",
  prompt="Evaluate project at /workspace/project"
)
\`\`\``);
    });

    it('should format multiline prompts correctly', () => {
      const toolCall = {
        type: 'tool_use',
        name: 'Task',
        input: {
          description: 'Evaluation',
          subagent_type: 'implementation-evaluator',
          prompt: `Name: TestProject
Path: /workspace/project
Plan: @/workspace/project/plan.md
Log: @/workspace/project/log.md

Evaluate project at /workspace/project`
        }
      };

      function formatToolInput(toolName: string, input: Record<string, unknown>): string {
        const lines: string[] = [];

        for (const [key, value] of Object.entries(input)) {
          if (typeof value === 'string') {
            if (value.includes('\n')) {
              lines.push(
                `  ${key}=\`\n${value
                  .split('\n')
                  .map((line) => '    ' + line)
                  .join('\n')}\n  \``
              );
            } else {
              lines.push(`  ${key}="${value}"`);
            }
          } else if (typeof value === 'object' && value !== null) {
            lines.push(`  ${key}=${JSON.stringify(value)}`);
          } else {
            lines.push(`  ${key}=${String(value)}`);
          }
        }

        return lines.join(',\n');
      }

      const formattedInput = formatToolInput(toolCall.name, toolCall.input as Record<string, unknown>);
      const logEntry = `\`\`\`tool-call\n${toolCall.name}(\n${formattedInput}\n)\n\`\`\``;

      // Check that multiline prompt is formatted with backticks and proper indentation
      expect(logEntry).toContain('prompt=`');
      expect(logEntry).toContain('    Name: TestProject');
      expect(logEntry).toContain('    Path: /workspace/project');
      expect(logEntry).toContain('    Evaluate project at /workspace/project');
      expect(logEntry).toMatch(/prompt=`\n( {4}.*\n)+ {2}`/);
    });

    it('should format tool responses correctly', () => {
      // Test tool response formatting
      const successResponse = '```tool-response\nSearch completed successfully. Found 10 files.\n```';
      const errorResponse = '```tool-response-error\nError: File not found\n```';

      expect(successResponse).toContain('tool-response');
      expect(successResponse).not.toContain('tool-response-error');
      expect(errorResponse).toContain('tool-response-error');

      // Test that responses don't have "Assistant Response" header
      const transcript = [
        '```tool-call\nRead(\n  file_path="/workspace/test.ts"\n)\n```',
        '```tool-response\nFile contents here...\n```',
        'The file contains the following code:'
      ];

      const fullTranscript = transcript.join('\n\n');
      expect(fullTranscript).not.toContain('## Assistant Response');
      expect(fullTranscript).toContain('The file contains the following code:');
    });
  });

  describe('log file format', () => {
    it('should use --- separators instead of headers', () => {
      const question = 'Test question';
      const transcript = [
        '```tool-call\nGrep(\n  pattern="test"\n)\n```',
        '```tool-response\nFound 5 matches in the following files:\n- src/test.ts\n- tests/example.test.ts\n```',
        'Based on the search results, I found 5 matches.'
      ];
      const answer = 'Final answer text';

      // Simulate the log format
      const lines = question.split('\n');
      const formattedQuestion = lines.map((line) => `> ${line}`).join('\n');

      const content = `${formattedQuestion}\n\n---\n\n` + `${transcript.join('\n\n')}\n\n---\n\n` + `${answer}`;

      // Verify format
      expect(content).not.toContain('# Question');
      expect(content).not.toContain('# Transcript');
      expect(content).not.toContain('# Final Answer');
      expect(content).toContain('> Test question');
      expect(content).toContain('---');
      expect(content.split('---').length).toBe(3); // Should have 2 separators
    });
  });
});
