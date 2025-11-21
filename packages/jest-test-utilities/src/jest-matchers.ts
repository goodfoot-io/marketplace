import type EventEmitter from 'events';
import type { MatcherContext } from 'expect';
import { iterableEquality, equals } from '@jest/expect-utils';
import { expect } from '@jest/globals';
import prettier from '@prettier/sync';
import {
  MatcherHintOptions,
  matcherHint,
  printDiffOrStringify,
  printExpected,
  printReceived,
  stringify,
  diff
} from 'jest-matcher-utils';
import { tsStringIsEqual } from './lib/typescript.js';

function unorderedArrayEquality(this: MatcherContext, a: unknown, b: unknown): boolean | undefined {
  const equals = this.equals;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    const bCopy = Array.from(b) as unknown[];
    for (const itemA of a) {
      const index = bCopy.findIndex((itemB) => equals(itemA, itemB, [unorderedArrayEquality.bind(this)]));
      if (index === -1) {
        return false;
      }
      bCopy.splice(index, 1);
    }
    return true;
  }

  // Let Jest handle other types (objects, primitives, asymmetric matchers)
  return undefined;
}

const isExpand = (expand?: boolean): boolean => expand !== false;

const EXPECTED_LABEL = 'Expected';
const RECEIVED_LABEL = 'Received';

expect.extend({
  toEmit<T>(emitter: EventEmitter, eventName: string, expected?: T, timeoutInterval: number = 30000) {
    const matcherName = 'toEmit';
    const options: MatcherHintOptions = {
      comment: 'deep equality'
    };

    return new Promise((resolve) => {
      let initialReceived: unknown = undefined;
      const handler = (received: T) => {
        if (typeof expected === 'undefined') {
          const message = () =>
            matcherHint(matcherName, undefined, undefined, options) +
            '\n\n' +
            `Expected: not ${printExpected(expected)}\n` +
            `Received:     ${printReceived(received)}`;
          clearTimeout(timeout);
          emitter.removeListener(eventName, handler);
          resolve({ message, pass: true });
          return;
        }
        const pass = equals(received, expected, [iterableEquality]);
        if (!pass) {
          if (typeof initialReceived === 'undefined') {
            initialReceived = received;
          }
          return;
        }
        const message = () =>
          matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `Expected: not ${printExpected(expected)}\n` +
          (stringify(expected) !== stringify(received) ? `Received:     ${printReceived(received)}` : '');
        clearTimeout(timeout);
        emitter.removeListener(eventName, handler);
        resolve({ message, pass });
      };
      const timeout = setTimeout(() => {
        emitter.removeListener(eventName, handler);
        if (typeof initialReceived === 'undefined') {
          return resolve({
            pass: false,
            message: () =>
              matcherHint(matcherName, undefined, undefined, options) +
              `\n\nexpected ${eventName} to be emitted in ${timeoutInterval}ms`
          });
        }
        resolve({
          pass: false,
          message: () =>
            matcherHint(matcherName, undefined, undefined, options) +
            '\n\n' +
            printDiffOrStringify(expected, initialReceived, EXPECTED_LABEL, RECEIVED_LABEL, isExpand(false))
        });
      }, timeoutInterval);
      emitter.addListener(eventName, handler);
    });
  },
  toEqualSorted(received: unknown, expected: unknown) {
    const pass = this.equals(received, expected, [unorderedArrayEquality.bind(this)]);

    const matcherName = 'toEqualUnordered';
    const options = {
      comment: 'deep equality while ignoring array order',
      isNot: this.isNot,
      promise: this.promise
    };

    const message = pass
      ? () =>
          `${matcherHint(matcherName, undefined, undefined, options)}\n\n` +
          `Expected: not ${printExpected(expected)}\n` +
          `Received: ${printReceived(received)}`
      : () => {
          const diffString = diff(expected, received, {
            expand: this.expand,
            aAnnotation: 'Expected',
            bAnnotation: 'Received'
          });

          return (
            `${matcherHint(matcherName, undefined, undefined, options)}\n\n` +
            `Expected: ${printExpected(expected)}\n` +
            `Received: ${printReceived(received)}` +
            (diffString ? `\n\nDifference:\n\n${diffString}` : '')
          );
        };

    return { pass, message };
  },
  tsStringIsEqual(received: string, expected: string) {
    const pass = tsStringIsEqual(received, expected);
    const matcherName = 'tsStringIsEqual';
    const options = {
      comment: 'deep equality of TypeScript type strings'
    };
    const message = pass
      ? () =>
          `${matcherHint(matcherName, undefined, undefined, options)}\n\n` +
          `Expected: not ${printExpected(expected)}\n` +
          `Received: ${printReceived(received)}`
      : () => {
          const diffString = diff(
            prettier.format(`type Expected = ${expected}`, { parser: 'typescript' }),
            prettier.format(`type Received = ${received}`, { parser: 'typescript' }),
            {
              expand: this.expand,
              aAnnotation: 'Expected',
              bAnnotation: 'Received'
            }
          );

          return (
            `${matcherHint(matcherName, undefined, undefined, options)}\n\n` +
            `Expected: ${printExpected(prettier.format(`type Expected = ${expected}`, { parser: 'typescript' }))}\n` +
            `Received: ${printReceived(prettier.format(`type Received = ${received}`, { parser: 'typescript' }))}` +
            (diffString ? `\n\nDifference:\n\n${diffString}` : '')
          );
        };

    return { pass, message };
  }
});

declare global {
  // eslint-disable-next-line  @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEmit<T>(eventName: string, expected?: T, timeoutInterval?: number): Promise<R>;
      toEqualSorted(expected: unknown): R;
      tsStringIsEqual(expected: string): R;
    }
  }
}
