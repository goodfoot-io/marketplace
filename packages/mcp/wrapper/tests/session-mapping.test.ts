/**
 * Tests for session mapping storage
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { getClaudeConfigDir, getWorkspaceName } from '../src/agent-id.js';
import { saveSessionMapping, getSessionId } from '../src/session-mapping.js';

describe('session mapping storage', () => {
  const testWorkspace = '/test/workspace/path';
  let testMappingPath: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    // Use a unique temp directory for testing (mkdtemp guarantees no collisions with
    // concurrently running test files that use the same claude-test- prefix)
    process.env.CLAUDE_CONFIG_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-test-'));
    const workspaceName = getWorkspaceName(testWorkspace);
    testMappingPath = path.join(getClaudeConfigDir(), 'mcp-wrapper-server', workspaceName, 'session-mappings.json');
  });

  afterEach(async () => {
    // Clean up test files
    if (process.env.CLAUDE_CONFIG_DIR) {
      try {
        await fs.rm(process.env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
  });

  describe('saveSessionMapping', () => {
    it('should save a session ID mapping for an agent ID', async () => {
      const agentId = 'agent-123';
      const sessionId = 'session-456';

      await saveSessionMapping(agentId, sessionId, testWorkspace);

      // Verify file exists and contains correct data
      const content = await fs.readFile(testMappingPath, 'utf-8');
      const mappings = JSON.parse(content) as Record<string, string>;
      expect(mappings[agentId]).toBe(sessionId);
    });

    it('should create directory structure if missing', async () => {
      const agentId = 'agent-new';
      const sessionId = 'session-new';

      // Directory should not exist yet
      const mappingDir = path.dirname(testMappingPath);
      await expect(fs.access(mappingDir)).rejects.toThrow();

      await saveSessionMapping(agentId, sessionId, testWorkspace);

      // Directory should now exist
      await expect(fs.access(mappingDir)).resolves.not.toThrow();
    });

    it('should update an existing agent ID mapping', async () => {
      const agentId = 'agent-update';
      const sessionId1 = 'session-old';
      const sessionId2 = 'session-new';

      // Save initial mapping
      await saveSessionMapping(agentId, sessionId1, testWorkspace);
      let content = await fs.readFile(testMappingPath, 'utf-8');
      let mappings = JSON.parse(content) as Record<string, string>;
      expect(mappings[agentId]).toBe(sessionId1);

      // Update mapping
      await saveSessionMapping(agentId, sessionId2, testWorkspace);
      content = await fs.readFile(testMappingPath, 'utf-8');
      mappings = JSON.parse(content) as Record<string, string>;
      expect(mappings[agentId]).toBe(sessionId2);
    });

    it('should preserve other mappings when updating', async () => {
      const agentId1 = 'agent-1';
      const sessionId1 = 'session-1';
      const agentId2 = 'agent-2';
      const sessionId2 = 'session-2';
      const agentId3 = 'agent-3';
      const sessionId3 = 'session-3';

      // Save multiple mappings
      await saveSessionMapping(agentId1, sessionId1, testWorkspace);
      await saveSessionMapping(agentId2, sessionId2, testWorkspace);
      await saveSessionMapping(agentId3, sessionId3, testWorkspace);

      // Verify all mappings exist
      const content = await fs.readFile(testMappingPath, 'utf-8');
      const mappings = JSON.parse(content) as Record<string, string>;
      expect(mappings[agentId1]).toBe(sessionId1);
      expect(mappings[agentId2]).toBe(sessionId2);
      expect(mappings[agentId3]).toBe(sessionId3);
    });

    it('should handle concurrent saves gracefully', async () => {
      const agentIds = ['agent-a', 'agent-b', 'agent-c', 'agent-d', 'agent-e'];
      const sessionIds = ['session-a', 'session-b', 'session-c', 'session-d', 'session-e'];

      // Save all mappings concurrently
      await Promise.all(
        agentIds.map((agentId, index) => saveSessionMapping(agentId, sessionIds[index], testWorkspace))
      );

      // Verify all mappings were saved
      const content = await fs.readFile(testMappingPath, 'utf-8');
      const mappings = JSON.parse(content) as Record<string, string>;

      agentIds.forEach((agentId, index) => {
        expect(mappings[agentId]).toBe(sessionIds[index]);
      });
      expect(Object.keys(mappings).length).toBe(5);
    });

    it('should use process.cwd() when no workspace path provided', async () => {
      const agentId = 'agent-cwd';
      const sessionId = 'session-cwd';

      await saveSessionMapping(agentId, sessionId);

      // Calculate expected path with process.cwd()
      const workspaceName = getWorkspaceName();
      const expectedPath = path.join(
        getClaudeConfigDir(),
        'mcp-wrapper-server',
        workspaceName,
        'session-mappings.json'
      );

      const content = await fs.readFile(expectedPath, 'utf-8');
      const mappings = JSON.parse(content) as Record<string, string>;
      expect(mappings[agentId]).toBe(sessionId);

      // Clean up
      await fs.rm(path.dirname(expectedPath), { recursive: true, force: true });
    });

    it('should handle invalid JSON in existing file', async () => {
      // Create file with invalid JSON
      const mappingDir = path.dirname(testMappingPath);
      await fs.mkdir(mappingDir, { recursive: true });
      await fs.writeFile(testMappingPath, 'invalid json{', 'utf-8');

      const agentId = 'agent-invalid';
      const sessionId = 'session-invalid';

      // Should overwrite with valid JSON
      await saveSessionMapping(agentId, sessionId, testWorkspace);

      const content = await fs.readFile(testMappingPath, 'utf-8');
      const mappings = JSON.parse(content) as Record<string, string>;
      expect(mappings[agentId]).toBe(sessionId);
    });

    it('should handle empty agent IDs', async () => {
      const agentId = '';
      const sessionId = 'session-empty-agent';

      await saveSessionMapping(agentId, sessionId, testWorkspace);

      const content = await fs.readFile(testMappingPath, 'utf-8');
      const mappings = JSON.parse(content) as Record<string, string>;
      expect(mappings[agentId]).toBe(sessionId);
    });

    it('should handle empty session IDs', async () => {
      const agentId = 'agent-empty-session';
      const sessionId = '';

      await saveSessionMapping(agentId, sessionId, testWorkspace);

      const content = await fs.readFile(testMappingPath, 'utf-8');
      const mappings = JSON.parse(content) as Record<string, string>;
      expect(mappings[agentId]).toBe(sessionId);
    });

    it('should handle special characters in IDs', async () => {
      const agentId = 'agent-with-special!@#$%^&*()';
      const sessionId = 'session-with-uuid-{abc-123-def}';

      await saveSessionMapping(agentId, sessionId, testWorkspace);

      const content = await fs.readFile(testMappingPath, 'utf-8');
      const mappings = JSON.parse(content) as Record<string, string>;
      expect(mappings[agentId]).toBe(sessionId);
    });
  });

  describe('getSessionId', () => {
    it('should retrieve a saved session ID', async () => {
      const agentId = 'agent-retrieve';
      const sessionId = 'session-retrieve';

      await saveSessionMapping(agentId, sessionId, testWorkspace);
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBe(sessionId);
    });

    it('should return null for non-existent agent ID', async () => {
      const agentId = 'agent-nonexistent';

      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBeNull();
    });

    it('should return null when mapping file does not exist', async () => {
      const agentId = 'agent-no-file';

      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBeNull();
    });

    it('should handle concurrent reads', async () => {
      const agentId = 'agent-concurrent';
      const sessionId = 'session-concurrent';

      await saveSessionMapping(agentId, sessionId, testWorkspace);

      // Read concurrently multiple times
      const reads = await Promise.all([
        getSessionId(agentId, testWorkspace),
        getSessionId(agentId, testWorkspace),
        getSessionId(agentId, testWorkspace),
        getSessionId(agentId, testWorkspace),
        getSessionId(agentId, testWorkspace)
      ]);

      reads.forEach((result: string | null) => {
        expect(result).toBe(sessionId);
      });
    });

    it('should use process.cwd() when no workspace path provided', async () => {
      const agentId = 'agent-cwd-get';
      const sessionId = 'session-cwd-get';

      await saveSessionMapping(agentId, sessionId);
      const retrieved = await getSessionId(agentId);

      expect(retrieved).toBe(sessionId);

      // Clean up
      const workspaceName = getWorkspaceName();
      const mappingDir = path.join(getClaudeConfigDir(), 'mcp-wrapper-server', workspaceName);
      await fs.rm(mappingDir, { recursive: true, force: true });
    });

    it('should handle invalid JSON file gracefully', async () => {
      // Create file with invalid JSON
      const mappingDir = path.dirname(testMappingPath);
      await fs.mkdir(mappingDir, { recursive: true });
      await fs.writeFile(testMappingPath, 'not json at all', 'utf-8');

      const agentId = 'agent-invalid-read';
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBeNull();
    });

    it('should handle empty mapping file', async () => {
      // Create empty file
      const mappingDir = path.dirname(testMappingPath);
      await fs.mkdir(mappingDir, { recursive: true });
      await fs.writeFile(testMappingPath, '{}', 'utf-8');

      const agentId = 'agent-empty-file';
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBeNull();
    });

    it('should retrieve correct session ID among multiple mappings', async () => {
      // Save multiple mappings
      await saveSessionMapping('agent-1', 'session-1', testWorkspace);
      await saveSessionMapping('agent-2', 'session-2', testWorkspace);
      await saveSessionMapping('agent-3', 'session-3', testWorkspace);

      // Retrieve specific one
      const retrieved = await getSessionId('agent-2', testWorkspace);

      expect(retrieved).toBe('session-2');
    });

    it('should handle special characters in agent ID lookup', async () => {
      const agentId = 'agent-special-!@#$';
      const sessionId = 'session-special';

      await saveSessionMapping(agentId, sessionId, testWorkspace);
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBe(sessionId);
    });
  });

  describe('persistence across restarts', () => {
    it('should persist mappings after process simulation', async () => {
      const agentId = 'agent-persist';
      const sessionId = 'session-persist';

      // Save mapping
      await saveSessionMapping(agentId, sessionId, testWorkspace);

      // Simulate restart by creating new instances (file system persists)
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBe(sessionId);
    });

    it('should persist multiple mappings', async () => {
      const mappings = [
        { agentId: 'agent-a', sessionId: 'session-a' },
        { agentId: 'agent-b', sessionId: 'session-b' },
        { agentId: 'agent-c', sessionId: 'session-c' }
      ];

      // Save all mappings
      for (const { agentId, sessionId } of mappings) {
        await saveSessionMapping(agentId, sessionId, testWorkspace);
      }

      // Verify all persist
      for (const { agentId, sessionId } of mappings) {
        const retrieved = await getSessionId(agentId, testWorkspace);
        expect(retrieved).toBe(sessionId);
      }
    });

    it('should handle updates to persisted mappings', async () => {
      const agentId = 'agent-update-persist';
      const sessionId1 = 'session-old-persist';
      const sessionId2 = 'session-new-persist';

      // Save initial
      await saveSessionMapping(agentId, sessionId1, testWorkspace);
      expect(await getSessionId(agentId, testWorkspace)).toBe(sessionId1);

      // Update
      await saveSessionMapping(agentId, sessionId2, testWorkspace);
      expect(await getSessionId(agentId, testWorkspace)).toBe(sessionId2);
    });
  });

  describe('different workspaces', () => {
    it('should isolate mappings between different workspaces', async () => {
      const workspace1 = '/workspace/project-1';
      const workspace2 = '/workspace/project-2';
      const agentId = 'same-agent-id';
      const sessionId1 = 'session-workspace-1';
      const sessionId2 = 'session-workspace-2';

      // Save same agent ID in different workspaces
      await saveSessionMapping(agentId, sessionId1, workspace1);
      await saveSessionMapping(agentId, sessionId2, workspace2);

      // Verify isolation
      const retrieved1 = await getSessionId(agentId, workspace1);
      const retrieved2 = await getSessionId(agentId, workspace2);

      expect(retrieved1).toBe(sessionId1);
      expect(retrieved2).toBe(sessionId2);
      expect(retrieved1).not.toBe(retrieved2);

      // Clean up workspace 1
      const workspaceName1 = getWorkspaceName(workspace1);
      const mappingDir1 = path.join(getClaudeConfigDir(), 'mcp-wrapper-server', workspaceName1);
      await fs.rm(mappingDir1, { recursive: true, force: true });

      // Clean up workspace 2
      const workspaceName2 = getWorkspaceName(workspace2);
      const mappingDir2 = path.join(getClaudeConfigDir(), 'mcp-wrapper-server', workspaceName2);
      await fs.rm(mappingDir2, { recursive: true, force: true });
    });

    it('should not leak data between workspaces', async () => {
      const workspace1 = '/workspace/isolated-1';
      const workspace2 = '/workspace/isolated-2';
      const agentId1 = 'agent-isolated-1';
      const agentId2 = 'agent-isolated-2';
      const sessionId1 = 'session-isolated-1';
      const sessionId2 = 'session-isolated-2';

      // Save in workspace 1
      await saveSessionMapping(agentId1, sessionId1, workspace1);

      // Save in workspace 2
      await saveSessionMapping(agentId2, sessionId2, workspace2);

      // Verify workspace 1 doesn't see workspace 2 data
      expect(await getSessionId(agentId1, workspace1)).toBe(sessionId1);
      expect(await getSessionId(agentId2, workspace1)).toBeNull();

      // Verify workspace 2 doesn't see workspace 1 data
      expect(await getSessionId(agentId2, workspace2)).toBe(sessionId2);
      expect(await getSessionId(agentId1, workspace2)).toBeNull();

      // Clean up workspace 1
      const workspaceName1 = getWorkspaceName(workspace1);
      const mappingDir1 = path.join(getClaudeConfigDir(), 'mcp-wrapper-server', workspaceName1);
      await fs.rm(mappingDir1, { recursive: true, force: true });

      // Clean up workspace 2
      const workspaceName2 = getWorkspaceName(workspace2);
      const mappingDir2 = path.join(getClaudeConfigDir(), 'mcp-wrapper-server', workspaceName2);
      await fs.rm(mappingDir2, { recursive: true, force: true });
    });
  });

  describe('edge cases', () => {
    it('should handle very long agent IDs', async () => {
      const agentId = 'a'.repeat(1000);
      const sessionId = 'session-long-agent';

      await saveSessionMapping(agentId, sessionId, testWorkspace);
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBe(sessionId);
    });

    it('should handle very long session IDs', async () => {
      const agentId = 'agent-long-session';
      const sessionId = 's'.repeat(1000);

      await saveSessionMapping(agentId, sessionId, testWorkspace);
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBe(sessionId);
    });

    it('should handle unicode characters in IDs', async () => {
      const agentId = 'agent-emoji-😀-test';
      const sessionId = 'session-unicode-日本語';

      await saveSessionMapping(agentId, sessionId, testWorkspace);
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBe(sessionId);
    });

    it('should handle newlines in IDs', async () => {
      const agentId = 'agent\nwith\nnewlines';
      const sessionId = 'session\nwith\nnewlines';

      await saveSessionMapping(agentId, sessionId, testWorkspace);
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBe(sessionId);
    });

    it('should handle JSON special characters in IDs', async () => {
      const agentId = 'agent-"quotes"-and-\\backslashes\\';
      const sessionId = 'session-{braces}-and-[brackets]';

      await saveSessionMapping(agentId, sessionId, testWorkspace);
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBe(sessionId);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: save multiple, retrieve specific', async () => {
      const testData = [
        { agentId: 'workflow-1', sessionId: 'wf-session-1' },
        { agentId: 'workflow-2', sessionId: 'wf-session-2' },
        { agentId: 'workflow-3', sessionId: 'wf-session-3' }
      ];

      // Save all
      for (const { agentId, sessionId } of testData) {
        await saveSessionMapping(agentId, sessionId, testWorkspace);
      }

      // Retrieve each one
      for (const { agentId, sessionId } of testData) {
        expect(await getSessionId(agentId, testWorkspace)).toBe(sessionId);
      }

      // Update one
      await saveSessionMapping('workflow-2', 'wf-session-2-updated', testWorkspace);

      // Verify update
      expect(await getSessionId('workflow-2', testWorkspace)).toBe('wf-session-2-updated');

      // Verify others unchanged
      expect(await getSessionId('workflow-1', testWorkspace)).toBe('wf-session-1');
      expect(await getSessionId('workflow-3', testWorkspace)).toBe('wf-session-3');
    });

    it('should handle rapid sequential operations', async () => {
      const agentId = 'agent-rapid';

      // Rapid updates
      await saveSessionMapping(agentId, 'session-1', testWorkspace);
      await saveSessionMapping(agentId, 'session-2', testWorkspace);
      await saveSessionMapping(agentId, 'session-3', testWorkspace);
      await saveSessionMapping(agentId, 'session-4', testWorkspace);
      await saveSessionMapping(agentId, 'session-final', testWorkspace);

      // Verify final state
      expect(await getSessionId(agentId, testWorkspace)).toBe('session-final');
    });

    it('should handle mixed concurrent reads and writes', async () => {
      const agentId = 'agent-mixed';
      const sessionId = 'session-mixed';

      // Initial save
      await saveSessionMapping(agentId, sessionId, testWorkspace);

      // Mix reads and writes concurrently
      const operations = [
        getSessionId(agentId, testWorkspace),
        saveSessionMapping('agent-new-1', 'session-new-1', testWorkspace),
        getSessionId(agentId, testWorkspace),
        saveSessionMapping('agent-new-2', 'session-new-2', testWorkspace),
        getSessionId(agentId, testWorkspace)
      ];

      const results = await Promise.all(operations);

      // Verify reads returned correct value
      expect(results[0]).toBe(sessionId);
      expect(results[2]).toBe(sessionId);
      expect(results[4]).toBe(sessionId);

      // Verify writes succeeded
      expect(await getSessionId('agent-new-1', testWorkspace)).toBe('session-new-1');
      expect(await getSessionId('agent-new-2', testWorkspace)).toBe('session-new-2');
    });
  });
});
