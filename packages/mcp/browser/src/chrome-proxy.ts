#!/usr/bin/env node

import { spawn, ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createServer, Socket, connect } from 'node:net';
import * as logger from './logger.js';

const LISTEN_PORT = process.env.LISTEN_PORT ? parseInt(process.env.LISTEN_PORT, 10) : 9222;
const CHROME_DEBUG_PORT = process.env.CHROME_DEBUG_PORT ? parseInt(process.env.CHROME_DEBUG_PORT, 10) : 9223;
const CHROME_USER_DATA_DIR = process.env.CHROME_USER_DATA_DIR || `/tmp/chrome-rdp-${CHROME_DEBUG_PORT}`;
const CHROME_SOCKET_TIMEOUT_MS = process.env.CHROME_SOCKET_TIMEOUT_MS
  ? parseInt(process.env.CHROME_SOCKET_TIMEOUT_MS, 10)
  : 10000; // 10 second default timeout for Chrome socket connection

// Parse idle timeout from environment variable (default: 5 minutes)
function getIdleTimeout(): number {
  const envValue = process.env.CHROME_PROXY_IDLE_TIMEOUT_MS;
  if (!envValue) {
    return 5 * 60 * 1000; // Default: 5 minutes
  }

  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed) || parsed <= 0) {
    logger.warn(`Invalid CHROME_PROXY_IDLE_TIMEOUT_MS value: ${envValue}. Using default 5 minutes.`);
    return 5 * 60 * 1000;
  }

  return parsed;
}

const IDLE_TIMEOUT_MS = getIdleTimeout();

let chromeProcess: ChildProcess | null = null;

// Idle timeout tracking state
const idleState = {
  lastActivityTime: Date.now(),
  checkInterval: null as NodeJS.Timeout | null
};

/**
 * Check if a port is open
 */
function checkPort(port: number, host = 'localhost'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, host);

    socket.on('connect', () => {
      socket.end();
      resolve(true);
    });

    socket.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Launch Chrome with remote debugging enabled
 */
