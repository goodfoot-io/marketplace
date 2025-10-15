import type { PostgresConnection, PostgresTransactionConnection } from './database.js';
import {
  TitleConflictError,
  NotFoundError,
  InvalidParameterError,
  ReorderMismatchError,
  InvalidIdError
} from './lib/errors.js';
import { generateNodeId, validateNodeId } from './lib/ids.js';

export interface Task {
  id: string;
  listId: string;
  title: string;
  body: string | null;
  completed: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
}

export function createTaskHandlers({ sql }: { sql: PostgresConnection }) {
  async function addTasks(
    {
      tasksData,
      workspaceId = 'default'
    }: {
      tasksData: Array<{ listId: string; title: string; body?: string; position?: number }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(tasksData) || tasksData.length === 0) {
      throw new InvalidParameterError('Input "tasks" must be a non-empty array.');
    }

    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      const taskIds: string[] = [];
      for (const taskData of tasksData) {
        validateNodeId(taskData.listId, 'list');
        const [listExistsResult] = await txSql<{ exists: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM lists WHERE id = ${taskData.listId} AND workspace_id = ${workspaceId}) as exists
        `;
        if (!listExistsResult?.exists) {
          throw new NotFoundError('List', taskData.listId);
        }

        if (!taskData.title || taskData.title.trim().length < 1 || taskData.title.trim().length > 200) {
          throw new InvalidParameterError(`Task title must be between 1 and 200 characters: "${taskData.title}"`);
        }
        const trimmedTitle = taskData.title.trim();

        const existingActive = await txSql<{ id: string }[]>`
          SELECT id FROM tasks WHERE list_id = ${taskData.listId} AND title = ${trimmedTitle} AND completed = FALSE AND workspace_id = ${workspaceId}
        `;
        if (existingActive.length > 0) {
          throw new TitleConflictError(`Active task in list '${taskData.listId}'`, trimmedTitle);
        }

        let position = taskData.position;
        if (position === undefined || position < 0) {
          const [result] = await txSql<
            { maxPos: string | null }[]
          >`SELECT MAX("position") as max_pos FROM tasks WHERE list_id = ${taskData.listId} AND workspace_id = ${workspaceId}`;
          const maxPos = result.maxPos ? parseInt(result.maxPos) : 0;
          position = maxPos + 1;
        } else {
          // Shift positions of other tasks if inserting in middle/start
          await txSql`UPDATE tasks SET "position" = "position" + 1 WHERE list_id = ${taskData.listId} AND "position" >= ${position} AND workspace_id = ${workspaceId}`;
        }

        const taskId = await generateNodeId(txSql, 'task');
        await txSql`
          INSERT INTO tasks (id, list_id, title, body, "position", workspace_id)
          VALUES (${taskId}, ${taskData.listId}, ${trimmedTitle}, ${taskData.body || null}, ${position}, ${workspaceId})
        `;
        taskIds.push(taskId);
      }
      return taskIds;
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function updateTasks(
    {
      updates,
      workspaceId = 'default'
    }: {
      updates: Array<{ taskId: string; title?: string; body?: string; completed?: boolean }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new InvalidParameterError('Input "tasks" for updates must be a non-empty array.');
    }
    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      for (const update of updates) {
        validateNodeId(update.taskId, 'task');
        const [task] = await txSql<
          Task[]
        >`SELECT * FROM tasks WHERE id = ${update.taskId} AND workspace_id = ${workspaceId}`;
        if (!task) {
          throw new NotFoundError('Task', update.taskId);
        }

        if (update.title !== undefined) {
          const trimmedTitle = update.title.trim();
          if (trimmedTitle.length < 1 || trimmedTitle.length > 200) {
            throw new InvalidParameterError(`Task title must be between 1 and 200 characters: "${trimmedTitle}"`);
          }
          if (task.title !== trimmedTitle) {
            // Only check for conflict if title actually changes
            const existingActive = await txSql<{ id: string }[]>`
              SELECT id FROM tasks WHERE list_id = ${task.listId} AND title = ${trimmedTitle} AND completed = FALSE AND id != ${update.taskId} AND workspace_id = ${workspaceId}
            `;
            if (existingActive.length > 0) {
              throw new TitleConflictError(`Active task in list '${task.listId}'`, trimmedTitle);
            }
            await txSql`UPDATE tasks SET title = ${trimmedTitle} WHERE id = ${update.taskId} AND workspace_id = ${workspaceId}`;
          }
        }
        if (update.body !== undefined) {
          await txSql`UPDATE tasks SET body = ${update.body || null} WHERE id = ${update.taskId} AND workspace_id = ${workspaceId}`;
        }
        if (update.completed !== undefined) {
          await txSql`UPDATE tasks SET completed = ${update.completed} WHERE id = ${update.taskId} AND workspace_id = ${workspaceId}`;
        }
      }
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function deleteTasks(
    {
      taskIds,
      workspaceId = 'default'
    }: {
      taskIds: string[];
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new InvalidParameterError('Input "taskIds" must be a non-empty array.');
    }

    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      const invalidIds: string[] = [];
      for (const taskId of taskIds) {
        try {
          validateNodeId(taskId, 'task');
          // Edges referencing this task will be handled by DB cascades if set up, or need manual deletion
          const result = await txSql`DELETE FROM tasks WHERE id = ${taskId} AND workspace_id = ${workspaceId}`;
          if (result.count === 0) {
            invalidIds.push(taskId);
          }
        } catch (e) {
          if (e instanceof InvalidIdError) invalidIds.push(taskId);
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

  async function markTasksCompleted(
    {
      taskIds,
      workspaceId = 'default'
    }: {
      taskIds: string[];
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(taskIds) || taskIds.length === 0 || taskIds.length > 256) {
      throw new InvalidParameterError('Input "taskIds" must be an array with 1 to 256 elements.');
    }
    const validatedTaskIds = taskIds.map((id) => validateNodeId(id, 'task'));

    // This will mark tasks as completed. If already completed, it won't change the timestamp.
    // The internal completion timestamp is handled by the 'updated_at' trigger.
    await _sql`
      UPDATE tasks
      SET completed = TRUE
      WHERE id = ANY(${validatedTaskIds}) AND workspace_id = ${workspaceId}
    `;
    // Return the list of IDs that were processed.
    // We assume if an ID is valid and in the list, it was "processed" even if already complete.
    return validatedTaskIds;
  }

  async function moveTasks(
    {
      moves,
      workspaceId = 'default'
    }: {
      moves: Array<{ taskId: string; destinationListId: string; position?: number }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    if (!Array.isArray(moves) || moves.length === 0) {
      throw new InvalidParameterError('Input "moves" must be a non-empty array.');
    }
    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      for (const move of moves) {
        validateNodeId(move.taskId, 'task');
        validateNodeId(move.destinationListId, 'list');

        const [task] = await txSql<
          Task[]
        >`SELECT * FROM tasks WHERE id = ${move.taskId} AND workspace_id = ${workspaceId}`;
        if (!task) throw new NotFoundError('Task', move.taskId);

        const [destListExistsResult] = await txSql<{ exists: boolean }[]>`
            SELECT EXISTS (SELECT 1 FROM lists WHERE id = ${move.destinationListId} AND workspace_id = ${workspaceId}) as exists
        `;
        if (!destListExistsResult?.exists) {
          throw new NotFoundError('Destination List', move.destinationListId);
        }

        // Check for title conflict in destination list if the task is active
        if (!task.completed) {
          const existingActive = await txSql<{ id: string }[]>`
            SELECT id FROM tasks 
            WHERE list_id = ${move.destinationListId} AND title = ${task.title} AND completed = FALSE AND id != ${move.taskId} AND workspace_id = ${workspaceId}
            `;
          if (existingActive.length > 0) {
            throw new TitleConflictError(`Active task in list '${move.destinationListId}'`, task.title);
          }
        }

        let position = move.position;
        if (position === undefined || position < 0) {
          const [result] = await txSql<
            { maxPos: string | null }[]
          >`SELECT MAX("position") as max_pos FROM tasks WHERE list_id = ${move.destinationListId} AND workspace_id = ${workspaceId}`;
          const maxPos = result.maxPos ? parseInt(result.maxPos) : 0;
          position = maxPos + 1;
        } else {
          await txSql`UPDATE tasks SET "position" = "position" + 1 WHERE list_id = ${move.destinationListId} AND "position" >= ${position} AND workspace_id = ${workspaceId}`;
        }

        // Decrement positions in old list
        await txSql`UPDATE tasks SET "position" = "position" - 1 WHERE list_id = ${task.listId} AND "position" > ${task.position} AND workspace_id = ${workspaceId}`;

        // Update task
        await txSql`UPDATE tasks SET list_id = ${move.destinationListId}, "position" = ${position} WHERE id = ${move.taskId} AND workspace_id = ${workspaceId}`;
      }
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function reorderListTasks(
    {
      listId,
      orderedTaskIds,
      workspaceId = 'default'
    }: {
      listId: string;
      orderedTaskIds: string[];
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    validateNodeId(listId, 'list');
    if (!Array.isArray(orderedTaskIds)) {
      throw new InvalidParameterError('Input "orderedTaskIds" must be an array.');
    }
    const validatedTaskIds = orderedTaskIds.map((id) => validateNodeId(id, 'task'));

    const runTransaction = async (txSql: PostgresConnection | PostgresTransactionConnection) => {
      const [listExists] = await txSql<
        { exists: boolean }[]
      >`SELECT EXISTS (SELECT 1 FROM lists WHERE id = ${listId} AND workspace_id = ${workspaceId})`;
      if (!listExists.exists) {
        throw new NotFoundError('List', listId);
      }

      const tasksInList = await txSql<Task[]>`
        SELECT id, "position" FROM tasks WHERE list_id = ${listId} AND workspace_id = ${workspaceId} ORDER BY "position" ASC
      `;

      if (tasksInList.length !== validatedTaskIds.length) {
        const currentIds = tasksInList.map((t) => t.id).sort();
        const providedIds = [...validatedTaskIds].sort();
        if (JSON.stringify(currentIds) !== JSON.stringify(providedIds)) {
          throw new ReorderMismatchError('The provided task IDs do not match the set of tasks in the list.');
        }
      }

      for (let i = 0; i < validatedTaskIds.length; i++) {
        const taskId = validatedTaskIds[i];
        const newPosition = i + 1;
        const updateResult =
          await txSql`UPDATE tasks SET "position" = ${newPosition} WHERE id = ${taskId} AND list_id = ${listId} AND workspace_id = ${workspaceId}`;
        if (updateResult.count === 0) {
          throw new NotFoundError('Task to reorder not found in the specified list and workspace', taskId);
        }
      }
    };

    if (typeof _sql.begin === 'function') {
      return _sql.begin(runTransaction);
    }
    return runTransaction(_sql);
  }

  async function getTask(
    {
      taskId,
      workspaceId = 'default'
    }: {
      taskId: string;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<Task | null> {
    validateNodeId(taskId, 'task');
    const [task] = await _sql<Task[]>`SELECT * FROM tasks WHERE id = ${taskId} AND workspace_id = ${workspaceId}`;
    return task || null;
  }

  // This is a convenience wrapper for moveTasks, designed for simpler single-task moves by AI agent
  async function moveTask(
    {
      taskId,
      destinationListId,
      position,
      workspaceId = 'default'
    }: {
      taskId: string;
      destinationListId: string;
      position?: number;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    await moveTasks({ moves: [{ taskId, destinationListId, position }], workspaceId }, _sql);
  }

  return { addTasks, updateTasks, deleteTasks, markTasksCompleted, moveTasks, reorderListTasks, getTask, moveTask };
}
