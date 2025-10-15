import type { PostgresConnection, PostgresTransactionConnection } from './database.js';
import { TitleConflictError, NotFoundError, InvalidParameterError, InvalidIdError } from './lib/errors.js';
import { generateNodeId, validateNodeId } from './lib/ids.js';
import { createTaskHandlers } from './task.js';

export interface List {
  id: string;
  title: string;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
  tasks?: TaskInputForList[];
}

export interface TaskInputForList {
  title: string;
  body?: string;
  position?: number;
}

export interface ListInputWithTasks {
  title: string;
  body?: string;
  tasks?: TaskInputForList[];
}

export function createListHandlers({ sql }: { sql: PostgresConnection }) {
  const taskHandlers = createTaskHandlers({ sql });

  async function addLists(
    {
      lists,
      workspaceId = 'default'
    }: {
      lists: Array<ListInputWithTasks>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(lists) || lists.length === 0) {
      throw new InvalidParameterError('Input "lists" must be a non-empty array.');
    }

    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      const listIds: string[] = [];
      for (const listData of lists) {
        if (!listData.title || listData.title.trim().length < 1 || listData.title.trim().length > 200) {
          throw new InvalidParameterError(`List title must be between 1 and 200 characters: "${listData.title}"`);
        }
        const trimmedTitle = listData.title.trim();

        const existing = await txSql<{ id: string }[]>`
          SELECT id FROM lists WHERE title = ${trimmedTitle} AND workspace_id = ${workspaceId}
        `;
        if (existing.length > 0) {
          throw new TitleConflictError('List', trimmedTitle);
        }

        const listId = await generateNodeId(txSql, 'list');
        await txSql`
          INSERT INTO lists (id, title, body, workspace_id)
          VALUES (${listId}, ${trimmedTitle}, ${listData.body || null}, ${workspaceId})
        `;
        listIds.push(listId);

        if (listData.tasks && listData.tasks.length > 0) {
          const tasksDataForHandler = listData.tasks.map((task) => ({
            ...task,
            listId: listId
          }));

          await taskHandlers.addTasks({ tasksData: tasksDataForHandler, workspaceId }, txSql);
        }
      }
      return listIds;
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function updateLists(
    {
      updates,
      workspaceId = 'default'
    }: {
      updates: Array<{ listId: string; title?: string; body?: string }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new InvalidParameterError('Input "updates" must be a non-empty array.');
    }

    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      for (const update of updates) {
        validateNodeId(update.listId, 'list');

        const [listExists] = await txSql<{ exists: boolean }[]>`
            SELECT EXISTS (SELECT 1 FROM lists WHERE id = ${update.listId} AND workspace_id = ${workspaceId})
        `;
        if (!listExists.exists) {
          throw new NotFoundError('List', update.listId);
        }

        if (update.title !== undefined) {
          const trimmedTitle = update.title.trim();
          if (trimmedTitle.length < 1 || trimmedTitle.length > 200) {
            throw new InvalidParameterError(`List title must be between 1 and 200 characters: "${trimmedTitle}"`);
          }
          const existing = await txSql<{ id: string }[]>`
            SELECT id FROM lists WHERE title = ${trimmedTitle} AND id != ${update.listId} AND workspace_id = ${workspaceId}
          `;
          if (existing.length > 0) {
            throw new TitleConflictError('List', trimmedTitle);
          }
          await txSql`
            UPDATE lists SET title = ${trimmedTitle} WHERE id = ${update.listId} AND workspace_id = ${workspaceId}
          `;
        }
        if (update.body !== undefined) {
          await txSql`
            UPDATE lists SET body = ${update.body || null} WHERE id = ${update.listId} AND workspace_id = ${workspaceId}
          `;
        }
      }
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function deleteLists(
    {
      listIds,
      workspaceId = 'default'
    }: {
      listIds: string[];
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(listIds) || listIds.length === 0) {
      throw new InvalidParameterError('Input "listIds" must be a non-empty array.');
    }

    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      const invalidIds: string[] = [];
      for (const listId of listIds) {
        try {
          validateNodeId(listId, 'list');
          // Cascading delete will handle tasks and associated edges
          const result = await txSql`
            DELETE FROM lists WHERE id = ${listId} AND workspace_id = ${workspaceId}
          `;
          if (result.count === 0) {
            invalidIds.push(listId);
          }
        } catch (e) {
          if (e instanceof InvalidIdError) invalidIds.push(listId);
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

  async function getList(
    {
      id,
      workspaceId = 'default'
    }: {
      id: string;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<List | null> {
    validateNodeId(id, 'list');
    const [list] = await _sql<List[]>`SELECT * FROM lists WHERE id = ${id} AND workspace_id = ${workspaceId}`;
    return list || null;
  }

  return { addLists, updateLists, deleteLists, getList };
}
