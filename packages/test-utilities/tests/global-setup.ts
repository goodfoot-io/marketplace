import type { TestProject } from 'vitest/node';
import { setupNeeded } from '@goodfoot/vitest-cache/plan';
import setup from '../src/vitest-global-setup.js';

export default async function globalSetup(project: TestProject) {
  if (!setupNeeded(project, (file) => file.endsWith('/tests/database-cleanup.test.ts'))) return;
  return setup(project);
}
