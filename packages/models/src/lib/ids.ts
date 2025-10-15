import type { PostgresConnection, PostgresTransactionConnection } from '../database.js';
import { InvalidIdError } from './errors.js';

export type NodeType =
  | 'list'
  | 'task'
  | 'note'
  | 'question'
  | 'edge'
  | 'conversation'
  | 'conversation_message'
  | 'reminder';

export async function generateNodeId(
  sql: PostgresConnection | PostgresTransactionConnection,
  type: NodeType
): Promise<string> {
  const sequenceName = `${type}_id_seq`;
  const [{ nextval }] = await sql<{ nextval: string }[]>`SELECT nextval('${sql(sequenceName)}')`;
  return `${type}:${nextval}`;
}

export function validateNodeId(id: string, expectedType?: NodeType): string {
  const parts = id.split(':');
  if (parts.length !== 2) {
    throw new InvalidIdError(id, expectedType);
  }
  const type = parts[0];
  const numericId = parseInt(parts[1], 10);

  if (isNaN(numericId) || numericId <= 0) {
    throw new InvalidIdError(id, expectedType);
  }

  if (expectedType && type !== expectedType) {
    throw new InvalidIdError(id, expectedType);
  }
  if (
    !['list', 'task', 'note', 'question', 'edge', 'conversation', 'conversation_message', 'reminder'].includes(type)
  ) {
    throw new InvalidIdError(id);
  }
  return id;
}

export function getNodeTypeFromId(id: string): NodeType {
  validateNodeId(id); // Basic validation
  return id.split(':')[0] as NodeType;
}
