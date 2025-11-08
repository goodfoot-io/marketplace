import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from '@jest/globals';
import { generateAgentId, getWorkspaceName, getTranscriptPath } from '../src/agent-id.js';

describe('Agent ID Utilities', () => {
  describe('generateAgentId', () => {
    it('should generate 8-character hex string', () => {
      const id = generateAgentId();
      expect(id).toMatch(/^[0-9a-f]{8}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateAgentId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('getWorkspaceName', () => {
    it('should normalize simple path', () => {
      expect(getWorkspaceName('/workspace/test')).toBe('-workspace-test');
    });

    it('should replace special characters with hyphens', () => {
      expect(getWorkspaceName('/path/to/workspace')).toBe('-path-to-workspace');
    });

    it('should handle spaces', () => {
      expect(getWorkspaceName('/my path/workspace')).toBe('-my-path-workspace');
    });
  });

  describe('getTranscriptPath', () => {
    it('should construct correct path', () => {
      const agentId = '12345678';
      const workspacePath = '/workspace/test';
      const expected = join(homedir(), '.claude', 'projects', '-workspace-test', 'agent-12345678.jsonl');
      expect(getTranscriptPath(agentId, workspacePath)).toBe(expected);
    });
  });
});
