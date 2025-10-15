import type { Application } from 'express';
import { promises as fs } from 'fs';
import { createServer, type Server as HttpServer } from 'http';
import path from 'path';

export interface DaemonServerConfig {
  port: number;
  host?: string;
  daemonDir?: string;
  debug?: boolean;
}

export interface DaemonInfo {
  pid: number;
  port: number;
  startedAt: number;
  clientCount: number;
}

export interface DaemonStartResult {
  isMainProcess: boolean;
  server?: HttpServer;
  info: DaemonInfo;
}

interface ClientRecord {
  [clientId: string]: number;
}

interface ErrnoException extends Error {
  code?: string;
}

export class StreamableHttpDaemon {
  private config: Required<DaemonServerConfig>;
  private pidFile: string;
  private clientsFile: string;
  private clientId: string;
  private cleanupHandlers: Array<() => Promise<void>> = [];
  private server?: HttpServer;

  constructor(config: DaemonServerConfig) {
    this.config = {
      host: '127.0.0.1',
      daemonDir: '/tmp/mcp-daemon',
      debug: false,
      ...config
    };
    this.pidFile = path.join(this.config.daemonDir, `server-${this.config.port}.pid`);
    this.clientsFile = path.join(this.config.daemonDir, `clients-${this.config.port}.json`);
    this.clientId = `${process.pid}-${Date.now()}`;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[StreamableHttpDaemon:${this.config.port}]`, message, ...args);
    }
  }

  private async isPortInUse(): Promise<boolean> {
    return new Promise((resolve) => {
      const testServer = createServer();
      testServer.once('error', (err: Error) => {
        const errnoError = err as ErrnoException;
        if (errnoError.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      testServer.once('listening', () => {
        testServer.close();
        resolve(false);
      });
      testServer.listen(this.config.port, this.config.host);
    });
  }

  private isServerProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async readDaemonInfo(): Promise<DaemonInfo | null> {
    try {
      const pidContent = await fs.readFile(this.pidFile, 'utf-8');
      const pid = parseInt(pidContent.trim(), 10);
      if (isNaN(pid)) {
        this.log('Invalid PID in file');
        return null;
      }
      if (!this.isServerProcessAlive(pid)) {
        this.log('Server process no longer alive');
        return null;
      }
      let clientCount = 0;
      try {
        const clientsContent = await fs.readFile(this.clientsFile, 'utf-8');
        const clients = JSON.parse(clientsContent) as ClientRecord;
        clientCount = Object.keys(clients).length;
      } catch {
        // File might not exist
      }
      return { pid, port: this.config.port, startedAt: 0, clientCount };
    } catch (error) {
      const errnoError = error as ErrnoException;
      if (errnoError.code !== 'ENOENT') {
        this.log('Error reading daemon info:', error);
      }
      return null;
    }
  }

  private async registerClient(): Promise<void> {
    await fs.mkdir(this.config.daemonDir, { recursive: true });
    let clients: ClientRecord = {};
    try {
      const content = await fs.readFile(this.clientsFile, 'utf-8');
      clients = JSON.parse(content) as ClientRecord;
    } catch {
      // File doesn't exist
    }
    clients[this.clientId] = process.pid;
    await fs.writeFile(this.clientsFile, JSON.stringify(clients, null, 2), 'utf-8');
    this.log(`Registered client ${this.clientId}`);
  }

  private async unregisterClient(): Promise<void> {
    try {
      const content = await fs.readFile(this.clientsFile, 'utf-8');
      const clients = JSON.parse(content) as ClientRecord;
      delete clients[this.clientId];
      if (Object.keys(clients).length > 0) {
        await fs.writeFile(this.clientsFile, JSON.stringify(clients, null, 2), 'utf-8');
        this.log(`Unregistered client ${this.clientId}, ${Object.keys(clients).length} clients remaining`);
      } else {
        await fs.unlink(this.clientsFile).catch(() => {});
        await fs.unlink(this.pidFile).catch(() => {});
        this.log('Last client unregistered, cleaned up daemon files');
      }
    } catch (error) {
      this.log('Error unregistering client:', error);
    }
  }

  private async getRemainingClientCount(): Promise<number> {
    try {
      const content = await fs.readFile(this.clientsFile, 'utf-8');
      const clients = JSON.parse(content) as ClientRecord;
      const aliveClients: ClientRecord = {};
      for (const [id, pid] of Object.entries(clients)) {
        try {
          process.kill(pid, 0);
          aliveClients[id] = pid;
        } catch {
          // Process is dead
        }
      }
      if (Object.keys(aliveClients).length !== Object.keys(clients).length) {
        if (Object.keys(aliveClients).length > 0) {
          await fs.writeFile(this.clientsFile, JSON.stringify(aliveClients, null, 2), 'utf-8');
        } else {
          await fs.unlink(this.clientsFile).catch(() => {});
        }
      }
      return Object.keys(aliveClients).length;
    } catch {
      return 0;
    }
  }

  private async writePidFile(): Promise<void> {
    await fs.mkdir(this.config.daemonDir, { recursive: true });
    await fs.writeFile(this.pidFile, process.pid.toString(), 'utf-8');
    this.log(`Wrote PID file: ${process.pid}`);
  }

  private setupCleanupHandlers(): void {
    const cleanup = async () => {
      this.log('Cleaning up...');
      for (const handler of this.cleanupHandlers) {
        try {
          await handler();
        } catch (error) {
          this.log('Error in cleanup handler:', error);
        }
      }
      await this.unregisterClient();
      if (this.server) {
        const clientCount = await this.getRemainingClientCount();
        if (clientCount === 0) {
          this.log('No clients remaining, shutting down server');
          await new Promise<void>((resolve) => {
            this.server?.close(() => resolve());
          });
        } else {
          this.log(`${clientCount} clients still active, keeping server alive`);
        }
      }
    };
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
    for (const signal of signals) {
      process.on(signal, async () => {
        this.log(`Received ${signal}`);
        await cleanup();
        process.exit(0);
      });
    }
    process.on('uncaughtException', async (error) => {
      this.log('Uncaught exception:', error);
      await cleanup();
      process.exit(1);
    });
    process.on('unhandledRejection', async (reason) => {
      this.log('Unhandled rejection:', reason);
      await cleanup();
      process.exit(1);
    });
  }

  async start(app: Application): Promise<DaemonStartResult> {
    await this.registerClient();
    const portInUse = await this.isPortInUse();
    if (portInUse) {
      const info = await this.readDaemonInfo();
      if (info) {
        this.log('Connecting to existing server');
        this.setupCleanupHandlers();
        return {
          isMainProcess: false,
          info: { ...info, clientCount: await this.getRemainingClientCount() }
        };
      }
      throw new Error(`Port ${this.config.port} is already in use by another process (not an MCP daemon)`);
    }
    this.log('Starting new server');
    await this.writePidFile();
    const server = createServer(app);
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.config.port, this.config.host, () => {
        this.log(`Server listening on ${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
    this.setupCleanupHandlers();
    return {
      isMainProcess: true,
      server,
      info: {
        pid: process.pid,
        port: this.config.port,
        startedAt: Date.now(),
        clientCount: await this.getRemainingClientCount()
      }
    };
  }

  onCleanup(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  async stop(): Promise<void> {
    await this.unregisterClient();
    if (this.server) {
      const clientCount = await this.getRemainingClientCount();
      if (clientCount === 0) {
        this.log('Stopping server');
        await new Promise<void>((resolve) => {
          this.server?.close(() => resolve());
        });
      }
    }
  }
}
