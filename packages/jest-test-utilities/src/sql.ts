import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import { jestTeardownQueue } from './jest-teardown.js';

export type PostgresConnection = postgres.Sql<Record<string, postgres.PostgresType>>;

const sql: PostgresConnection = postgres({
  transform: {
    column: postgres.camel.column
  },
  onnotice(data) {
    if (data.code === '42P07') {
      return;
    }
    console.log(data);
  }
});

let didAddGlobalTeardown = false;

export const teardownCallbacks: (() => Promise<void>)[] = [];
export const MAX_CONCURRENT_CONNECTIONS = 5;

export async function getTestSql(
  options: { debug?: postgres.Options<Record<string, postgres.PostgresType>>['debug'] } = {}
) {
  if (!didAddGlobalTeardown) {
    didAddGlobalTeardown = true;
    void jestTeardownQueue.add(
      async () => {
        await sql.end();
      },
      { priority: -2, id: 'global-teardown' }
    );
  }
  const username = `_${uuidv4().replace(/-/g, '')}`;
  const password = `_${uuidv4().replace(/-/g, '')}`;
  const database = `_${uuidv4().replace(/-/g, '')}`;

  await sql.unsafe(`CREATE ROLE ${username} WITH LOGIN PASSWORD '${password}' CREATEDB`);
  await sql.unsafe(`CREATE DATABASE ${database}`);
  await sql.unsafe(`ALTER DATABASE ${database} OWNER TO ${username}`);
  await sql.unsafe(`GRANT ALL PRIVILEGES ON DATABASE ${database} TO ${username}`);
  const testSql: PostgresConnection = postgres({
    username,
    password,
    database,
    debug: options.debug,
    transform: {
      column: postgres.camel.column
    }
  });
  let didTeardown = false;
  const teardownCallback = async () => {
    if (didTeardown) {
      return;
    }
    didTeardown = true;
    await testSql.end();
    await sql.unsafe(`DROP DATABASE ${database}`);
    await sql.unsafe(`DROP OWNED BY ${username} CASCADE`);
    await sql.unsafe(`DROP ROLE ${username}`);
    const callbackIndex = teardownCallbacks.indexOf(teardownCallback);
    if (callbackIndex !== -1) {
      teardownCallbacks.splice(callbackIndex, 1);
    }
  };
  teardownCallbacks.unshift(teardownCallback);
  while (teardownCallbacks.length > MAX_CONCURRENT_CONNECTIONS) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  void jestTeardownQueue.add(teardownCallback, { priority: -1 });
  return {
    username,
    password,
    database,
    sql: testSql,
    destroySql: teardownCallback
  };
}

export default sql;
