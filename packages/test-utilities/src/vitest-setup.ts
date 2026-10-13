import { inject } from 'vitest';
import './vitest-teardown.js';
import './vitest-matchers.js';

const database = inject('testPostgres');
if (database) {
  process.env.PGHOST = '127.0.0.1';
  process.env.PGPORT = String(database.port);
  process.env.PGUSER = 'postgres';
  delete process.env.PGUSERNAME;
  process.env.PGPASSWORD = 'postgres';
  process.env.PGDATABASE = 'postgres';
  process.env.PGCONNECT_TIMEOUT = '2';
}

declare global {
  function startTeardownQueue(name?: string): Promise<void>;
}

// Use the same Vitest name that teardownQueue reads from expect.getState().
afterEach(async ({ task }) => {
  const testName = task.fullTestName;
  if (!testName) throw new Error('Vitest did not provide a test name for teardown');
  await globalThis.startTeardownQueue(testName);
});

afterAll(async () => {
  await globalThis.startTeardownQueue();
});
