/**
 * Tests for resume functionality with session ID mapping
 *
 * This test suite verifies that when resuming with an agent ID,
 * the wrapper correctly maps it to a session ID for the SDK.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { getClaudeConfigDir, getWorkspaceName } from '../src/agent-id.js';
import { saveSessionMapping, getSessionId } from '../src/session-mapping.js';

describe('resume with session ID mapping', () => {
  const testWorkspace = '/test/workspace/resume';
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    // Use a temp directory for testing
    process.env.CLAUDE_CONFIG_DIR = path.join(os.tmpdir(), `claude-test-${Date.now()}`);
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

  describe('session ID lookup for resume', () => {
    it('should map agent ID to session ID for resume operations', async () => {
      // Simulate first agent execution that captures session ID
      const agentId = 'agent-abc123';
      const sessionId = 'session-xyz789';

      // Save the mapping (this would happen during agent execution)
      await saveSessionMapping(agentId, sessionId, testWorkspace);

      // Verify the mapping was saved
      const retrievedSessionId = await getSessionId(agentId, testWorkspace);
      expect(retrievedSessionId).toBe(sessionId);
    });

    it('should return null when agent ID has no session mapping', async () => {
      const agentId = 'agent-never-executed';

      // Try to get session ID for an agent that never ran
      const sessionId = await getSessionId(agentId, testWorkspace);
      expect(sessionId).toBeNull();
    });

    it('should handle multiple agent-to-session mappings', async () => {
      const mappings = [
        { agentId: 'agent-001', sessionId: 'session-001' },
        { agentId: 'agent-002', sessionId: 'session-002' },
        { agentId: 'agent-003', sessionId: 'session-003' }
      ];

      // Save all mappings
      for (const { agentId, sessionId } of mappings) {
        await saveSessionMapping(agentId, sessionId, testWorkspace);
      }

      // Verify each can be retrieved independently
      for (const { agentId, sessionId } of mappings) {
        const retrieved = await getSessionId(agentId, testWorkspace);
        expect(retrieved).toBe(sessionId);
      }
    });

    it('should use the most recent session ID when agent is re-executed', async () => {
      const agentId = 'agent-reexecuted';
      const firstSessionId = 'session-first';
      const secondSessionId = 'session-second';

      // First execution
      await saveSessionMapping(agentId, firstSessionId, testWorkspace);
      expect(await getSessionId(agentId, testWorkspace)).toBe(firstSessionId);

      // Re-execution with new session ID
      await saveSessionMapping(agentId, secondSessionId, testWorkspace);
      expect(await getSessionId(agentId, testWorkspace)).toBe(secondSessionId);
    });
  });

  describe('resume workflow simulation', () => {
    it('should complete full resume workflow: execute -> save -> resume', async () => {
      // Step 1: Simulate initial agent execution
      const initialAgentId = 'agent-initial-exec';
      const capturedSessionId = 'session-captured-123';

      // During execution, session ID is captured and saved
      await saveSessionMapping(initialAgentId, capturedSessionId, testWorkspace);

      // Step 2: User wants to resume with the agent ID
      const resumeAgentId = initialAgentId;

      // Step 3: Lookup session ID for resume
      const sessionIdForResume = await getSessionId(resumeAgentId, testWorkspace);

      // Step 4: Verify we got the correct session ID to pass to SDK
      expect(sessionIdForResume).toBe(capturedSessionId);
      expect(sessionIdForResume).not.toBeNull();
    });

    it('should handle resume failure gracefully when no session mapping exists', async () => {
      const agentId = 'agent-no-mapping';

      // Try to resume with an agent that has no session mapping
      const sessionId = await getSessionId(agentId, testWorkspace);

      // Should return null, allowing wrapper to handle gracefully
      expect(sessionId).toBeNull();
    });

    it('should persist session mappings across operations', async () => {
      const agentId = 'agent-persistent';
      const sessionId = 'session-persistent-456';

      // Save mapping
      await saveSessionMapping(agentId, sessionId, testWorkspace);

      // Simulate multiple lookups (like multiple resume attempts)
      const lookup1 = await getSessionId(agentId, testWorkspace);
      const lookup2 = await getSessionId(agentId, testWorkspace);
      const lookup3 = await getSessionId(agentId, testWorkspace);

      // All lookups should return the same session ID
      expect(lookup1).toBe(sessionId);
      expect(lookup2).toBe(sessionId);
      expect(lookup3).toBe(sessionId);
    });
  });

  describe('edge cases for resume', () => {
    it('should handle concurrent session saves and lookups', async () => {
      const agents = [
        { agentId: 'agent-concurrent-1', sessionId: 'session-concurrent-1' },
        { agentId: 'agent-concurrent-2', sessionId: 'session-concurrent-2' },
        { agentId: 'agent-concurrent-3', sessionId: 'session-concurrent-3' }
      ];

      // Save all mappings concurrently (simulating multiple agent executions)
      await Promise.all(agents.map(({ agentId, sessionId }) => saveSessionMapping(agentId, sessionId, testWorkspace)));

      // Lookup all concurrently (simulating multiple resume operations)
      const lookups = await Promise.all(agents.map(({ agentId }) => getSessionId(agentId, testWorkspace)));

      // Verify all lookups succeeded with correct session IDs
      agents.forEach(({ sessionId }, index) => {
        expect(lookups[index]).toBe(sessionId);
      });
    });

    it('should handle empty agent ID gracefully', async () => {
      const agentId = '';
      const sessionId = 'session-empty-agent';

      await saveSessionMapping(agentId, sessionId, testWorkspace);
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBe(sessionId);
    });

    it('should handle session IDs with special characters', async () => {
      const agentId = 'agent-special-chars';
      const sessionId = 'session-{uuid-abc-123-def}-special';

      await saveSessionMapping(agentId, sessionId, testWorkspace);
      const retrieved = await getSessionId(agentId, testWorkspace);

      expect(retrieved).toBe(sessionId);
    });
  });

  describe('workspace isolation for resume', () => {
    it('should isolate session mappings between different workspaces', async () => {
      const workspace1 = '/workspace/project-a';
      const workspace2 = '/workspace/project-b';
      const agentId = 'agent-same-name';
      const sessionId1 = 'session-workspace-a';
      const sessionId2 = 'session-workspace-b';

      // Save same agent ID in different workspaces with different session IDs
      await saveSessionMapping(agentId, sessionId1, workspace1);
      await saveSessionMapping(agentId, sessionId2, workspace2);

      // Verify each workspace gets its own session ID
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
  });

  describe('bug reproduction: agent ID passed directly to SDK', () => {
    it('should demonstrate the bug when agent ID is used as-is for resume', async () => {
      // This test documents the bug behavior
      const agentId = 'agent-bug-test';
      const sessionId = 'session-bug-test';

      // Step 1: First execution saves the mapping
      await saveSessionMapping(agentId, sessionId, testWorkspace);

      // Step 2: When resuming, we need to lookup the session ID
      // BUG: If we pass agentId directly to SDK, it fails
      // FIX: We should lookup sessionId and pass that instead
      const resumeValue = await getSessionId(agentId, testWorkspace);

      // The resume value should be the session ID, not the agent ID
      expect(resumeValue).toBe(sessionId);
      expect(resumeValue).not.toBe(agentId);
    });

    it('should return null when trying to resume non-existent agent', async () => {
      const nonExistentAgentId = 'agent-does-not-exist';

      // Try to get session ID for resume
      const sessionId = await getSessionId(nonExistentAgentId, testWorkspace);

      // Should return null, indicating no session mapping exists
      expect(sessionId).toBeNull();
    });
  });
});
