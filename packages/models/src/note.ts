import type { PostgresConnection, PostgresTransactionConnection } from './database.js';
import { TitleConflictError, NotFoundError, InvalidParameterError, InvalidIdError } from './lib/errors.js';
import { generateNodeId, validateNodeId } from './lib/ids.js';

export interface Note {
  id: string;
  title: string;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
}

export function createNoteHandlers({ sql }: { sql: PostgresConnection }) {
  async function addNotes(
    {
      notesData,
      workspaceId = 'default'
    }: {
      notesData: Array<{ title: string; body?: string }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(notesData) || notesData.length === 0) {
      throw new InvalidParameterError('Input "notes" must be a non-empty array.');
    }
    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      const noteIds: string[] = [];
      for (const noteData of notesData) {
        if (!noteData.title || noteData.title.trim().length < 1 || noteData.title.trim().length > 200) {
          throw new InvalidParameterError(`Note title must be between 1 and 200 characters: "${noteData.title}"`);
        }
        const trimmedTitle = noteData.title.trim();
        const existing = await txSql<
          { id: string }[]
        >`SELECT id FROM notes WHERE title = ${trimmedTitle} AND workspace_id = ${workspaceId}`;
        if (existing.length > 0) {
          throw new TitleConflictError('Note', trimmedTitle);
        }
        const noteId = await generateNodeId(txSql, 'note');
        await txSql`
          INSERT INTO notes (id, title, body, workspace_id)
          VALUES (${noteId}, ${trimmedTitle}, ${noteData.body || null}, ${workspaceId})
        `;
        noteIds.push(noteId);
      }
      return noteIds;
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function updateNotes(
    {
      updates,
      workspaceId = 'default'
    }: {
      updates: Array<{ noteId: string; title?: string; body?: string }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new InvalidParameterError('Input "notes" for updates must be a non-empty array.');
    }
    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      for (const update of updates) {
        validateNodeId(update.noteId, 'note');

        const [noteExists] = await txSql<{ exists: boolean }[]>`
            SELECT EXISTS (SELECT 1 FROM notes WHERE id = ${update.noteId} AND workspace_id = ${workspaceId})
        `;
        if (!noteExists.exists) {
          throw new NotFoundError('Note', update.noteId);
        }

        if (update.title !== undefined) {
          const trimmedTitle = update.title.trim();
          if (trimmedTitle.length < 1 || trimmedTitle.length > 200) {
            throw new InvalidParameterError(`Note title must be between 1 and 200 characters: "${trimmedTitle}"`);
          }
          const existing = await txSql<{ id: string }[]>`
            SELECT id FROM notes WHERE title = ${trimmedTitle} AND id != ${update.noteId} AND workspace_id = ${workspaceId}
          `;
          if (existing.length > 0) {
            throw new TitleConflictError('Note', trimmedTitle);
          }
          await txSql`UPDATE notes SET title = ${trimmedTitle} WHERE id = ${update.noteId} AND workspace_id = ${workspaceId}`;
        }
        if (update.body !== undefined) {
          await txSql`UPDATE notes SET body = ${update.body || null} WHERE id = ${update.noteId} AND workspace_id = ${workspaceId}`;
        }
      }
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function deleteNotes(
    {
      noteIds,
      workspaceId = 'default'
    }: {
      noteIds: string[];
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      throw new InvalidParameterError('Input "noteIds" must be a non-empty array.');
    }
    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      const invalidIds: string[] = [];
      for (const noteId of noteIds) {
        try {
          validateNodeId(noteId, 'note');
          // Edges referencing this note will be handled by DB cascades if set up, or need manual deletion
          const result = await txSql`DELETE FROM notes WHERE id = ${noteId} AND workspace_id = ${workspaceId}`;
          if (result.count === 0) {
            invalidIds.push(noteId);
          }
        } catch (e) {
          if (e instanceof InvalidIdError) invalidIds.push(noteId);
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

  async function getNote(
    {
      noteId,
      workspaceId = 'default'
    }: {
      noteId: string;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<Note | null> {
    validateNodeId(noteId, 'note');

    const [note] = await _sql<Note[]>`SELECT * FROM notes WHERE id = ${noteId} AND workspace_id = ${workspaceId}`;

    return note || null;
  }

  return { addNotes, updateNotes, deleteNotes, getNote };
}
