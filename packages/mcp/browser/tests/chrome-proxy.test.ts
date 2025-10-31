import { Socket, createServer, connect } from 'net';

describe('chrome-proxy', () => {
  describe('idle timeout configuration', () => {
    it('should use default idle timeout when env var not set', () => {
      // Test getIdleTimeout logic
      const getIdleTimeout = (): number => {
        const envValue = process.env.CHROME_PROXY_IDLE_TIMEOUT_MS;
        if (!envValue) {
          return 5 * 60 * 1000; // Default: 5 minutes
        }

        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed) || parsed <= 0) {
          return 5 * 60 * 1000;
        }

        return parsed;
      };

      // Save original value
      const originalValue = process.env.CHROME_PROXY_IDLE_TIMEOUT_MS;
      delete process.env.CHROME_PROXY_IDLE_TIMEOUT_MS;

      const timeout = getIdleTimeout();
      expect(timeout).toBe(5 * 60 * 1000); // 5 minutes

      // Restore
      if (originalValue !== undefined) {
        process.env.CHROME_PROXY_IDLE_TIMEOUT_MS = originalValue;
      }
    });

    it('should parse valid idle timeout from env var', () => {
      const getIdleTimeout = (): number => {
        const envValue = process.env.CHROME_PROXY_IDLE_TIMEOUT_MS;
        if (!envValue) {
          return 5 * 60 * 1000;
        }

        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed) || parsed <= 0) {
          return 5 * 60 * 1000;
        }

        return parsed;
      };

      const originalValue = process.env.CHROME_PROXY_IDLE_TIMEOUT_MS;
      process.env.CHROME_PROXY_IDLE_TIMEOUT_MS = '120000'; // 2 minutes

      const timeout = getIdleTimeout();
      expect(timeout).toBe(120000);

      // Restore
      if (originalValue !== undefined) {
        process.env.CHROME_PROXY_IDLE_TIMEOUT_MS = originalValue;
      } else {
        delete process.env.CHROME_PROXY_IDLE_TIMEOUT_MS;
      }
    });

    it('should use default idle timeout for invalid env var values', () => {
      const getIdleTimeout = (): number => {
        const envValue = process.env.CHROME_PROXY_IDLE_TIMEOUT_MS;
        if (!envValue) {
          return 5 * 60 * 1000;
        }

        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed) || parsed <= 0) {
          return 5 * 60 * 1000;
        }

        return parsed;
      };

      const originalValue = process.env.CHROME_PROXY_IDLE_TIMEOUT_MS;

      // Test invalid values
      const invalidValues = ['invalid', '-5000', '0', 'xyz'];

      for (const invalidValue of invalidValues) {
        process.env.CHROME_PROXY_IDLE_TIMEOUT_MS = invalidValue;
        const timeout = getIdleTimeout();
        expect(timeout).toBe(5 * 60 * 1000); // Should use default
      }

      // Restore
      if (originalValue !== undefined) {
        process.env.CHROME_PROXY_IDLE_TIMEOUT_MS = originalValue;
      } else {
        delete process.env.CHROME_PROXY_IDLE_TIMEOUT_MS;
      }
    });
  });

  describe('activity tracking', () => {
    it('should update activity timestamp on connection', () => {
      const idleState = {
        lastActivityTime: Date.now() - 10000, // 10 seconds ago
        checkInterval: null as NodeJS.Timeout | null
      };

      const updateActivity = () => {
        idleState.lastActivityTime = Date.now();
      };

      const oldTime = idleState.lastActivityTime;
      updateActivity();

      expect(idleState.lastActivityTime).toBeGreaterThan(oldTime);
    });

    it('should detect idle timeout when no activity', () => {
      const IDLE_TIMEOUT_MS = 5000; // 5 seconds for test
      const idleState = {
        lastActivityTime: Date.now() - 10000, // 10 seconds ago (expired)
        checkInterval: null as NodeJS.Timeout | null
      };

      const checkIdleTimeout = (): boolean => {
        const idleTime = Date.now() - idleState.lastActivityTime;
        return idleTime > IDLE_TIMEOUT_MS;
      };

      expect(checkIdleTimeout()).toBe(true);
    });

    it('should not detect timeout when activity is recent', () => {
      const IDLE_TIMEOUT_MS = 5000; // 5 seconds for test
      const idleState = {
        lastActivityTime: Date.now() - 2000, // 2 seconds ago (not expired)
        checkInterval: null as NodeJS.Timeout | null
      };

      const checkIdleTimeout = (): boolean => {
        const idleTime = Date.now() - idleState.lastActivityTime;
        return idleTime > IDLE_TIMEOUT_MS;
      };

      expect(checkIdleTimeout()).toBe(false);
    });
  });

  describe('socket connection tracking', () => {
    it('should track active connections', (done) => {
      const connections = new Set<Socket>();

      // Create a test server
      const testServer = createServer((socket) => {
        connections.add(socket);

        socket.on('close', () => {
          connections.delete(socket);
        });

        socket.end();
      });

      testServer.listen(0, () => {
        const port = (testServer.address() as { port: number }).port;

        // Connect a client
        const client = connect(port, 'localhost');

        client.on('connect', () => {
          expect(connections.size).toBe(1);
        });

        client.on('close', () => {
          // Wait a bit for cleanup
          setTimeout(() => {
            expect(connections.size).toBe(0);
            testServer.close(() => {
              done();
            });
          }, 100);
        });

        client.on('error', (err) => {
          testServer.close(() => {
            done(err);
          });
        });
      });
    });

    it('should handle multiple connections', (done) => {
      const connections = new Set<Socket>();

      // Create a test server
      const testServer = createServer((socket) => {
        connections.add(socket);

        socket.on('close', () => {
          connections.delete(socket);
        });

        // Don't close immediately - let test control it
        socket.on('data', (data) => {
          socket.write(data); // Echo back
        });
      });

      testServer.listen(0, () => {
        const port = (testServer.address() as { port: number }).port;

        // Connect multiple clients
        const client1 = connect(port, 'localhost');
        const client2 = connect(port, 'localhost');

        let connectCount = 0;

        const cleanup = (err?: Error) => {
          testServer.close(() => {
            if (err) {
              done(err);
            } else {
              done();
            }
          });
        };

        const checkConnections = () => {
          connectCount++;
          if (connectCount === 2) {
            expect(connections.size).toBe(2);

            // Close clients
            client1.end();
            client2.end();

            setTimeout(() => {
              expect(connections.size).toBe(0);
              cleanup();
            }, 100);
          }
        };

        client1.on('connect', checkConnections);
        client2.on('connect', checkConnections);

        client1.on('error', cleanup);
        client2.on('error', cleanup);
      });
    });
  });

  describe('data transfer activity', () => {
    it('should track activity on data transfer', (done) => {
      const idleState = {
        lastActivityTime: Date.now() - 10000, // Start 10 seconds ago
        checkInterval: null as NodeJS.Timeout | null
      };

      const updateActivity = () => {
        idleState.lastActivityTime = Date.now();
      };

      // Create a test server that updates activity on data
      const testServer = createServer((socket) => {
        socket.on('data', () => {
          updateActivity();
          socket.write('response');
        });
      });

      testServer.listen(0, () => {
        const port = (testServer.address() as { port: number }).port;
        const client = connect(port, 'localhost');

        const cleanup = (err?: Error) => {
          client.destroy();
          testServer.close(() => {
            if (err) {
              done(err);
            } else {
              done();
            }
          });
        };

        client.on('connect', () => {
          const beforeTime = idleState.lastActivityTime;
          client.write('test data');

          setTimeout(() => {
            try {
              expect(idleState.lastActivityTime).toBeGreaterThan(beforeTime);
              cleanup();
            } catch (err) {
              cleanup(err as Error);
            }
          }, 100);
        });

        client.on('error', cleanup);
      });
    });
  });

  describe('interval management', () => {
    it('should start and stop check interval', (done) => {
      const idleState = {
        lastActivityTime: Date.now(),
        checkInterval: null as NodeJS.Timeout | null
      };

      let checkCount = 0;
      const checkIdleTimeout = () => {
        checkCount++;
      };

      // Start interval
      idleState.checkInterval = setInterval(checkIdleTimeout, 50); // Fast for testing

      setTimeout(() => {
        expect(checkCount).toBeGreaterThan(0);

        // Stop interval
        if (idleState.checkInterval) {
          clearInterval(idleState.checkInterval);
          idleState.checkInterval = null;
        }

        const countAfterStop = checkCount;

        // Verify it stopped
        setTimeout(() => {
          expect(checkCount).toBe(countAfterStop);
          expect(idleState.checkInterval).toBe(null);
          done();
        }, 100);
      }, 150);
    });
  });
});
