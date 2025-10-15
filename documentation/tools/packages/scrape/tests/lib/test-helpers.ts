import type { Socket } from 'net';
import http from 'http';
import express, { Express, Request, Response } from 'express';

export interface TestServer {
  app: Express;
  server: http.Server;
  url: string;
  close: () => Promise<void>;
}

export function createTestServer(): Promise<TestServer> {
  return new Promise((resolve) => {
    const app = express();
    app.get('/ok', (req: Request, res: Response) => {
      res.status(200).send('<h1>OK</h1>');
    });
    app.get('/redirect', (req: Request, res: Response) => {
      res.redirect(301, '/ok');
    });
    app.get('/not-found', (req: Request, res: Response) => {
      res.status(404).send('Not Found');
    });
    app.get('/server-error', (req: Request, res: Response) => {
      res.status(503).send('Service Unavailable');
    });

    const server = app.listen(0, () => {
      const address = server.address();
      if (typeof address === 'string' || !address) {
        throw new Error('Invalid server address');
      }
      const url = `http://localhost:${address.port}`;

      const sockets = new Set<Socket>();
      server.on('connection', (socket: Socket) => {
        sockets.add(socket);
        socket.on('close', () => {
          sockets.delete(socket);
        });
      });

      const close = () =>
        new Promise<void>((resolve, reject) => {
          for (const socket of sockets) {
            socket.destroy();
          }
          sockets.clear();

          server.close((err) => {
            if (err) return reject(err);
            resolve();
          });
        });

      resolve({ app, server, url, close });
    });
  });
}
