/**
 * Tests for agent ID generation and workspace utilities
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { generateAgentId, getClaudeConfigDir, getWorkspaceName, getTranscriptPath } from '../src/agent-id.js';

describe('generateAgentId', () => {
  it('should generate 8-character hex string', () => {
    const agentId = generateAgentId();
    expect(agentId).toMatch(/^[0-9a-f]{8}$/);
    expect(agentId.length).toBe(8);
  });

  it('should generate unique IDs on subsequent calls', () => {
    const id1 = generateAgentId();
    const id2 = generateAgentId();
    const id3 = generateAgentId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it('should only contain lowercase hex characters', () => {
    // Generate multiple IDs to ensure consistency
    for (let i = 0; i < 10; i++) {
      const agentId = generateAgentId();
      expect(agentId).toMatch(/^[0-9a-f]+$/);
      expect(agentId).not.toMatch(/[A-F]/); // No uppercase
      expect(agentId).not.toMatch(/[g-z]/); // No non-hex letters
    }
  });
});

describe('getWorkspaceName', () => {
  it('should replace non-alphanumeric characters with hyphens', () => {
    const mockCwd = '/home/user/my-project';
    const result = getWorkspaceName(mockCwd);
    expect(result).toBe('-home-user-my-project');
  });

  it('should handle paths with multiple consecutive special characters', () => {
    const mockCwd = '/home/user//my__project';
    const result = getWorkspaceName(mockCwd);
    expect(result).toBe('-home-user--my--project');
  });

  it('should handle paths with spaces', () => {
    const mockCwd = '/home/user/my project folder';
    const result = getWorkspaceName(mockCwd);
    expect(result).toBe('-home-user-my-project-folder');
  });

  it('should handle Windows-style paths', () => {
    const mockCwd = 'C:\\Users\\Developer\\Projects\\MyApp';
    const result = getWorkspaceName(mockCwd);
    expect(result).toBe('C--Users-Developer-Projects-MyApp');
  });

  it('should handle paths with dots', () => {
    const mockCwd = '/home/user/project.name.v1.0';
    const result = getWorkspaceName(mockCwd);
    expect(result).toBe('-home-user-project-name-v1-0');
  });

  it('should preserve alphanumeric characters', () => {
    const mockCwd = '/home123/user456/project789';
    const result = getWorkspaceName(mockCwd);
    expect(result).toBe('-home123-user456-project789');
  });

  it('should handle path with underscores', () => {
    const mockCwd = '/home/user/my_project_name';
    const result = getWorkspaceName(mockCwd);
    expect(result).toBe('-home-user-my-project-name');
  });

  it('should handle path with mixed special characters', () => {
    const mockCwd = '/home/user/my-project@2024!v1.0';
    const result = getWorkspaceName(mockCwd);
    expect(result).toBe('-home-user-my-project-2024-v1-0');
  });

  it('should use process.cwd() when no path provided', () => {
    const result = getWorkspaceName();
    const cwdNormalized = process.cwd().replace(/[^a-zA-Z0-9]/g, '-');
    expect(result).toBe(cwdNormalized);
  });

  it('should handle nested project paths', () => {
    const mockCwd = '/workspace/.worktrees/feature-branch';
    const result = getWorkspaceName(mockCwd);
    expect(result).toBe('-workspace--worktrees-feature-branch');
  });

  it('should handle empty path segments', () => {
    const mockCwd = '///home///user///';
    const result = getWorkspaceName(mockCwd);
    expect(result).toBe('---home---user---');
  });
});

describe('getClaudeConfigDir', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
  });

  it('should return ~/.claude when CLAUDE_CONFIG_DIR is not set', () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    const result = getClaudeConfigDir();
    const expected = path.join(os.homedir(), '.claude');
    expect(result).toBe(expected);
  });

  it('should return CLAUDE_CONFIG_DIR when env var is set', () => {
    process.env.CLAUDE_CONFIG_DIR = '/custom/config/path';
    const result = getClaudeConfigDir();
    expect(result).toBe('/custom/config/path');
  });

  it('should handle Windows-style paths in CLAUDE_CONFIG_DIR', () => {
    process.env.CLAUDE_CONFIG_DIR = 'C:\\Users\\TestUser\\.claude-config';
    const result = getClaudeConfigDir();
    expect(result).toBe('C:\\Users\\TestUser\\.claude-config');
  });

  it('should respect CLAUDE_CONFIG_DIR with relative path', () => {
    process.env.CLAUDE_CONFIG_DIR = './config';
    const result = getClaudeConfigDir();
    expect(result).toBe('./config');
  });
});

describe('getTranscriptPath', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
  });

  it('should return path in ~/.claude/mcp-wrapper-server/{workspace}/agent-{agentId}.jsonl format', () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    const agentId = 'abc12345';
    const mockCwd = '/home/user/my-project';
    const result = getTranscriptPath(agentId, mockCwd);

    const homeDir = os.homedir();
    const workspaceName = '-home-user-my-project';
    const expected = path.join(homeDir, '.claude', 'mcp-wrapper-server', workspaceName, `agent-${agentId}.jsonl`);

    expect(result).toBe(expected);
  });

  it('should handle different agent IDs', () => {
    const mockCwd = '/home/user/project';
    const agentId1 = 'aabbccdd';
    const agentId2 = '11223344';

    const path1 = getTranscriptPath(agentId1, mockCwd);
    const path2 = getTranscriptPath(agentId2, mockCwd);

    expect(path1).toContain('agent-aabbccdd.jsonl');
    expect(path2).toContain('agent-11223344.jsonl');
    expect(path1).not.toBe(path2);
  });

  it('should normalize workspace name in path', () => {
    const agentId = 'abc12345';
    const mockCwd = '/my-special@project!2024';
    const result = getTranscriptPath(agentId, mockCwd);

    expect(result).toContain('-my-special-project-2024');
    expect(result).toContain('agent-abc12345.jsonl');
  });

  it('should use process.cwd() when no workspace path provided', () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    const agentId = 'abc12345';
    const result = getTranscriptPath(agentId);

    const homeDir = os.homedir();
    const workspaceName = getWorkspaceName();
    const expected = path.join(homeDir, '.claude', 'mcp-wrapper-server', workspaceName, `agent-${agentId}.jsonl`);

    expect(result).toBe(expected);
  });

  it('should handle workspace paths with spaces', () => {
    const agentId = 'test1234';
    const mockCwd = '/home/user/my project folder';
    const result = getTranscriptPath(agentId, mockCwd);

    expect(result).toContain('-home-user-my-project-folder');
    expect(result).toContain('agent-test1234.jsonl');
  });

  it('should create consistent paths for same inputs', () => {
    const agentId = 'same1234';
    const mockCwd = '/consistent/path';

    const path1 = getTranscriptPath(agentId, mockCwd);
    const path2 = getTranscriptPath(agentId, mockCwd);

    expect(path1).toBe(path2);
  });

  it('should include .claude/mcp-wrapper-server directory structure', () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    const agentId = 'test5678';
    const mockCwd = '/workspace/project';
    const result = getTranscriptPath(agentId, mockCwd);

    expect(result).toContain('.claude');
    expect(result).toContain('mcp-wrapper-server');
    expect(result).toContain('-workspace-project');
    expect(result).toContain('agent-test5678.jsonl');
  });

  it('should handle Windows workspace paths', () => {
    const agentId = 'win12345';
    const mockCwd = 'C:\\Users\\Developer\\Project';
    const result = getTranscriptPath(agentId, mockCwd);

    expect(result).toContain('C--Users-Developer-Project');
    expect(result).toContain('agent-win12345.jsonl');
  });

  it('should use absolute paths from home directory', () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    const agentId = 'abs12345';
    const mockCwd = '/any/workspace';
    const result = getTranscriptPath(agentId, mockCwd);

    const homeDir = os.homedir();
    expect(result).toMatch(new RegExp(`^${homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  });

  it('should use custom config directory when CLAUDE_CONFIG_DIR is set', () => {
    process.env.CLAUDE_CONFIG_DIR = '/custom/config';
    const agentId = 'custom123';
    const mockCwd = '/workspace/test';
    const result = getTranscriptPath(agentId, mockCwd);

    const expected = path.join('/custom/config', 'mcp-wrapper-server', '-workspace-test', 'agent-custom123.jsonl');
    expect(result).toBe(expected);
  });

  it('should create consistent paths with CLAUDE_CONFIG_DIR set', () => {
    process.env.CLAUDE_CONFIG_DIR = '/tmp/claude-test';
    const agentId = 'consistent1';
    const mockCwd = '/workspace/path';

    const path1 = getTranscriptPath(agentId, mockCwd);
    const path2 = getTranscriptPath(agentId, mockCwd);

    expect(path1).toBe(path2);
    expect(path1).toContain('/tmp/claude-test');
    expect(path1).not.toContain(os.homedir());
  });

  it('should handle CLAUDE_CONFIG_DIR with Windows paths', () => {
    process.env.CLAUDE_CONFIG_DIR = 'D:\\CustomConfig\\Claude';
    const agentId = 'win99999';
    const mockCwd = 'C:\\Projects\\MyApp';
    const result = getTranscriptPath(agentId, mockCwd);

    expect(result).toContain('D:\\CustomConfig\\Claude');
    expect(result).toContain('mcp-wrapper-server');
    expect(result).toContain('C--Projects-MyApp');
    expect(result).toContain('agent-win99999.jsonl');
  });
});

describe('integration scenarios', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
  });

  it('should create complete workflow: generate ID and get transcript path', () => {
    const agentId = generateAgentId();
    const transcriptPath = getTranscriptPath(agentId);

    expect(agentId).toMatch(/^[0-9a-f]{8}$/);
    expect(transcriptPath).toContain(`agent-${agentId}.jsonl`);
    expect(transcriptPath).toContain('.claude');
    expect(transcriptPath).toContain('mcp-wrapper-server');
  });

  it('should handle multiple agents in same workspace', () => {
    const mockCwd = '/workspace/test-project';

    const agentId1 = generateAgentId();
    const agentId2 = generateAgentId();

    const path1 = getTranscriptPath(agentId1, mockCwd);
    const path2 = getTranscriptPath(agentId2, mockCwd);

    // Different files but same directory
    expect(path.dirname(path1)).toBe(path.dirname(path2));
    expect(path1).not.toBe(path2);
    expect(path1).toContain(`agent-${agentId1}.jsonl`);
    expect(path2).toContain(`agent-${agentId2}.jsonl`);
  });

  it('should handle different workspaces with same agent ID', () => {
    const agentId = 'shared123';
    const workspace1 = '/workspace/project-a';
    const workspace2 = '/workspace/project-b';

    const path1 = getTranscriptPath(agentId, workspace1);
    const path2 = getTranscriptPath(agentId, workspace2);

    // Different directories, same filename
    expect(path.dirname(path1)).not.toBe(path.dirname(path2));
    expect(path1).toContain('project-a');
    expect(path2).toContain('project-b');
    expect(path.basename(path1)).toBe(path.basename(path2));
  });
});
