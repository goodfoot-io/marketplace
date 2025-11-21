/**
 * Tests for transcript store - JSONL file storage for agent messages
 */

import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { getTranscriptPath } from '../src/agent-id.js';
import { writeTranscriptMessage, loadTranscript, type TranscriptMessage } from '../src/transcript-store.js';

describe('Transcript Store', () => {
  let testDir: string;
  let agentId: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'transcript-test-'));
    agentId = 'test1234';
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('writeTranscriptMessage', () => {
    it('should write a single message to JSONL file', async () => {
      const message = {
        type: 'user' as const,
        content: 'Hello, world!',
        timestamp: new Date().toISOString(),
        session_id: 'session-123'
      };

      await writeTranscriptMessage(agentId, message, testDir);

      const transcriptPath = getTranscriptPath(agentId, testDir);
      const content = await readFile(transcriptPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(1);

      const parsed = JSON.parse(lines[0]) as TranscriptMessage;
      expect(parsed).toEqual(message);
    });

    it('should append multiple messages atomically', async () => {
      const messages = [
        {
          type: 'user' as const,
          content: 'First message',
          timestamp: new Date().toISOString(),
          session_id: 'session-123'
        },
        {
          type: 'assistant' as const,
          content: 'Second message',
          timestamp: new Date().toISOString(),
          session_id: 'session-123'
        },
        {
          type: 'result' as const,
          content: 'Third message',
          timestamp: new Date().toISOString(),
          session_id: 'session-123'
        }
      ];

      for (const msg of messages) {
        await writeTranscriptMessage(agentId, msg, testDir);
      }

      const transcriptPath = getTranscriptPath(agentId, testDir);
      const content = await readFile(transcriptPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(3);

      const parsed = lines.map((line) => JSON.parse(line) as TranscriptMessage);
      expect(parsed).toEqual(messages);
    });

    it('should create directory structure when missing', async () => {
      const nestedDir = join(testDir, 'nested', 'path', 'to', 'workspace');

      const message = {
        type: 'user' as const,
        content: 'Test message',
        timestamp: new Date().toISOString(),
        session_id: 'session-123'
      };

      // Directory doesn't exist yet
      await writeTranscriptMessage(agentId, message, nestedDir);

      const transcriptPath = getTranscriptPath(agentId, nestedDir);
      const content = await readFile(transcriptPath, 'utf-8');

      expect(content.trim()).toBeTruthy();
      const parsed = JSON.parse(content.trim()) as TranscriptMessage;
      expect(parsed).toEqual(message);
    });

    it('should handle assistant type messages', async () => {
      const message = {
        type: 'assistant' as const,
        content: 'Assistant response',
        timestamp: new Date().toISOString(),
        session_id: 'session-456'
      };

      await writeTranscriptMessage(agentId, message, testDir);

      const transcriptPath = getTranscriptPath(agentId, testDir);
      const content = await readFile(transcriptPath, 'utf-8');
      const parsed = JSON.parse(content.trim()) as TranscriptMessage;

      expect(parsed.type).toBe('assistant');
      expect(parsed.content).toBe('Assistant response');
    });

    it('should handle result type messages', async () => {
      const message = {
        type: 'result' as const,
        content: 'Tool result',
        timestamp: new Date().toISOString(),
        session_id: 'session-789'
      };

      await writeTranscriptMessage(agentId, message, testDir);

      const transcriptPath = getTranscriptPath(agentId, testDir);
      const content = await readFile(transcriptPath, 'utf-8');
      const parsed = JSON.parse(content.trim()) as TranscriptMessage;

      expect(parsed.type).toBe('result');
      expect(parsed.content).toBe('Tool result');
    });

    it('should preserve message order across multiple writes', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        type: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
        session_id: 'session-abc'
      }));

      for (const msg of messages) {
        await writeTranscriptMessage(agentId, msg, testDir);
      }

      const transcriptPath = getTranscriptPath(agentId, testDir);
      const content = await readFile(transcriptPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(10);

      lines.forEach((line, i: number) => {
        const parsed = JSON.parse(line) as TranscriptMessage;
        expect(parsed.content).toBe(`Message ${i}`);
      });
    });

    it('should handle special characters in content', async () => {
      const message = {
        type: 'user' as const,
        content: 'Special chars: "quotes", \'apostrophes\', \n newlines, \t tabs',
        timestamp: new Date().toISOString(),
        session_id: 'session-123'
      };

      await writeTranscriptMessage(agentId, message, testDir);

      const transcriptPath = getTranscriptPath(agentId, testDir);
      const content = await readFile(transcriptPath, 'utf-8');
      const parsed = JSON.parse(content.trim()) as TranscriptMessage;

      expect(parsed.content).toBe(message.content);
    });

    it('should handle empty content', async () => {
      const message = {
        type: 'user' as const,
        content: '',
        timestamp: new Date().toISOString(),
        session_id: 'session-123'
      };

      await writeTranscriptMessage(agentId, message, testDir);

      const transcriptPath = getTranscriptPath(agentId, testDir);
      const content = await readFile(transcriptPath, 'utf-8');
      const parsed = JSON.parse(content.trim()) as TranscriptMessage;

      expect(parsed.content).toBe('');
    });

    it('should handle very long content', async () => {
      const longContent = 'x'.repeat(100000);
      const message = {
        type: 'user' as const,
        content: longContent,
        timestamp: new Date().toISOString(),
        session_id: 'session-123'
      };

      await writeTranscriptMessage(agentId, message, testDir);

      const transcriptPath = getTranscriptPath(agentId, testDir);
      const content = await readFile(transcriptPath, 'utf-8');
      const parsed = JSON.parse(content.trim()) as TranscriptMessage;

      expect(parsed.content).toBe(longContent);
      expect(parsed.content.length).toBe(100000);
    });

    it('should handle write errors gracefully', async () => {
      // Use an invalid directory that can't be created
      const invalidDir = '/root/invalid/path/that/cannot/be/created';

      const message = {
        type: 'user' as const,
        content: 'Test',
        timestamp: new Date().toISOString(),
        session_id: 'session-123'
      };

      // Should not throw, but handle error gracefully
      await expect(writeTranscriptMessage(agentId, message, invalidDir)).resolves.not.toThrow();
    });
  });

  describe('loadTranscript', () => {
    it('should load single message from transcript', async () => {
      const message = {
        type: 'user' as const,
        content: 'Hello',
        timestamp: new Date().toISOString(),
        session_id: 'session-123'
      };

      await writeTranscriptMessage(agentId, message, testDir);
      const messages = await loadTranscript(agentId, testDir);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(message);
    });

    it('should load multiple messages in order', async () => {
      const messages = [
        {
          type: 'user' as const,
          content: 'First',
          timestamp: new Date().toISOString(),
          session_id: 'session-123'
        },
        {
          type: 'assistant' as const,
          content: 'Second',
          timestamp: new Date().toISOString(),
          session_id: 'session-123'
        },
        {
          type: 'result' as const,
          content: 'Third',
          timestamp: new Date().toISOString(),
          session_id: 'session-123'
        }
      ];

      for (const msg of messages) {
        await writeTranscriptMessage(agentId, msg, testDir);
      }

      const loaded = await loadTranscript(agentId, testDir);

      expect(loaded).toHaveLength(3);
      expect(loaded).toEqual(messages);
    });

    it('should return empty array for missing file', async () => {
      const messages = await loadTranscript('nonexistent-agent', testDir);
      expect(messages).toEqual([]);
    });

    it('should handle missing directory gracefully', async () => {
      const nonExistentDir = join(testDir, 'does', 'not', 'exist');
      const messages = await loadTranscript(agentId, nonExistentDir);
      expect(messages).toEqual([]);
    });

    it('should skip malformed lines with warnings', async () => {
      const transcriptPath = getTranscriptPath(agentId, testDir);

      // Write mixed valid and invalid lines
      const content = [
        JSON.stringify({ type: 'user', content: 'Valid 1', timestamp: new Date().toISOString(), session_id: 's1' }),
        'this is not valid JSON',
        JSON.stringify({
          type: 'assistant',
          content: 'Valid 2',
          timestamp: new Date().toISOString(),
          session_id: 's2'
        }),
        '{"incomplete": "json"',
        JSON.stringify({ type: 'result', content: 'Valid 3', timestamp: new Date().toISOString(), session_id: 's3' })
      ].join('\n');

      await mkdir(dirname(transcriptPath), { recursive: true });
      await writeFile(transcriptPath, content + '\n', 'utf-8');

      const messages = await loadTranscript(agentId, testDir);

      // Should only load the 3 valid messages
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('Valid 1');
      expect(messages[1].content).toBe('Valid 2');
      expect(messages[2].content).toBe('Valid 3');
    });

    it('should handle empty file', async () => {
      const transcriptPath = getTranscriptPath(agentId, testDir);
      await mkdir(dirname(transcriptPath), { recursive: true });
      await writeFile(transcriptPath, '', 'utf-8');

      const messages = await loadTranscript(agentId, testDir);
      expect(messages).toEqual([]);
    });

    it('should handle file with only whitespace', async () => {
      const transcriptPath = getTranscriptPath(agentId, testDir);
      await mkdir(dirname(transcriptPath), { recursive: true });
      await writeFile(transcriptPath, '   \n  \n  ', 'utf-8');

      const messages = await loadTranscript(agentId, testDir);
      expect(messages).toEqual([]);
    });

    it('should handle large transcript files', async () => {
      const messageCount = 1000;
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        type: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
        session_id: 'session-large'
      }));

      for (const msg of messages) {
        await writeTranscriptMessage(agentId, msg, testDir);
      }

      const loaded = await loadTranscript(agentId, testDir);

      expect(loaded).toHaveLength(messageCount);
      loaded.forEach((msg, i: number) => {
        expect(msg.content).toBe(`Message ${i}`);
      });
    });

    it('should preserve all message fields', async () => {
      const message = {
        type: 'user' as const,
        content: 'Test content',
        timestamp: '2024-01-15T10:30:00.000Z',
        session_id: 'session-xyz-123'
      };

      await writeTranscriptMessage(agentId, message, testDir);
      const loaded = await loadTranscript(agentId, testDir);

      expect(loaded[0]).toEqual(message);
      expect(loaded[0].type).toBe('user');
      expect(loaded[0].content).toBe('Test content');
      expect(loaded[0].timestamp).toBe('2024-01-15T10:30:00.000Z');
      expect(loaded[0].session_id).toBe('session-xyz-123');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete conversation workflow', async () => {
      const conversation = [
        { type: 'user' as const, content: 'Hello', timestamp: new Date().toISOString(), session_id: 's1' },
        { type: 'assistant' as const, content: 'Hi there!', timestamp: new Date().toISOString(), session_id: 's1' },
        { type: 'user' as const, content: 'How are you?', timestamp: new Date().toISOString(), session_id: 's1' },
        { type: 'assistant' as const, content: 'I am well!', timestamp: new Date().toISOString(), session_id: 's1' }
      ];

      for (const msg of conversation) {
        await writeTranscriptMessage(agentId, msg, testDir);
      }

      const loaded = await loadTranscript(agentId, testDir);
      expect(loaded).toEqual(conversation);
    });

    it('should handle multiple agents in same workspace', async () => {
      const agent1 = 'agent-aaa';
      const agent2 = 'agent-bbb';

      const msg1 = {
        type: 'user' as const,
        content: 'Agent 1 message',
        timestamp: new Date().toISOString(),
        session_id: 's1'
      };

      const msg2 = {
        type: 'user' as const,
        content: 'Agent 2 message',
        timestamp: new Date().toISOString(),
        session_id: 's2'
      };

      await writeTranscriptMessage(agent1, msg1, testDir);
      await writeTranscriptMessage(agent2, msg2, testDir);

      const loaded1 = await loadTranscript(agent1, testDir);
      const loaded2 = await loadTranscript(agent2, testDir);

      expect(loaded1).toHaveLength(1);
      expect(loaded2).toHaveLength(1);
      expect(loaded1[0].content).toBe('Agent 1 message');
      expect(loaded2[0].content).toBe('Agent 2 message');
    });

    it('should handle resume scenario - load existing then append new', async () => {
      // Initial conversation
      const initial = [
        { type: 'user' as const, content: 'Initial 1', timestamp: new Date().toISOString(), session_id: 's1' },
        { type: 'assistant' as const, content: 'Initial 2', timestamp: new Date().toISOString(), session_id: 's1' }
      ];

      for (const msg of initial) {
        await writeTranscriptMessage(agentId, msg, testDir);
      }

      // Load transcript (resume scenario)
      const loaded = await loadTranscript(agentId, testDir);
      expect(loaded).toHaveLength(2);

      // Continue conversation
      const continuation = [
        { type: 'user' as const, content: 'Continued 3', timestamp: new Date().toISOString(), session_id: 's1' },
        { type: 'assistant' as const, content: 'Continued 4', timestamp: new Date().toISOString(), session_id: 's1' }
      ];

      for (const msg of continuation) {
        await writeTranscriptMessage(agentId, msg, testDir);
      }

      // Load full transcript
      const fullTranscript = await loadTranscript(agentId, testDir);
      expect(fullTranscript).toHaveLength(4);
      expect(fullTranscript).toEqual([...initial, ...continuation]);
    });

    it('should handle concurrent writes from same agent', async () => {
      // Simulate concurrent writes
      const messages = Array.from({ length: 50 }, (_, i) => ({
        type: 'user' as const,
        content: `Concurrent ${i}`,
        timestamp: new Date().toISOString(),
        session_id: 'concurrent-session'
      }));

      await Promise.all(messages.map((msg) => writeTranscriptMessage(agentId, msg, testDir)));

      const loaded = await loadTranscript(agentId, testDir);

      // All messages should be present (order may vary due to concurrency)
      expect(loaded).toHaveLength(50);

      const contents = loaded.map((m) => m.content);
      messages.forEach((msg) => {
        expect(contents).toContain(msg.content);
      });
    });
  });
});
