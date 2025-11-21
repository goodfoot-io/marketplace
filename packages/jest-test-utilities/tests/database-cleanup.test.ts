import postgres from 'postgres';
import { getTestSql, teardownCallbacks, MAX_CONCURRENT_CONNECTIONS } from '../src/sql.js';

describe('Test Utilities', () => {
  test('Should make a connection to a test database', async () => {
    const { sql } = await getTestSql();
    await expect(sql`SELECT 1 as foo`).resolves.toEqual([{ foo: 1 }]);
  });

  test('Should cleanup a test database', async () => {
    // destroySql is called on process.on('JEST_TEARDOWN', ...)
    const { sql, database, username, password, destroySql } = await getTestSql();
    const testSql = postgres({ username, password, database });
    await expect(testSql`SELECT 1 as foo`).resolves.toEqual([{ foo: 1 }]);
    await testSql.end();
    await expect(sql`SELECT current_database()`).resolves.toEqual([{ currentDatabase: database }]);
    await expect(sql`SELECT current_user`).resolves.toEqual([{ currentUser: username }]);
    await destroySql();
    const destroyedTestSql = postgres({ username, password, database });
    await expect(destroyedTestSql`SELECT 1 as foo`).rejects.toThrow();
    await destroyedTestSql.end();
  });
  test('Should destroy old connections if the number of connections exceeds MAX_CONCURRENT_CONNECTIONS', async () => {
    const testSqls: Awaited<ReturnType<typeof getTestSql>>[] = [];
    for (let i = 0; i < MAX_CONCURRENT_CONNECTIONS * 2; i += 1) {
      const testSql = await getTestSql();
      testSqls.unshift(testSql);
    }
    for (let i = 0; i < MAX_CONCURRENT_CONNECTIONS; i += 1) {
      const testSql = testSqls[i];
      if (typeof testSql === 'undefined') {
        throw new Error('Test SQL object is undefined');
      }
      const { sql, username, database } = testSql;
      await expect(sql`SELECT current_database()`).resolves.toEqual([{ currentDatabase: database }]);
      await expect(sql`SELECT current_user`).resolves.toEqual([{ currentUser: username }]);
    }
    for (let i = MAX_CONCURRENT_CONNECTIONS; i < testSqls.length; i += 1) {
      const testSql = testSqls[i];
      if (typeof testSql === 'undefined') {
        throw new Error('Test SQL object is undefined');
      }
      const { sql } = testSql;
      await expect(sql`SELECT 1 as foo`).rejects.toThrow('CONNECTION_ENDED');
    }
    expect(teardownCallbacks.length).toEqual(MAX_CONCURRENT_CONNECTIONS);
  });
});
