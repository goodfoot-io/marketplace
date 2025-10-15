import type { PostgresConnection, PostgresTransactionConnection } from './database.js';
import { NotFoundError, InvalidParameterError, InvalidIdError } from './lib/errors.js';
import { generateNodeId, validateNodeId, getNodeTypeFromId } from './lib/ids.js';

export interface Edge {
  id: string;
  srcId: string;
  dstId: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
}

async function nodeExists(
  sql: PostgresConnection | PostgresTransactionConnection,
  nodeId: string,
  workspaceId: string
): Promise<boolean> {
  const type = getNodeTypeFromId(nodeId); // this also validates general ID format
  let tableName: string;
  switch (type) {
    case 'list':
      tableName = 'lists';
      break;
    case 'task':
      tableName = 'tasks';
      break;
    case 'note':
      tableName = 'notes';
      break;
    case 'question':
      tableName = 'questions';
      break;
    case 'reminder':
      tableName = 'reminders';
      break;
    default:
      throw new InvalidParameterError(`Unknown node type in ID: ${nodeId}`);
  }
  const [result] = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM ${sql(tableName)} WHERE id = ${nodeId} AND workspace_id = ${workspaceId})
    `;
  return result.exists;
}

export function createEdgeHandlers({ sql }: { sql: PostgresConnection }) {
  async function linkEdges(
    {
      edgesData,
      workspaceId = 'default'
    }: {
      edgesData: Array<{ srcId: string; dstId: string; description?: string }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    if (!Array.isArray(edgesData) || edgesData.length === 0) {
      throw new InvalidParameterError('Input "edges" must be a non-empty array.');
    }
    await _sql.begin(async (txSql) => {
      for (const edgeData of edgesData) {
        validateNodeId(edgeData.srcId); // Validate format, type will be checked by nodeExists
        validateNodeId(edgeData.dstId);

        if (!(await nodeExists(txSql, edgeData.srcId, workspaceId))) {
          throw new NotFoundError('Source node', edgeData.srcId);
        }
        if (!(await nodeExists(txSql, edgeData.dstId, workspaceId))) {
          throw new NotFoundError('Destination node', edgeData.dstId);
        }

        const [existingEdge] = await txSql<Edge[]>`
          SELECT * FROM edges WHERE src_id = ${edgeData.srcId} AND dst_id = ${edgeData.dstId} AND workspace_id = ${workspaceId}
        `;

        if (existingEdge) {
          if (edgeData.description !== undefined && existingEdge.description !== (edgeData.description || null)) {
            await txSql`
              UPDATE edges SET description = ${edgeData.description || null}
              WHERE id = ${existingEdge.id}
            `;
          }
        } else {
          const edgeId = await generateNodeId(txSql, 'edge');
          await txSql`
            INSERT INTO edges (id, src_id, dst_id, description, workspace_id)
            VALUES (${edgeId}, ${edgeData.srcId}, ${edgeData.dstId}, ${edgeData.description || null}, ${workspaceId})
          `;
        }
      }
    });
  }

  async function updateEdges(
    {
      updates,
      workspaceId = 'default'
    }: {
      updates: Array<{ edgeId: string; description: string }>;
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new InvalidParameterError('Input "edges" for updates must be a non-empty array.');
    }
    const invalidIds: string[] = [];
    await _sql.begin(async (txSql) => {
      for (const update of updates) {
        try {
          validateNodeId(update.edgeId, 'edge');
          const result = await txSql`
            UPDATE edges SET description = ${update.description || null}
            WHERE id = ${update.edgeId} AND workspace_id = ${workspaceId}
            `;
          if (result.count === 0) {
            invalidIds.push(update.edgeId);
          }
        } catch (e) {
          if (e instanceof InvalidIdError) invalidIds.push(update.edgeId);
          else throw e;
        }
      }
    });
    return invalidIds;
  }

  async function unlinkEdges(
    {
      edgeIds,
      workspaceId = 'default'
    }: {
      edgeIds: string[];
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<string[]> {
    if (!Array.isArray(edgeIds) || edgeIds.length === 0) {
      throw new InvalidParameterError('Input "edgeIds" must be a non-empty array.');
    }
    const invalidIds: string[] = [];
    await _sql.begin(async (txSql) => {
      for (const edgeId of edgeIds) {
        try {
          validateNodeId(edgeId, 'edge');
          const result = await txSql`DELETE FROM edges WHERE id = ${edgeId} AND workspace_id = ${workspaceId}`;
          if (result.count === 0) {
            invalidIds.push(edgeId);
          }
        } catch (e) {
          if (e instanceof InvalidIdError) invalidIds.push(edgeId);
          else throw e;
        }
      }
    });
    return invalidIds;
  }

  return { linkEdges, updateEdges, unlinkEdges };
}
