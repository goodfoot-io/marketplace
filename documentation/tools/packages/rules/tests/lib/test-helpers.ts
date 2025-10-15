import type { RuleViolation } from '../../src/types.js';
import type { Socket } from 'net';
import fs from 'fs/promises';
import http from 'http';
import { join } from 'path';
import express, { Express, Request, Response } from 'express';

/**
 * Helper to find a violation by code
 */
export function findViolation(violations: RuleViolation[] | null, code: string): RuleViolation | undefined {
  return violations?.find((v) => v.code === code);
}

/**
 * Helper to find violations by location pattern
 */
export function findViolationsByLocation(
  violations: RuleViolation[] | null,
  pattern: string | RegExp
): RuleViolation[] {
  if (!violations) return [];

  if (typeof pattern === 'string') {
    return violations.filter((v) => v.location.includes(pattern));
  } else {
    return violations.filter((v) => pattern.test(v.location));
  }
}

/**
 * Helper to check if violations contain expected locations
 */
export function expectViolationLocations(violations: RuleViolation[] | null, expectedPaths: string[]) {
  const actualPaths = violations?.map((v) => v.location) || [];
  const violationPaths = actualPaths.filter((path) => expectedPaths.includes(path));
  expect(violationPaths).toEqual(expect.arrayContaining(expectedPaths));
}

/**
 * Helper to check violation properties
 */
export function expectViolation(violation: RuleViolation | undefined, expected: Partial<RuleViolation>): void {
  expect(violation).toBeDefined();
  if (violation) {
    if (expected.code !== undefined) expect(violation.code).toBe(expected.code);
    if (expected.title !== undefined) expect(violation.title).toBe(expected.title);
    if (expected.description !== undefined) expect(violation.description).toBe(expected.description);
    if (expected.location !== undefined) expect(violation.location).toBe(expected.location);
    if (expected.severity !== undefined) expect(violation.severity).toBe(expected.severity);
  }
}

/**
 * Creates default status file content
 */
export function createStatusContent(state: string = 'drafting'): string {
  return `state: ${state}
created: 2025-01-10T10:00:00Z
assigned_to: writer-specialist
current_phase: ${state}`;
}

/**
 * Creates default blackboard content
 */
export function createBlackboardContent(): string {
  return `project_metadata:
  primary_topic: test
  latest_version: 2501130945-initial
  latest_file: essay/2501130945-initial/essay.md

shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []

agent_activity:
  active_agents: []
  
specialist_requests:
  pending: []
  completed: []`;
}

/**
 * Creates frontmatter for feedback files
 */
export function createFeedbackFrontmatter(specialist: string, version: string = 'current'): string {
  return `---
specialist: ${specialist}
story_slug: test-story
timestamp: 2025-01-10T10:00:00Z
version: ${version}
overall_effectiveness: good
---

# Performance Feedback - ${specialist}

Test feedback content.`;
}

/**
 * Creates review metadata content
 */
export function createReviewMetadata(version: string, reviewType: string, specialist: string): string {
  return `---
version: ${version}
review_type: ${reviewType}
completed: 2025-01-12T10:00:00Z
specialist: ${specialist}
---

# Review Metadata - ${version} ${reviewType}

Test review metadata.`;
}

/**
 * Creates a source file with proper attribution
 */
export function createSourceFileContent(
  url: string = 'https://example.com/article',
  includeDate: boolean = true
): string {
  return `# Test Source Document

Source: ${url}
${includeDate ? 'Date Accessed: 2025-01-10' : ''}
Original Publication: Example Journal, 2025

This is test content for a source file.`;
}

/**
 * Creates a version file content
 */
export function createVersionContent(version: number = 1): string {
  return `# Version ${version}

This is version ${version} of the story.

## Changes
- Test change 1
- Test change 2`;
}

/**
 * Helper to create multiple violations at once
 */
export function expectViolationCodes(violations: RuleViolation[] | null, expectedCodes: string[]): void {
  const actualCodes = violations?.map((v) => v.code) || [];
  expect(actualCodes.sort()).toEqual(expectedCodes.sort());
}

/**
 * Helper to check if all violations have a specific property
 */
export function expectAllViolations(violations: RuleViolation[] | null, check: Partial<RuleViolation>): void {
  expect(violations).not.toBeNull();
  violations?.forEach((v) => {
    if (check.code !== undefined) expect(v.code).toBe(check.code);
    if (check.severity !== undefined) expect(v.severity).toBe(check.severity);
  });
}

/**
 * Creates invalid status content with missing fields
 */
export function createIncompleteStatusContent(includeState: boolean = true, includeCreated: boolean = true): string {
  const lines: string[] = [];
  if (includeState) lines.push('state: drafting');
  if (includeCreated) lines.push('created: 2025-01-10T10:00:00Z');
  return lines.join('\n');
}

/**
 * Creates status content with invalid date
 */
export function createStatusContentWithInvalidDate(): string {
  return `state: drafting
created: 2025-01-10 10:00:00
assigned_to: writer-specialist`;
}

/**
 * Creates frontmatter with missing fields
 */
export function createIncompleteFrontmatter(data: Record<string, unknown>): string {
  let frontmatter = '---\n';
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      frontmatter += `${key}:\n`;
      for (const item of value) {
        frontmatter += `  - ${item}\n`;
      }
    } else {
      frontmatter += `${key}: ${String(value)}\n`;
    }
  }
  frontmatter += '---\n\n';
  return frontmatter;
}

export async function createStory(
  workspacePath: string,
  rootDir: 'active' | 'published' | 'archive',
  storySlug: string
): Promise<void> {
  const storyPath = join(workspacePath, rootDir, storySlug);
  await fs.mkdir(storyPath, { recursive: true });
}

export async function cleanupTestWorkspace(workspacePath: string): Promise<void> {
  if (!workspacePath.includes('test-workspace')) {
    throw new Error('Refusing to clean up non-test workspace');
  }
  try {
    await fs.rm(workspacePath, { recursive: true, force: true });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error cleaning up test workspace: ${error.message}`);
    } else {
      console.error('An unknown error occurred during workspace cleanup');
    }
  }
}

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
