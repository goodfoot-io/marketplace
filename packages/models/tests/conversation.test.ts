import { getTestSql } from '@productivity-bot/test-utilities/sql';
import { createConversationHandlers } from '../src/conversation.js';
import { initializeDatabase } from '../src/database.js';
import { NotFoundError, InvalidParameterError } from '../src/lib/errors.js';

describe('Conversation model', () => {
  describe('addConversation', () => {
    it('creates a conversation successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456',
        agentName: 'TestAgent',
        workspaceId: 'default'
      });

      expect(conversationId).toMatch(/^conversation:\d+$/);
    });

    it('creates a conversation with minimal required fields', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-789',
        userId: 'user-012'
      });

      expect(conversationId).toMatch(/^conversation:\d+$/);
    });

    it('throws InvalidParameterError for empty voiceSessionId', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation } = createConversationHandlers({ sql });

      await expect(
        addConversation({
          voiceSessionId: '',
          userId: 'user-456'
        })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for empty userId', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation } = createConversationHandlers({ sql });

      await expect(
        addConversation({
          voiceSessionId: 'session-123',
          userId: ''
        })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('trims whitespace from voiceSessionId and userId', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, getConversation } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: '  session-123  ',
        userId: '  user-456  '
      });

      const conversation = await getConversation({ conversationId });
      expect(conversation?.voiceSessionId).toBe('session-123');
      expect(conversation?.userId).toBe('user-456');
    });
  });

  describe('endConversation', () => {
    it('ends an active conversation successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, endConversation, getConversation } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      await endConversation({ conversationId });

      const conversation = await getConversation({ conversationId });
      expect(conversation?.endedAt).toBeTruthy();
    });

    it('throws NotFoundError for non-existent conversation', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { endConversation } = createConversationHandlers({ sql });

      await expect(endConversation({ conversationId: 'conversation:999999' })).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for already ended conversation', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, endConversation } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      await endConversation({ conversationId });

      // Try to end it again
      await expect(endConversation({ conversationId })).rejects.toThrow(NotFoundError);
    });
  });

  describe('addConversationMessages', () => {
    it('adds messages to a conversation successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, addConversationMessages } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      const messageIds = await addConversationMessages({
        messagesData: [
          {
            conversationId,
            messageId: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: new Date()
          },
          {
            conversationId,
            messageId: 'msg-2',
            role: 'assistant',
            content: 'Hi there!',
            timestamp: new Date(),
            audioTranscript: false,
            toolCall: { name: 'greet', arguments: {} }
          }
        ]
      });

      expect(messageIds).toHaveLength(2);
      messageIds.forEach((id) => {
        expect(id).toMatch(/^conversation_message:\d+$/);
      });
    });

    it('skips duplicate messages with same messageId', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, addConversationMessages } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      // Add first message
      const firstBatch = await addConversationMessages({
        messagesData: [
          {
            conversationId,
            messageId: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: new Date()
          }
        ]
      });

      // Try to add same message again
      const secondBatch = await addConversationMessages({
        messagesData: [
          {
            conversationId,
            messageId: 'msg-1',
            role: 'user',
            content: 'Hello again', // Different content, but same messageId
            timestamp: new Date()
          }
        ]
      });

      expect(firstBatch[0]).toBe(secondBatch[0]); // Should return same ID
    });

    it('throws InvalidParameterError for empty array', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversationMessages } = createConversationHandlers({ sql });

      await expect(addConversationMessages({ messagesData: [] })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for invalid role', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, addConversationMessages } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      await expect(
        addConversationMessages({
          messagesData: [
            {
              conversationId,
              messageId: 'msg-1',
              role: 'invalid' as 'user' | 'assistant' | 'system',
              content: 'Hello',
              timestamp: new Date()
            }
          ]
        })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('throws NotFoundError for non-existent conversation', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversationMessages } = createConversationHandlers({ sql });

      await expect(
        addConversationMessages({
          messagesData: [
            {
              conversationId: 'conversation:999999',
              messageId: 'msg-1',
              role: 'user',
              content: 'Hello',
              timestamp: new Date()
            }
          ]
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('handles tool call data correctly', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, addConversationMessages, getConversationMessages } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      const toolCallData = {
        name: 'saveUserMemory',
        arguments: { title: 'Test', body: 'Content' },
        result: 'Success'
      } as const;

      await addConversationMessages({
        messagesData: [
          {
            conversationId,
            messageId: 'msg-1',
            role: 'assistant',
            content: 'I saved your memory',
            timestamp: new Date(),
            toolCall: toolCallData
          }
        ]
      });

      const messages = await getConversationMessages({ conversationId });
      expect(messages).toHaveLength(1);
      expect(messages[0].toolCall).toEqual(toolCallData);
    });
  });

  describe('getConversation', () => {
    it('retrieves a conversation by ID', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, getConversation } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456',
        agentName: 'TestAgent'
      });

      const conversation = await getConversation({ conversationId });

      expect(conversation).toBeTruthy();
      expect(conversation?.id).toBe(conversationId);
      expect(conversation?.voiceSessionId).toBe('session-123');
      expect(conversation?.userId).toBe('user-456');
      expect(conversation?.agentName).toBe('TestAgent');
      expect(conversation?.endedAt).toBeNull();
    });

    it('returns null for non-existent conversation', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getConversation } = createConversationHandlers({ sql });

      const conversation = await getConversation({ conversationId: 'conversation:999999' });
      expect(conversation).toBeNull();
    });

    it('respects workspace isolation', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, getConversation } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456',
        workspaceId: 'workspace-1'
      });

      // Try to get from different workspace
      const conversation = await getConversation({
        conversationId,
        workspaceId: 'workspace-2'
      });

      expect(conversation).toBeNull();
    });
  });

  describe('getConversationByVoiceSession', () => {
    it('retrieves the most recent conversation by voice session ID', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, getConversationByVoiceSession } = createConversationHandlers({ sql });

      // Add two conversations with same voice session
      await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const conversationId2 = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      const conversation = await getConversationByVoiceSession({
        voiceSessionId: 'session-123'
      });

      expect(conversation?.id).toBe(conversationId2); // Should return the more recent one
    });

    it('returns null for non-existent voice session', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getConversationByVoiceSession } = createConversationHandlers({ sql });

      const conversation = await getConversationByVoiceSession({
        voiceSessionId: 'non-existent-session'
      });

      expect(conversation).toBeNull();
    });

    it('throws InvalidParameterError for empty voiceSessionId', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getConversationByVoiceSession } = createConversationHandlers({ sql });

      await expect(getConversationByVoiceSession({ voiceSessionId: '' })).rejects.toThrow(InvalidParameterError);
    });
  });

  describe('getConversationMessages', () => {
    it('retrieves messages in chronological order', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, addConversationMessages, getConversationMessages } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      const now = new Date();
      const message1Time = new Date(now.getTime() - 2000);
      const message2Time = new Date(now.getTime() - 1000);
      const message3Time = new Date(now.getTime());

      await addConversationMessages({
        messagesData: [
          {
            conversationId,
            messageId: 'msg-3',
            role: 'assistant',
            content: 'Third message',
            timestamp: message3Time
          },
          {
            conversationId,
            messageId: 'msg-1',
            role: 'user',
            content: 'First message',
            timestamp: message1Time
          },
          {
            conversationId,
            messageId: 'msg-2',
            role: 'assistant',
            content: 'Second message',
            timestamp: message2Time
          }
        ]
      });

      const messages = await getConversationMessages({ conversationId });

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('Third message');
    });

    it('supports pagination with limit and offset', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, addConversationMessages, getConversationMessages } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      // Add 5 messages
      const messagesData = [];
      for (let i = 1; i <= 5; i++) {
        messagesData.push({
          conversationId,
          messageId: `msg-${i}`,
          role: 'user' as const,
          content: `Message ${i}`,
          timestamp: new Date(Date.now() + i * 1000)
        });
      }

      await addConversationMessages({ messagesData });

      // Get first 2 messages
      const page1 = await getConversationMessages({
        conversationId,
        limit: 2,
        offset: 0
      });

      expect(page1).toHaveLength(2);
      expect(page1[0].content).toBe('Message 1');
      expect(page1[1].content).toBe('Message 2');

      // Get next 2 messages
      const page2 = await getConversationMessages({
        conversationId,
        limit: 2,
        offset: 2
      });

      expect(page2).toHaveLength(2);
      expect(page2[0].content).toBe('Message 3');
      expect(page2[1].content).toBe('Message 4');
    });
  });

  describe('deleteConversation', () => {
    it('deletes a conversation and its messages', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, addConversationMessages, deleteConversation, getConversation, getConversationMessages } =
        createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456'
      });

      await addConversationMessages({
        messagesData: [
          {
            conversationId,
            messageId: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: new Date()
          }
        ]
      });

      const deleted = await deleteConversation({ conversationId });
      expect(deleted).toBe(true);

      // Verify conversation is deleted
      const conversation = await getConversation({ conversationId });
      expect(conversation).toBeNull();

      // Verify messages are deleted
      const messages = await getConversationMessages({ conversationId });
      expect(messages).toHaveLength(0);
    });

    it('returns false for non-existent conversation', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { deleteConversation } = createConversationHandlers({ sql });

      const deleted = await deleteConversation({ conversationId: 'conversation:999999' });
      expect(deleted).toBe(false);
    });

    it('returns false for invalid conversation ID', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { deleteConversation } = createConversationHandlers({ sql });

      const deleted = await deleteConversation({ conversationId: 'invalid-id' });
      expect(deleted).toBe(false);
    });

    it('respects workspace isolation', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addConversation, deleteConversation } = createConversationHandlers({ sql });

      const conversationId = await addConversation({
        voiceSessionId: 'session-123',
        userId: 'user-456',
        workspaceId: 'workspace-1'
      });

      // Try to delete from different workspace
      const deleted = await deleteConversation({
        conversationId,
        workspaceId: 'workspace-2'
      });

      expect(deleted).toBe(false);
    });
  });
});
