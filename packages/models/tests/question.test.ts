import { getTestSql } from '@productivity-bot/test-utilities/sql';
import { initializeDatabase } from '../src/database.js';
import { InvalidParameterError, TitleConflictError, NotFoundError } from '../src/lib/errors.js';
import { createListHandlers } from '../src/list.js';
import { createQuestionHandlers } from '../src/question.js';

describe('Question Handlers', () => {
  describe('addQuestions', () => {
    it('should add questions successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions, getQuestion } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      // Create a list to use as srcId
      const [listId] = await addLists({ lists: [{ title: 'Test List' }] });

      const questionIds = await addQuestions({
        questionsData: [
          {
            srcId: listId,
            title: 'What is the deadline?',
            body: 'Need to know when this is due'
          },
          {
            srcId: listId,
            title: 'Who is the contact person?'
          }
        ]
      });

      expect(questionIds).toHaveLength(2);
      expect(questionIds[0]).toMatch(/^question:\d+$/);
      expect(questionIds[1]).toMatch(/^question:\d+$/);

      const question1 = await getQuestion({ questionId: questionIds[0] });
      expect(question1?.title).toBe('What is the deadline?');
      expect(question1?.body).toBe('Need to know when this is due');
      expect(question1?.srcId).toBe(listId);
      expect(question1?.answer).toBeNull();

      const question2 = await getQuestion({ questionId: questionIds[1] });
      expect(question2?.title).toBe('Who is the contact person?');
      expect(question2?.body).toBeNull();
    });

    it('should validate input parameters', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions } = createQuestionHandlers({ sql });

      await expect(addQuestions({ questionsData: [] })).rejects.toThrow(InvalidParameterError);
      await expect(addQuestions({ questionsData: null as unknown as [] })).rejects.toThrow(InvalidParameterError);
    });

    it('should validate title length', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }] });

      await expect(
        addQuestions({
          questionsData: [{ srcId: listId, title: '' }]
        })
      ).rejects.toThrow('Question title must be between 1 and 200 characters');

      await expect(
        addQuestions({
          questionsData: [{ srcId: listId, title: 'a'.repeat(201) }]
        })
      ).rejects.toThrow('Question title must be between 1 and 200 characters');
    });

    it('should require srcId', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions } = createQuestionHandlers({ sql });

      await expect(
        addQuestions({
          questionsData: [{ srcId: '', title: 'Test Question' }]
        })
      ).rejects.toThrow('Question must have a srcId');
    });

    it('should prevent duplicate titles for same srcId', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }] });

      await addQuestions({
        questionsData: [{ srcId: listId, title: 'Test Question' }]
      });

      await expect(
        addQuestions({
          questionsData: [{ srcId: listId, title: 'Test Question' }]
        })
      ).rejects.toThrow(TitleConflictError);
    });

    it('should allow same title for different srcIds', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      const [listId1] = await addLists({ lists: [{ title: 'Test List 1' }] });
      const [listId2] = await addLists({ lists: [{ title: 'Test List 2' }] });

      const questionIds1 = await addQuestions({
        questionsData: [{ srcId: listId1, title: 'Test Question' }]
      });

      const questionIds2 = await addQuestions({
        questionsData: [{ srcId: listId2, title: 'Test Question' }]
      });

      expect(questionIds1).toHaveLength(1);
      expect(questionIds2).toHaveLength(1);
      expect(questionIds1[0]).not.toBe(questionIds2[0]);
    });
  });

  describe('updateQuestions', () => {
    it('should update questions successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions, updateQuestions, getQuestion } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }] });
      const [questionId] = await addQuestions({
        questionsData: [{ srcId: listId, title: 'Original Question', body: 'Original body' }]
      });

      await updateQuestions({
        updates: [
          {
            questionId,
            title: 'Updated Question',
            body: 'Updated body',
            answer: 'The answer is 42'
          }
        ]
      });

      const question = await getQuestion({ questionId });
      expect(question?.title).toBe('Updated Question');
      expect(question?.body).toBe('Updated body');
      expect(question?.answer).toBe('The answer is 42');
    });

    it('should validate input parameters', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateQuestions } = createQuestionHandlers({ sql });

      await expect(updateQuestions({ updates: [] })).rejects.toThrow(InvalidParameterError);
    });

    it('should validate question exists', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateQuestions } = createQuestionHandlers({ sql });

      await expect(
        updateQuestions({
          updates: [{ questionId: 'question:999999', title: 'Updated' }]
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should validate title length on update', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions, updateQuestions } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }] });
      const [questionId] = await addQuestions({
        questionsData: [{ srcId: listId, title: 'Original Question' }]
      });

      await expect(
        updateQuestions({
          updates: [{ questionId, title: '' }]
        })
      ).rejects.toThrow('Question title must be between 1 and 200 characters');
    });

    it('should handle partial updates', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions, updateQuestions, getQuestion } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }] });
      const [questionId] = await addQuestions({
        questionsData: [{ srcId: listId, title: 'Original Question', body: 'Original body' }]
      });

      // Update only the answer
      await updateQuestions({
        updates: [{ questionId, answer: 'New answer' }]
      });

      const question = await getQuestion({ questionId });
      expect(question?.title).toBe('Original Question'); // unchanged
      expect(question?.body).toBe('Original body'); // unchanged
      expect(question?.answer).toBe('New answer'); // updated
    });

    it('should allow updating to a title that exists for a different srcId', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions, updateQuestions, getQuestion } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      // Create two lists
      const [listId1] = await addLists({ lists: [{ title: 'Test List 1' }] });
      const [listId2] = await addLists({ lists: [{ title: 'Test List 2' }] });

      // Create questions with different titles for different lists
      const [questionId1] = await addQuestions({
        questionsData: [{ srcId: listId1, title: 'Question for List 1' }]
      });

      const [questionId2] = await addQuestions({
        questionsData: [{ srcId: listId2, title: 'Common Question Title' }]
      });

      // Update question1 to have the same title as question2 (but different srcId)
      await updateQuestions({
        updates: [{ questionId: questionId1, title: 'Common Question Title' }]
      });

      // Verify both questions exist with the same title
      const question1 = await getQuestion({ questionId: questionId1 });
      const question2 = await getQuestion({ questionId: questionId2 });

      expect(question1?.title).toBe('Common Question Title');
      expect(question2?.title).toBe('Common Question Title');
      expect(question1?.srcId).toBe(listId1);
      expect(question2?.srcId).toBe(listId2);
    });

    it('should prevent updating to a duplicate title within the same srcId', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions, updateQuestions } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }] });

      // Create two questions for the same list
      await addQuestions({
        questionsData: [{ srcId: listId, title: 'Question 1' }]
      });

      const [questionId2] = await addQuestions({
        questionsData: [{ srcId: listId, title: 'Question 2' }]
      });

      // Try to update question2 to have the same title as question1
      await expect(
        updateQuestions({
          updates: [{ questionId: questionId2, title: 'Question 1' }]
        })
      ).rejects.toThrow(TitleConflictError);
    });
  });

  describe('deleteQuestions', () => {
    it('should delete questions successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions, deleteQuestions, getQuestion } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }] });
      const [questionId] = await addQuestions({
        questionsData: [{ srcId: listId, title: 'Question to Delete' }]
      });

      const invalidIds = await deleteQuestions({ questionIds: [questionId] });

      expect(invalidIds).toHaveLength(0);
      const question = await getQuestion({ questionId });
      expect(question).toBeNull();
    });

    it('should return invalid IDs for non-existent questions', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { deleteQuestions } = createQuestionHandlers({ sql });

      const invalidIds = await deleteQuestions({ questionIds: ['question:999999'] });

      expect(invalidIds).toEqual(['question:999999']);
    });

    it('should validate input parameters', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { deleteQuestions } = createQuestionHandlers({ sql });

      await expect(deleteQuestions({ questionIds: [] })).rejects.toThrow(InvalidParameterError);
    });

    it('should handle mixed valid and invalid IDs', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions, deleteQuestions, getQuestion } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }] });
      const [validQuestionId] = await addQuestions({
        questionsData: [{ srcId: listId, title: 'Valid Question' }]
      });

      const invalidIds = await deleteQuestions({
        questionIds: [validQuestionId, 'question:999999']
      });

      expect(invalidIds).toEqual(['question:999999']);
      const question = await getQuestion({ questionId: validQuestionId });
      expect(question).toBeNull();
    });
  });

  describe('getQuestion', () => {
    it('should retrieve question successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions, getQuestion } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }] });
      const [questionId] = await addQuestions({
        questionsData: [{ srcId: listId, title: 'Test Question', body: 'Test body', answer: 'Test answer' }]
      });

      const question = await getQuestion({ questionId });

      expect(question).toBeTruthy();
      expect(question?.id).toBe(questionId);
      expect(question?.srcId).toBe(listId);
      expect(question?.title).toBe('Test Question');
      expect(question?.body).toBe('Test body');
      expect(question?.answer).toBe('Test answer');
      expect(question?.createdAt).toBeInstanceOf(Date);
      expect(question?.updatedAt).toBeInstanceOf(Date);
      expect(question?.workspaceId).toBe('default');
    });

    it('should return null for non-existent question', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getQuestion } = createQuestionHandlers({ sql });

      const question = await getQuestion({ questionId: 'question:999999' });

      expect(question).toBeNull();
    });

    it('should validate question ID format', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getQuestion } = createQuestionHandlers({ sql });

      await expect(getQuestion({ questionId: 'invalid:id' })).rejects.toThrow();
    });
  });

  describe('Workspace Support', () => {
    it('should respect workspace isolation', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addQuestions, getQuestion } = createQuestionHandlers({ sql });
      const { addLists } = createListHandlers({ sql });

      // Create lists in different workspaces
      const [listIdA] = await addLists({ lists: [{ title: 'Test List' }], workspaceId: 'workspace-a' });
      const [listIdB] = await addLists({ lists: [{ title: 'Test List' }], workspaceId: 'workspace-b' });

      // Create questions in workspace A
      const [questionIdA] = await addQuestions({
        questionsData: [{ srcId: listIdA, title: 'Question A' }],
        workspaceId: 'workspace-a'
      });

      // Create questions in workspace B
      const [questionIdB] = await addQuestions({
        questionsData: [{ srcId: listIdB, title: 'Question A' }], // Same title is OK in different workspace
        workspaceId: 'workspace-b'
      });

      // Verify workspace isolation
      const questionA = await getQuestion({ questionId: questionIdA, workspaceId: 'workspace-a' });
      const questionB = await getQuestion({ questionId: questionIdB, workspaceId: 'workspace-b' });

      expect(questionA?.title).toBe('Question A');
      expect(questionB?.title).toBe('Question A');

      // Verify cross-workspace access returns null
      const questionAFromB = await getQuestion({ questionId: questionIdA, workspaceId: 'workspace-b' });
      const questionBFromA = await getQuestion({ questionId: questionIdB, workspaceId: 'workspace-a' });

      expect(questionAFromB).toBeNull();
      expect(questionBFromA).toBeNull();
    });
  });
});
