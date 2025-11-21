/**
 * Tests for background agent tracking system
 */

import type { AgentToolResponse } from '../src/types/wrapper.js';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { getTranscriptPath } from '../src/agent-id.js';
import {
  registerAgent,
  getAgentStatus,
  getAgentResult,
  clearAgents,
  type CompletedResponse
} from '../src/background-agents.js';

/**
 * Type guard to check if result is the old CompletedResponse type
 */
function isOldCompletedResponse(result: AgentToolResponse | CompletedResponse | null): result is CompletedResponse {
  return result !== null && 'output' in result && 'sessionId' in result;
}

describe('Background Agents', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'agent-test-'));
    // Clear agent registry before each test
    clearAgents();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(testDir, { recursive: true, force: true });
    // Clear agent registry after each test
    clearAgents();
  });

  describe('registerAgent', () => {
    it('should register an agent with a Promise', async () => {
      const agentId = 'test1234';
      const response: CompletedResponse = {
        sessionId: 'session-123',
        output: 'Test output',
        status: 'completed'
      };
      const promise = Promise.resolve(response);

      registerAgent(agentId, promise);

      const status = await getAgentStatus(agentId);
      expect(status).toBe('completed');
    });

    it('should allow registering multiple agents', async () => {
      const agentId1 = 'agent-001';
      const agentId2 = 'agent-002';
      const promise1 = Promise.resolve({ sessionId: 's1', output: 'o1', status: 'completed' as const });
      const promise2 = Promise.resolve({ sessionId: 's2', output: 'o2', status: 'completed' as const });

      registerAgent(agentId1, promise1);
      registerAgent(agentId2, promise2);

      // Both should be registered
      await expect(getAgentStatus(agentId1)).resolves.toBe('completed');
      await expect(getAgentStatus(agentId2)).resolves.toBe('completed');
    });

    it('should allow overwriting existing agent registration', async () => {
      const agentId = 'overwrite-test';
      const promise1 = Promise.resolve({ sessionId: 's1', output: 'first', status: 'completed' as const });
      const promise2 = Promise.resolve({ sessionId: 's2', output: 'second', status: 'completed' as const });

      registerAgent(agentId, promise1);
      registerAgent(agentId, promise2);

      const result = await getAgentResult(agentId, testDir);
      expect(isOldCompletedResponse(result)).toBe(true);
      if (isOldCompletedResponse(result)) {
        expect(result.output).toBe('second');
      }
    });
  });

  describe('getAgentStatus', () => {
    it('should return "running" for pending Promise', async () => {
      const agentId = 'pending-agent';
      const promise = new Promise<CompletedResponse>(() => {
        // Never resolves - remains pending
      });

      registerAgent(agentId, promise);

      const status = await getAgentStatus(agentId);
      expect(status).toBe('running');
    });

    it('should return "completed" for resolved Promise', async () => {
      const agentId = 'completed-agent';
      const response: CompletedResponse = {
        sessionId: 'session-123',
        output: 'Success',
        status: 'completed'
      };
      const promise = Promise.resolve(response);

      registerAgent(agentId, promise);

      // Wait for Promise to settle
      await promise;

      const status = await getAgentStatus(agentId);
      expect(status).toBe('completed');
    });

    it('should return "failed" for rejected Promise', async () => {
      const agentId = 'failed-agent';
      const promise = Promise.reject(new Error('Test error'));

      registerAgent(agentId, promise);

      // Wait for Promise to settle and suppress unhandled rejection
      await promise.catch(() => {});

      const status = await getAgentStatus(agentId);
      expect(status).toBe('failed');
    });

    it('should return "not_found" for unregistered agent', async () => {
      const status = await getAgentStatus('non-existent-agent');
      expect(status).toBe('not_found');
    });

    it('should use Promise.race to check status without blocking', async () => {
      const agentId = 'race-test';
      let resolvePromise: (value: CompletedResponse) => void;
      const promise = new Promise<CompletedResponse>((resolve) => {
        resolvePromise = resolve;
      });

      registerAgent(agentId, promise);

      // Should immediately return "running" without waiting
      const startTime = Date.now();
      const status1 = await getAgentStatus(agentId);
      const duration1 = Date.now() - startTime;

      expect(status1).toBe('running');
      expect(duration1).toBeLessThan(100); // Should be nearly instant

      // Resolve the Promise
      resolvePromise!({ sessionId: 's1', output: 'done', status: 'completed' });
      await promise;

      // Now should return "completed"
      const status2 = await getAgentStatus(agentId);
      expect(status2).toBe('completed');
    });

    it('should handle multiple status checks on same agent', async () => {
      const agentId = 'multi-check';
      const promise = Promise.resolve({ sessionId: 's1', output: 'test', status: 'completed' as const });

      registerAgent(agentId, promise);
      await promise;

      const status1 = await getAgentStatus(agentId);
      const status2 = await getAgentStatus(agentId);
      const status3 = await getAgentStatus(agentId);

      expect(status1).toBe('completed');
      expect(status2).toBe('completed');
      expect(status3).toBe('completed');
    });
  });

  describe('getAgentResult', () => {
    it('should return cached result from memory for completed agent', async () => {
      const agentId = 'cached-agent';
      const response: CompletedResponse = {
        sessionId: 'session-456',
        output: 'Cached output',
        status: 'completed'
      };
      const promise = Promise.resolve(response);

      registerAgent(agentId, promise);
      await promise;

      const result = await getAgentResult(agentId, testDir);
      expect(result).toEqual(response);
    });

    it('should return null for running agent', async () => {
      const agentId = 'running-agent';
      const promise = new Promise<CompletedResponse>(() => {
        // Never resolves
      });

      registerAgent(agentId, promise);

      const result = await getAgentResult(agentId, testDir);
      expect(result).toBeNull();
    });

    it('should return null for failed agent with no cached result', async () => {
      const agentId = 'failed-agent';
      const promise = Promise.reject(new Error('Execution failed'));

      registerAgent(agentId, promise);
      await promise.catch(() => {});

      const result = await getAgentResult(agentId, testDir);
      expect(result).toBeNull();
    });

    it('should return null for unregistered agent with no transcript', async () => {
      const result = await getAgentResult('non-existent', testDir);
      expect(result).toBeNull();
    });

    it('should return null for agents not in memory (no disk fallback)', async () => {
      const agentId = 'disk-agent';

      // Agent not registered in memory - should return null
      // (Transcript fallback has been removed, SDK manages transcript storage)
      const result = await getAgentResult(agentId, testDir);

      expect(result).toBeNull();
    });

    it('should retrieve result from memory when agent is registered', async () => {
      const agentId = 'memory-agent';

      // Register agent with data in memory
      const response: CompletedResponse = {
        sessionId: 'session-123',
        output: 'Memory result',
        status: 'completed'
      };
      const promise = Promise.resolve(response);
      registerAgent(agentId, promise);
      await promise;

      const result = await getAgentResult(agentId, testDir);
      expect(isOldCompletedResponse(result)).toBe(true);
      if (isOldCompletedResponse(result)) {
        expect(result.output).toBe('Memory result');
        expect(result.sessionId).toBe('session-123');
      }
    });

    it('should return null for agents not in memory (multiple messages case)', async () => {
      const agentId = 'multi-message';

      // Agent not registered in memory - should return null
      const result = await getAgentResult(agentId, testDir);
      expect(result).toBeNull();
    });

    it('should handle empty transcript file', async () => {
      const agentId = 'empty-transcript';
      const transcriptPath = getTranscriptPath(agentId, testDir);

      await mkdir(dirname(transcriptPath), { recursive: true });
      await writeFile(transcriptPath, '', 'utf-8');

      const result = await getAgentResult(agentId, testDir);
      expect(result).toBeNull();
    });

    it('should handle malformed transcript gracefully', async () => {
      const agentId = 'malformed-transcript';
      const transcriptPath = getTranscriptPath(agentId, testDir);

      await mkdir(dirname(transcriptPath), { recursive: true });
      await writeFile(transcriptPath, 'invalid json\n{broken\n', 'utf-8');

      const result = await getAgentResult(agentId, testDir);
      expect(result).toBeNull();
    });
  });

  describe('clearAgents', () => {
    it('should clear all registered agents', async () => {
      const agentId1 = 'clear-test-1';
      const agentId2 = 'clear-test-2';
      const promise1 = Promise.resolve({ sessionId: 's1', output: 'o1', status: 'completed' as const });
      const promise2 = Promise.resolve({ sessionId: 's2', output: 'o2', status: 'completed' as const });

      registerAgent(agentId1, promise1);
      registerAgent(agentId2, promise2);

      clearAgents();

      const status1 = await getAgentStatus(agentId1);
      const status2 = await getAgentStatus(agentId2);

      expect(status1).toBe('not_found');
      expect(status2).toBe('not_found');
    });

    it('should allow re-registration after clear', async () => {
      const agentId = 'clear-reregister';
      const promise1 = Promise.resolve({ sessionId: 's1', output: 'first', status: 'completed' as const });

      registerAgent(agentId, promise1);
      clearAgents();

      const statusAfterClear = await getAgentStatus(agentId);
      expect(statusAfterClear).toBe('not_found');

      const promise2 = Promise.resolve({ sessionId: 's2', output: 'second', status: 'completed' as const });
      registerAgent(agentId, promise2);

      const statusAfterReregister = await getAgentStatus(agentId);
      expect(statusAfterReregister).toBe('completed');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete agent lifecycle', async () => {
      const agentId = 'lifecycle-test';
      let resolveAgent: (value: CompletedResponse) => void;
      const promise = new Promise<CompletedResponse>((resolve) => {
        resolveAgent = resolve;
      });

      // Step 1: Register agent
      registerAgent(agentId, promise);

      // Step 2: Check status while running
      const runningStatus = await getAgentStatus(agentId);
      expect(runningStatus).toBe('running');

      // Step 3: Get result while running (should be null)
      const runningResult = await getAgentResult(agentId, testDir);
      expect(runningResult).toBeNull();

      // Step 4: Complete the agent
      const response: CompletedResponse = {
        sessionId: 'session-lifecycle',
        output: 'Lifecycle complete',
        status: 'completed'
      };
      resolveAgent!(response);
      await promise;

      // Step 5: Check status after completion
      const completedStatus = await getAgentStatus(agentId);
      expect(completedStatus).toBe('completed');

      // Step 6: Get result after completion
      const completedResult = await getAgentResult(agentId, testDir);
      expect(completedResult).toEqual(response);
    });

    it('should handle multiple concurrent agents', async () => {
      const agents = [
        { id: 'concurrent-1', delay: 50 },
        { id: 'concurrent-2', delay: 100 },
        { id: 'concurrent-3', delay: 25 }
      ];

      // Register all agents with different completion times
      for (const agent of agents) {
        const promise = new Promise<CompletedResponse>((resolve) => {
          setTimeout(() => {
            resolve({
              sessionId: `session-${agent.id}`,
              output: `Output from ${agent.id}`,
              status: 'completed'
            });
          }, agent.delay);
        });
        registerAgent(agent.id, promise);
      }

      // All should initially be running
      for (const agent of agents) {
        const status = await getAgentStatus(agent.id);
        expect(status).toBe('running');
      }

      // Wait for all to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // All should now be completed
      for (const agent of agents) {
        const status = await getAgentStatus(agent.id);
        expect(status).toBe('completed');

        const result = await getAgentResult(agent.id, testDir);
        expect(isOldCompletedResponse(result)).toBe(true);
        if (isOldCompletedResponse(result)) {
          expect(result.output).toBe(`Output from ${agent.id}`);
        }
      }
    });

    it('should handle mixed success and failure agents', async () => {
      const successAgent = 'success-agent';
      const failureAgent = 'failure-agent';
      const runningAgent = 'running-agent';

      const successPromise = Promise.resolve({
        sessionId: 'success-session',
        output: 'Success',
        status: 'completed' as const
      });

      const failurePromise = Promise.reject(new Error('Intentional failure'));

      const runningPromise = new Promise<CompletedResponse>(() => {
        // Never resolves
      });

      registerAgent(successAgent, successPromise);
      registerAgent(failureAgent, failurePromise);
      registerAgent(runningAgent, runningPromise);

      // Suppress unhandled rejection
      await failurePromise.catch(() => {});
      await successPromise;

      const successStatus = await getAgentStatus(successAgent);
      const failureStatus = await getAgentStatus(failureAgent);
      const runningStatus = await getAgentStatus(runningAgent);

      expect(successStatus).toBe('completed');
      expect(failureStatus).toBe('failed');
      expect(runningStatus).toBe('running');

      const successResult = await getAgentResult(successAgent, testDir);
      const failureResult = await getAgentResult(failureAgent, testDir);
      const runningResult = await getAgentResult(runningAgent, testDir);

      expect(isOldCompletedResponse(successResult)).toBe(true);
      if (isOldCompletedResponse(successResult)) {
        expect(successResult.output).toBe('Success');
      }
      expect(failureResult).toBeNull();
      expect(runningResult).toBeNull();
    });

    it('should return null for historical agents not in memory', async () => {
      const agentId = 'historical-agent';

      // Agent not in memory (simulating server restart)
      const status = await getAgentStatus(agentId);
      expect(status).toBe('not_found');

      // With transcript fallback removed, historical agents return null
      // SDK manages transcript storage internally
      const result = await getAgentResult(agentId, testDir);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle agent ID with special characters', async () => {
      const agentId = 'agent-with-special_chars.123';
      const promise = Promise.resolve({ sessionId: 's1', output: 'test', status: 'completed' as const });

      registerAgent(agentId, promise);
      await promise;

      const status = await getAgentStatus(agentId);
      expect(status).toBe('completed');
    });

    it('should handle very long agent IDs', async () => {
      const agentId = 'a'.repeat(1000);
      const promise = Promise.resolve({ sessionId: 's1', output: 'test', status: 'completed' as const });

      registerAgent(agentId, promise);
      await promise;

      const status = await getAgentStatus(agentId);
      expect(status).toBe('completed');
    });

    it('should handle Promise that resolves to error status', async () => {
      const agentId = 'error-status-agent';
      const response: CompletedResponse = {
        sessionId: 'error-session',
        output: 'Error occurred',
        status: 'failed'
      };
      const promise = Promise.resolve(response);

      registerAgent(agentId, promise);
      await promise;

      const status = await getAgentStatus(agentId);
      expect(status).toBe('completed'); // Promise resolved, not rejected

      const result = await getAgentResult(agentId, testDir);
      expect(result?.status).toBe('failed');
    });

    it('should handle rapid registration and deregistration', async () => {
      const agentId = 'rapid-test';

      for (let i = 0; i < 100; i++) {
        const promise = Promise.resolve({ sessionId: `s${i}`, output: `output${i}`, status: 'completed' as const });
        registerAgent(agentId, promise);
        await promise;
      }

      const result = await getAgentResult(agentId, testDir);
      expect(isOldCompletedResponse(result)).toBe(true);
      if (isOldCompletedResponse(result)) {
        expect(result.output).toBe('output99'); // Last registration wins
      }
    });

    it('should handle undefined workspace path', async () => {
      const agentId = 'undefined-workspace';
      const response: CompletedResponse = {
        sessionId: 'session-123',
        output: 'Test output',
        status: 'completed'
      };
      const promise = Promise.resolve(response);

      registerAgent(agentId, promise);
      await promise;

      // Should use process.cwd() as default
      const result = await getAgentResult(agentId);
      expect(result).toEqual(response);
    });
  });
});
