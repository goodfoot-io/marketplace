import type { JestEnvironmentConfig, EnvironmentContext } from '@jest/environment';
import type { Circus } from '@jest/types';
import { Script } from 'vm';
import { TestEnvironment } from 'jest-environment-node';


const script = new Script(`
  if(globalThis.startJestTeardownQueue) {
    globalThis.startJestTeardownQueue();
  }
`);

function getTestName(test: Circus.TestEntry | Circus.DescribeBlock, childTestName?: string) {
  const parent = test.parent;
  if(test.name === 'ROOT_DESCRIBE_BLOCK') {
    return childTestName;
  }
  const name = typeof childTestName === 'string' ? `${test.name} ${childTestName}` : test.name;
  if(parent) {
    return getTestName(parent, name);
  }
  return name;
}

class hotlineTestEnvironment extends TestEnvironment {
  constructor(config: JestEnvironmentConfig, _context: EnvironmentContext) {
    super(config, _context);
  }

  async setup() {
    await super.setup();
  }

  async teardown() {
    const context = this.context;
    if (context) {
      await script.runInContext(context);
    }
    await super.teardown();
  }

  async handleTestEvent(event: Circus.AsyncEvent) {
    if(event.name !== 'test_done') {
      return;
    }
    const testScript = new Script(`
      if(globalThis.startJestTeardownQueue) {
        globalThis.startJestTeardownQueue("${getTestName(event.test)}");
      }
    `);
    const context = this.context;
    if (context) {
      await testScript.runInContext(context);
    }
  }

  getVmContext() {
    return super.getVmContext();
  }
}

export default hotlineTestEnvironment;
