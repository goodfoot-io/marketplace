import type { RunnerTask } from 'vitest';
import './vitest-teardown.js';
import './vitest-matchers.js';

declare global {
  function startTeardownQueue(name?: string): Promise<void>;
}

/**
 * Build full test name from task hierarchy
 * Constructs test names like "Test Suite parent test name"
 */
function buildFullTestName(task: RunnerTask): string | undefined {
  const parts: string[] = [];
  let current: RunnerTask | undefined = task;

  while (current) {
    if ((current.name && current.type !== 'suite') || (current.type === 'suite' && current.name)) {
      parts.unshift(current.name);
    }
    current = current.suite;
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Setup afterEach hook to trigger teardown queue for each test
 * Uses Vitest task context API to get test name and invoke teardown
 */
afterEach(async (context) => {
  if (context && 'task' in context && context.task?.type === 'test') {
    const testName = buildFullTestName(context.task as RunnerTask);
    if (testName && globalThis.startTeardownQueue) {
      await globalThis.startTeardownQueue(testName);
    }
  }
});
