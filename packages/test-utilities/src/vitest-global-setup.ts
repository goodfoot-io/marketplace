import type { TestProject } from 'vitest/node';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import exitHook from 'async-exit-hook';
import EmbeddedPostgres from 'embedded-postgres';

// Vitest awaits our teardown. The library's natural-exit hooks force code 0
// or invoke async shutdown without its callback; preserve its signal handlers.
for (const event of ['beforeExit', 'exit']) {
  if (exitHook.hookedEvents().includes(event)) exitHook.unhookEvent(event);
}

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

export default async function setup(project: TestProject) {
  const port = await getFreePort();
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    postgresFlags: ['-h', '127.0.0.1', '-k', databaseDir, '-c', 'statement_timeout=10000'],
    onLog: () => {}
  });

  try {
    await pg.initialise();
    await pg.start();
  } catch (error) {
    // Startup rejection follows child exit; stop() would wait for a second exit.
    fs.rmSync(databaseDir, { recursive: true, force: true });
    throw error;
  }

  project.provide('testPostgres', { port });

  return async () => {
    try {
      await pg.stop();
    } finally {
      fs.rmSync(databaseDir, { recursive: true, force: true });
    }
  };
}
