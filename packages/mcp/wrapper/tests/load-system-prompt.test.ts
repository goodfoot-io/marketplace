import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { loadSystemPromptFromFile } from '../src/wrapper.js';

describe('loadSystemPromptFromFile', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'load-system-prompt-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('successful file reading', () => {
    it('should read file content from absolute path', async () => {
      const testContent = 'You are a helpful assistant.';
      const filePath = path.join(testDir, 'prompt.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });

    it('should read file with multi-line content', async () => {
      const testContent = `You are a helpful assistant.

This is line 2.
This is line 3.`;
      const filePath = path.join(testDir, 'prompt.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });

    it('should read file with special characters', async () => {
      const testContent = 'You are helpful! Use <tags> and "quotes" and $special chars.';
      const filePath = path.join(testDir, 'prompt.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });

    it('should read file with unicode characters', async () => {
      const testContent = 'You are helpful! 你好 🎉 café';
      const filePath = path.join(testDir, 'prompt.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });

    it('should read empty file', async () => {
      const filePath = path.join(testDir, 'empty.md');
      await fs.writeFile(filePath, '', 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe('');
    });

    it('should read file with front matter without parsing it', async () => {
      const testContent = `---
name: test
description: test description
---
You are a helpful assistant.`;
      const filePath = path.join(testDir, 'prompt.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      // Should return the entire content including front matter
      expect(result).toBe(testContent);
    });

    it('should handle file with only whitespace', async () => {
      const testContent = '   \n\n\t  ';
      const filePath = path.join(testDir, 'whitespace.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });

    it('should read .txt files', async () => {
      const testContent = 'Plain text content';
      const filePath = path.join(testDir, 'prompt.txt');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error for non-existent file (ENOENT)', async () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist.md');

      await expect(loadSystemPromptFromFile(nonExistentPath)).rejects.toThrow(
        `System prompt file not found: ${nonExistentPath}`
      );
    });

    it('should throw error for relative paths', async () => {
      const relativePath = 'relative/path/prompt.md';

      await expect(loadSystemPromptFromFile(relativePath)).rejects.toThrow(
        'system_prompt_file must be an absolute path'
      );
    });

    it('should throw error for empty path', async () => {
      await expect(loadSystemPromptFromFile('')).rejects.toThrow('system_prompt_file must be an absolute path');
    });

    it('should throw error for path that starts with ./', async () => {
      await expect(loadSystemPromptFromFile('./prompt.md')).rejects.toThrow(
        'system_prompt_file must be an absolute path'
      );
    });

    it('should throw error for path that starts with ../', async () => {
      await expect(loadSystemPromptFromFile('../prompt.md')).rejects.toThrow(
        'system_prompt_file must be an absolute path'
      );
    });

    it('should throw descriptive error for directory path', async () => {
      // Try to read a directory instead of a file
      await expect(loadSystemPromptFromFile(testDir)).rejects.toThrow('Failed to read system prompt file');
    });

    it('should accept Windows-style absolute paths', async () => {
      // Skip on non-Windows platforms for path.isAbsolute behavior consistency
      if (process.platform !== 'win32') {
        // On Unix, we still need to test the validation logic
        // Use a Unix absolute path format
        const unixPath = '/tmp/prompt.md';
        // This should pass the validation but fail on file read since we didn't create it
        await expect(loadSystemPromptFromFile(unixPath)).rejects.toThrow('System prompt file not found');
        return;
      }

      // On Windows, test actual Windows paths
      const testContent = 'Windows path test';
      const windowsPath = path.join(testDir, 'prompt.md');
      await fs.writeFile(windowsPath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(windowsPath);
      expect(result).toBe(testContent);
    });
  });

  describe('edge cases', () => {
    it('should handle very long file content', async () => {
      // Create a 1MB file
      const testContent = 'a'.repeat(1024 * 1024);
      const filePath = path.join(testDir, 'large.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result.length).toBe(1024 * 1024);
      expect(result).toBe(testContent);
    });

    it('should handle file with different line endings (LF)', async () => {
      const testContent = 'Line 1\nLine 2\nLine 3';
      const filePath = path.join(testDir, 'lf.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });

    it('should handle file with different line endings (CRLF)', async () => {
      const testContent = 'Line 1\r\nLine 2\r\nLine 3';
      const filePath = path.join(testDir, 'crlf.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });

    it('should handle file path with spaces', async () => {
      const testContent = 'Content with spaces in path';
      const dirWithSpaces = path.join(testDir, 'dir with spaces');
      await fs.mkdir(dirWithSpaces, { recursive: true });
      const filePath = path.join(dirWithSpaces, 'prompt file.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });

    it('should handle file path with special characters', async () => {
      const testContent = 'Content with special chars in path';
      const dirWithSpecialChars = path.join(testDir, 'dir-with_special.chars');
      await fs.mkdir(dirWithSpecialChars, { recursive: true });
      const filePath = path.join(dirWithSpecialChars, 'prompt-file_2023.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });
  });

  describe('comparison with test-agent pattern', () => {
    it('should match test-agent file reading behavior for absolute paths', async () => {
      const testContent = 'You are a test agent.';
      const filePath = path.join(testDir, 'agent-prompt.md');
      await fs.writeFile(filePath, testContent, 'utf-8');

      // Test that absolute path works
      const result = await loadSystemPromptFromFile(filePath);
      expect(result).toBe(testContent);
    });

    it('should reject relative paths like test-agent does', async () => {
      const relativePath = 'agent-prompt.md';

      await expect(loadSystemPromptFromFile(relativePath)).rejects.toThrow(
        'system_prompt_file must be an absolute path'
      );
    });

    it('should throw ENOENT error like test-agent for missing files', async () => {
      const missingPath = path.join(testDir, 'missing-agent.md');

      await expect(loadSystemPromptFromFile(missingPath)).rejects.toThrow('System prompt file not found');
    });
  });
});
