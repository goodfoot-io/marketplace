import { getTestSql } from '@productivity-bot/test-utilities/sql';
import { initializeDatabase } from '../src/database.js';
import { TitleConflictError, NotFoundError, InvalidParameterError, InvalidIdError } from '../src/lib/errors.js';
import { createListHandlers } from '../src/list.js';

describe('List model', () => {
  describe('addLists', () => {
    it('creates a single list successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'Test List', body: 'Test body' }], workspaceId: 'default' });

      expect(listIds).toHaveLength(1);
      expect(listIds[0]).toMatch(/^list:\d+$/);
    });

    it('creates multiple lists successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });

      const listIds = await addLists({
        lists: [{ title: 'List 1', body: 'Body 1' }, { title: 'List 2', body: 'Body 2' }, { title: 'List 3' }],
        workspaceId: 'default'
      });

      expect(listIds).toHaveLength(3);
      listIds.forEach((id) => {
        expect(id).toMatch(/^list:\d+$/);
      });
    });

    it('creates a list with only title', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'Title Only List' }], workspaceId: 'default' });

      expect(listIds).toHaveLength(1);
      expect(listIds[0]).toMatch(/^list:\d+$/);
    });

    it('throws InvalidParameterError for empty array', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });

      await expect(addLists({ lists: [], workspaceId: 'default' })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for non-array input', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });

      await expect(
        addLists({ lists: null as unknown as Array<{ title: string; body?: string }>, workspaceId: 'default' })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for empty title', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });

      await expect(addLists({ lists: [{ title: '' }], workspaceId: 'default' })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for title that is too long', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });

      const longTitle = 'a'.repeat(201);
      await expect(addLists({ lists: [{ title: longTitle }], workspaceId: 'default' })).rejects.toThrow(
        InvalidParameterError
      );
    });

    it('throws InvalidParameterError for whitespace-only title', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });

      await expect(addLists({ lists: [{ title: '   ' }], workspaceId: 'default' })).rejects.toThrow(
        InvalidParameterError
      );
    });

    it('throws TitleConflictError for duplicate titles', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });

      await addLists({ lists: [{ title: 'Duplicate Title' }], workspaceId: 'default' });
      await expect(addLists({ lists: [{ title: 'Duplicate Title' }], workspaceId: 'default' })).rejects.toThrow(
        TitleConflictError
      );
    });

    it('trims whitespace from titles', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: '  Trimmed Title  ' }], workspaceId: 'default' });
      const list = await getList({ id: listIds[0], workspaceId: 'default' });

      expect(list?.title).toBe('Trimmed Title');
    });

    it('handles null body correctly', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'No Body List', body: undefined }], workspaceId: 'default' });
      const list = await getList({ id: listIds[0], workspaceId: 'default' });

      expect(list?.body).toBeNull();
    });
  });

  describe('updateLists', () => {
    it('updates list title successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, updateLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'Original Title' }], workspaceId: 'default' });
      await updateLists({ updates: [{ listId: listIds[0], title: 'Updated Title' }], workspaceId: 'default' });
      const list = await getList({ id: listIds[0], workspaceId: 'default' });

      expect(list?.title).toBe('Updated Title');
    });

    it('updates list body successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, updateLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({
        lists: [{ title: 'Test List', body: 'Original body' }],
        workspaceId: 'default'
      });
      await updateLists({ updates: [{ listId: listIds[0], body: 'Updated body' }], workspaceId: 'default' });
      const list = await getList({ id: listIds[0], workspaceId: 'default' });

      expect(list?.body).toBe('Updated body');
    });

    it('updates both title and body successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, updateLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({
        lists: [{ title: 'Original Title', body: 'Original body' }],
        workspaceId: 'default'
      });
      await updateLists({
        updates: [{ listId: listIds[0], title: 'Updated Title', body: 'Updated body' }],
        workspaceId: 'default'
      });
      const list = await getList({ id: listIds[0], workspaceId: 'default' });

      expect(list?.title).toBe('Updated Title');
      expect(list?.body).toBe('Updated body');
    });

    it('updates multiple lists successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, updateLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'List 1' }, { title: 'List 2' }], workspaceId: 'default' });

      await updateLists({
        updates: [
          { listId: listIds[0], title: 'Updated List 1' },
          { listId: listIds[1], title: 'Updated List 2' }
        ],
        workspaceId: 'default'
      });

      const list1 = await getList({ id: listIds[0], workspaceId: 'default' });
      const list2 = await getList({ id: listIds[1], workspaceId: 'default' });

      expect(list1?.title).toBe('Updated List 1');
      expect(list2?.title).toBe('Updated List 2');
    });

    it('sets body to null when empty string is provided', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, updateLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({
        lists: [{ title: 'Test List', body: 'Original body' }],
        workspaceId: 'default'
      });
      await updateLists({ updates: [{ listId: listIds[0], body: '' }], workspaceId: 'default' });
      const list = await getList({ id: listIds[0], workspaceId: 'default' });

      expect(list?.body).toBeNull();
    });

    it('throws InvalidParameterError for empty array', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateLists } = createListHandlers({ sql });

      await expect(updateLists({ updates: [], workspaceId: 'default' })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for non-array input', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateLists } = createListHandlers({ sql });

      await expect(
        updateLists({
          updates: null as unknown as Array<{ listId: string; title?: string; body?: string }>,
          workspaceId: 'default'
        })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidIdError for invalid list ID format', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateLists } = createListHandlers({ sql });

      await expect(
        updateLists({ updates: [{ listId: 'invalid-id', title: 'New Title' }], workspaceId: 'default' })
      ).rejects.toThrow(InvalidIdError);
    });

    it('throws NotFoundError for non-existent list ID', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateLists } = createListHandlers({ sql });

      await expect(
        updateLists({ updates: [{ listId: 'list:999999', title: 'New Title' }], workspaceId: 'default' })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws TitleConflictError for duplicate titles', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, updateLists } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'List 1' }, { title: 'List 2' }], workspaceId: 'default' });

      await expect(
        updateLists({ updates: [{ listId: listIds[1], title: 'List 1' }], workspaceId: 'default' })
      ).rejects.toThrow(TitleConflictError);
    });

    it('trims whitespace from updated titles', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, updateLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'Original Title' }], workspaceId: 'default' });
      await updateLists({ updates: [{ listId: listIds[0], title: '  Trimmed Title  ' }], workspaceId: 'default' });
      const list = await getList({ id: listIds[0], workspaceId: 'default' });

      expect(list?.title).toBe('Trimmed Title');
    });

    it('throws InvalidParameterError for empty title', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, updateLists } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'Test List' }], workspaceId: 'default' });
      await expect(
        updateLists({ updates: [{ listId: listIds[0], title: '' }], workspaceId: 'default' })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for title that is too long', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, updateLists } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'Test List' }], workspaceId: 'default' });
      const longTitle = 'a'.repeat(201);
      await expect(
        updateLists({ updates: [{ listId: listIds[0], title: longTitle }], workspaceId: 'default' })
      ).rejects.toThrow(InvalidParameterError);
    });
  });

  describe('deleteLists', () => {
    it('deletes a single list successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, deleteLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'Test List' }], workspaceId: 'default' });

      const invalidIds = await deleteLists({ listIds, workspaceId: 'default' });
      const list = await getList({ id: listIds[0], workspaceId: 'default' });

      expect(invalidIds).toEqual([]);
      expect(list).toBeNull();
    });

    it('deletes multiple lists successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, deleteLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({
        lists: [{ title: 'List 1' }, { title: 'List 2' }, { title: 'List 3' }],
        workspaceId: 'default'
      });

      const invalidIds = await deleteLists({ listIds, workspaceId: 'default' });

      expect(invalidIds).toEqual([]);
      for (const listId of listIds) {
        const list = await getList({ id: listId, workspaceId: 'default' });
        expect(list).toBeNull();
      }
    });

    it('returns invalid IDs for non-existent lists', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, deleteLists } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'Test List' }], workspaceId: 'default' });
      const invalidIds = await deleteLists({ listIds: [listIds[0], 'list:999999'], workspaceId: 'default' });

      expect(invalidIds).toEqual(['list:999999']);
    });

    it('returns invalid IDs for malformed list IDs', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { deleteLists } = createListHandlers({ sql });

      const invalidIds = await deleteLists({ listIds: ['invalid-id', 'also-invalid'], workspaceId: 'default' });

      expect(invalidIds).toEqual(['invalid-id', 'also-invalid']);
    });

    it('throws InvalidParameterError for empty array', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { deleteLists } = createListHandlers({ sql });

      await expect(deleteLists({ listIds: [], workspaceId: 'default' })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for non-array input', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { deleteLists } = createListHandlers({ sql });

      await expect(deleteLists({ listIds: null as unknown as string[], workspaceId: 'default' })).rejects.toThrow(
        InvalidParameterError
      );
    });
  });

  describe('getList', () => {
    it('retrieves an existing list successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'Test List', body: 'Test body' }], workspaceId: 'default' });
      const list = await getList({ id: listIds[0], workspaceId: 'default' });

      expect(list).toEqual({
        id: listIds[0],
        title: 'Test List',
        body: 'Test body',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        workspaceId: 'default'
      });
    });

    it('returns null for non-existent list', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getList } = createListHandlers({ sql });

      const list = await getList({ id: 'list:999999', workspaceId: 'default' });
      expect(list).toBeNull();
    });

    it('throws InvalidIdError for invalid list ID format', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getList } = createListHandlers({ sql });

      await expect(getList({ id: 'invalid-id', workspaceId: 'default' })).rejects.toThrow(InvalidIdError);
    });

    it('throws InvalidIdError for wrong node type', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getList } = createListHandlers({ sql });

      await expect(getList({ id: 'task:123', workspaceId: 'default' })).rejects.toThrow(InvalidIdError);
    });

    it('handles null body correctly', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, getList } = createListHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'No Body List' }], workspaceId: 'default' });
      const list = await getList({ id: listIds[0], workspaceId: 'default' });

      expect(list?.body).toBeNull();
    });
  });

  describe('integration tests', () => {
    it('handles complete CRUD operations', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, updateLists, getList, deleteLists } = createListHandlers({ sql });

      // Create
      const listIds = await addLists({
        lists: [{ title: 'CRUD Test List', body: 'Original body' }],
        workspaceId: 'default'
      });
      expect(listIds).toHaveLength(1);

      // Read
      let list = await getList({ id: listIds[0], workspaceId: 'default' });
      expect(list?.title).toBe('CRUD Test List');
      expect(list?.body).toBe('Original body');

      // Update
      await updateLists({
        updates: [{ listId: listIds[0], title: 'Updated CRUD List', body: 'Updated body' }],
        workspaceId: 'default'
      });
      list = await getList({ id: listIds[0], workspaceId: 'default' });
      expect(list?.title).toBe('Updated CRUD List');
      expect(list?.body).toBe('Updated body');

      // Delete
      const invalidIds = await deleteLists({ listIds, workspaceId: 'default' });
      expect(invalidIds).toEqual([]);
      list = await getList({ id: listIds[0], workspaceId: 'default' });
      expect(list).toBeNull();
    });

    it('maintains data integrity across transactions', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });

      await addLists({ lists: [{ title: 'Existing List' }], workspaceId: 'default' });

      await expect(
        addLists({
          lists: [
            { title: 'New List 1' },
            { title: 'Existing List' }, // This should cause rollback
            { title: 'New List 2' }
          ],
          workspaceId: 'default'
        })
      ).rejects.toThrow(TitleConflictError);

      const [result] = await sql<
        { count: string }[]
      >`SELECT COUNT(*) as count FROM lists WHERE title IN ('New List 1', 'New List 2') AND workspace_id = 'default';`;
      expect(parseInt(result.count)).toBe(0);
    });
  });

  describe('workspace isolation', () => {
    it('isolates lists by workspace', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists, getList, updateLists, deleteLists } = createListHandlers({ sql });

      // Workspace 1 Setup
      const [list1W1Id] = await addLists({ lists: [{ title: 'W1 List 1' }], workspaceId: 'w1' });
      await addLists({ lists: [{ title: 'W1 List 2' }], workspaceId: 'w1' });

      // Workspace 2 Setup
      const [list1W2Id] = await addLists({ lists: [{ title: 'W2 List 1' }], workspaceId: 'w2' });

      // getList isolation
      const list1W1 = await getList({ id: list1W1Id, workspaceId: 'w1' });
      expect(list1W1?.title).toBe('W1 List 1');
      const list1W1FromW2 = await getList({ id: list1W1Id, workspaceId: 'w2' });
      expect(list1W1FromW2).toBeNull();

      // addLists title conflict isolation (same workspace)
      await expect(addLists({ lists: [{ title: 'W1 List 1' }], workspaceId: 'w1' })).rejects.toThrow(
        TitleConflictError
      );
      const [listW1List1FromW2] = await addLists({ lists: [{ title: 'W1 List 1' }], workspaceId: 'w2' }); // Should succeed in different workspace
      expect(listW1List1FromW2).toMatch(/^list:\d+$/);

      // updateLists isolation
      await updateLists({ updates: [{ listId: list1W1Id, title: 'W1 List 1 Updated' }], workspaceId: 'w1' });
      const updatedList1W1 = await getList({ id: list1W1Id, workspaceId: 'w1' });
      expect(updatedList1W1?.title).toBe('W1 List 1 Updated');
      await expect(
        updateLists({ updates: [{ listId: list1W1Id, title: 'W1 List 1 Updated From W2' }], workspaceId: 'w2' })
      ).rejects.toThrow(NotFoundError);
      const originalList1W1 = await getList({ id: list1W1Id, workspaceId: 'w1' });
      expect(originalList1W1?.title).toBe('W1 List 1 Updated'); // Verify not changed by W2 attempt

      // updateLists title conflict isolation
      await addLists({ lists: [{ title: 'W2 List for Conflict' }], workspaceId: 'w2' });
      await expect(
        updateLists({ updates: [{ listId: list1W2Id, title: 'W2 List for Conflict' }], workspaceId: 'w2' })
      ).rejects.toThrow(TitleConflictError);
      await expect(
        updateLists({ updates: [{ listId: list1W1Id, title: 'W2 List for Conflict' }], workspaceId: 'w1' })
      ).resolves.not.toThrow(); // Should succeed in different workspace

      // deleteLists isolation
      const deleteResultW2 = await deleteLists({ listIds: [list1W1Id], workspaceId: 'w2' });
      expect(deleteResultW2).toEqual([list1W1Id]); // Should be invalid in W2
      const list1W1StillExists = await getList({ id: list1W1Id, workspaceId: 'w1' });
      expect(list1W1StillExists).not.toBeNull();

      const deleteResultW1 = await deleteLists({ listIds: [list1W1Id], workspaceId: 'w1' });
      expect(deleteResultW1).toEqual([]);
      const list1W1Deleted = await getList({ id: list1W1Id, workspaceId: 'w1' });
      expect(list1W1Deleted).toBeNull();
    });
  });
});
