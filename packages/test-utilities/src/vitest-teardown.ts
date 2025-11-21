import PQueue from 'p-queue';

// Type declaration for Vitest's global expect - allows other packages to compile this file
declare const expect: {
  getState?: () => { currentTestName?: string };
};

export const teardownQueue: PQueue = new PQueue({ concurrency: 1, autoStart: false });

export const TEARDOWN = 'TEARDOWN';

const queueMap = new Map<string, PQueue>();

const stackMap = new Map<Parameters<typeof teardownQueue.add>[0], string>();

const originalAdd = teardownQueue.add.bind(teardownQueue);

export function addToTestQueue(
  testName: string,
  func: Parameters<typeof PQueue.prototype.add>[0],
  options?: Parameters<typeof PQueue.prototype.add>[1]
) {
  const queue = queueMap.get(testName);
  if (queue) {
    return queue.add(func, options);
  }
  const newQueue = new PQueue({ concurrency: 1, autoStart: false });
  queueMap.set(testName, newQueue);
  const promise = newQueue.add(func, options);
  void newQueue.onIdle().finally(() => {
    queueMap.delete(testName);
  });
  return promise;
}

teardownQueue.on('error', (error) => {
  console.error(error);
});

teardownQueue.add = async <TaskResultType>(
  task: Parameters<typeof teardownQueue.add<TaskResultType>>[0],
  options?: Parameters<typeof teardownQueue.add<TaskResultType>>[1]
): Promise<TaskResultType> => {
  const stack = (new Error().stack as string).split('\n').slice(2).join('\n');
  stackMap.set(task, stack);
  if (typeof expect.getState === 'function') {
    try {
      const testName = expect.getState().currentTestName;
      if (testName && options?.id !== 'global-teardown') {
        return (addToTestQueue(testName, task, options) as Promise<TaskResultType>)
          .then((result) => {
            stackMap.delete(task);
            return result;
          })
          .catch((error) => {
            if (error instanceof Error) {
              error.stack = `${error.stack}\n${stackMap.get(task)}`
                .split('\n')
                .filter((line) => !line.includes('processTicksAndRejections'))
                .join('\n');
            }
            console.error(task.toString());
            throw error;
          });
      }
    } catch (error) {
      console.error(error);
    }
  }
  return (originalAdd(task, options))
    .then((result) => {
      stackMap.delete(task);
      return result;
    })
    .catch((error) => {
      console.error(task.toString());
      if (error instanceof Error) {
        error.stack = `${error.stack}\n${stackMap.get(task)}`
          .split('\n')
          .filter((line) => !line.includes('processTicksAndRejections'))
          .join('\n');
      }

      throw error;
    });
};

declare global {
  function startTeardownQueue(name?: string): Promise<void>;
}

globalThis.startTeardownQueue = async (name?: string) => {
  if (name) {
    const queue = queueMap.get(name);
    if (queue) {
      queue.start();
      await queue.onIdle();
    }
    return;
  }
  for (const queue of queueMap.values()) {
    queue.start();
  }
  await Promise.all([...queueMap.values()].map((queue) => queue.onIdle()));
  teardownQueue.start();
  await teardownQueue.onIdle();
};
