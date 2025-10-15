import type { Sql, PostgresType, TransactionSql } from 'postgres';

export type PostgresConnection = Sql<Record<string, PostgresType>>;
export type PostgresTransactionConnection = TransactionSql<Record<string, PostgresType>>;

export async function initializeDatabase(sql: PostgresConnection): Promise<void> {
  // Only run on server side
  if (typeof window !== 'undefined') {
    throw new Error('Database initialization can only run on the server');
  }

  // Dynamic imports for Node.js modules
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  // Resolve path correctly whether running from root or package
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const sqlPath = path.join(__dirname, 'database.sql');
  const sqlContent = await fs.promises.readFile(sqlPath, 'utf8');
  await sql.unsafe(sqlContent);
}
