import type { EventMap, TypedEventEmitter, Unsubscribe } from "./types.js";

export class StrictEventEmitter<TEvents extends EventMap> implements TypedEventEmitter<TEvents> {
  readonly #handlers = new Map<keyof TEvents, Set<(event: TEvents[keyof TEvents]) => void>>();

  on<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): Unsubscribe {
    const handlers = this.#handlers.get(eventName) ?? new Set<(event: TEvents[keyof TEvents]) => void>();
    handlers.add(handler as (event: TEvents[keyof TEvents]) => void);
    this.#handlers.set(eventName, handlers);
    return () => this.off(eventName, handler);
  }

  once<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): Unsubscribe {
    const unsubscribe = this.on(eventName, (event) => {
      unsubscribe();
      handler(event);
    });
    return unsubscribe;
  }

  off<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): void {
    this.#handlers.get(eventName)?.delete(handler as (event: TEvents[keyof TEvents]) => void);
  }

  protected emit<K extends keyof TEvents>(eventName: K, event: TEvents[K]): void {
    const handlers = this.#handlers.get(eventName);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      handler(event);
    }
  }
}
