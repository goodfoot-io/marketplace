import { getTestSql } from '@productivity-bot/test-utilities/sql';
import { initializeDatabase } from '../src/database.js';
import { TitleConflictError, NotFoundError, InvalidParameterError, InvalidIdError } from '../src/lib/errors.js';
import { createNoteHandlers } from '../src/note.js';

describe('Note model', () => {
  describe('addNotes', () => {
    it('creates a single note successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });

      const noteIds = await addNotes({
        notesData: [{ title: 'Test Note', body: 'Test body' }],
        workspaceId: 'default'
      });

      expect(noteIds).toHaveLength(1);
      expect(noteIds[0]).toMatch(/^note:\d+$/);
    });

    it('creates multiple notes successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });

      const noteIds = await addNotes({
        notesData: [{ title: 'Note 1', body: 'Body 1' }, { title: 'Note 2', body: 'Body 2' }, { title: 'Note 3' }],
        workspaceId: 'default'
      });

      expect(noteIds).toHaveLength(3);
      noteIds.forEach((id) => {
        expect(id).toMatch(/^note:\d+$/);
      });
    });

    it('creates a note with only title', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: 'Title Only Note' }], workspaceId: 'default' });

      expect(noteIds).toHaveLength(1);
      expect(noteIds[0]).toMatch(/^note:\d+$/);
    });

    it('throws InvalidParameterError for empty array', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });

      await expect(addNotes({ notesData: [], workspaceId: 'default' })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for non-array input', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });

      await expect(
        addNotes({ notesData: null as unknown as Array<{ title: string; body?: string }>, workspaceId: 'default' })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for empty title', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });

      await expect(addNotes({ notesData: [{ title: '' }], workspaceId: 'default' })).rejects.toThrow(
        InvalidParameterError
      );
    });

    it('throws InvalidParameterError for title that is too long', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });

      const longTitle = 'a'.repeat(201);
      await expect(addNotes({ notesData: [{ title: longTitle }], workspaceId: 'default' })).rejects.toThrow(
        InvalidParameterError
      );
    });

    it('throws InvalidParameterError for whitespace-only title', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });

      await expect(addNotes({ notesData: [{ title: '   ' }], workspaceId: 'default' })).rejects.toThrow(
        InvalidParameterError
      );
    });

    it('throws TitleConflictError for duplicate titles', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });

      await addNotes({ notesData: [{ title: 'Duplicate Title' }], workspaceId: 'default' });
      await expect(addNotes({ notesData: [{ title: 'Duplicate Title' }], workspaceId: 'default' })).rejects.toThrow(
        TitleConflictError
      );
    });

    it('trims whitespace from titles', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: '  Trimmed Title  ' }], workspaceId: 'default' });
      const note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });

      expect(note?.title).toBe('Trimmed Title');
    });

    it('handles null body correctly', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({
        notesData: [{ title: 'No Body Note', body: undefined }],
        workspaceId: 'default'
      });
      const note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });

      expect(note?.body).toBeNull();
    });
  });

  describe('updateNotes', () => {
    it('updates note title successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, updateNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: 'Original Title' }], workspaceId: 'default' });
      await updateNotes({ updates: [{ noteId: noteIds[0], title: 'Updated Title' }], workspaceId: 'default' });
      const note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });

      expect(note?.title).toBe('Updated Title');
    });

    it('updates note body successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, updateNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({
        notesData: [{ title: 'Test Note', body: 'Original body' }],
        workspaceId: 'default'
      });
      await updateNotes({ updates: [{ noteId: noteIds[0], body: 'Updated body' }], workspaceId: 'default' });
      const note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });

      expect(note?.body).toBe('Updated body');
    });

    it('updates both title and body successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, updateNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({
        notesData: [{ title: 'Original Title', body: 'Original body' }],
        workspaceId: 'default'
      });
      await updateNotes({
        updates: [{ noteId: noteIds[0], title: 'Updated Title', body: 'Updated body' }],
        workspaceId: 'default'
      });
      const note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });

      expect(note?.title).toBe('Updated Title');
      expect(note?.body).toBe('Updated body');
    });

    it('updates multiple notes successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, updateNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: 'Note 1' }, { title: 'Note 2' }], workspaceId: 'default' });

      await updateNotes({
        updates: [
          { noteId: noteIds[0], title: 'Updated Note 1' },
          { noteId: noteIds[1], title: 'Updated Note 2' }
        ],
        workspaceId: 'default'
      });

      const note1 = await getNote({ noteId: noteIds[0], workspaceId: 'default' });
      const note2 = await getNote({ noteId: noteIds[1], workspaceId: 'default' });

      expect(note1?.title).toBe('Updated Note 1');
      expect(note2?.title).toBe('Updated Note 2');
    });

    it('sets body to null when empty string is provided', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, updateNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({
        notesData: [{ title: 'Test Note', body: 'Original body' }],
        workspaceId: 'default'
      });
      await updateNotes({ updates: [{ noteId: noteIds[0], body: '' }], workspaceId: 'default' });
      const note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });

      expect(note?.body).toBeNull();
    });

    it('throws InvalidParameterError for empty array', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateNotes } = createNoteHandlers({ sql });

      await expect(updateNotes({ updates: [], workspaceId: 'default' })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for non-array input', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateNotes } = createNoteHandlers({ sql });

      await expect(
        updateNotes({
          updates: null as unknown as Array<{ noteId: string; title?: string; body?: string }>,
          workspaceId: 'default'
        })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidIdError for invalid note ID format', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateNotes } = createNoteHandlers({ sql });

      await expect(
        updateNotes({ updates: [{ noteId: 'invalid-id', title: 'New Title' }], workspaceId: 'default' })
      ).rejects.toThrow(InvalidIdError);
    });

    it('throws NotFoundError for non-existent note ID', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateNotes } = createNoteHandlers({ sql });

      await expect(
        updateNotes({ updates: [{ noteId: 'note:999999', title: 'New Title' }], workspaceId: 'default' })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws InvalidParameterError for empty title', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, updateNotes } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: 'Test Note' }], workspaceId: 'default' });
      await expect(
        updateNotes({ updates: [{ noteId: noteIds[0], title: '' }], workspaceId: 'default' })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for title that is too long', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, updateNotes } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: 'Test Note' }], workspaceId: 'default' });
      const longTitle = 'a'.repeat(201);
      await expect(
        updateNotes({ updates: [{ noteId: noteIds[0], title: longTitle }], workspaceId: 'default' })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('throws TitleConflictError for duplicate titles', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, updateNotes } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: 'Note 1' }, { title: 'Note 2' }], workspaceId: 'default' });

      await expect(
        updateNotes({ updates: [{ noteId: noteIds[1], title: 'Note 1' }], workspaceId: 'default' })
      ).rejects.toThrow(TitleConflictError);
    });

    it('trims whitespace from titles', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, updateNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: 'Original Title' }], workspaceId: 'default' });
      await updateNotes({ updates: [{ noteId: noteIds[0], title: '  Trimmed Title  ' }], workspaceId: 'default' });
      const note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });

      expect(note?.title).toBe('Trimmed Title');
    });
  });

  describe('deleteNotes', () => {
    it('deletes a single note successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, deleteNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: 'Test Note' }], workspaceId: 'default' });
      const invalidIds = await deleteNotes({ noteIds: noteIds, workspaceId: 'default' });
      const note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });

      expect(invalidIds).toEqual([]);
      expect(note).toBeNull();
    });

    it('deletes multiple notes successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, deleteNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({
        notesData: [{ title: 'Note 1' }, { title: 'Note 2' }, { title: 'Note 3' }],
        workspaceId: 'default'
      });

      const invalidIds = await deleteNotes({ noteIds: noteIds, workspaceId: 'default' });

      expect(invalidIds).toEqual([]);
      for (const noteId of noteIds) {
        const note = await getNote({ noteId: noteId, workspaceId: 'default' });
        expect(note).toBeNull();
      }
    });

    it('returns invalid IDs for non-existent notes', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, deleteNotes } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: 'Test Note' }], workspaceId: 'default' });
      const invalidIds = await deleteNotes({ noteIds: [noteIds[0], 'note:999999'], workspaceId: 'default' });

      expect(invalidIds).toEqual(['note:999999']);
    });

    it('returns all IDs as invalid for completely invalid input', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { deleteNotes } = createNoteHandlers({ sql });

      const invalidIds = await deleteNotes({ noteIds: ['invalid-id', 'also-invalid'], workspaceId: 'default' });

      expect(invalidIds).toEqual(['invalid-id', 'also-invalid']);
    });

    it('throws InvalidParameterError for empty array', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { deleteNotes } = createNoteHandlers({ sql });

      await expect(deleteNotes({ noteIds: [], workspaceId: 'default' })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for non-array input', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { deleteNotes } = createNoteHandlers({ sql });

      await expect(deleteNotes({ noteIds: null as unknown as string[], workspaceId: 'default' })).rejects.toThrow(
        InvalidParameterError
      );
    });
  });

  describe('getNote', () => {
    it('retrieves a note successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({
        notesData: [{ title: 'Test Note', body: 'Test body' }],
        workspaceId: 'default'
      });
      const note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });

      expect(note).toEqual({
        id: noteIds[0],
        title: 'Test Note',
        body: 'Test body',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        workspaceId: 'default'
      });
    });

    it('returns null for non-existent note', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getNote } = createNoteHandlers({ sql });

      const note = await getNote({ noteId: 'note:999999', workspaceId: 'default' });

      expect(note).toBeNull();
    });

    it('throws InvalidIdError for invalid note ID format', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getNote } = createNoteHandlers({ sql });

      await expect(getNote({ noteId: 'invalid-id', workspaceId: 'default' })).rejects.toThrow(InvalidIdError);
    });

    it('throws InvalidIdError for wrong entity type', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { getNote } = createNoteHandlers({ sql });

      await expect(getNote({ noteId: 'list:123', workspaceId: 'default' })).rejects.toThrow(InvalidIdError);
    });

    it('handles notes with null body', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, getNote } = createNoteHandlers({ sql });

      const noteIds = await addNotes({ notesData: [{ title: 'No Body Note' }], workspaceId: 'default' });
      const note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });

      expect(note).toEqual({
        id: noteIds[0],
        title: 'No Body Note',
        body: null,
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        workspaceId: 'default'
      });
    });
  });

  describe('CRUD operations', () => {
    it('performs complete CRUD cycle', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, getNote, updateNotes, deleteNotes } = createNoteHandlers({ sql });

      // Create
      const noteIds = await addNotes({
        notesData: [{ title: 'CRUD Test Note', body: 'Original body' }],
        workspaceId: 'default'
      });
      expect(noteIds).toHaveLength(1);

      // Read
      let note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });
      expect(note?.title).toBe('CRUD Test Note');
      expect(note?.body).toBe('Original body');

      // Update
      await updateNotes({
        updates: [{ noteId: noteIds[0], title: 'Updated CRUD Note', body: 'Updated body' }],
        workspaceId: 'default'
      });
      note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });
      expect(note?.title).toBe('Updated CRUD Note');
      expect(note?.body).toBe('Updated body');

      // Delete
      const invalidIds = await deleteNotes({ noteIds: [noteIds[0]], workspaceId: 'default' });
      expect(invalidIds).toEqual([]);
      note = await getNote({ noteId: noteIds[0], workspaceId: 'default' });
      expect(note).toBeNull();
    });
  });

  describe('workspace isolation', () => {
    it('allows duplicate titles across different workspaces', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });

      await addNotes({ notesData: [{ title: 'Existing Note' }], workspaceId: 'default' });

      await expect(
        addNotes({
          notesData: [
            { title: 'New Note 1' },
            { title: 'Existing Note' }, // This should fail due to conflict in default workspace
            { title: 'New Note 2' }
          ],
          workspaceId: 'default'
        })
      ).rejects.toThrow(TitleConflictError);
    });

    it('isolates notes between workspaces', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes, getNote, updateNotes, deleteNotes } = createNoteHandlers({ sql });

      // Create notes in different workspaces
      const [note1W1Id] = await addNotes({ notesData: [{ title: 'W1 Note 1' }], workspaceId: 'w1' });
      await addNotes({ notesData: [{ title: 'W1 Note 2' }], workspaceId: 'w1' });

      // Create note with same title in different workspace
      const [note1W2Id] = await addNotes({ notesData: [{ title: 'W2 Note 1' }], workspaceId: 'w2' });

      // Verify isolation
      const note1W1 = await getNote({ noteId: note1W1Id, workspaceId: 'w1' });
      expect(note1W1?.title).toBe('W1 Note 1');
      const note1W1FromW2 = await getNote({ noteId: note1W1Id, workspaceId: 'w2' });
      expect(note1W1FromW2).toBeNull();

      // Test title conflicts within workspace
      await expect(addNotes({ notesData: [{ title: 'W1 Note 1' }], workspaceId: 'w1' })).rejects.toThrow(
        TitleConflictError
      );
      await addNotes({ notesData: [{ title: 'W1 Note 1' }], workspaceId: 'w2' }); // Should succeed in different workspace

      // Test updates across workspaces
      await updateNotes({ updates: [{ noteId: note1W1Id, title: 'W1 Note 1 Updated' }], workspaceId: 'w1' });
      const updatedNote1W1 = await getNote({ noteId: note1W1Id, workspaceId: 'w1' });
      expect(updatedNote1W1?.title).toBe('W1 Note 1 Updated');
      await expect(
        updateNotes({ updates: [{ noteId: note1W1Id, title: 'W1 Note 1 Updated From W2' }], workspaceId: 'w2' })
      ).rejects.toThrow(NotFoundError);
      const originalNote1W1 = await getNote({ noteId: note1W1Id, workspaceId: 'w1' }); // Verify it wasn't changed by w2 update attempt
      expect(originalNote1W1?.title).toBe('W1 Note 1 Updated');

      // Test title conflicts across workspaces during updates
      await addNotes({ notesData: [{ title: 'W2 Note 2 for Conflict' }], workspaceId: 'w2' });
      await expect(
        updateNotes({ updates: [{ noteId: note1W2Id, title: 'W2 Note 2 for Conflict' }], workspaceId: 'w2' })
      ).rejects.toThrow(TitleConflictError);
      await expect(
        updateNotes({ updates: [{ noteId: note1W1Id, title: 'W2 Note 2 for Conflict' }], workspaceId: 'w1' })
      ).resolves.not.toThrow(); // Should succeed in different workspace

      // Test deletes across workspaces
      const deleteResultW2 = await deleteNotes({ noteIds: [note1W1Id], workspaceId: 'w2' });
      expect(deleteResultW2).toEqual([note1W1Id]); // Should be invalid in w2
      const note1W1StillExists = await getNote({ noteId: note1W1Id, workspaceId: 'w1' });
      expect(note1W1StillExists).not.toBeNull();

      const deleteResultW1 = await deleteNotes({ noteIds: [note1W1Id], workspaceId: 'w1' });
      expect(deleteResultW1).toEqual([]);
      const note1W1Deleted = await getNote({ noteId: note1W1Id, workspaceId: 'w1' });
      expect(note1W1Deleted).toBeNull();
    });
  });
});
