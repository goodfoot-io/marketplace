import '../src/jest-matchers.js';
import EventEmitter from 'events';

describe('expect(emitter).toEmit(name, value, timeout)', () => {
  test('Should pass if the value is emitted', async () => {
    const emitter = new EventEmitter();
    const name = Math.random().toString(36);
    const value = Math.random().toString(36);
    setImmediate(() => emitter.emit(name, value));
    await expect(emitter).toEmit(name, value, 50);
  });
  test('Should throw an assertion error if a value is not emitted', async () => {
    const emitter = new EventEmitter();
    const name = Math.random().toString(36);
    const value = Math.random().toString(36);
    await expect(expect(emitter).toEmit(name, value, 50)).rejects.toThrow();
  });
  test('Should throw an assertion error if an incorrect value is emitted', async () => {
    const emitter = new EventEmitter();
    const name = Math.random().toString(36);
    const valueA = Math.random().toString(36);
    const valueB = Math.random().toString(36);
    setImmediate(() => emitter.emit(name, valueA));
    await expect(expect(emitter).toEmit(name, valueB, 50)).rejects.toThrow();
  });
  test('Should pass if only the name is defined and any value is emitted', async () => {
    const emitter = new EventEmitter();
    const name = Math.random().toString(36);
    const value = Math.random().toString(36);
    setImmediate(() => emitter.emit(name, value));
    await expect(emitter).toEmit(name);
  });
  test('Should throw an assertion error if only the name is defined and a value is not emitted', async () => {
    const emitter = new EventEmitter();
    const name = Math.random().toString(36);
    await expect(expect(emitter).toEmit(name, undefined, 50)).rejects.toThrow();
  });
});