function launchChrome(): void {
  if (chromeProcess) {
    logger.info('Chrome already running');
    return;
  }

  logger.info(`Launching Chrome on port ${CHROME_DEBUG_PORT}...`);

  chromeProcess = spawn(
    'open',
    [
      '-n',
      '-a',
      'Google Chrome',
      '--args',
      `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
      `--user-data-dir=${CHROME_USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check'
    ],
    {
      stdio: 'inherit'
    }
  );

  chromeProcess.on('error', (err) => {
    logger.error('Failed to launch Chrome:', err);
    chromeProcess = null;
  });

  chromeProcess.on('exit', (code) => {
    logger.info(`Chrome exited with code ${code}`);
    chromeProcess = null;
  });
}

/**
 * Wait for Chrome to be ready by checking if the port is open and responding
 */
async function waitForChrome(maxWaitMs = 5000): Promise<void> {
  const startTime = Date.now();
  const checkInterval = 100;

  while (Date.now() - startTime < maxWaitMs) {
    const isOpen = await checkPort(CHROME_DEBUG_PORT);

    if (isOpen) {
      // Verify Chrome is actually responding by checking the /json/version endpoint
      try {
        const response = await fetch(`http://localhost:${CHROME_DEBUG_PORT}/json/version`, {
          signal: AbortSignal.timeout(1000)
        });
        if (response.ok) {
          logger.info(`Chrome port ${CHROME_DEBUG_PORT} is ready and responding`);
          return;
        }
      } catch {
        // Chrome port is open but not responding yet, continue waiting
      }
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  throw new Error(`Chrome failed to be ready on port ${CHROME_DEBUG_PORT} within ${maxWaitMs}ms`);
}

/**
 * Update the last activity timestamp
 */
function updateActivity(): void {
  idleState.lastActivityTime = Date.now();
}

/**
 * Check for idle timeout and shutdown if no activity
 */
function checkIdleTimeout(): void {
  const idleTime = Date.now() - idleState.lastActivityTime;

  if (idleTime > IDLE_TIMEOUT_MS) {
    logger.info(`No activity for ${Math.floor(idleTime / 1000)}s - shutting down due to idle timeout`);

    // Clear the interval
    if (idleState.checkInterval) {
      clearInterval(idleState.checkInterval);
      idleState.checkInterval = null;
    }

    // Close all connections
    for (const socket of connections) {
      socket.destroy();
    }

    // Kill Chrome process
    if (chromeProcess) {
      chromeProcess.kill();
      chromeProcess = null;
    }

    // Close server
    server.close(() => {
      logger.info('Server closed due to idle timeout');
      process.exit(0);
    });

    // Force exit after 2 seconds if server doesn't close gracefully
    setTimeout(() => {
      logger.info('Forcing exit after idle timeout...');
      process.exit(0);
    }, 2000);
  }
}

/**
 * Create the TCP server that proxies to Chrome
 */
const server = createServer(async (clientSocket) => {
  let chromeSocket: Socket | null = null;

  try {
    // Update activity on new connection
    updateActivity();

    // Check if Chrome port is already open
    const isPortOpen = await checkPort(CHROME_DEBUG_PORT);

    // Launch Chrome only if port is not already in use
    if (!isPortOpen) {
      if (!chromeProcess) {
        launchChrome();
      }
      await waitForChrome();
    }

    // Create connection to Chrome
    logger.info(`Client connected, establishing connection to Chrome on port ${CHROME_DEBUG_PORT}`);
    chromeSocket = connect(CHROME_DEBUG_PORT, 'localhost');

    // Set connection timeout on the socket
    chromeSocket.setTimeout(CHROME_SOCKET_TIMEOUT_MS);

    // Set up error handlers before connect event
    chromeSocket.on('error', (err) => {
      logger.error('Chrome connection error:', err);
      if (!clientSocket.destroyed) {
        clientSocket.end();
      }
    });

    chromeSocket.on('timeout', () => {
      logger.error(`Chrome socket timeout after ${CHROME_SOCKET_TIMEOUT_MS}ms`);
      if (chromeSocket && !chromeSocket.destroyed) {
        chromeSocket.destroy();
      }
      if (!clientSocket.destroyed) {
        clientSocket.end();
      }
    });

    clientSocket.on('error', (err) => {
      logger.error('Client socket error:', err);
      if (chromeSocket && !chromeSocket.destroyed) {
        chromeSocket.end();
      }
    });

    // Wait for chrome socket to be ready before piping
    await new Promise<void>((resolve, reject) => {
      if (!chromeSocket) {
        reject(new Error('Chrome socket not initialized'));
        return;
      }

      chromeSocket.once('connect', () => {
        logger.info('Chrome socket connected successfully');
        resolve();
      });

      chromeSocket.once('error', (err) => {
        logger.error('Chrome socket connection error during handshake:', err);
        reject(err);
      });

      chromeSocket.once('timeout', () => {
        const err = new Error(`Chrome socket connection timeout after ${CHROME_SOCKET_TIMEOUT_MS}ms`);
        logger.error(err.message);
        reject(err);
      });

      // Timeout handler for the promise
      const timeout = setTimeout(() => {
        reject(new Error(`Chrome socket connection timeout after ${CHROME_SOCKET_TIMEOUT_MS}ms`));
      }, CHROME_SOCKET_TIMEOUT_MS);

      chromeSocket.once('connect', () => {
        clearTimeout(timeout);
      });

      chromeSocket.once('error', () => {
        clearTimeout(timeout);
      });

      chromeSocket.once('timeout', () => {
        clearTimeout(timeout);
      });
    });

    // Now that Chrome is connected, set up bidirectional piping
    logger.info('Setting up bidirectional pipe between client and Chrome');

    // Remove the timeout once connected, as we'll track activity instead
    chromeSocket.setTimeout(0);

    clientSocket.pipe(chromeSocket);
    chromeSocket.pipe(clientSocket);

    // Update activity on data transfer
    clientSocket.on('data', () => {
      updateActivity();
    });

    chromeSocket.on('data', () => {
      updateActivity();
    });

    chromeSocket.on('close', () => {
      if (!clientSocket.destroyed) {
        clientSocket.end();
      }
    });

    clientSocket.on('close', () => {
      if (chromeSocket && !chromeSocket.destroyed) {
        chromeSocket.end();
      }
    });
  } catch (err) {
    logger.error('Connection error:', err);
    if (chromeSocket && !chromeSocket.destroyed) {
      chromeSocket.destroy();
    }
    if (!clientSocket.destroyed) {
      clientSocket.end();
    }
  }
});

server.listen(LISTEN_PORT, () => {
  logger.info(`Chrome proxy server listening on port ${LISTEN_PORT}`);
  logger.info(`Will forward to Chrome on port ${CHROME_DEBUG_PORT}`);
  logger.info(`Chrome user data dir: ${CHROME_USER_DATA_DIR}`);
  logger.info(`Chrome socket timeout: ${CHROME_SOCKET_TIMEOUT_MS}ms`);
  logger.info(`Idle timeout: ${IDLE_TIMEOUT_MS}ms (${Math.floor(IDLE_TIMEOUT_MS / 60000)} minutes)`);

  // Start idle timeout checker
  idleState.checkInterval = setInterval(checkIdleTimeout, 30000); // Check every 30 seconds
});

// Track active connections
const connections = new Set<Socket>();

server.on('connection', (socket) => {
  connections.add(socket);
  socket.on('close', () => {
    connections.delete(socket);
  });
});

// Cleanup on exit
process.on('SIGINT', () => {
  logger.info('\nShutting down...');

  // Clear idle check interval
  if (idleState.checkInterval) {
    clearInterval(idleState.checkInterval);
    idleState.checkInterval = null;
  }

  // Close all active connections
  for (const socket of connections) {
    socket.destroy();
  }

  // Kill Chrome process
  if (chromeProcess) {
    chromeProcess.kill();
  }

  // Close server with timeout
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force exit after 2 seconds if server doesn't close gracefully
  setTimeout(() => {
    logger.info('Forcing exit...');
    process.exit(0);
  }, 2000);
});

// Auto-start when invoked directly
// Resolve symlinks to handle npx execution where argv[1] points to npx cache
const resolveFileUrl = async (filePath: string): Promise<string> => {
  try {
    const resolved = await fs.realpath(filePath);
    return `file://${resolved}`;
  } catch {
    return `file://${filePath}`;
  }
};

const currentFileUrl = import.meta.url;
const argvFileUrl = await resolveFileUrl(process.argv[1]);

if (currentFileUrl === argvFileUrl) {
  // Server is already set up and listening above
  logger.info('Chrome proxy is running. Press Ctrl+C to exit.');
}
