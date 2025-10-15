import type { PostgresConnection, PostgresTransactionConnection } from './database.js';
import { TitleConflictError, NotFoundError, InvalidParameterError, InvalidIdError } from './lib/errors.js';
import { generateNodeId, validateNodeId } from './lib/ids.js';

export interface Question {
  id: string;
  srcId: string;
  title: string;
  body: string | null;
  answer: string | null;
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
}

export function createQuestionHandlers({ sql }: { sql: PostgresConnection }) {
  async function addQuestions(
    {
      questionsData,
      workspaceId = 'default'
    }: {
      questionsData: Array<{ srcId: string; title: string; body?: string; answer?: string }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(questionsData) || questionsData.length === 0) {
      throw new InvalidParameterError('Input "questions" must be a non-empty array.');
    }
    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      const questionIds: string[] = [];
      for (const questionData of questionsData) {
        if (!questionData.title || questionData.title.trim().length < 1 || questionData.title.trim().length > 200) {
          throw new InvalidParameterError(
            `Question title must be between 1 and 200 characters: "${questionData.title}"`
          );
        }
        if (!questionData.srcId) {
          throw new InvalidParameterError('Question must have a srcId');
        }
        validateNodeId(questionData.srcId);

        const trimmedTitle = questionData.title.trim();
        const existing = await txSql<
          { id: string }[]
        >`SELECT id FROM questions WHERE title = ${trimmedTitle} AND src_id = ${questionData.srcId} AND workspace_id = ${workspaceId}`;
        if (existing.length > 0) {
          throw new TitleConflictError('Question', trimmedTitle);
        }
        const questionId = await generateNodeId(txSql, 'question');
        await txSql`
          INSERT INTO questions (id, src_id, title, body, answer, workspace_id)
          VALUES (${questionId}, ${questionData.srcId}, ${trimmedTitle}, ${questionData.body || null}, ${questionData.answer || null}, ${workspaceId})
        `;
        questionIds.push(questionId);
      }
      return questionIds;
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function updateQuestions(
    {
      updates,
      workspaceId = 'default'
    }: {
      updates: Array<{ questionId: string; title?: string; body?: string; answer?: string }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new InvalidParameterError('Input "questions" for updates must be a non-empty array.');
    }
    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      for (const update of updates) {
        validateNodeId(update.questionId, 'question');

        const [questionExists] = await txSql<{ exists: boolean }[]>`
            SELECT EXISTS (SELECT 1 FROM questions WHERE id = ${update.questionId} AND workspace_id = ${workspaceId})
        `;
        if (!questionExists.exists) {
          throw new NotFoundError('Question', update.questionId);
        }

        if (update.title !== undefined) {
          const trimmedTitle = update.title.trim();
          if (trimmedTitle.length < 1 || trimmedTitle.length > 200) {
            throw new InvalidParameterError(`Question title must be between 1 and 200 characters: "${trimmedTitle}"`);
          }

          // First get the current question's src_id
          const currentQuestionResult = await txSql<{ srcId: string }[]>`
            SELECT src_id as "srcId" FROM questions WHERE id = ${update.questionId} AND workspace_id = ${workspaceId}
          `;

          if (!currentQuestionResult || currentQuestionResult.length === 0) {
            throw new NotFoundError('Question', update.questionId);
          }

          const currentQuestion = currentQuestionResult[0];

          // Check for duplicates within the same src_id
          const existing = await txSql<{ id: string }[]>`
            SELECT id FROM questions 
            WHERE title = ${trimmedTitle} 
            AND src_id = ${currentQuestion.srcId}
            AND id != ${update.questionId} 
            AND workspace_id = ${workspaceId}
          `;
          if (existing.length > 0) {
            throw new TitleConflictError('Question', trimmedTitle);
          }
          await txSql`UPDATE questions SET title = ${trimmedTitle} WHERE id = ${update.questionId} AND workspace_id = ${workspaceId}`;
        }
        if (update.body !== undefined) {
          await txSql`UPDATE questions SET body = ${update.body || null} WHERE id = ${update.questionId} AND workspace_id = ${workspaceId}`;
        }
        if (update.answer !== undefined) {
          await txSql`UPDATE questions SET answer = ${update.answer || null} WHERE id = ${update.questionId} AND workspace_id = ${workspaceId}`;
        }
      }
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function deleteQuestions(
    {
      questionIds,
      workspaceId = 'default'
    }: {
      questionIds: string[];
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      throw new InvalidParameterError('Input "questionIds" must be a non-empty array.');
    }
    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      const invalidIds: string[] = [];
      for (const questionId of questionIds) {
        try {
          validateNodeId(questionId, 'question');
          const result = await txSql`DELETE FROM questions WHERE id = ${questionId} AND workspace_id = ${workspaceId}`;
          if (result.count === 0) {
            invalidIds.push(questionId);
          }
        } catch (e) {
          if (e instanceof InvalidIdError) invalidIds.push(questionId);
          else throw e;
        }
      }
      return invalidIds;
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function getQuestion(
    {
      questionId,
      workspaceId = 'default'
    }: {
      questionId: string;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<Question | null> {
    validateNodeId(questionId, 'question');

    const [question] = await _sql<
      Question[]
    >`SELECT * FROM questions WHERE id = ${questionId} AND workspace_id = ${workspaceId}`;

    return question || null;
  }

  return { addQuestions, updateQuestions, deleteQuestions, getQuestion };
}
