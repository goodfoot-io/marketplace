import type { PostgresConnection, PostgresTransactionConnection } from './database.js';
import { NotFoundError, InvalidParameterError, InvalidIdError } from './lib/errors.js';
import { generateNodeId, validateNodeId } from './lib/ids.js';

export interface Conversation {
  id: string;
  voiceSessionId: string;
  userId: string;
  agentName: string | null;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
}

export interface ToolCallData {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  messageId: string; // External message ID from the transcript
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  audioTranscript: boolean;
  toolCall: ToolCallData | null; // JSON field for tool call data
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
}

export function createConversationHandlers({ sql }: { sql: PostgresConnection }) {
  async function addConversation(
    {
      voiceSessionId,
      userId,
      agentName,
      workspaceId = 'default'
    }: {
      voiceSessionId: string;
      userId: string;
      agentName?: string;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string> {
    if (!voiceSessionId || voiceSessionId.trim().length === 0) {
      throw new InvalidParameterError('voiceSessionId is required');
    }
    if (!userId || userId.trim().length === 0) {
      throw new InvalidParameterError('userId is required');
    }

    const conversationId = await generateNodeId(_sql, 'conversation');
    await _sql`
      INSERT INTO conversations (id, voice_session_id, user_id, agent_name, workspace_id)
      VALUES (${conversationId}, ${voiceSessionId.trim()}, ${userId.trim()}, ${agentName || null}, ${workspaceId})
    `;
    return conversationId;
  }

  async function endConversation(
    {
      conversationId,
      workspaceId = 'default'
    }: {
      conversationId: string;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    validateNodeId(conversationId, 'conversation');

    const result = await _sql`
      UPDATE conversations 
      SET ended_at = NOW() 
      WHERE id = ${conversationId} AND workspace_id = ${workspaceId} AND ended_at IS NULL
    `;

    if (result.count === 0) {
      throw new NotFoundError('Active conversation', conversationId);
    }
  }

  async function addConversationMessages(
    {
      messagesData,
      workspaceId = 'default'
    }: {
      messagesData: Array<{
        conversationId: string;
        messageId: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: Date;
        audioTranscript?: boolean;
        toolCall?: ToolCallData;
      }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(messagesData) || messagesData.length === 0) {
      throw new InvalidParameterError('Input "messagesData" must be a non-empty array.');
    }

    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      const messageIds: string[] = [];

      for (const messageData of messagesData) {
        validateNodeId(messageData.conversationId, 'conversation');

        if (!messageData.messageId || messageData.messageId.trim().length === 0) {
          throw new InvalidParameterError('messageId is required');
        }
        if (!messageData.content || messageData.content.trim().length === 0) {
          throw new InvalidParameterError('content is required');
        }
        if (!['user', 'assistant', 'system'].includes(messageData.role)) {
          throw new InvalidParameterError('role must be one of: user, assistant, system');
        }

        // Check if conversation exists
        const [conversationExists] = await txSql<{ exists: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM conversations WHERE id = ${messageData.conversationId} AND workspace_id = ${workspaceId}) as exists
        `;
        if (!conversationExists?.exists) {
          throw new NotFoundError('Conversation', messageData.conversationId);
        }

        // Check if message with same messageId already exists in this conversation
        const [existingMessage] = await txSql<{ id: string }[]>`
          SELECT id FROM conversation_messages 
          WHERE conversation_id = ${messageData.conversationId} 
          AND message_id = ${messageData.messageId.trim()} 
          AND workspace_id = ${workspaceId}
        `;

        if (existingMessage) {
          // Message already exists, skip it
          messageIds.push(existingMessage.id);
          continue;
        }

        const messageDbId = await generateNodeId(txSql, 'conversation_message');
        await txSql`
          INSERT INTO conversation_messages (
            id, 
            conversation_id, 
            message_id, 
            role, 
            content, 
            timestamp, 
            audio_transcript, 
            tool_call, 
            workspace_id
          )
          VALUES (
            ${messageDbId}, 
            ${messageData.conversationId}, 
            ${messageData.messageId.trim()}, 
            ${messageData.role}, 
            ${messageData.content.trim()}, 
            ${messageData.timestamp}, 
            ${messageData.audioTranscript || false}, 
            ${messageData.toolCall ? JSON.stringify(messageData.toolCall) : null}, 
            ${workspaceId}
          )
        `;
        messageIds.push(messageDbId);
      }

      return messageIds;
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function getConversation(
    {
      conversationId,
      workspaceId = 'default'
    }: {
      conversationId: string;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<Conversation | null> {
    validateNodeId(conversationId, 'conversation');

    const [conversation] = await _sql<Conversation[]>`
      SELECT * FROM conversations WHERE id = ${conversationId} AND workspace_id = ${workspaceId}
    `;

    return conversation || null;
  }

  async function getConversationByVoiceSession(
    {
      voiceSessionId,
      workspaceId = 'default'
    }: {
      voiceSessionId: string;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<Conversation | null> {
    if (!voiceSessionId || voiceSessionId.trim().length === 0) {
      throw new InvalidParameterError('voiceSessionId is required');
    }

    const [conversation] = await _sql<Conversation[]>`
      SELECT * FROM conversations 
      WHERE voice_session_id = ${voiceSessionId.trim()} 
      AND workspace_id = ${workspaceId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return conversation || null;
  }

  async function getConversationMessages(
    {
      conversationId,
      workspaceId = 'default',
      limit,
      offset
    }: {
      conversationId: string;
      workspaceId?: string;
      limit?: number;
      offset?: number;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<ConversationMessage[]> {
    validateNodeId(conversationId, 'conversation');

    let query = _sql`
      SELECT * FROM conversation_messages 
      WHERE conversation_id = ${conversationId} AND workspace_id = ${workspaceId}
      ORDER BY timestamp ASC
    `;

    if (limit !== undefined) {
      if (offset !== undefined) {
        query = _sql`
          SELECT * FROM conversation_messages 
          WHERE conversation_id = ${conversationId} AND workspace_id = ${workspaceId}
          ORDER BY timestamp ASC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        query = _sql`
          SELECT * FROM conversation_messages 
          WHERE conversation_id = ${conversationId} AND workspace_id = ${workspaceId}
          ORDER BY timestamp ASC
          LIMIT ${limit}
        `;
      }
    }

    const messages = await query;

    // Parse JSON fields
    return messages.map((message) => ({
      ...message,
      toolCall: message.toolCall
        ? typeof message.toolCall === 'string'
          ? (JSON.parse(message.toolCall) as ToolCallData)
          : (message.toolCall as ToolCallData)
        : null
    })) as ConversationMessage[];
  }

  async function deleteConversation(
    {
      conversationId,
      workspaceId = 'default'
    }: {
      conversationId: string;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<boolean> {
    try {
      validateNodeId(conversationId, 'conversation');

      const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
        // Delete messages first (if cascade is not set up)
        await txSql`DELETE FROM conversation_messages WHERE conversation_id = ${conversationId} AND workspace_id = ${workspaceId}`;

        // Delete conversation
        const result =
          await txSql`DELETE FROM conversations WHERE id = ${conversationId} AND workspace_id = ${workspaceId}`;

        return result.count > 0;
      };

      if (typeof _sql.begin === 'function') {
        return _sql.begin(runTransaction);
      }
      return runTransaction(_sql);
    } catch (e) {
      if (e instanceof InvalidIdError) return false;
      throw e;
    }
  }

  return {
    addConversation,
    endConversation,
    addConversationMessages,
    getConversation,
    getConversationByVoiceSession,
    getConversationMessages,
    deleteConversation
  };
}
