import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const PORT = 55432;

declare global {
  var __EMBEDDED_PG__: EmbeddedPostgres | undefined;
}

export default async function globalSetup() {
  const pg = new EmbeddedPostgres({
    databaseDir: fs.mkdtempSync(path.join(os.tmpdir(), 'jest-pg-')),
    port: PORT,
    user: 'postgres',
    password: 'postgres',
    persistent: false
  });
  await pg.initialise();
  await pg.start();
  globalThis.__EMBEDDED_PG__ = pg;

  process.env.PGHOST = '127.0.0.1';
  process.env.PGPORT = String(PORT);
  process.env.PGUSER = 'postgres';
  process.env.PGPASSWORD = 'postgres';
  process.env.PGDATABASE = 'postgres';
}
