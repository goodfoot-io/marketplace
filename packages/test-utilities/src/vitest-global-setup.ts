import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Could not determine a free port')));
        return;
      }
      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

export default async function setup() {
  const port = await getFreePort();
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    onLog: () => {}
  });

  try {
    await pg.initialise();
    await pg.start();
  } catch (error) {
    fs.rmSync(databaseDir, { recursive: true, force: true });
    throw error;
  }

  process.env.PGHOST = '127.0.0.1';
  process.env.PGPORT = String(port);
  process.env.PGUSER = 'postgres';
  process.env.PGPASSWORD = 'postgres';
  process.env.PGDATABASE = 'postgres';

  return async () => {
    await pg.stop();
  };
}
