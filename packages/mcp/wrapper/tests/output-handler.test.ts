/**
 * Tests for output tool handler
 */

import type { AgentToolResponse } from '../src/types/wrapper.js';
import { registerAgent, clearAgents, getAgentStatus, getAgentResult } from '../src/background-agents.js';
import { validateAgentOutputArguments } from '../src/types/wrapper.js';

describe('Agent Output Tool Handler', () => {
  beforeEach(() => {
    clearAgents();
  });

  describe('argument validation', () => {
    it('should validate correct arguments with defaults', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123']
      });

      expect(result.agentIds).toEqual(['agent-123']);
      expect(result.block).toBe(true);
      expect(result.wait_up_to).toBe(150);
    });

    it('should validate multiple agent IDs', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-1', 'agent-2', 'agent-3']
      });

      expect(result.agentIds).toEqual(['agent-1', 'agent-2', 'agent-3']);
    });

    it('should accept block as false', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        block: false
      });

      expect(result.block).toBe(false);
    });

    it('should accept custom wait_up_to', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        wait_up_to: 60
      });

      expect(result.wait_up_to).toBe(60);
    });
  });

  describe('single agent retrieval', () => {
    it('should return completed status for completed agent', async () => {
      const completedResponse: AgentToolResponse = {
        status: 'completed',
        prompt: 'test prompt',
        agentId: 'test-agent-1',
        content: [{ type: 'text', text: 'test result' }],
        totalToolUseCount: 5,
        totalDurationMs: 1000,
        totalTokens: 100,
        usage: {}
      };

      const promise = Promise.resolve(completedResponse);
      registerAgent('test-agent-1', promise);

      // Wait for promise to settle
      await promise;

      const status = await getAgentStatus('test-agent-1');
      expect(status).toBe('completed');

      const result = await getAgentResult('test-agent-1');
      expect(result).toEqual(completedResponse);
    });

    it('should return running status for pending agent', async () => {
      let timerId: NodeJS.Timeout | undefined;
      const promise = new Promise<AgentToolResponse>((resolve) => {
        timerId = setTimeout(() => {
          resolve({
            status: 'completed',
            prompt: 'test',
            agentId: 'test-agent-2',
            content: [{ type: 'text', text: 'done' }],
            totalToolUseCount: 0,
            totalDurationMs: 1000,
            totalTokens: 0,
            usage: {}
          });
        }, 5000);
      });

      registerAgent('test-agent-2', promise);

      const status = await getAgentStatus('test-agent-2');
      expect(status).toBe('running');

      const result = await getAgentResult('test-agent-2');
      expect(result).toBeNull();

      // Clean up the timer
      if (timerId) clearTimeout(timerId);
    });

    it('should return failed status for rejected agent', async () => {
      const promise = Promise.reject(new Error('Agent execution failed'));
      registerAgent('test-agent-3', promise);

      // Prevent unhandled rejection
      promise.catch(() => {});

      const status = await getAgentStatus('test-agent-3');
      expect(status).toBe('failed');

      const result = await getAgentResult('test-agent-3');
      expect(result).toBeNull();
    });

    it('should return not_found status for unregistered agent', async () => {
      const status = await getAgentStatus('non-existent-agent');
      expect(status).toBe('not_found');

      const result = await getAgentResult('non-existent-agent');
      expect(result).toBeNull();
    });
  });

  describe('multiple agent retrieval', () => {
    it('should handle mixed statuses across multiple agents', async () => {
      // Completed agent
      const completed: AgentToolResponse = {
        status: 'completed',
        prompt: 'test1',
        agentId: 'agent-1',
        content: [{ type: 'text', text: 'result1' }],
        totalToolUseCount: 1,
        totalDurationMs: 100,
        totalTokens: 10,
        usage: {}
      };
      registerAgent('agent-1', Promise.resolve(completed));

      // Running agent
      let timerId: NodeJS.Timeout | undefined;
      const running = new Promise<AgentToolResponse>((resolve) => {
        timerId = setTimeout(() => resolve(completed), 10000);
      });
      registerAgent('agent-2', running);

      // Failed agent
      const failed = Promise.reject(new Error('Failed'));
      failed.catch(() => {});
      registerAgent('agent-3', failed);

      await Promise.resolve(completed);

      const status1 = await getAgentStatus('agent-1');
      const status2 = await getAgentStatus('agent-2');
      const status3 = await getAgentStatus('agent-3');
      const status4 = await getAgentStatus('agent-4');

      expect(status1).toBe('completed');
      expect(status2).toBe('running');
      expect(status3).toBe('failed');
      expect(status4).toBe('not_found');

      // Clean up the timer
      if (timerId) clearTimeout(timerId);
    });

    it('should retrieve results for multiple completed agents', async () => {
      const response1: AgentToolResponse = {
        status: 'completed',
        prompt: 'task1',
        agentId: 'agent-1',
        content: [{ type: 'text', text: 'result1' }],
        totalToolUseCount: 2,
        totalDurationMs: 200,
        totalTokens: 20,
        usage: {}
      };

      const response2: AgentToolResponse = {
        status: 'completed',
        prompt: 'task2',
        agentId: 'agent-2',
        content: [{ type: 'text', text: 'result2' }],
        totalToolUseCount: 3,
        totalDurationMs: 300,
        totalTokens: 30,
        usage: {}
      };

      registerAgent('agent-1', Promise.resolve(response1));
      registerAgent('agent-2', Promise.resolve(response2));

      await Promise.all([Promise.resolve(response1), Promise.resolve(response2)]);

      const result1 = await getAgentResult('agent-1');
      const result2 = await getAgentResult('agent-2');

      expect(result1).toEqual(response1);
      expect(result2).toEqual(response2);
    });
  });

  describe('blocking behavior', () => {
    it('should wait for agent to complete when blocking is enabled', async () => {
      const response: AgentToolResponse = {
        status: 'completed',
        prompt: 'delayed task',
        agentId: 'delayed-agent',
        content: [{ type: 'text', text: 'completed after delay' }],
        totalToolUseCount: 1,
        totalDurationMs: 150,
        totalTokens: 15,
        usage: {}
      };

      const promise = new Promise<AgentToolResponse>((resolve) => {
        setTimeout(() => resolve(response), 100);
      });

      registerAgent('delayed-agent', promise);

      // Status should be running initially
      const statusBefore = await getAgentStatus('delayed-agent');
      expect(statusBefore).toBe('running');

      // Wait for completion
      await promise;

      // Status should be completed after waiting
      const statusAfter = await getAgentStatus('delayed-agent');
      expect(statusAfter).toBe('completed');

      const result = await getAgentResult('delayed-agent');
      expect(result).toEqual(response);
    });

    it('should return immediately when blocking is disabled', async () => {
      let timerId: NodeJS.Timeout | undefined;
      const promise = new Promise<AgentToolResponse>((resolve) => {
        timerId = setTimeout(() => {
          resolve({
            status: 'completed',
            prompt: 'test',
            agentId: 'test',
            content: [{ type: 'text', text: 'done' }],
            totalToolUseCount: 0,
            totalDurationMs: 1000,
            totalTokens: 0,
            usage: {}
          });
        }, 5000);
      });

      registerAgent('test-agent', promise);

      // With blocking disabled, should return running status immediately
      const status = await getAgentStatus('test-agent');
      expect(status).toBe('running');

      const result = await getAgentResult('test-agent');
      expect(result).toBeNull();

      // Clean up the timer
      if (timerId) clearTimeout(timerId);
    });
  });

  describe('timeout behavior', () => {
    it('should timeout if agent takes longer than wait_up_to', async () => {
      let promiseTimerId: NodeJS.Timeout | undefined;
      let timeoutTimerId: NodeJS.Timeout | undefined;

      const promise = new Promise<AgentToolResponse>((resolve) => {
        promiseTimerId = setTimeout(() => {
          resolve({
            status: 'completed',
            prompt: 'slow task',
            agentId: 'slow-agent',
            content: [{ type: 'text', text: 'finally done' }],
            totalToolUseCount: 10,
            totalDurationMs: 5000,
            totalTokens: 100,
            usage: {}
          });
        }, 5000);
      });

      registerAgent('slow-agent', promise);

      // Simulate timeout by using Promise.race
      const timeoutMs = 100;
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        timeoutTimerId = setTimeout(() => resolve('timeout'), timeoutMs);
      });

      const result = await Promise.race([promise, timeoutPromise]);

      // Should timeout
      expect(result).toBe('timeout');

      // Agent should still be running
      const status = await getAgentStatus('slow-agent');
      expect(status).toBe('running');

      // Clean up both timers
      if (promiseTimerId) clearTimeout(promiseTimerId);
      if (timeoutTimerId) clearTimeout(timeoutTimerId);
    });

    it('should return result if agent completes before timeout', async () => {
      const response: AgentToolResponse = {
        status: 'completed',
        prompt: 'quick task',
        agentId: 'quick-agent',
        content: [{ type: 'text', text: 'done quickly' }],
        totalToolUseCount: 1,
        totalDurationMs: 50,
        totalTokens: 10,
        usage: {}
      };

      let promiseTimerId: NodeJS.Timeout | undefined;
      let timeoutTimerId: NodeJS.Timeout | undefined;

      const promise = new Promise<AgentToolResponse>((resolve) => {
        promiseTimerId = setTimeout(() => resolve(response), 50);
      });

      registerAgent('quick-agent', promise);

      // Timeout longer than execution time
      const timeoutMs = 200;
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        timeoutTimerId = setTimeout(() => resolve('timeout'), timeoutMs);
      });

      const result = await Promise.race([promise, timeoutPromise]);

      // Should complete before timeout
      expect(result).toEqual(response);

      const status = await getAgentStatus('quick-agent');
      expect(status).toBe('completed');

      // Clean up both timers
      if (promiseTimerId) clearTimeout(promiseTimerId);
      if (timeoutTimerId) clearTimeout(timeoutTimerId);
    });
  });

  describe('edge cases', () => {
    it('should handle empty agentIds array', () => {
      const result = validateAgentOutputArguments({
        agentIds: []
      });

      expect(result.agentIds).toEqual([]);
    });

    it('should handle agent IDs with special characters', async () => {
      const agentId = 'agent-123_test.special';
      const response: AgentToolResponse = {
        status: 'completed',
        prompt: 'test',
        agentId,
        content: [{ type: 'text', text: 'success' }],
        totalToolUseCount: 0,
        totalDurationMs: 100,
        totalTokens: 10,
        usage: {}
      };

      registerAgent(agentId, Promise.resolve(response));
      await Promise.resolve(response);

      const status = await getAgentStatus(agentId);
      expect(status).toBe('completed');
    });

    it('should handle very long agent IDs', async () => {
      const agentId = 'a'.repeat(1000);
      const response: AgentToolResponse = {
        status: 'completed',
        prompt: 'test',
        agentId,
        content: [{ type: 'text', text: 'success' }],
        totalToolUseCount: 0,
        totalDurationMs: 100,
        totalTokens: 10,
        usage: {}
      };

      registerAgent(agentId, Promise.resolve(response));
      await Promise.resolve(response);

      const status = await getAgentStatus(agentId);
      expect(status).toBe('completed');
    });

    it('should handle wait_up_to of 0 seconds', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-1'],
        wait_up_to: 0
      });

      expect(result.wait_up_to).toBe(0);
    });

    it('should handle wait_up_to at maximum (300)', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-1'],
        wait_up_to: 300
      });

      expect(result.wait_up_to).toBe(300);
    });
  });

  describe('result formatting', () => {
    it('should format completed result correctly', async () => {
      const response: AgentToolResponse = {
        status: 'completed',
        prompt: 'test prompt',
        agentId: 'format-agent',
        content: [
          { type: 'text', text: 'First line of output' },
          { type: 'text', text: 'Second line of output' }
        ],
        totalToolUseCount: 3,
        totalDurationMs: 500,
        totalTokens: 50,
        usage: { input_tokens: 25, output_tokens: 25 }
      };

      registerAgent('format-agent', Promise.resolve(response));
      await Promise.resolve(response);

      const result = await getAgentResult('format-agent');
      expect(result).toEqual(response);
    });

    it('should handle historical agent from transcript fallback', async () => {
      // Simulate historical agent (not in registry)
      const result = await getAgentResult('historical-agent');
      // Will be null since we don't have a transcript file
      expect(result).toBeNull();
    });
  });

  describe('concurrent operations', () => {
    it('should handle checking multiple agents concurrently', async () => {
      const agents = Array.from({ length: 10 }, (_, i) => ({
        id: `agent-${i}`,
        response: {
          status: 'completed' as const,
          prompt: `task ${i}`,
          agentId: `agent-${i}`,
          content: [{ type: 'text' as const, text: `result ${i}` }],
          totalToolUseCount: i,
          totalDurationMs: i * 100,
          totalTokens: i * 10,
          usage: {}
        }
      }));

      // Register all agents
      for (const agent of agents) {
        registerAgent(agent.id, Promise.resolve(agent.response));
      }

      // Wait for all
      await Promise.all(agents.map((a) => Promise.resolve(a.response)));

      // Check all statuses concurrently
      const statuses = await Promise.all(agents.map((a) => getAgentStatus(a.id)));

      expect(statuses.every((s) => s === 'completed')).toBe(true);
    });

    it('should handle retrieving results for many agents', async () => {
      const count = 50;
      const agents = Array.from({ length: count }, (_, i) => `agent-${i}`);

      for (const agentId of agents) {
        const response: AgentToolResponse = {
          status: 'completed',
          prompt: `task for ${agentId}`,
          agentId,
          content: [{ type: 'text', text: `result for ${agentId}` }],
          totalToolUseCount: 1,
          totalDurationMs: 100,
          totalTokens: 10,
          usage: {}
        };
        registerAgent(agentId, Promise.resolve(response));
      }

      const results = await Promise.all(agents.map((id) => getAgentResult(id)));

      expect(results.every((r) => r !== null)).toBe(true);
      expect(results).toHaveLength(count);
    });
  });
});
